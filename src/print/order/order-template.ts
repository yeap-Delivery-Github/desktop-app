import { DeliveryType } from '../../enums'
import { Order } from '../../types'
import {
  currency,
  currencyWithSymbol,
  formatAddress,
  formatDateWithHour,
  getPrice
} from '../../utils'
import { TemplatePrint } from '../template-print'

export class OrderTemplate extends TemplatePrint {
  order: Order

  constructor(order: Order) {
    super()
    this.order = order
  }

  header(): void {
    this.title('Cliente')
    this.line(`Nome: ${this.order.userName}`)

    if (this.order.deliveryType === DeliveryType.DELIVERY) {
      this.line(`Endereço: ${formatAddress(this.order.userAddress)}`)
    }
    this.line(`Data hora: ${formatDateWithHour(this.order.createdAt)}`)

    if (this.order.observation) {
      this.separator()
      this.line(`Observação: ${this.order.observation}`)
    }
  }

  products(): void {
    this.title('Produtos')
    const headers = ['Item', 'Qt', 'Unit', 'Total']
    const rows = this.order.products.map((product) => [
      product.name,
      `${product.quantity.toString()}x`,
      currencyWithSymbol(getPrice(product.price)),
      currencyWithSymbol(getPrice(product.price) * product.quantity)
    ])
    this.table(headers, rows, ['50%', '10%', '20%', '20%'])
  }

  footerOrder(): void {
    this.title('Resumo do Pedido')
    this.line('Quantidade de items: ' + this.order.products.length)
    this.line(
      `Subtotal: ${currency(this.order.totalPrice - Number(this.order.deliveryPrice || 0))}`
    )

    if (this.order.deliveryType === DeliveryType.DELIVERY) {
      this.line(`Taxa de entrega: ${currency(Number(this.order.deliveryPrice || 0))}`)
    }
    this.line(`Valor total: ${currency(this.order.totalPrice)}`)

    this.separator()
    this.line('Obrigado pela compra!')
  }

  execute(): string {
    this.header()
    this.separator()
    this.products()
    this.separator()
    this.footerOrder()

    const data = this.build()

    return data
  }
}
