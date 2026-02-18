import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'

import CreateProductForm from '@/components/product/CreateProductForm'
import { renderWithProviders } from '@/test/test-utils'

const mockSuggestProductDetails = vi.fn()

vi.mock('@/lib/api-provider', () => ({
  createProduct: vi.fn(),
  addStockMovement: vi.fn(),
}))

vi.mock('@/lib/ai', () => ({
  suggestProductDetails: (...args: unknown[]) => mockSuggestProductDetails(...args),
}))

vi.mock('@/lib/imageUpload', () => ({
  uploadImage: vi.fn(),
  isDataUrl: vi.fn(() => false),
}))

vi.mock('@/components/camera/CameraCaptureDialog', () => ({
  default: () => null,
}))

describe('CreateProductForm AI status', () => {
  beforeEach(() => {
    mockSuggestProductDetails.mockReset()
  })

  it('shows found status and applies AI fields when suggestion exists', async () => {
    mockSuggestProductDetails.mockResolvedValueOnce({
      name: 'AI Milk',
      category: 'Dairy',
      source: 'OpenFoodFacts',
    })

    renderWithProviders(
      <CreateProductForm barcode="1234567890123" onSuccess={vi.fn()} onCancel={vi.fn()} />
    )

    await waitFor(() => {
      expect(screen.getByText('AI details found')).toBeInTheDocument()
    })
    expect(screen.getByDisplayValue('AI Milk')).toBeInTheDocument()
  })

  it('shows not found status when AI returns null', async () => {
    mockSuggestProductDetails.mockResolvedValueOnce(null)

    renderWithProviders(
      <CreateProductForm barcode="2222222222222" onSuccess={vi.fn()} onCancel={vi.fn()} />
    )

    await waitFor(() => {
      expect(screen.getByText('No AI match, fill manually')).toBeInTheDocument()
    })
  })

  it('shows error status when AI call fails', async () => {
    mockSuggestProductDetails.mockRejectedValueOnce(new Error('OFF timeout'))

    renderWithProviders(
      <CreateProductForm barcode="3333333333333" onSuccess={vi.fn()} onCancel={vi.fn()} />
    )

    await waitFor(() => {
      expect(screen.getByText('AI unavailable, fill manually')).toBeInTheDocument()
    })
  })

  it('hides AI status badge when barcode becomes empty', async () => {
    mockSuggestProductDetails.mockResolvedValueOnce({
      name: 'AI Water',
      category: 'Beverages',
      source: 'OpenFoodFacts',
    })

    const { rerender } = renderWithProviders(
      <CreateProductForm barcode="4444444444444" onSuccess={vi.fn()} onCancel={vi.fn()} />
    )

    await waitFor(() => {
      expect(screen.getByText('AI details found')).toBeInTheDocument()
    })

    rerender(<CreateProductForm barcode="" onSuccess={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.queryByText('AI details found')).not.toBeInTheDocument()
    expect(screen.queryByText('No AI match, fill manually')).not.toBeInTheDocument()
    expect(screen.queryByText('AI unavailable, fill manually')).not.toBeInTheDocument()
  })
})
