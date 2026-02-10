import APIBase from './httpBase'

class ProviderCategoryService extends APIBase {
  async getCategories() {
    const response = await this.get<any>('provider-categories')
    return response.data.data
  }

  async createCategory(categoryData: { name: string }) {
    const response = await this.post<any>('provider-categories', categoryData)
    return response.data.data
  }

  async updateCategory(id: string, categoryData: { name?: string; isActive?: boolean }) {
    const response = await this.patch<any>(`provider-categories/${id}`, categoryData)
    return response.data.data
  }

  async deleteCategory(id: string) {
    const response = await this.delete<any>(`provider-categories/${id}`)
    return response.data
  }
}

export default new ProviderCategoryService()
