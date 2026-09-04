import APIBase from './httpBase'

/** Vendedor que puede quedar asignado a un pedido y sale en la factura de Contífico. */
export interface Seller {
  _id: string
  name: string
  /** Cédula — es la llave con la que Contífico identifica a la persona. */
  identification: string
  contificoPersonId?: string
  contificoSource: 'nicole' | 'sucree'
  isActive: boolean
  sortOrder: number
}

class SellerService extends APIBase {
  async getSellers(includeInactive = false): Promise<Seller[]> {
    const res = await this.get<{ data: Seller[] }>(`/sellers${includeInactive ? '?all=true' : ''}`)
    return res.data.data || []
  }

  async createSeller(data: {
    name: string
    identification: string
    contificoPersonId?: string
    contificoSource?: 'nicole' | 'sucree'
    isActive?: boolean
    sortOrder?: number
  }): Promise<Seller> {
    const res = await this.post<{ data: Seller }>('/sellers', data)
    return res.data.data
  }

  async updateSeller(id: string, data: Partial<Omit<Seller, '_id'>>): Promise<Seller> {
    const res = await this.put<{ data: Seller }>(`/sellers/${id}`, data)
    return res.data.data
  }

  /** Desactiva al vendedor. No se borra: las facturas ya emitidas lo referencian. */
  async deactivateSeller(id: string): Promise<void> {
    await this.delete(`/sellers/${id}`)
  }
}

export default new SellerService()
