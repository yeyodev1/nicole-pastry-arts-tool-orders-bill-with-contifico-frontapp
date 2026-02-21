export interface RawMaterial {
  _id: string;
  name: string;
  unit: string;
  quantity: number;
  cost: number;
  provider?: string | { _id: string; name: string };
}

export interface Provider {
  _id: string;
  name: string;
}

export interface Movement {
  _id: string;
  type: 'IN' | 'OUT' | 'LOSS';
  rawMaterial: RawMaterial;
  quantity: number;
  unitCost: number;
  totalValue: number;
  date: string;
  createdAt?: string;
  responsible?: string;
  entity?: string;
  provider?: Provider;
  user?: { _id: string; name: string };
}

export interface Option {
  value: string;
  label: string;
  subtitle?: string;
  rawOrder?: any;
  rawItem?: any;
}

export interface WarehouseInForm {
  date: string;
  time: string;
  rawMaterial: string;
  quantity: number;
  unitCost: number;
  provider: string;
  responsible: string;
  observation: string;
  suggestedOrderId: string;
}

export interface WarehouseOutForm {
  date: string;
  time: string;
  rawMaterial: string;
  quantity: number;
  responsible: string;
  entity: string;
  observation: string;
  expectedSaleValue: number;
}

export interface WarehouseLossFormState {
  date: string;
  time: string;
  rawMaterial: string;
  quantity: number;
  responsible: string;
  observation: string;
  reason: string;
}
