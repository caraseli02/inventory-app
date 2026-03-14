import { describe, expect, it } from 'vitest'

import {
  extractSearchCandidates,
  extractSearchCandidatesFromHistory,
  maybeHandleMenuSelection,
  maybeHandleOrderFollowup,
  maybeRepairOrderReply,
} from '../../lib/whatsapp/conversation'
import { processOrderIntent } from '../../lib/whatsapp/order-intent'
import { getInventorySummary, resolveOrderItems } from '../../lib/whatsapp/inventory'

type ProductRow = {
  id: string
  created_at: string
  name: string
  category: string | null
  price: number | null
  price_50: number | null
  price_70: number | null
  price_100: number | null
  markup: number | null
}

function createFakeSupabase(args: {
  productsByTerm: Record<string, ProductRow[]>
  fallbackProducts?: ProductRow[]
  movementsByProductId: Record<string, number>
}) {
  const fallbackProducts = args.fallbackProducts ?? []

  function createProductsQuery() {
    const filters: string[] = []
    const api = {
      select() {
        return api
      },
      ilike(_field: string, pattern: string) {
        const term = pattern.replace(/^%/, '').replace(/%$/, '')
        filters.push(term)
        return api
      },
      order() {
        return api
      },
      async limit() {
        if (filters.length === 0) return { data: fallbackProducts }
        if (filters.length > 1) return { data: [] }
        const term = filters[0] ?? ''
        return { data: args.productsByTerm[term] ?? [] }
      },
      eq() {
        return api
      },
      async maybeSingle() {
        return { data: null }
      },
    }

    return api
  }

  function createMovementsQuery() {
    const api = {
      select() {
        return api
      },
      in(_field: string, ids: string[]) {
        const data = ids.map((id) => ({
          product_id: id,
          quantity: args.movementsByProductId[id] ?? 0,
        }))
        return Promise.resolve({ data })
      },
    }
    return api
  }

  return {
    from(table: string) {
      if (table === 'products') return createProductsQuery()
      if (table === 'stock_movements') return createMovementsQuery()
      return createProductsQuery()
    },
  }
}

