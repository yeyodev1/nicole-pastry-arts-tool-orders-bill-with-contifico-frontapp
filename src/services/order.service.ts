import APIBase from './httpBase'

interface OrderData {
  customerName: string
  customerPhone: string
  deliveryDate: string
  deliveryType: 'pickup' | 'delivery'
  products: Array<{
    id?: string
    contifico_id?: string
    name: string
    quantity: number
    price: number
  }>
  invoiceData?: {
    ruc: string
    businessName: string
    email: string
    address: string
  }
  invoiceNeeded: boolean
  comments?: string
  responsible: string
  salesChannel: string
  paymentMethod: string
}

interface OrderResponse {
  message: string
  order: any
  whatsappMessage: string
}

class OrderService extends APIBase {
  async createOrder(data: OrderData): Promise<OrderResponse> {
    try {
      const response = await this.post<OrderResponse>('orders', data)
      return response.data
    } catch (error) {
      console.error('Error creating order:', error)
      throw error
    }
  }

  async getOrders(): Promise<any[]> {
    try {
      const response = await this.get<any[]>('orders')
      return response.data
    } catch (error) {
      console.error('Error fetching orders:', error)
      throw error
    }
  }

  async getOrder(id: string): Promise<any> {
    try {
      const response = await this.get<any>(`orders/${id}`)
      return response.data
    } catch (error) {
      console.error('Error fetching order:', error)
      throw error
    }
  }
}

export default new OrderService()
