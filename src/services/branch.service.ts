import APIBase from './httpBase'

export interface Branch {
  _id: string
  name: string
  isActive: boolean
  sortOrder: number
}

class BranchService extends APIBase {
  async getBranches(): Promise<Branch[]> {
    const res = await this.get<{ data: Branch[] }>('/branches')
    return res.data.data || []
  }

  async createBranch(data: { name: string; isActive?: boolean; sortOrder?: number }): Promise<Branch> {
    const res = await this.post<{ data: Branch }>('/branches', data)
    return res.data.data
  }

  async updateBranch(id: string, data: Partial<{ name: string; isActive: boolean; sortOrder: number }>): Promise<Branch> {
    const res = await this.put<{ data: Branch }>(`/branches/${id}`, data)
    return res.data.data
  }

  async deleteBranch(id: string): Promise<void> {
    await this.delete(`/branches/${id}`)
  }
}

export default new BranchService()
