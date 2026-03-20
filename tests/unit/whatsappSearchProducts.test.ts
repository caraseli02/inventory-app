import { describe, expect, it } from 'vitest'

import { searchProducts } from '../../lib/whatsapp/inventory'

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
      for (const filter of ilikes) {
        const regex = likeToRegex(filter.pattern)
        rows = rows.filter((row) => regex.test(String(row[filter.field] ?? '')))
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
      async limit(count: number) {
        return { data: resolveRows(count), error: null }
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

describe('searchProducts', () => {
  it('expands english "milk" to romanian "lapte" server-side', async () => {
    const products: ProductRow[] = [
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
    ]

    const sb = createFakeSupabase({
      products,
      stockByProductId: { 'p-lapte-1': 24 },
    }) as any

    const result = await searchProducts(sb, { query: 'milk', limit: 5 })
    expect(result.length).toBeGreaterThan(0)
    expect(result[0]!.name).toContain('LAPTE')
    expect(result[0]!.currentStock).toBe(24)
  })

  it('clamps invalid limit inputs safely', async () => {
    const products: ProductRow[] = Array.from({ length: 40 }).map((_, idx) => ({
      id: `p-${idx}`,
      created_at: new Date('2026-03-01T10:00:00Z').toISOString(),
      name: `Lapte ${idx}`,
      category: 'Dairy',
      price: 1,
      price_50: null,
      price_70: 1,
      price_100: null,
      markup: 70,
    }))

    const sb = createFakeSupabase({
      products,
      stockByProductId: Object.fromEntries(products.map((p) => [p.id, 1])),
    }) as any

    const result = await searchProducts(sb, { query: 'lapte', limit: Number.NaN as any })
    expect(result.length).toBeLessThanOrEqual(25)
  })

  it('clamps overly large limit inputs safely', async () => {
    const products: ProductRow[] = Array.from({ length: 40 }).map((_, idx) => ({
      id: `p-${idx}`,
      created_at: new Date('2026-03-01T10:00:00Z').toISOString(),
      name: `Lapte ${idx}`,
      category: 'Dairy',
      price: 1,
      price_50: null,
      price_70: 1,
      price_100: null,
      markup: 70,
    }))

    const sb = createFakeSupabase({
      products,
      stockByProductId: Object.fromEntries(products.map((p) => [p.id, 1])),
    }) as any

    const result = await searchProducts(sb, { query: 'lapte', limit: '999999' as any })
    expect(result.length).toBeLessThanOrEqual(25)
  })
})
