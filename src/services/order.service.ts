import APIBase from './httpBase'

interface OrderData {
  customerName: string
  customerPhone: string
  deliveryDate: string
  deliveryTime: string
  deliveryType: 'pickup' | 'delivery' | 'retiro'
  branch?: 'San Marino' | 'Mall del Sol' | 'Centro de Producción'
  googleMapsLink?: string
  deliveryAddress?: string
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

  async getOrders(filters?: { search?: string, startDate?: string, endDate?: string, dateType?: 'deliveryDate' | 'createdAt' }): Promise<any[]> {
    try {
      const response = await this.get<any[]>('orders', undefined, { params: filters })
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
  async updateInvoiceData(id: string, data: { invoiceNeeded: boolean, invoiceData?: any }): Promise<any> {
    try {
      const response = await this.put<any>(`orders/${id}/invoice`, data)
      return response.data
    } catch (error) {
      console.error('Error updating invoice data:', error)
      throw error
    }
  }

  async registerCollection(id: string, data: any): Promise<any> {
    try {
      const response = await this.post<any>(`orders/${id}/collection`, data)
      return response.data
    } catch (error) {
      console.error('Error registering collection:', error)
      throw error
    }
  }

  async generateInvoice(id: string): Promise<any> {
    try {
      const response = await this.post<any>(`orders/${id}/invoice/generate`, {})
      return response.data
    } catch (error) {
      console.error('Error generating invoice:', error)
      throw error
    }
  }

  async getInvoicePdf(id: string): Promise<any> {
    try {
      const response = await this.get<any>(`orders/${id}/invoice-pdf`)
      return response.data
    } catch (error) {
      console.error('Error fetching invoice PDF:', error)
      throw error
    }
  }

  async settleOrderInIsland(id: string, islandName: string): Promise<any> {
    try {
      const response = await this.post<any>(`orders/${id}/settle-island`, { islandName })
      return response.data
    } catch (error) {
      console.error('Error settling order in island:', error)
      throw error
    }
  }
}

export default new OrderService()
