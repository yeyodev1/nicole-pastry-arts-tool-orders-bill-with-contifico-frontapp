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

  /**
   * Solicita el email de recuperación de contraseña
   */
  async forgotPassword(email: string): Promise<{ message: string }> {
    const response = await this.post<{ message: string }>('users/forgot-password', { email })
    return response.data
  }

  /**
   * Restablece la contraseña con el token recibido por email
   */
  async resetPassword(token: string, password: string): Promise<{ message: string }> {
    const response = await this.post<{ message: string }>('users/reset-password', { token, password })
    return response.data
  }
}

export default new AuthService()
