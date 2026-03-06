import { test, expect, type Page } from '@playwright/test'

type TestOrder = {
  id: string
  order_number: string
  customer_name: string
  customer_phone: string
  items: Array<{ product_id: string; name: string; qty: number; unit_price: number }>
  total_price: number
  pickup_time: string | null
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
  notes: string | null
  created_at: string
  updated_at: string
}

function makePendingOrder(overrides: Partial<TestOrder> = {}): TestOrder {
  const now = new Date().toISOString()
  return {
    id: overrides.id ?? '00000000-0000-4000-8000-000000000001',
    order_number: overrides.order_number ?? 'ORD-TEST-001',
    customer_name: overrides.customer_name ?? 'Playwright Customer',
    customer_phone: overrides.customer_phone ?? '+40111111111',
    items: overrides.items ?? [
      { product_id: '00000000-0000-4000-8000-000000000099', name: 'Test Item', qty: 1, unit_price: 2.78 },
    ],
    total_price: overrides.total_price ?? 2.78,
    pickup_time: overrides.pickup_time ?? '19:00',
    status: overrides.status ?? 'pending',
    notes: overrides.notes ?? 'Created by Playwright',
    created_at: overrides.created_at ?? now,
    updated_at: overrides.updated_at ?? now,
  }
}

async function stubSupabaseForOrders(page: Page, initialOrders: TestOrder[]) {
  const orders: TestOrder[] = [...initialOrders]

  const json = (body: unknown) => JSON.stringify(body)
  const corsHeaders = {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': '*',
  }

  await page.route('**/auth/v1/**', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: corsHeaders })
    }
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      headers: corsHeaders,
      body: json({ error: 'unauthorized' }),
    })
  })

  await page.route('**/rest/v1/**', async (route) => {
    const request = route.request()
    if (request.method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: corsHeaders })
    }
    const url = new URL(request.url())
    const table = url.pathname.split('/rest/v1/')[1]?.split('/')[0] ?? ''
    const accept = request.headers()['accept'] ?? ''
    const wantsObject = accept.includes('application/vnd.pgrst.object+json')

    const respond = async (status: number, body: unknown) => {
      await route.fulfill({
        status,
        contentType: 'application/json',
        headers: corsHeaders,
        body: json(body),
      })
    }

    if (table === 'orders') {
      if (request.method() === 'GET') {
        const statusFilter = url.searchParams.get('status')
        const idFilter = url.searchParams.get('id')
        let result = [...orders]

        if (statusFilter?.startsWith('eq.')) {
          const wanted = statusFilter.slice('eq.'.length)
          result = result.filter((o) => o.status === wanted)
        }
        if (idFilter?.startsWith('eq.')) {
          const wanted = idFilter.slice('eq.'.length)
          result = result.filter((o) => o.id === wanted)
        }

        if (wantsObject) {
          return respond(result.length ? 200 : 406, result[0] ?? { message: 'Not found' })
        }
        return respond(200, result)
      }

      if (request.method() === 'PATCH') {
        const idFilter = url.searchParams.get('id')
        const statusFilter = url.searchParams.get('status')
        const id = idFilter?.startsWith('eq.') ? idFilter.slice('eq.'.length) : null
        const expectedStatus = statusFilter?.startsWith('eq.') ? statusFilter.slice('eq.'.length) : null

        if (!id) return respond(400, { error: 'Missing id filter' })

        const body = request.postDataJSON?.() as { status?: TestOrder['status'] } | undefined
        const nextStatus = body?.status
        const existing = orders.find((o) => o.id === id)
        if (!existing) return respond(404, { error: 'Order not found' })
        if (expectedStatus && existing.status !== expectedStatus) return respond(409, { error: 'Conflict' })
        if (!nextStatus) return respond(400, { error: 'Missing status update' })

        existing.status = nextStatus
        existing.updated_at = new Date().toISOString()

        return respond(200, wantsObject ? existing : [existing])
      }

      return respond(405, { error: 'Unsupported orders method' })
    }

    if (table === 'stock_movements') {
      if (request.method() === 'POST') {
        const body = request.postDataJSON?.() as Record<string, unknown>
        return respond(201, {
          id: '00000000-0000-4000-8000-000000000777',
          ...body,
        })
      }
      if (request.method() === 'GET') {
        return respond(wantsObject ? 406 : 200, wantsObject ? { message: 'Not found' } : [])
      }
      return respond(405, { error: 'Unsupported stock_movements method' })
    }

    if (table === 'products') {
      // Used by the reorder-policy check after stock movements; returning a null min_stock_level
      // makes the policy exit early so tests don't need to model inventory behavior.
      if (request.method() === 'GET') {
        const idFilter = url.searchParams.get('id')
        const id = idFilter?.startsWith('eq.') ? idFilter.slice('eq.'.length) : 'unknown'
        const product = { id, min_stock_level: null, name: 'Test Product' }
        return respond(wantsObject ? 200 : 200, wantsObject ? product : [product])
      }
      return respond(405, { error: 'Unsupported products method' })
    }

    return respond(404, { error: `Unhandled Supabase table: ${table}` })
  })
}

test.describe('Orders Option B interactions', () => {
  test('desktop: shows visible Confirm/Reject buttons for pending orders', async ({ page }) => {
    await stubSupabaseForOrders(page, [makePendingOrder()])

    await page.goto('/orders')
    await expect(page.getByText(/pickup orders/i)).toBeVisible({ timeout: 15000 })

    const card = page.getByTestId('order-card').filter({ hasText: 'ORD-TEST-001' })
    await expect(card).toBeVisible()

    await expect(card.getByTestId('order-confirm-desktop')).toBeVisible()
    await expect(card.getByTestId('order-reject-desktop')).toBeVisible()
  })

  test('desktop: confirm removes the order from Pending list', async ({ page }) => {
    await stubSupabaseForOrders(page, [makePendingOrder()])

    await page.goto('/orders')
    const card = page.getByTestId('order-card').filter({ hasText: 'ORD-TEST-001' })
    await expect(card).toBeVisible()

    await card.getByTestId('order-confirm-desktop').click()

    await expect(page.getByText(/no pending orders/i)).toBeVisible({ timeout: 10000 })
  })

  test('mobile: swipe reveals Confirm/Reject actions', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 740 })
    await stubSupabaseForOrders(page, [makePendingOrder()])

    await page.goto('/orders')
    const card = page.getByTestId('order-card').filter({ hasText: 'ORD-TEST-001' })
    await expect(card).toBeVisible()

    const surface = card.getByTestId('order-swipe-surface')
    const box = await surface.boundingBox()
    expect(box).toBeTruthy()
    if (!box) return

    await page.mouse.move(box.x + box.width - 12, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + 18, box.y + box.height / 2, { steps: 12 })
    await page.mouse.up()

    await card.getByTestId('order-reject-swipe').click()
    await expect(page.getByText(/no pending orders/i)).toBeVisible({ timeout: 10000 })
  })

  test('mobile: actions sheet provides non-gesture fallback', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 740 })
    await stubSupabaseForOrders(page, [makePendingOrder()])

    await page.goto('/orders')
    const card = page.getByTestId('order-card').filter({ hasText: 'ORD-TEST-001' })
    await expect(card).toBeVisible()

    await card.getByTestId('order-actions-trigger').click()
    await expect(page.getByRole('heading', { name: /actions/i })).toBeVisible({ timeout: 10000 })

    await page.getByTestId('order-confirm-sheet').click()
    await expect(page.getByText(/no pending orders/i)).toBeVisible({ timeout: 10000 })
  })
})
