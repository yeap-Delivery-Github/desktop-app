import { DeliveryType, PaymentType } from '../enums'

export interface Address {
  id: string
  street: string
  number: string
  neighborhood: string
  city: string
  state: string
  zip: string
  complement?: string
  reference?: string
}

export interface Order {
  orderNumber: number
  totalPrice: number
  status: string
  storeId: string
  userId: string
  userName: string
  phone: string
  observation: string
  userAddress: Address
  products: Product[]
  deliveryPrice: string
  deliveryTime: number
  deliveryType: DeliveryType
  paymentType: PaymentType
  createdAt: string
  updatedAt: string
  id: string
}

export interface Product {
  id: string
  name: string
  price: Price
  quantity: number
  variations: Variation[]
}

export interface Price {
  id: string
  original: number
  promotional?: number | null
}

export interface Variation {
  id: string
  name: string
  options: Option[]
}

export interface Option {
  id: string
  name: string
  price: number
  quantity: number
}
