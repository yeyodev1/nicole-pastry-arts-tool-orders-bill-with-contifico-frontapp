import APIBase from './httpBase'

class RawMaterialService extends APIBase {
  async getRawMaterials(search?: string) {
    const params = search ? { search } : {}
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
