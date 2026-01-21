import APIBase from './httpBase'
import type { AxiosResponse } from 'axios'
import type { Product } from '@/types/order'

class ProductService extends APIBase {
  async getProducts(params: { filtro?: string; page?: number; limit?: number } = {}): Promise<Product[]> {
    try {
      const response = await this.get<Product[]>('products', undefined, { params })
      return response.data
    } catch (error) {
      console.error('Error fetching products:', error)
      throw error
    }
  }
}

export default new ProductService()
