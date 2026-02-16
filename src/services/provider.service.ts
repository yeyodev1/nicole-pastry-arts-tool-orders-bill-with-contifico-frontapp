import APIBase from './httpBase'

class ProviderService extends APIBase {
  async getProviders(search?: string) {
    const params = search ? { search } : {}
    const response = await this.get<any>('providers', undefined, { params })
    return response.data.data
  }

  async createProvider(providerData: any) {
    const response = await this.post<any>('providers', providerData)
    return response.data.data
  }

  async updateProvider(id: string, providerData: any) {
    const response = await this.patch<any>(`providers/${id}`, providerData)
    return response.data.data
  }

  async deleteProvider(id: string) {
    const response = await this.delete<any>(`providers/${id}`)
    return response.data
  }
}

export default new ProviderService()
