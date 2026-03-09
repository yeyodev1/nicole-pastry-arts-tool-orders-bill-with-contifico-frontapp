import APIBase from './httpBase'

class RawMaterialService extends APIBase {
  async getRawMaterials(search?: string, provider?: string, category?: string, receptionPoint?: string) {
    const params: Record<string, string> = {}
    if (search) params.search = search
    if (provider) params.provider = provider
    if (category) params.category = category
    if (receptionPoint) params.receptionPoint = receptionPoint
    const response = await this.get<any>('raw-materials', undefined, { params })
    return response.data.data
  }

  async createRawMaterial(materialData: any) {
    const response = await this.post<any>('raw-materials', materialData)
    return response.data.data
  }

  async updateRawMaterial(id: string, materialData: any) {
    const response = await this.patch<any>(`raw-materials/${id}`, materialData)
    return response.data.data
  }

  async deleteRawMaterial(id: string) {
    const response = await this.delete<any>(`raw-materials/${id}`)
    return response.data
  }
}

export default new RawMaterialService()
