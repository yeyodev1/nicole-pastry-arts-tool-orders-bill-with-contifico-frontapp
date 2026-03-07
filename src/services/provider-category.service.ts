import APIBase from './httpBase'

export interface IProviderCategory {
  _id: string
  name: string
  isActive: boolean
  materialCount?: number
}

class ProviderCategoryService extends APIBase {
  async getCategories(): Promise<IProviderCategory[]> {
    const response = await this.get<any>('provider-categories')
    return response.data.data
  }

  async createCategory(name: string): Promise<IProviderCategory> {
    const response = await this.post<any>('provider-categories', { name })
    return response.data.data
  }

  async updateCategory(id: string, name: string): Promise<IProviderCategory> {
    const response = await this.patch<any>(`provider-categories/${id}`, { name })
    return response.data.data
  }

  async deleteCategory(id: string, targetCategory?: string): Promise<any> {
    const response = await this.delete<any>(`provider-categories/${id}`, { data: { targetCategory } })
    return response.data
  }
}

export default new ProviderCategoryService()
