export interface User {
  _id: string
  name: string
  email: string
  role: 'admin' | 'sales' | 'production' | 'SALES_REP' | 'SALES_MANAGER' | 'RetailManager' | 'SUPPLY_CHAIN_MANAGER'
  password?: string
  createdAt?: string
  updatedAt?: string
}

export interface LoginResponse {
  token: string
  user: User
}
