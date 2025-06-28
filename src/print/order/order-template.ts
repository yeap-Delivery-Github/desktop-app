import { DeliveryType, paymentMethodsMap } from '../../enums'
import { Order } from '../../types'
import { currencyWithSymbol, formatDateWithHour, getPrice } from '../../utils'
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

    this.line(`Data hora: ${formatDateWithHour(this.order.createdAt)}`)

    if (this.order.observation) {
      this.separator()
      this.line(`Observação: ${this.order.observation}`)
    }

    if (this.order.deliveryType === DeliveryType.DELIVERY) {
      this.line(`Rua: ${this.order.userAddress.street}`)
      this.line(`Bairro: ${this.order.userAddress.street}`)
      this.line(`Número: ${this.order.userAddress.number}`)
      this.line(`Complemento: ${this.order.userAddress.complement || 'N/A'}`)
      this.line(`CEP: ${this.order.userAddress.zip}`)
    }
  }

  products(): void {
    this.title('Produtos')
    const headers = ['Item', 'Qt', 'Unit', 'Total']
    const rows = this.order.products.map((product) => [
      product.name,
      product.quantity.toString(),
      currencyWithSymbol(getPrice(product.price)),
      currencyWithSymbol(getPrice(product.price) * product.quantity)
    ])
    this.table(headers, rows, ['50%', '10%', '20%', '20%'])
  }

  footerOrder(): void {
    this.title('Resumo do Pedido')
    this.line('Quantidade de items: ' + this.order.products.length)
    this.line(`Forma de pagamento: ${paymentMethodsMap[this.order.paymentType]}`)
    this.line(' ')

    this.line(
      `Subtotal: ${currencyWithSymbol(this.order.totalPrice - Number(this.order.deliveryPrice || 0))}`
    )

    if (this.order.deliveryType === DeliveryType.DELIVERY) {
      this.line(`Taxa de entrega: ${currencyWithSymbol(Number(this.order.deliveryPrice || 0))}`)
    }
    this.line(`Valor total: ${currencyWithSymbol(this.order.totalPrice)}`)

    this.separator()
    this.line('Obrigado pela preferência!')
    this.line('Impresso por: Yeap delivery - yeapdelivery.com.br')
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
