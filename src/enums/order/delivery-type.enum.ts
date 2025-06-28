export enum DeliveryType {
  DELIVERY = 'DELIVERY',
  PICKUP = 'PICKUP'
}

export const deliveryTypeMap: Record<DeliveryType, string> = {
  [DeliveryType.DELIVERY]: 'Entrega',
  [DeliveryType.PICKUP]: 'Retirar na loja'
}
