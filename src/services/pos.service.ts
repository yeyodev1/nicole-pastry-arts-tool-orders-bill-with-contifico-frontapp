import APIBase from './httpBase'

export interface DispatchItem {
  productId: string
  name: string
  quantitySent: number
  quantityReceived?: number
  itemStatus?: 'OK' | 'MISSING' | 'DAMAGED'
}

export interface IncomingDispatch {
  orderId: string
  orderNumber?: string
  customerName: string
  deliveryDate: string
  products: any[]
  dispatch: {
    _id: string
    reportedAt: string
    destination: string
    items: DispatchItem[]
    notes?: string
    reportedBy: string
    receptionStatus: 'PENDING' | 'RECEIVED' | 'PROBLEM'
    receivedAt?: string
    receivedBy?: string
    receptionNotes?: string
  }
}

class POSService extends APIBase {
  /**
   * Get incoming dispatches for a specific branch (e.g., 'San Marino', 'Mall del Sol')
   */
  async getIncomingDispatches(branch: string): Promise<IncomingDispatch[]> {
    try {
      const response = await this.get<{ data: IncomingDispatch[] }>(`pos/dispatches?branch=${encodeURIComponent(branch)}`)
      return response.data.data
    } catch (error) {
      console.error('Error fetching incoming dispatches:', error)
      throw error
    }
  }

  /**
   * Confirm reception of a dispatch
   */
  async confirmReception(
    orderId: string,
    dispatchId: string,
    data: {
      receivedBy: string;
      receptionNotes?: string;
      items: { productId: string; quantityReceived: number; itemStatus: string }[]
    }
  ): Promise<any> {
    try {
      const response = await this.post(`pos/dispatches/${orderId}/${dispatchId}/confirm`, data)
      return response.data
    } catch (error) {
      console.error('Error confirming reception:', error)
      throw error
    }
  }

  /**
   * Get pickup orders for a branch
   */
  async getPickupOrders(branch: string): Promise<any[]> {
    try {
      const response = await this.get<{ data: any[] }>(`pos/pickups?branch=${encodeURIComponent(branch)}`)
      return response.data.data
    } catch (error) {
      console.error('Error fetching pickups:', error)
      throw error
    }
  }
}

export default new POSService()