describe('WhatsApp inventory summary', () => {
  it('does not stack ilike filters across search candidates', async () => {
    const product: ProductRow = {
      id: 'p1',
      created_at: new Date('2026-03-05T12:00:00Z').toISOString(),
      name: '370G LAPTE CONDEN INTEG ICINEA',
      category: 'Dairy',
      price: 3.42,
      price_50: null,
      price_70: 3.42,
      price_100: null,
      markup: 70,
    }

    const sb = createFakeSupabase({
      productsByTerm: {
        foobarlonggg: [],
        condensat: [product],
        icinea: [],
      },
      fallbackProducts: [],
      movementsByProductId: {
        p1: 10,
      },
    }) as any

    const summary = await getInventorySummary(sb, {
      intent: 'product_query',
      text: 'vreau 1 FOOBARLONGGG condensat icinea',
    })

    expect(summary).toContain('LAPTE CONDEN INTEG ICINEA')
    expect(summary).toContain('€3.42')
    expect(summary).toContain('stoc: 10')
  })

  it('filters order-related words from search candidates', () => {
    const candidates = extractSearchCandidates('vreu sa comand 2 lapte pentru ora 18.30')
    expect(candidates).not.toContain('comand')
    expect(candidates).not.toContain('pentru')
    expect(candidates).not.toContain('ora')
    expect(candidates).not.toContain('ridic')
  })

  it('maps english milk to romanian lapte', () => {
    const candidates = extractSearchCandidates('hey, do you have milk for sale?')
    expect(candidates).toContain('lapte')
  })

  it('filters english filler words from search candidates', () => {
    const candidates = extractSearchCandidates('ok I will get 2')
    expect(candidates).not.toContain('will')
    expect(candidates).not.toContain('get')
    expect(candidates).not.toContain('ok')
  })

  it('reuses prior turn keywords when current message has no product term', () => {
    const history = [
      { role: 'assistant', content: 'We have condensed milk ICINEA', timestamp: 't1' },
      { role: 'user', content: 'hey, do you have milk for sale?', timestamp: 't2' },
    ]
    const candidates = extractSearchCandidatesFromHistory(history as any)
    expect(candidates).toContain('lapte')
  })

  it('also extracts product keywords from recent assistant messages (multi-turn context)', () => {
    // After our fix, assistant messages are included so confirmations like "da, ora 11"
    // can still find the product mentioned in the previous assistant turn.
    const history = [
      { role: 'user', content: 'aveti lapte?', timestamp: 't1' },
      { role: 'assistant', content: 'Da, avem lapte condensat integral de 370G.', timestamp: 't2' },
    ]
    const candidates = extractSearchCandidatesFromHistory(history as any)
    expect(candidates).toContain('lapte')
  })

  it('repairs missing ORDER line when user provides exact product + qty + pickup time', () => {
    const inventoryText = '• 370G LAPTE CONDEN INTEG ICINEA (Dairy) — €3.42, stoc: 24'
    const userText = 'vreu sa comand 2 de 370G LAPTE CONDEN INTEG ICINEA pentru ora 18.30'
    const replyText = 'Am notat comanda. Mulțumesc!'

    const repaired = maybeRepairOrderReply({
      replyText,
      userText,
      inventoryText,
      customerName: 'Test',
      customerPhone: '+40000000000',
    })

    expect(repaired.repairedOrder).toBe(true)
    expect(repaired.text).toContain('ORDER:')
    expect(repaired.text).toContain('370G LAPTE CONDEN INTEG ICINEA')
    expect(repaired.text).toContain('18:30')
  })

  it('does not repair an order from stale history alone on a fresh browse query', () => {
    const inventoryText = '• Carne Porc (Meat) — €8.50, stoc: 12'
    const replyText = 'Avem cateva produse disponibile:\n• Carne Porc (Meat) — €8.50, stoc: 12'

    const repaired = maybeRepairOrderReply({
      replyText,
      userText: 'Ce aveti de carne?',
      historyContext: 'vreau 1 370G LAPTE CONDEN INTEG ICINEA maine la 10.30',
      inventoryText,
      customerName: 'Test',
      customerPhone: '+40000000000',
    })

    expect(repaired.repairedOrder).toBe(false)
    expect(repaired.text).not.toContain('ORDER:')
  })

  it('asks to choose when followup has qty+time but no exact product and inventory has multiple options', () => {
    const inventoryText = [
      '• 370G LAPTE CONDEN INTEG ICINEA (Dairy) — €3.42, stoc: 24',
      '• 370G LAPTE CONDEN FIERT IRISK (Dairy) — €3.34, stoc: 30',
    ].join('\n')

    const followup = maybeHandleOrderFollowup({
      userText: 'da 2, sa ridic la 18.30',
      history: [],
      inventoryText,
      customerName: 'Test',
      customerPhone: '+40000000000',
    })

    expect(followup?.createdOrder).toBe(false)
    expect(followup?.text).toContain('Care anume?')
  })

  it('creates an order when user selects a menu option after qty+time followup', () => {
    const history = [
      { role: 'user', content: 'da 2, sa ridic la 18.30', timestamp: 't1' },
      {
        role: 'assistant',
        content: [
          'Am mai multe opțiuni în inventar. Care anume?',
          '1) 370G LAPTE CONDEN INTEG ICINEA',
          '2) 370G LAPTE CONDEN FIERT IRISK',
        ].join('\n'),
        timestamp: 't2',
      },
    ]

    const selection = maybeHandleMenuSelection({
      userText: '1',
      history: history as any,
      inventoryText: [
        '• 370G LAPTE CONDEN INTEG ICINEA (Dairy) — €3.42, stoc: 24',
        '• 370G LAPTE CONDEN FIERT IRISK (Dairy) — €3.34, stoc: 30',
      ].join('\n'),
      customerName: 'Test',
      customerPhone: '+40000000000',
    })

    expect(selection?.text).toContain('ORDER:')
    expect(selection?.text).toContain('370G LAPTE CONDEN INTEG ICINEA')
    expect(selection?.text).toContain('18:30')
  })

  it('does NOT create a multi-item order for "de cada" (repeatedQty path removed in PR 5a)', () => {
    const history = [
      {
        role: 'assistant',
        content: [
          '* 0.75L BACIO DI BOLLE D/SEC ALB — €8.27',
          '* 0.75L VIORICA ECO CRICOVA DEMI — €13.24',
          '',
          'Care te interesează?',
        ].join('\n'),
        timestamp: 't1',
      },
    ]

    const followup = maybeHandleOrderFollowup({
      userText: 'vreau 1 de cada pentru 19:00',
      history: history as any,
      inventoryText: '• 0.5L DIVIN AUTENTIC VSOP 5 ANI — €12.00, stoc: 5',
      customerName: 'Test',
      customerPhone: '+40000000000',
    })

    // repeatedQty multi-item path was removed — should not create a multi-item ORDER
    if (followup !== null) {
      expect(followup.createdOrder).toBe(false)
      if (followup.text.includes('ORDER:')) {
        const orderMatch = followup.text.match(/ORDER:(\{.*\})/s)
        if (orderMatch) {
          const parsed = JSON.parse(orderMatch[1]!)
          expect(parsed.items?.length ?? 0).toBeLessThanOrEqual(1)
        }
      }
    }
  })

  it('resolves assistant-style packaging suffixes back to canonical inventory names', async () => {
    const divin: ProductRow = {
      id: 'p-divin-1',
      created_at: new Date('2026-03-05T12:00:00Z').toISOString(),
      name: '0.5L DIVIN 5 ANI BARDAR SILVER',
      category: 'Wine',
      price: 10.35,
      price_50: null,
      price_70: 10.35,
      price_100: null,
      markup: 70,
    }

    const viorica: ProductRow = {
      id: 'p-viorica-1',
      created_at: new Date('2026-03-05T12:00:00Z').toISOString(),
      name: '0.75L VIORICA ECO CRICOVA DEMI',
      category: 'Wine',
      price: 13.24,
      price_50: null,
      price_70: 13.24,
      price_100: null,
      markup: 70,
    }

    const sb = createFakeSupabase({
      productsByTerm: {
        'DIVIN 5 ANI BARDAR SILVER (0.5L)': [],
        'DIVIN 5 ANI BARDAR SILVER': [divin],
        'VIORICA ECO CRICOVA (0.75L)': [],
        'VIORICA ECO CRICOVA': [viorica],
      },
      fallbackProducts: [],
      movementsByProductId: {
        'p-divin-1': 5,
        'p-viorica-1': 4,
      },
    }) as any

    const resolved = await resolveOrderItems(sb, [
      { name: 'DIVIN 5 ANI BARDAR SILVER (0.5L)', qty: 1, unit_price: 10.35 },
      { name: 'VIORICA ECO CRICOVA (0.75L)', qty: 1, unit_price: 13.24 },
    ])

    expect(resolved.items).toEqual([
      { product_id: 'p-divin-1', name: '0.5L DIVIN 5 ANI BARDAR SILVER', qty: 1, unit_price: 10.35 },
      { product_id: 'p-viorica-1', name: '0.75L VIORICA ECO CRICOVA DEMI', qty: 1, unit_price: 13.24 },
    ])
    expect(resolved.totalPrice).toBe(23.59)
  })

  it('resolves the phone flow labels back to canonical stock rows after pickup followup', async () => {
    const freedom: ProductRow = {
      id: 'p-freedom-1',
      created_at: new Date('2026-03-05T12:00:00Z').toISOString(),
      name: '0.75L FREEDOM BLEND PURCARI',
      category: 'Wine',
      price: 18.73,
      price_50: null,
      price_70: 18.73,
      price_100: null,
      markup: 70,
    }

    const chocolates: ProductRow = {
      id: 'p-choco-1',
      created_at: new Date('2026-03-05T12:00:00Z').toISOString(),
      name: 'BOMBOANE CIOCO 5 MINUTE 125G',
      category: 'Snacks',
      price: 2.57,
      price_50: null,
      price_70: 2.57,
      price_100: null,
      markup: 70,
    }

    const sb = createFakeSupabase({
      productsByTerm: {
        'FREEDOM BLEND PURCAR': [],
        'BOMBOANE CIOCO 5 MINUTE (125G) — €2.57': [],
        freedom: [freedom],
        blend: [freedom],
        purcar: [freedom],
        bomboane: [chocolates],
        minute: [chocolates],
        '125g': [chocolates],
      },
      fallbackProducts: [],
      movementsByProductId: {
        'p-freedom-1': 8,
        'p-choco-1': 15,
      },
    }) as any

    const result = await processOrderIntent(
      sb,
      [
        'Perfecto. Confirmo tu pedido:',
        '- 1x FREEDOM BLEND PURCAR (0.75L) — €18.73',
        '- 1x BOMBOANE CIOCO 5 MINUTE (125G) — €2.57',
        '*Total: €21.30*',
        '*Recogida: hoy jueves 12 de marzo a las 19:00*',
        'ORDER:{"customer_name":"Vlad","customer_phone":"+34000000000","items":[{"name":"FREEDOM BLEND PURCAR","qty":1,"unit_price":18.73},{"name":"BOMBOANE CIOCO 5 MINUTE (125G) — €2.57","qty":1,"unit_price":2.57}],"pickup_time":"azi 19:00"}',
      ].join('\n'),
    )

    expect(result.reply).not.toContain('⚠️ Nu am găsit')
    expect(result.pending?.items).toEqual([
      { product_id: 'p-freedom-1', name: '0.75L FREEDOM BLEND PURCARI', qty: 1, unit_price: 18.73 },
      { product_id: 'p-choco-1', name: 'BOMBOANE CIOCO 5 MINUTE 125G', qty: 1, unit_price: 2.57 },
    ])
    expect(result.pending?.total_price).toBe(21.3)
  })
})
