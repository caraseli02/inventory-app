import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import { CartItem } from '@/components/cart/CartItem'
import { createCartItem, createProductWithPriceTiers } from '@/test/factories'

describe('CartItem pricing', () => {
  it('uses markup-aware store price (not base Price)', () => {
    const product = createProductWithPriceTiers({
      fields: {
        Price: 10.0,
        'Price 70%': 17.0,
        Markup: 70,
      },
    })

    const item = createCartItem({
      product,
      quantity: 1,
      status: 'idle',
    })

    render(<CartItem item={item} index={0} onUpdateQuantity={() => {}} />)

    expect(screen.getAllByText('€17.00').length).toBeGreaterThan(0)
    expect(screen.queryByText('€10.00')).not.toBeInTheDocument()
  })
})
