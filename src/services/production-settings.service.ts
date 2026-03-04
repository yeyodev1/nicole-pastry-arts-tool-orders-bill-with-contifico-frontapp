import APIBase from './httpBase'

export interface ProductionDestination {
  id: string;
  name: string;
  icon: string;
  matchKeywords: string[];
}

export interface ProductionSettingsData {
  destinations: ProductionDestination[];
}

interface ProductionSettingsResponse {
  message: string;
  data: ProductionSettingsData;
}

class ProductionSettingsService extends APIBase {
  async getSettings(): Promise<ProductionSettingsData> {
    const response = await this.get<ProductionSettingsResponse>('settings/production')
    return response.data.data
  }

  async updateSettings(payload: ProductionSettingsData): Promise<ProductionSettingsData> {
    const response = await this.put<ProductionSettingsResponse>('settings/production', payload)
    return response.data.data
  }
}

export default new ProductionSettingsService()
