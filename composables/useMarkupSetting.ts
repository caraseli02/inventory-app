export type MarkupPercentage = 50 | 70 | 100

const DEFAULT_MARKUP: MarkupPercentage = 70

export function getProductDisplayPrice(
  product: {
    Price?: number
    'Price 50%'?: number
    'Price 70%'?: number
    'Price 100%'?: number
    Markup?: number
  }
): number | undefined {
  const markup = (product.Markup as MarkupPercentage) || DEFAULT_MARKUP

  switch (markup) {
    case 50:
      return product['Price 50%'] ?? product.Price
    case 70:
      return product['Price 70%'] ?? product.Price
    case 100:
      return product['Price 100%'] ?? product.Price
    default:
      return product.Price
  }
}
