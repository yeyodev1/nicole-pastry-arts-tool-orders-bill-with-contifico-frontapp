import APIBase from './httpBase';

export interface RestockItem {
  productName: string;
  unit: string;
  isGeneral?: boolean;
  requiresMinimum?: boolean;
  category?: 'Producción' | 'Bodega';
  stockObjectiveTomorrow: number;
  stockObjectiveToday: number;
  lastEntry?: {
    stockFinal: number;
    bajas: number;
    pedidoSugerido: number;
    pedidoFinal: number;
    date: string;
    detailedLosses?: DetailedLoss[];
  };
}

export interface DailyFormData {
  branch: string;
  formDate: string;
  targetDate: string;
  items: RestockItem[];
  upcomingOrders?: any[];
}

export type LossCategory = "Transport" | "Storage" | "Production" | "Other";

export interface DetailedLoss {
  quantity: number;
  reason: string;
  category: LossCategory;
}

export interface RestockEntryItem {
  productName: string;
  unit: string;
  isGeneral?: boolean;
  requiresMinimum?: boolean;
  category?: 'Producción' | 'Bodega';
  bajas: number;
  bajasNote?: string;
  stockFinal: number; // This is the 'excedente'
  pedidoFinal: number;
  detailedLosses?: DetailedLoss[];
}

export interface RestockEntryPayload {
  branch: string;
  date: string;
  submittedBy: string;
  items: RestockEntryItem[];
}

export interface WeeklyObjectives {
  monday: number;
  tuesday: number;
  wednesday: number;
  thursday: number;
  friday: number;
  saturday: number;
  sunday: number;
}

class POSRestockService extends APIBase {
  /**
   * Get the daily form data for a specific branch.
   */
  async getDailyForm(branch: string): Promise<DailyFormData> {
    const { data } = await this.get<any>('pos/restock/daily-form', undefined, { params: { branch } });
    return data.data;
  }

  /**
   * Submit the daily restock entry.
   */
  async submitDailyEntry(payload: RestockEntryPayload): Promise<any> {
    const { data } = await this.post<any>('pos/restock/daily-entry', payload);
    return data;
  }

  // TODO: Add real endpoints
  async getRestockConfiguration(branch: string): Promise<any[]> {
    const { data } = await this.get<any>('pos/restock/objectives', undefined, { params: { branch } });
    return data.data || [];
  }

  async upsertObjective(payload: any): Promise<void> {
    await this.post('pos/restock/objectives', payload);
  }

  async deleteObjective(branch: string, productName: string): Promise<void> {
    await this.delete(`pos/restock/objectives/${productName}`, { params: { branch } });
  }
}

export const posRestockService = new POSRestockService();
