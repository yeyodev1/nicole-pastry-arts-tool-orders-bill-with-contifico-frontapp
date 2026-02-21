import APIBase from "./httpBase";

class SupplierOrderService extends APIBase {
  async createOrder(data: any) {
    const response = await this.post<any>("/supplier-orders", data);
    return response.data;
  }

  async getOrders(params: any = {}) {
    const response = await this.get<any>("/supplier-orders", { params });
    return response.data;
  }

  async getOrderById(id: string) {
    const response = await this.get<any>(`/supplier-orders/${id}`);
    return response.data;
  }

  async updateOrder(id: string, data: any) {
    const response = await this.put<any>(`/supplier-orders/${id}`, data);
    return response.data;
  }

  async deleteOrder(id: string) {
    const response = await this.delete<any>(`/supplier-orders/${id}`);
    return response.data;
  }
}

export default new SupplierOrderService();
