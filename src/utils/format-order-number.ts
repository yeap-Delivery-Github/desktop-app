export function formatOrderNumber(orderNumber: number): string {
  return '#' + orderNumber.toString().padStart(4, '0')
}
