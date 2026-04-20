import APIBase from './httpBase'

interface SalesByResponsibleResponse {
  message: string
  range: {
    from: string
    to: string
  }
  monthlyGoal?: number
  commissionTiers?: Array<{ threshold: number; rate: number }>
  stats: Array<{
    _id: string
    totalSales: number
    count: number
    role: string
    commission: number
  }>
}

class AnalyticsService extends APIBase {
  async getSalesByResponsible(from?: string, to?: string, source?: 'nicole' | 'sucree'): Promise<SalesByResponsibleResponse> {
    try {
      const params: any = {}
      if (from) params.from = from
      if (to) params.to = to
      if (source) params.source = source

      const response = await this.get<SalesByResponsibleResponse>('analytics/sales-by-responsible', undefined, { params })
      return response.data
    } catch (error) {
      console.error('Error fetching sales by responsible:', error)
      throw error
    }
  }
}

export default new AnalyticsService()
