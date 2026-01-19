import APIBase from './httpBase'
import type { AxiosResponse } from 'axios'

interface Product {
  id: string
  name: string
  price: number
  category_id?: string
  // Add other fields as needed
}

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
