import APIBase from './httpBase'
import { cacheGet, cacheSet, cacheInvalidate } from './listCache'

class ProviderService extends APIBase {
  async getProviders(search?: string) {
    const key = `providers:${search || ''}`
    const cached = cacheGet<any>(key)
    if (cached) return cached

    const params = search ? { search } : {}
    const response = await this.get<any>('providers', undefined, { params })
    cacheSet(key, response.data.data)
    return response.data.data
  }

  async getProviderById(id: string) {
    const response = await this.get<any>(`providers/${id}`)
    return response.data.data
  }

  async createProvider(providerData: any) {
    const response = await this.post<any>('providers', providerData)
    cacheInvalidate('providers:')
    return response.data.data
  }

  async updateProvider(id: string, providerData: any) {
    const response = await this.patch<any>(`providers/${id}`, providerData)
    cacheInvalidate('providers:')
    return response.data.data
  }

  async deleteProvider(id: string) {
    const response = await this.delete<any>(`providers/${id}`)
    cacheInvalidate('providers:')
    return response.data
  }
}

export default new ProviderService()
