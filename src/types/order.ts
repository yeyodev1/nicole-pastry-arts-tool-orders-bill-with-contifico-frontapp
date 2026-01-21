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
}

export interface InvoiceData {
  ruc: string
  businessName: string
  email: string
  address: string
}

export interface OrderFormData {
  customerName: string
  customerPhone: string
  deliveryDate: string
  deliveryType: 'pickup' | 'delivery'
  invoiceNeeded: boolean
  comments: string
  responsible: string
  salesChannel: string
  paymentMethod: string
  invoiceData: InvoiceData
}

export interface Order extends OrderFormData {
  _id: string
  orderDate: string
  products: CartItem[]
  totalValue: number
  deliveryValue: number
  invoiceStatus?: 'PENDING' | 'PROCESSED' | 'ERROR'
  productionStage: 'PENDING' | 'IN_PROCESS' | 'FINISHED'
  productionNotes: string
  createdAt: string
  updatedAt: string
}
