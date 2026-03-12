export interface RawMaterial {
  _id: string;
  name: string;
  unit: string;
  quantity: number;
  cost: number;
  presentationPrice?: number;
  presentationQuantity?: number;
  provider?: string | { _id: string; name: string };
  providers?: { provider: any; price: number; isMain: boolean }[];
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
  receptionPoint?: string;
  entity?: string;
  provider?: Provider;
  user?: { _id: string; name: string };
  invoiceRef?: string;
  invoiceDueDate?: string;
  isPaid?: boolean;
  batchId?: string;
}

export interface Option {
  value: string;
  label: string;
  subtitle?: string;
  rawOrder?: any;
  rawItem?: any;
}

export interface ReceptionItem {
  rawMaterial: string;
  quantity: number;
  unitCost: number;
  provider?: string;
}

export interface DispatchItem {
  rawMaterial: string;
  sourceReceptionPoint: string;
  quantity: number;
}

export interface WarehouseInForm {
  date: string;
  time: string;
  provider: string;
  receptionPoint: string;
  invoiceRef: string;
  invoiceDueDate: string;
  responsible: string;
  observation: string;
  suggestedOrderId: string;
  items: ReceptionItem[];
}

export interface WarehouseOutForm {
  date: string;
  time: string;
  entity: string;
  responsible: string;
  observation: string;
  items: DispatchItem[];
}

export interface LocationStock {
  location: string;
  stock: number;
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

export interface InvoiceGroup {
  _id: string;
  invoiceDueDate: string;
  isPaid: boolean;
  provider?: Provider;
  totalValue: number;
  count: number;
  materials: string[];
  batchId?: string;
}
