import APIBase from './httpBase'

export interface Payable {
  contificoId: string
  documento: string
  tipo: string
  proveedor: string
  ruc: string
  fechaEmision?: string
  fechaVencimiento?: string
  total: number
  saldo?: number
  estado?: string
  urgency: 'PAID' | 'OVERDUE' | 'DUE_SOON' | 'OK'
  creditDays: number | null
  providerId: string | null
}

export interface PayablesResponse {
  message: string
  source: string
  summary: {
    total: number
    overdue: number
    dueSoon: number
    ok: number
    paid: number
    totalPendingAmount: number
  }
  data: Payable[]
}

class PayablesService extends APIBase {
  async getPayables(params: { source?: string; urgency?: string; ruc?: string; fecha_emision?: string } = {}) {
    const response = await this.get<PayablesResponse>('payables', undefined, { params })
    return response.data
  }
}

export default new PayablesService()
