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

  async getOrders(filters?: { search?: string, startDate?: string, endDate?: string, dateType?: 'deliveryDate' | 'createdAt', dispatchStatus?: string }): Promise<any[]> {
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

  async updateOrder(id: string, data: any): Promise<any> {
    try {
      const response = await this.put<any>(`orders/${id}`, data)
      return response.data
    } catch (error) {
      console.error('Error updating order:', error)
      throw error
    }
  }

  async bulkAssign(orderIds: string[], deliveryPerson: any): Promise<any> {
    try {
      const response = await this.post<any>('orders/bulk-assign', { orderIds, deliveryPerson })
      return response.data
    } catch (error) {
      console.error('Error bulk assigning orders:', error)
      throw error
    }
  }

  async reassignDelivery(oldPersonId: string, newPerson: any): Promise<any> {
    try {
      const response = await this.post<any>('orders/reassign-delivery', { oldPersonId, newPerson })
      return response.data
    } catch (error) {
      console.error('Error reassigning delivery:', error)
      throw error
    }
  }

  async deleteOrder(id: string): Promise<any> {
    try {
      const response = await this.delete<any>(`orders/${id}`)
      return response.data
    } catch (error) {
      console.error('Error deleting order:', error)
      throw error
    }
  }

  async returnOrder(id: string, notes: string): Promise<any> {
    try {
      const response = await this.put<any>(`orders/${id}/return`, { notes })
      return response.data
    } catch (error) {
      console.error('Error returning order:', error)
      throw error
    }
  }
}

export default new OrderService()
