import APIBase from './httpBase'
import type { User, LoginResponse } from '@/types/user'

class AuthService extends APIBase {
  /**
   * Login user with email and password
   */
  async login(credentials: Pick<User, 'email'> & { password?: string }): Promise<LoginResponse> {
    try {
      const response = await this.post<LoginResponse>('users/login', credentials)
      return response.data
    } catch (error) {
      console.error('Error logging in:', error)
      throw error
    }
  }
}

export default new AuthService()
