import axios from 'axios'
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
   * Fetches Meta Ads insights. Uses VITE_META_ADS_SERVICE_URL from env.
   */
  async getMetaAdsInsights(clientId: string, adAccountId: string, datePreset: string = 'this_month'): Promise<any> {
    try {
      const baseUrl = (import.meta.env.VITE_META_ADS_SERVICE_URL || 'https://ads-bakano-clients-backapp.vercel.app').replace(/\/$/, '')
      const url = `${baseUrl}/api/meta/${clientId}/ads-insights`
      
      const response = await axios.get(url, {
        params: { datePreset, adAccountId }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching Meta Ads insights:', error)
      throw error
    }
  }
}

export default new AnalyticsService()
