import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ProductDetailDialog } from '@/components/inventory/ProductDetailDialog'
import { createProduct, createStockMovement } from '@/test/factories'
import { renderWithProviders } from '@/test/test-utils'

const mockGetStockMovements = vi.fn()

vi.mock('@/lib/api-provider', () => ({
  getStockMovements: (...args: unknown[]) => mockGetStockMovements(...args),
}))

vi.mock('@/components/ProductHistory', () => ({
  ProductHistory: () => <div>Mocked Product History</div>,
}))

describe('ProductDetailDialog movement history states', () => {
  beforeEach(() => {
    mockGetStockMovements.mockReset()
  })

  it('shows error state and retries successfully', async () => {
    const product = createProduct({ id: 'prod_retry_1' })
    const movement = createStockMovement({
      fields: {
        Product: [product.id],
        Type: 'IN',
        Quantity: 5,
        Date: new Date().toISOString(),
      },
    })

    mockGetStockMovements
      .mockRejectedValueOnce(new Error('Service unavailable'))
      .mockResolvedValueOnce([movement])

    renderWithProviders(
      <ProductDetailDialog
        product={product}
        open
        onClose={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Failed to load movement history')).toBeInTheDocument()
    })
    expect(screen.getByText('Service unavailable')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))

    await waitFor(() => {
      expect(screen.getByText('Mocked Product History')).toBeInTheDocument()
    })
    expect(screen.getByText('IN')).toBeInTheDocument()
  })

  it('shows empty state only after successful load with no movements', async () => {
    const product = createProduct({ id: 'prod_empty_1' })
    mockGetStockMovements.mockResolvedValueOnce([])

    renderWithProviders(
      <ProductDetailDialog
        product={product}
        open
        onClose={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('No stock movements recorded')).toBeInTheDocument()
    })
    expect(screen.queryByText('Failed to load movement history')).not.toBeInTheDocument()
  })
})
