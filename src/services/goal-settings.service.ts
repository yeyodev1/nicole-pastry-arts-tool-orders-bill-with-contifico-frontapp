import APIBase from './httpBase'

export interface GoalSettingsData {
  managerGoal: number
  sellerGoal: number
  // Per-person overrides: keyed by person name (stat._id from analytics)
  individualGoals: Record<string, number>
  // Dynamic commission tiers. Rate is a percentage (e.g. 2 for 2%)
  commissionTiers: Array<{ threshold: number; rate: number }>
}

interface GoalSettingsResponse {
  message: string
  data: GoalSettingsData
}

class GoalSettingsService extends APIBase {
  async getGoals(): Promise<GoalSettingsData> {
    const response = await this.get<GoalSettingsResponse>('settings/goals')
    return response.data.data
  }

  async updateGoals(payload: GoalSettingsData): Promise<GoalSettingsData> {
    const response = await this.put<GoalSettingsResponse>('settings/goals', payload)
    return response.data.data
  }
}

export default new GoalSettingsService()
