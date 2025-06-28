import { Price } from '../types'

export function getPrice(price?: Price): number {
  if (!price) {
    return 0
  }

  if (price.promotional) {
    return price.promotional
  }

  return price.original
}
