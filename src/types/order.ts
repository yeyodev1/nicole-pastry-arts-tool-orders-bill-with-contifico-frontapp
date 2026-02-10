export interface Product {
  id: string
  codigo: string
  tipo_producto: string
  para_pos: boolean
  nombre: string
  codigo_barra: string
  categoria_id: string
  marca_id: string | null
  marca_nombre: string | null
  porcentaje_iva: number
  pvp1: string
  pvp2: string | null
  pvp3: string | null
  pvp4: string | null
  minimo: string
  cantidad_stock: string
  estado: string
  pvp_manual: boolean
  imagen: string
  descripcion: string
  personalizado1: string
  personalizado2: string
  tipo: string
  producto_base_id: string | null
  nombre_producto_base: string | null
  variantes: any | null
  pvp_peso: string | null
  peso_desde: string | null
  peso_hasta: string | null
  cuenta_venta_id: string
  cuenta_compra_id: string
  cuenta_costo_id: string
  costo_maximo: string
  fecha_creacion: string
  codigo_proveedor: string | null
  lead_time: number
  generacion_automatica: boolean
  id_integracion_proveedor: string | null
  detalle_variantes: any[]
}

export interface CartItem {
  id?: string
  contifico_id?: string
  name: string
  price: number
  quantity: number
  category?: string // Grouping name (e.g., 'Tortas enteras')
  categoryId?: string // Contifico ID
  isCourtesy?: boolean
}

export interface InvoiceData {
  ruc: string
  businessName: string
  email: string
  address: string
}

export interface Payment {
  forma_cobro: string
  monto: number
  fecha: string
  status?: string
  numero_comprobante?: string
  reference?: string
}

export interface OrderFormData {
  customerName: string
  customerPhone: string
  deliveryDate: string
  deliveryTime: string // New field
  deliveryType: 'pickup' | 'delivery' | 'retiro' // 'retiro' is used in backend
  branch?: 'San Marino' | 'Mall del Sol' | 'Centro de Producción' // New field
  googleMapsLink?: string // New field
  deliveryAddress?: string // New field
  invoiceNeeded: boolean
  comments: string
  responsible: string
  salesChannel: string
  paymentMethod: string
  invoiceData: InvoiceData
  // New Payment Fields
  registerPaymentNow?: boolean
  isCredit?: boolean
  settledInIsland?: boolean
  settledIslandName?: string
  paymentDetails?: {
    forma_cobro: string
    monto: number
    fecha: string
    numero_comprobante: string
    numero_tarjeta?: string // Added for TC
    cuenta_bancaria_id: string
    tipo_ping: string
  }
  // Existing Payments for Edit Mode
  payments?: Payment[]

  // Added for Form Validation
  totalValue?: number
  deliveryValue?: number
  deliveryPerson?: {
    name: string
    identification: string
    personId?: string
  }
  globalDiscountPercentage?: number
  isGlobalCourtesy?: boolean
}

export interface Order extends OrderFormData {
  _id: string
  orderDate: string
  products: CartItem[]
  totalValue: number // Required here
  deliveryValue: number
  invoiceStatus?: 'PENDING' | 'PROCESSED' | 'ERROR'
  productionStage: 'PENDING' | 'IN_PROCESS' | 'FINISHED' | 'VOID'
  productionNotes: string
  createdAt: string
  updatedAt: string
  // History of payments
  payments?: Payment[]
}
