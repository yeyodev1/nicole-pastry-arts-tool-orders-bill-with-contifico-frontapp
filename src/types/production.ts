export interface OrderDetail {
  id: string
  quantity: number
  client: string
  delivery: string
  stage: string
  branch?: string
  deliveryType?: string
  deliveryRound?: string | null
}

export interface SummaryItem {
  _id: string
  uid?: string   // composite key: bucket + ':' + _id
  totalQuantity: number
  urgency: string
  category?: string
  orders: OrderDetail[]
  isExpanded?: boolean
  currentInput?: number
  mode?: 'all' | 'custom'
}

export interface CategoryGroup {
  name: string
  items: SummaryItem[]
  isExpanded: boolean
  id: string
}
