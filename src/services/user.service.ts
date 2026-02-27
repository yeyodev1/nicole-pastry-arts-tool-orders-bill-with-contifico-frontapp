import APIBase from './httpBase'
import type { User } from '@/types/user'

interface ApiResponse<T> {
  message: string
  data: T
}

class UserService extends APIBase {
  async getAllUsers(): Promise<User[]> {
    const response = await this.get<ApiResponse<User[]>>('users')
    return response.data.data
  }

  async createUser(userData: Partial<User>): Promise<User> {
    const response = await this.post<ApiResponse<User>>('users', userData)
    return response.data.data
  }

  async updateUser(id: string, userData: Partial<User>): Promise<User> {
    const response = await this.put<ApiResponse<User>>(`users/${id}`, userData)
    return response.data.data
  }

  async deleteUser(id: string): Promise<void> {
    await this.delete(`users/${id}`)
  }
}

export default new UserService()
