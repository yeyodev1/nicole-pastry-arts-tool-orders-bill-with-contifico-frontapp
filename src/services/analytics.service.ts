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

  async getSuperAdminAnalytics(period: 'day' | 'week' | 'month' = 'month', source?: 'nicole' | 'sucree'): Promise<any> {
    try {
      const params: any = { period }
      if (source) params.source = source
      
      const response = await this.get<any>(`analytics/superadmin/main`, undefined, { params })
      return response.data
    } catch (error) {
      console.error('Error fetching superadmin analytics:', error)
      throw error
    }
  }

  /**
   * Fetches Meta Ads insights via backend proxy to avoid CORS issues
   */
  async getMetaAdsInsights(clientId: string, adAccountId: string, datePreset: string = 'this_month'): Promise<any> {
    try {
      // Now calling our own backend endpoint
      const response = await this.get<any>('analytics/meta-ads', undefined, {
        params: { clientId, adAccountId, datePreset }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching Meta Ads insights via proxy:', error)
      throw error
    }
  }
}

export default new AnalyticsService()
