import APIBase from './httpBase';

class WarehouseService extends APIBase {
  async getMovements(params: { page?: number; type?: string; materialId?: string; startDate?: string; endDate?: string } = {}) {
    const query = new URLSearchParams()
    if (params.page) query.append('page', params.page.toString())
    if (params.type) query.append('type', params.type)
    if (params.materialId) query.append('materialId', params.materialId)
    if (params.startDate) query.append('startDate', params.startDate)
    if (params.endDate) query.append('endDate', params.endDate)

    const response = await this.get<any>(`warehouse?${query.toString()}`)
    return response.data
  }

  async createMovement(payload: any) {
    const response = await this.post<any>('warehouse', payload);
    return response.data;
  }
}

export default new WarehouseService();
