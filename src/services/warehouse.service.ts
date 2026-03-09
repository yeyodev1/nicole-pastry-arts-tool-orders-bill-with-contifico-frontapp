import APIBase from './httpBase';

class WarehouseService extends APIBase {
  async getMovements(params: { page?: number; type?: string; materialId?: string; startDate?: string; endDate?: string; receptionPoint?: string } = {}) {
    const query = new URLSearchParams()
    if (params.page) query.append('page', params.page.toString())
    if (params.type) query.append('type', params.type)
    if (params.materialId) query.append('materialId', params.materialId)
    if (params.startDate) query.append('startDate', params.startDate)
    if (params.endDate) query.append('endDate', params.endDate)
    if (params.receptionPoint) query.append('receptionPoint', params.receptionPoint)

    const response = await this.get<any>(`warehouse?${query.toString()}`)
    return response.data
  }

  async createMovement(payload: any) {
    const response = await this.post<any>('warehouse', payload);
    return response.data;
  }

  async getStockByLocation(rawMaterialId: string): Promise<{ location: string; stock: number }[]> {
    const response = await this.get<{ data: { location: string; stock: number }[] }>(`warehouse/stock-by-location/${rawMaterialId}`)
    return response.data.data
  }

  async createBatch(payload: any) {
    const response = await this.post<any>('warehouse/batch', payload);
    return response.data;
  }

  async getInvoices(paid = false) {
    const response = await this.get<any>(`warehouse/invoices?paid=${paid}`);
    return response.data;
  }

  async markInvoicePaid(invoiceRef: string) {
    const response = await this.patch<any>(`warehouse/invoices/${encodeURIComponent(invoiceRef)}/pay`, {});
    return response.data;
  }
}

export default new WarehouseService();
