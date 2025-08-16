export function currency(value: number): string {
  if (typeof value !== 'number') {
    return ''
  }

  return value.toLocaleString('pt-br', {
    style: 'currency',
    currency: 'BRL'
  })
}

export function currencyWithOutSymbol(value: number): string {
  if (typeof value !== 'number') {
    return ''
  }

  return value
    .toLocaleString('pt-br', {
      style: 'currency',
      currency: 'BRL',
      currencyDisplay: 'symbol'
    })
    .replace('R$', '')
}
