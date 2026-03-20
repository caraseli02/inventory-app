import { describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/whatsapp/conversation-state.js', () => ({
  appendHistory: vi.fn(async () => {}),
  getHistory: vi.fn(async () => []),
  getLanguage: vi.fn(async () => 'ro'),
  resetConversationHistory: vi.fn(async () => {}),
  setLanguage: vi.fn(async () => {}),
}))

import { runConversationTurn } from '../../lib/whatsapp/llm'
import { appendHistory } from '../../lib/whatsapp/conversation-state.js'

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

function likeToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*')
  return new RegExp(`^${escaped}$`, 'i')
}

function createFakeSupabase(args: {
  products: ProductRow[]
  stockByProductId: Record<string, number>
}) {
  function createProductsQuery() {
    let selectFields = ''
    const ilikes: Array<{ field: string; pattern: string }> = []
    const equals = new Map<string, unknown>()
    const sorters: Array<{ field: string; ascending?: boolean; nullsFirst?: boolean }> = []

    function project(row: Record<string, unknown>) {
      if (!selectFields) return row
      const out: Record<string, unknown> = {}
      for (const field of selectFields.split(',').map((value) => value.trim()).filter(Boolean)) {
        out[field] = row[field]
      }
      return out
    }

    function resolveRows(limit?: number) {
      let rows: Array<Record<string, unknown>> = [...args.products]

      for (const [field, value] of equals.entries()) {
        rows = rows.filter((row) => row[field] === value)
      }

      for (const filter of ilikes) {
        const regex = likeToRegex(filter.pattern)
        rows = rows.filter((row) => regex.test(String(row[filter.field] ?? '')))
      }

      if (sorters.length) {
        rows.sort((left, right) => {
          for (const sorter of sorters) {
            const a = left[sorter.field]
            const b = right[sorter.field]
            if (a == null || b == null) {
              if (a == null && b == null) continue
              const nullsFirst = sorter.nullsFirst ?? false
              return a == null ? (nullsFirst ? -1 : 1) : (nullsFirst ? 1 : -1)
            }
            const cmp = typeof a === 'number' && typeof b === 'number'
              ? a - b
              : String(a).localeCompare(String(b), 'ro')
            if (cmp !== 0) return sorter.ascending === false ? -cmp : cmp
          }
          return 0
        })
      }

      if (typeof limit === 'number') rows = rows.slice(0, limit)
      return rows.map(project)
    }

    const api = {
      select(fields: string) {
        selectFields = fields
        return api
      },
      ilike(field: string, pattern: string) {
        ilikes.push({ field, pattern })
        return api
      },
      eq(field: string, value: unknown) {
        equals.set(field, value)
        return api
      },
      order(field: string, options: { ascending?: boolean; nullsFirst?: boolean } = {}) {
        sorters.push({ field, ...options })
        return api
      },
      async limit(count: number) {
        return { data: resolveRows(count), error: null }
      },
      async maybeSingle() {
        return { data: resolveRows(1)[0] ?? null, error: null }
      },
    }

    return api
  }

  function createStockMovementsQuery() {
    const api = {
      select() {
        return api
      },
      async in(_field: string, ids: string[]) {
        return {
          data: ids.map((id) => ({ product_id: id, quantity: args.stockByProductId[id] ?? 0 })),
          error: null,
        }
      },
      async eq(_field: string, id: string) {
        return {
          data: [{ product_id: id, quantity: args.stockByProductId[id] ?? 0 }],
          error: null,
        }
      },
    }
    return api
  }

  return {
    from(table: string) {
      if (table === 'products') return createProductsQuery()
      if (table === 'stock_movements') return createStockMovementsQuery()
      return createProductsQuery()
    },
  }
}

describe('WhatsApp LLM inventory prompt', () => {
  const products: ProductRow[] = [
    {
      id: 'p-zahar-1',
      created_at: new Date('2026-03-01T12:00:00Z').toISOString(),
      name: 'Zahar Alb',
      category: 'Pantry',
      price: 2.1,
      price_50: null,
      price_70: 2.1,
      price_100: null,
      markup: 70,
    },
    {
      id: 'p-paine-1',
      created_at: new Date('2026-03-01T09:00:00Z').toISOString(),
      name: 'Paine Alba',
      category: 'Bakery',
      price: 1.2,
      price_50: null,
      price_70: 1.2,
      price_100: null,
      markup: 70,
    },
  ]

  const sb = createFakeSupabase({
    products,
    stockByProductId: { 'p-zahar-1': 12, 'p-paine-1': 20 },
  }) as any

  it('does not inject INVENTAR LIVE for non-local LLM providers', async () => {
    let seenSystem = ''
    const result = await runConversationTurn({
      sb,
      phone: '+40123456789',
      name: 'Test',
      text: 'zahar',
      llmProvider: 'openai',
      includeDebug: true,
      repairOrder: false,
      generateLlmReply: async ({ system }) => {
        seenSystem = system
        return 'Ok.'
      },
    })

    expect(seenSystem).not.toContain('INVENTAR LIVE:')
    expect(seenSystem).toContain('search_products')
    expect(result.debug?.inventoryText ?? 'missing').toBe('')
  })

  it('injects INVENTAR LIVE for the local simulator', async () => {
    let seenSystem = ''
    const result = await runConversationTurn({
      sb,
      phone: '+40123456789',
      name: 'Test',
      text: 'zahar',
      llmProvider: 'local',
      includeDebug: true,
      repairOrder: false,
      generateLlmReply: async ({ system }) => {
        seenSystem = system
        return 'Ok.'
      },
    })

    expect(seenSystem).toContain('INVENTAR LIVE:')
    expect(seenSystem).toContain('Zahar Alb')
    expect(result.debug?.inventoryText ?? '').toContain('Zahar Alb')
  })

  it('persists list-picker options to history (for numeric followups)', async () => {
    const milkProducts: ProductRow[] = [
      {
        id: 'p-lapte-1',
        created_at: new Date('2026-03-01T10:00:00Z').toISOString(),
        name: '370G LAPTE CONDEN INTEG ICINEA',
        category: 'Dairy',
        price: 3.42,
        price_50: null,
        price_70: 3.42,
        price_100: null,
        markup: 70,
      },
      {
        id: 'p-lapte-2',
        created_at: new Date('2026-03-02T10:00:00Z').toISOString(),
        name: '370G LAPTE CONDEN FIERT IRISK',
        category: 'Dairy',
        price: 3.34,
        price_50: null,
        price_70: 3.34,
        price_100: null,
        markup: 70,
      },
    ]

    const sb2 = createFakeSupabase({
      products: milkProducts,
      stockByProductId: { 'p-lapte-1': 24, 'p-lapte-2': 30 },
    }) as any

    const appendHistoryMock = appendHistory as unknown as {
      mock: { calls: unknown[][] }
      mockClear: () => void
    }
    appendHistoryMock.mockClear()

    const result = await runConversationTurn({
      sb: sb2,
      phone: '+40123456789',
      name: 'Test',
      text: 'Vreau 2 lapte maine 12:00',
      llmProvider: 'openai',
      includeDebug: false,
      repairOrder: false,
      generateLlmReply: async () => {
        throw new Error('LLM should not run for listPicker path')
      },
    })

    expect(result.listPicker?.length).toBe(2)
    expect(appendHistory).toHaveBeenCalledTimes(1)
    const args = appendHistoryMock.mock.calls[0] ?? []
    expect(JSON.stringify(args)).toContain('Care anume?')
    expect(JSON.stringify(args)).toContain('1)')
  })
})
