import APIBase from './httpBase'

export interface LoanItem {
  _id?: string
  material: any
  name: string
  quantity: number
  unit: string
  quantityReturned: number
}

export interface WarehouseLoan {
  _id: string
  fromPoint: string
  toPoint: string
  items: LoanItem[]
  status: 'LENT' | 'PARTIALLY_RETURNED' | 'RETURNED' | 'WRITTEN_OFF'
  responsible?: string
  notes?: string
  returnedAt?: string
  writtenOffAt?: string
  writeOffNote?: string
  createdAt: string
}

class WarehouseLoanService extends APIBase {
  async createLoan(data: { fromPoint: string; toPoint: string; items: any[]; responsible?: string; notes?: string }) {
    const response = await this.post<any>('warehouse-loans', data)
    return response.data
  }

  async getLoans(params: any = {}) {
    const response = await this.get<any>('warehouse-loans', undefined, { params })
    return response.data
  }

  async returnLoan(id: string, payload: { items?: { itemId: string; quantityReturned: number }[]; responsible?: string } = {}) {
    const response = await this.put<any>(`warehouse-loans/${id}/return`, payload)
    return response.data
  }

  async writeOff(id: string, writeOffNote?: string) {
    const response = await this.put<any>(`warehouse-loans/${id}/write-off`, { writeOffNote })
    return response.data
  }
}

export default new WarehouseLoanService()
