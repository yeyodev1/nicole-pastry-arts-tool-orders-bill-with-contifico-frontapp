import APIBase from './httpBase'

export interface WarehousePoint {
  _id?: string
  name: string
  isActive: boolean
}

export interface WarehouseSettingsData {
  receptionPoints: WarehousePoint[]
  dispatchPoints: WarehousePoint[]
}

class WarehouseSettingsService extends APIBase {
  async getSettings(): Promise<WarehouseSettingsData> {
    const res = await this.get<{ data: WarehouseSettingsData }>('/settings/warehouse')
    return res.data.data
  }

  async updateSettings(data: WarehouseSettingsData): Promise<WarehouseSettingsData> {
    const res = await this.put<{ data: WarehouseSettingsData }>('/settings/warehouse', data)
    return res.data.data
  }
}

export default new WarehouseSettingsService()
