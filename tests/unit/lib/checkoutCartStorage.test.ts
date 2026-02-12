import { describe, it, expect, beforeEach } from 'vitest'

import type { CartItem, Product } from '@/types'
import {
  CHECKOUT_CART_STORAGE_KEY,
  clearPersistedCheckoutCart,
  loadPersistedCheckoutCart,
  persistCheckoutCart,
} from '@/lib/checkoutCartStorage'

function makeProduct(id: string, name: string): Product {
  return {
    id,
    createdTime: new Date().toISOString(),
    fields: {
      Name: name,
    },
  }
}

describe('checkoutCartStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns null when no cart is persisted', () => {
    expect(loadPersistedCheckoutCart()).toBeNull()
  })

  it('persists and loads cart items', () => {
    const cart: CartItem[] = [
      { product: makeProduct('p1', 'Apple'), quantity: 2 },
      { product: makeProduct('p2', 'Banana'), quantity: 1 },
    ]

    persistCheckoutCart(cart)
    const loaded = loadPersistedCheckoutCart()

    expect(loaded).not.toBeNull()
    expect(loaded!.map((i) => [i.product.id, i.quantity])).toEqual([
      ['p1', 2],
      ['p2', 1],
    ])
  })

  it('clears storage when cart is empty', () => {
    const cart: CartItem[] = [{ product: makeProduct('p1', 'Apple'), quantity: 1 }]
    persistCheckoutCart(cart)
    expect(localStorage.getItem(CHECKOUT_CART_STORAGE_KEY)).toBeTruthy()

    persistCheckoutCart([])
    expect(localStorage.getItem(CHECKOUT_CART_STORAGE_KEY)).toBeNull()
  })

  it('does not persist items marked as success', () => {
    const cart: CartItem[] = [
      { product: makeProduct('p1', 'Apple'), quantity: 2, status: 'success' },
      { product: makeProduct('p2', 'Banana'), quantity: 1, status: 'failed' },
    ]

    persistCheckoutCart(cart)
    const loaded = loadPersistedCheckoutCart()

    expect(loaded).not.toBeNull()
    expect(loaded!.map((i) => [i.product.id, i.quantity])).toEqual([['p2', 1]])
  })

  it('clears storage when all items are success', () => {
    const cart: CartItem[] = [{ product: makeProduct('p1', 'Apple'), quantity: 2, status: 'success' }]
    persistCheckoutCart(cart)
    expect(localStorage.getItem(CHECKOUT_CART_STORAGE_KEY)).toBeNull()
    expect(loadPersistedCheckoutCart()).toBeNull()
  })

  it('ignores and clears expired cart payloads', () => {
    const payload = {
      version: 1,
      updatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
      items: [{ product: makeProduct('p1', 'Apple'), quantity: 1 }],
    }
    localStorage.setItem(CHECKOUT_CART_STORAGE_KEY, JSON.stringify(payload))

    expect(loadPersistedCheckoutCart()).toBeNull()
    expect(localStorage.getItem(CHECKOUT_CART_STORAGE_KEY)).toBeNull()
  })

  it('handles invalid JSON by returning null and removing the key', () => {
    localStorage.setItem(CHECKOUT_CART_STORAGE_KEY, '{not json')

    expect(loadPersistedCheckoutCart()).toBeNull()
    expect(localStorage.getItem(CHECKOUT_CART_STORAGE_KEY)).toBeNull()
  })

  it('caps loaded item count to avoid pathological payloads', () => {
    const items = Array.from({ length: 500 }, (_, idx) => ({
      product: makeProduct(`p${idx}`, `P${idx}`),
      quantity: 1,
    }))
    const payload = {
      version: 1,
      updatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      items,
    }
    localStorage.setItem(CHECKOUT_CART_STORAGE_KEY, JSON.stringify(payload))

    const loaded = loadPersistedCheckoutCart()
    expect(loaded).not.toBeNull()
    expect(loaded!.length).toBeLessThanOrEqual(200)
  })

  it('clearPersistedCheckoutCart removes the key', () => {
    localStorage.setItem(CHECKOUT_CART_STORAGE_KEY, JSON.stringify({ ok: true }))
    clearPersistedCheckoutCart()
    expect(localStorage.getItem(CHECKOUT_CART_STORAGE_KEY)).toBeNull()
  })
})
