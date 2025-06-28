export enum PaymentType {
  CREDIT_CARD = 'CREDIT_CARD',
  DEBIT_CARD = 'DEBIT_CARD',
  PIX = 'PIX',
  MONEY = 'MONEY'
}

export const paymentMethodsMap: Record<PaymentType, string> = {
  [PaymentType.CREDIT_CARD]: 'Cartão de crédito',
  [PaymentType.DEBIT_CARD]: 'Cartão de débito',
  [PaymentType.PIX]: 'Pix',
  [PaymentType.MONEY]: 'Dinheiro'
}
