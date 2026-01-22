import APIBase from './httpBase'
import type { Order } from '@/types/order'

export interface ProductionTask extends Order { }

class ProductionService extends APIBase {
  async getTasks(): Promise<ProductionTask[]> {
    try {
      const response = await this.get<{ data: ProductionTask[] }>('production')
      return response.data.data
    } catch (error) {
      console.error('Error fetching production tasks:', error)
      throw error
    }
  }

  async updateTask(id: string, updates: { stage?: 'PENDING' | 'IN_PROCESS' | 'FINISHED'; notes?: string }): Promise<ProductionTask> {
    try {
      const response = await this.patch<{ data: ProductionTask }>(`production/${id}`, updates)
      return response.data.data
    } catch (error) {
      console.error('Error updating production task:', error)
      throw error
    }
  }

  async batchUpdate(ids: string[], stage: 'PENDING' | 'IN_PROCESS' | 'FINISHED') {
    await this.patch('production/batch', { ids, stage })
  }

  async registerProgress(productName: string, quantity: number) {
    await this.post('production/progress', { productName, quantity })
  }

  async getSummary(): Promise<any[]> {
    const response = await this.get<{ summary: any[] }>('production/summary')
    return response.data.summary
  }
}

export default new ProductionService()
