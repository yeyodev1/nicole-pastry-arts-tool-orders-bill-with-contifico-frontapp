import APIBase from './httpBase'
import type { User } from '@/types/user'

class UserService extends APIBase {
  async getAllUsers(): Promise<User[]> {
    const response = await this.get<User[]>('users')
    return response.data
  }

  async createUser(userData: Partial<User>): Promise<User> {
    const response = await this.post<User>('users/register', userData) // Assuming register or common endpoint
    return response.data
  }

  async updateUser(id: string, userData: Partial<User>): Promise<User> {
    const response = await this.put<User>(`users/${id}`, userData)
    return response.data
  }

  async deleteUser(id: string): Promise<void> {
    await this.delete(`users/${id}`)
  }
}

export default new UserService()
