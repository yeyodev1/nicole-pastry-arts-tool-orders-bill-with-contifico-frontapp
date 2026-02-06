<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import ProductionService from '@/services/production.service'
import { parseECTDate } from '@/utils/dateUtils'
import DispatchReportModal from './components/DispatchReportModal.vue'
import DispatchByDestinationModal from './components/DispatchByDestinationModal.vue'
import ToastNotification from '@/components/ToastNotification.vue'

interface Order {
  _id: string
  orderDate: string
  deliveryDate: string
  customerName: string
  customerPhone?: string
  salesChannel: string
  products: {
    _id: string
    name: string
    quantity: number
    productionStatus: string
    produced?: number
  }[]
  productionStage: string
  deliveryType: string
  branch?: string
  deliveryAddress?: string
  deliveryTime?: string

  // Dispatch
  dispatchStatus?: string
  dispatches?: {
    _id: string
    reportedAt: string
    destination: string
    items: any[]
  }[]
}

const orders = ref<Order[]>([])
const isLoading = ref(true)
const error = ref('')

// Filter State
const filterMode = ref('today') // Default to Today for focus
const filterBranch = ref<string | null>(null) // 'sanMarino', 'mallDelSol', 'centroProduccion', 'delivery'

// Collapse State
const isPendingExpanded = ref(true)
const isSentExpanded = ref(true)

// Modal State
const showDispatchModal = ref(false)
const showGlobalBatchModal = ref(false)
const selectedOrder = ref<Order | null>(null)
const dispatchDestination = ref('')

// Toast State
const showToast = ref(false)
const toastMessage = ref('')
const toastType = ref<'success' | 'error'>('success')

// Batch Selection
const selectedIds = ref<string[]>([])
const expandedOrders = ref<string[]>([])

const toggleProducts = (id: string) => {
  if (expandedOrders.value.includes(id)) {
    expandedOrders.value = expandedOrders.value.filter(i => i !== id)
  } else {
    expandedOrders.value.push(id)
  }
}

const toggleSelection = (id: string) => {
  if (selectedIds.value.includes(id)) {
    selectedIds.value = selectedIds.value.filter(i => i !== id)
  } else {
    selectedIds.value.push(id)
  }
}

const toggleSelectAll = () => {
  if (selectedIds.value.length === filteredOrders.value.length) {
    selectedIds.value = []
  } else {
    selectedIds.value = filteredOrders.value.map(o => o._id)
  }
}

const fetchOrders = async () => {
  try {
    isLoading.value = true
    const response = await ProductionService.getAllOrders()
    // Service now returns the array directly
    orders.value = response as any
  } catch (err) {
    console.error(err)
    error.value = 'No se pudieron cargar las órdenes.'
  } finally {
    isLoading.value = false
  }
}

const handleBatchDispatch = async () => {
  if (selectedIds.value.length === 0) return
  if (!confirm(`¿Estás seguro de marcar como ENVIADOS ${selectedIds.value.length} órdenes?`)) return

  try {
    isLoading.value = true
    await ProductionService.registerBatchDispatch(selectedIds.value)
    selectedIds.value = [] // clear selection
    await fetchOrders()
    // Using Toast instead of alert
    toastMessage.value = 'Envíos masivos registrados correctamente.'
    toastType.value = 'success'
    showToast.value = true
  } catch (err) {
    console.error(err)
    // Alert used here as fallback or update to toast? Let's keep consistent
    toastMessage.value = 'Hubo un error al procesar los envíos masivos.'
    toastType.value = 'error'
    showToast.value = true
  } finally {
    isLoading.value = false
  }
}

const handleGlobalBatchSuccess = async () => {
  await fetchOrders()
  toastMessage.value = '¡Envío masivo registrado con éxito!'
  toastType.value = 'success'
  showToast.value = true
}

const openDispatchModal = (order: Order) => {
  selectedOrder.value = order

  // Determine Destination Label
  if (order.deliveryType === 'delivery') {
    dispatchDestination.value = 'Domicilio / Delivery'
  } else {
    dispatchDestination.value = order.branch || 'Local'
  }

  showDispatchModal.value = true
}

const handleDispatchConfirm = async (payload: any) => {
  if (!selectedOrder.value) return

  try {
    isLoading.value = true
    await ProductionService.registerDispatch(selectedOrder.value._id, {
      ...payload,
      reportedBy: 'Producción'
    })
    showDispatchModal.value = false
    await fetchOrders() // Refresh to show new status
    toastMessage.value = 'Envío registrado.'
    toastType.value = 'success'
    showToast.value = true
  } catch (err: any) {
    toastMessage.value = 'Error registrando envío: ' + (err.response?.data?.message || err.message)
    toastType.value = 'error'
    showToast.value = true
  } finally {
    isLoading.value = false
  }
}

// Helper to strip time for date comparison
const isSameDay = (d1: Date, d2: Date) => {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
}

// 1. First: Filter by Date (Time) - This is the "Base" for the view
const ordersByDate = computed(() => {
  if (filterMode.value === 'all') return orders.value

  const now = new Date()
  // Normalizing "today" to EC midnight
  const ecToday = new Date(now.toLocaleString('en-US', { timeZone: 'America/Guayaquil' }))
  const today = new Date(ecToday.getFullYear(), ecToday.getMonth(), ecToday.getDate())

  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  return orders.value.filter(o => {
    // Crucial: Use parseECTDate to treat UTC midnight as EC midnight
    const dDate = parseECTDate(o.deliveryDate)

    if (filterMode.value === 'today') {
      return isSameDay(dDate, today)
    }
    if (filterMode.value === 'tomorrow') {
      return isSameDay(dDate, tomorrow)
    }
    if (filterMode.value === 'yesterday') {
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      return isSameDay(dDate, yesterday)
    }
    if (filterMode.value === 'future') {
      return dDate > tomorrow
    }
    if (filterMode.value === 'overdue') {
      return dDate < today
    }
    return true
  })
})

// 2. Second: Filter by Branch/Type if selected (The Clickable Cards)
const filteredOrders = computed(() => {
  let result = ordersByDate.value // Use the date-filtered list!

  if (filterBranch.value) {
    result = result.filter(o => {
      if (filterBranch.value === 'delivery') {
        return o.deliveryType === 'delivery'
      }

      const branch = (o.branch || '').toLowerCase()
      if (filterBranch.value === 'sanMarino') return branch.includes('marino')
      if (filterBranch.value === 'mallDelSol') return branch.includes('mall') || branch.includes('sol')
      if (filterBranch.value === 'centroProduccion') return branch.includes('centro') || branch.includes('producci')

      return false
    })
  }

  return result
})

const pendingDispatchOrders = computed(() => {
  return filteredOrders.value.filter(o => !o.dispatchStatus || o.dispatchStatus === 'NOT_SENT' || o.dispatchStatus === 'PARTIAL')
})

const dispatchedOrders = computed(() => {
  return filteredOrders.value.filter(o => o.dispatchStatus === 'SENT' || o.dispatchStatus === 'PROBLEM')
})

const stats = computed(() => {
  const s = {
    sanMarino: 0,
    mallDelSol: 0,
    centroProduccion: 0,
    delivery: 0
  }

  // Calculate stats based on orders filtered by DATE.
  // This ensures that when "Today" is selected, the stats show counts for Today.
  ordersByDate.value.forEach(o => {
    // If delivery, count as delivery
    if (o.deliveryType === 'delivery') {
      s.delivery++
      return
    }

    // If pickup, check branch
    const branch = (o.branch || '').toLowerCase()
    if (branch.includes('marino')) s.sanMarino++
    else if (branch.includes('mall') || branch.includes('sol')) s.mallDelSol++
    else if (branch.includes('centro') || branch.includes('producci')) s.centroProduccion++
    else s.delivery++ // Fallback
  })

  return s
})

const toggleBranchFilter = (branch: string) => {
  if (filterBranch.value === branch) {
    filterBranch.value = null // Deselect
  } else {
    filterBranch.value = branch
  }
}

onMounted(async () => {
  await fetchOrders()
})

const formatDate = (dateString: string, timeString?: string) => {
  if (!dateString) return '-'
  const date = parseECTDate(dateString)

  const options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  }

  const formattedDate = new Intl.DateTimeFormat('es-EC', options).format(date)

  if (timeString && timeString.includes(':')) {
    return `${formattedDate}, ${timeString}`
  }

  const isMidnight = date.getHours() === 0 && date.getMinutes() === 0
  if (!isMidnight) {
    const timeOpts: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }
    const timePart = new Intl.DateTimeFormat('es-EC', timeOpts).format(date)
    return `${formattedDate}, ${timePart.toUpperCase()}`
  }

  return formattedDate
}

const getChannelParams = (channel: string) => {
  const norm = (channel || '').toLowerCase()
  if (norm.includes('whatsapp') || norm.includes('wsp') || norm.includes('ws') || norm.includes('web')) {
    return { class: 'whatsapp', label: 'WhatsApp', icon: 'fab fa-whatsapp' }
  }
  return { class: 'default', label: channel || 'Venta', icon: 'fas fa-store' }
}

const getDestination = (order: Order) => {
  if (order.deliveryType === 'delivery') {
    return {
      type: 'DOMICILIO',
      label: 'Delivery / Domicilio',
      detail: order.deliveryAddress || 'Dirección no especificada',
      icon: 'fas fa-motorcycle',
      class: 'dest-delivery'
    }
  }

  return {
    type: 'RETIRO',
    label: `Retiro - ${order.branch || 'Local desconocida'}`,
    detail: 'Cliente retira en local',
    icon: 'fas fa-store',
    class: 'dest-pickup'
  }
}

const getStatusBadge = (stage: string) => {
  const map: Record<string, any> = {
    'PENDING': { label: 'PENDIENTE', class: 'status-pending' },
    'IN_PROCESS': { label: 'EN PROCESO', class: 'status-process' },
    'FINISHED': { label: 'TERMINADO', class: 'status-finished' },
    'DELAYED': { label: 'ATRASADO', class: 'status-delayed' }
  }
  return map[stage] || { label: stage, class: '' }
}

const getDispatchBadge = (status?: string) => {
  const map: Record<string, any> = {
    'NOT_SENT': { label: 'NO ENVIADO', class: 'disp-none' },
    'PARTIAL': { label: 'PARCIAL', class: 'disp-partial' },
    'SENT': { label: 'ENVIADO', class: 'disp-sent' },
    'PROBLEM': { label: 'EXCESO / ERROR', class: 'disp-problem' }
  }
  return map[status || 'NOT_SENT'] || map['NOT_SENT']
}
</script>

<template>
  <div class="orders-view">
    <div class="header">
      <div class="title-box">
        <h1>Órdenes de Producción</h1>
        <p>Listado general - Ventas WhatsApp y Local</p>
      </div>
      <div class="actions-header">
        <button class="btn-primary" @click="showGlobalBatchModal = true">
          <i class="fas fa-shipping-fast"></i> Nuevo Envío Masivo
        </button>
        <button @click="fetchOrders" class="btn-refresh" :disabled="isLoading">
          <i class="fas fa-sync-alt" :class="{ 'fa-spin': isLoading }"></i>
        </button>
      </div>
    </div>

    <!-- Filter Bar (Moved Top) -->
    <div class="filter-bar-container">
      <div class="filter-bar">
        <button 
          v-for="mode in ['yesterday', 'today', 'tomorrow', 'future', 'all']" 
          :key="mode"
          class="filter-pill"
          :class="{ active: filterMode === mode }"
          @click="filterMode = mode"
        >
          <span v-if="mode === 'yesterday'">Ayer</span>
          <span v-else-if="mode === 'today'">Hoy</span>
          <span v-else-if="mode === 'tomorrow'">Mañana</span>
          <span v-else-if="mode === 'future'">Próximos Días</span>
          <span v-else>Todos</span>
        </button>
      </div>
    </div>

    <!-- Stats Summary (Clickable Filters) -->
    <div class="stats-grid" v-if="orders.length > 0">
      <div 
        class="stat-card" 
        :class="{ active: filterBranch === 'sanMarino' }"
        @click="toggleBranchFilter('sanMarino')"
      >
        <div class="icon-box sm"><i class="fas fa-store-alt"></i></div>
        <div class="info">
          <span class="count">{{ stats.sanMarino }}</span>
          <span class="label">San Marino</span>
        </div>
      </div>
      <div 
        class="stat-card"
        :class="{ active: filterBranch === 'mallDelSol' }"
        @click="toggleBranchFilter('mallDelSol')"
      >
        <div class="icon-box mds"><i class="fas fa-shopping-bag"></i></div>
        <div class="info">
          <span class="count">{{ stats.mallDelSol }}</span>
          <span class="label">Mall del Sol</span>
        </div>
      </div>
      <div 
        class="stat-card"
        :class="{ active: filterBranch === 'centroProduccion' }"
        @click="toggleBranchFilter('centroProduccion')"
      >
        <div class="icon-box cp"><i class="fas fa-industry"></i></div>
        <div class="info">
          <span class="count">{{ stats.centroProduccion }}</span>
          <span class="label">Centro Prod.</span>
        </div>
      </div>
      <div 
        class="stat-card"
        :class="{ active: filterBranch === 'delivery' }"
        @click="toggleBranchFilter('delivery')"
      >
        <div class="icon-box del"><i class="fas fa-motorcycle"></i></div>
        <div class="info">
          <span class="count">{{ stats.delivery }}</span>
          <span class="label">Delivery</span>
        </div>
      </div>
    </div>

    <div v-if="isLoading && orders.length === 0" class="loading">
      <div class="loader"></div>
      <p>Cargando órdenes...</p>
    </div>

    <div v-else-if="filteredOrders.length > 0" class="sections-container">
      
      <!-- Section: Pending Dispatch -->
      <div class="order-section" :class="{ 'collapsed': !isPendingExpanded }">
        <div class="section-header" @click="isPendingExpanded = !isPendingExpanded">
          <div class="header-main">
            <i class="fas fa-chevron-right chevron"></i>
            <h3>Pedidos por enviar</h3>
            <span class="badge pending">{{ pendingDispatchOrders.length }}</span>
          </div>
          <div class="header-actions" v-if="isPendingExpanded && selectedIds.length > 0">
            <button class="btn-bulk" @click.stop="handleBatchDispatch">
              <i class="fas fa-shipping-fast"></i> Reportar {{ selectedIds.length }} Envíos
            </button>
          </div>
        </div>
        
        <div class="section-content" v-show="isPendingExpanded">
          <div class="table-container">
            <table class="orders-table">
              <thead>
                <tr>
                  <th class="col-check">
                    <input 
                      type="checkbox" 
                      :checked="selectedIds.length === pendingDispatchOrders.length && pendingDispatchOrders.length > 0"
                      @change="toggleSelectAll"
                    >
                  </th>
                  <th>Cliente</th>
                  <th>Canal</th>
                  <th>Destino / Entrega</th>
                  <th>Items</th>
                  <th>Estado y Acción</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="order in pendingDispatchOrders" :key="order._id" :class="{ selected: selectedIds.includes(order._id) }">
                  <td class="col-check">
                     <input 
                      type="checkbox" 
                      :checked="selectedIds.includes(order._id)"
                      @change="toggleSelection(order._id)"
                    >
                  </td>
                  <td class="col-client">
                    <span class="name">{{ order.customerName }}</span>
                    <span class="phone" v-if="order.customerPhone"><i class="fas fa-phone-alt"></i> {{ order.customerPhone }}</span>
                    <span class="date-created">Creado: {{ formatDate(order.orderDate) }}</span>
                  </td>
                  <td>
                    <div class="channel-badge" :class="getChannelParams(order.salesChannel).class">
                      <i :class="getChannelParams(order.salesChannel).icon"></i>
                      <span>{{ getChannelParams(order.salesChannel).label }}</span>
                    </div>
                  </td>
                  <td class="col-date">
                    <div class="delivery-date">
                      <i class="far fa-calendar-alt"></i>
                      {{ formatDate(order.deliveryDate, order.deliveryTime) }}
                    </div>
                    
                    <div class="destination-box" :class="getDestination(order).class">
                      <div class="dest-header">
                        <i :class="getDestination(order).icon"></i>
                        <span>{{ getDestination(order).label }}</span>
                      </div>
                      <small class="dest-detail" v-if="getDestination(order).detail">{{ getDestination(order).detail }}</small>
                    </div>
                  </td>
                  <td class="col-items">
                    <div class="items-dropdown" :class="{ 'is-expanded': expandedOrders.includes(order._id) }">
                      <div class="items-summary" @click="toggleProducts(order._id)">
                        <span class="main-item">
                          <strong>x{{ order.products[0]?.quantity || 0 }}</strong> {{ order.products[0]?.name || 'Sin items' }}
                        </span>
                        <span v-if="order.products.length > 1" class="more-count">
                          +{{ order.products.length - 1 }} más
                        </span>
                        <i class="fas fa-chevron-down toggle-icon"></i>
                      </div>
                      
                      <div class="items-expanded-list" v-if="expandedOrders.includes(order._id)">
                        <div v-for="(prod, idx) in order.products" :key="idx" class="expanded-item">
                           <div class="item-meta">
                             <strong>x{{ prod.quantity }}</strong>
                             <span>{{ prod.name }}</span>
                           </div>
                           <i 
                            v-if="prod.productionStatus === 'COMPLETED'" 
                            class="fas fa-check-circle" 
                            style="color: #2ecc71;"
                          ></i>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div class="status-action-row">
                      <div class="status-col">
                        <span class="status-pill" :class="getStatusBadge(order.productionStage).class">
                          {{ getStatusBadge(order.productionStage).label }}
                        </span>
                        <span 
                          class="dispatch-badge" 
                          :class="getDispatchBadge(order.dispatchStatus).class"
                          v-if="order.dispatchStatus && order.dispatchStatus !== 'NOT_SENT'"
                        >
                          <i class="fas fa-truck"></i> {{ getDispatchBadge(order.dispatchStatus).label }}
                        </span>
                      </div>
                      <div class="action-col">
                        <button class="btn-dispatch" @click="openDispatchModal(order)">
                          <i class="fas fa-paper-plane"></i> Reportar Envío
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
                <tr v-if="pendingDispatchOrders.length === 0">
                  <td colspan="6" class="empty-row">No hay pedidos pendientes por enviar</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Section: Dispatched -->
      <div class="order-section dispatched" :class="{ 'collapsed': !isSentExpanded }">
        <div class="section-header" @click="isSentExpanded = !isSentExpanded">
          <div class="header-main">
            <i class="fas fa-chevron-right chevron"></i>
            <h3>Pedidos enviados</h3>
            <span class="badge sent">{{ dispatchedOrders.length }}</span>
          </div>
        </div>
        
        <div class="section-content" v-show="isSentExpanded">
          <div class="table-container">
            <table class="orders-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Canal</th>
                  <th>Destino / Entrega</th>
                  <th>Items</th>
                  <th>Estado y Acción</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="order in dispatchedOrders" :key="order._id">
                  <td class="col-client">
                    <span class="name">{{ order.customerName }}</span>
                    <span class="phone" v-if="order.customerPhone"><i class="fas fa-phone-alt"></i> {{ order.customerPhone }}</span>
                    <span class="date-created">Creado: {{ formatDate(order.orderDate) }}</span>
                  </td>
                  <td>
                    <div class="channel-badge" :class="getChannelParams(order.salesChannel).class">
                      <i :class="getChannelParams(order.salesChannel).icon"></i>
                      <span>{{ getChannelParams(order.salesChannel).label }}</span>
                    </div>
                  </td>
                  <td class="col-date">
                    <div class="delivery-date">
                      <i class="far fa-calendar-alt"></i>
                      {{ formatDate(order.deliveryDate, order.deliveryTime) }}
                    </div>
                    
                    <div class="destination-box" :class="getDestination(order).class">
                      <div class="dest-header">
                        <i :class="getDestination(order).icon"></i>
                        <span>{{ getDestination(order).label }}</span>
                      </div>
                      <small class="dest-detail" v-if="getDestination(order).detail">{{ getDestination(order).detail }}</small>
                    </div>
                  </td>
                  <td class="col-items">
                    <div class="items-dropdown" :class="{ 'is-expanded': expandedOrders.includes(order._id) }">
                      <div class="items-summary" @click="toggleProducts(order._id)">
                        <span class="main-item">
                          <strong>x{{ order.products[0]?.quantity || 0 }}</strong> {{ order.products[0]?.name || 'Sin items' }}
                        </span>
                        <span v-if="order.products.length > 1" class="more-count">
                          +{{ order.products.length - 1 }} más
                        </span>
                        <i class="fas fa-chevron-down toggle-icon"></i>
                      </div>
                      
                      <div class="items-expanded-list" v-if="expandedOrders.includes(order._id)">
                        <div v-for="(prod, idx) in order.products" :key="idx" class="expanded-item">
                           <div class="item-meta">
                             <strong>x{{ prod.quantity }}</strong>
                             <span>{{ prod.name }}</span>
                           </div>
                           <i 
                            v-if="prod.productionStatus === 'COMPLETED'" 
                            class="fas fa-check-circle" 
                            style="color: #2ecc71;"
                          ></i>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div class="status-action-row">
                      <div class="status-col">
                        <span class="status-pill" :class="getStatusBadge(order.productionStage).class">
                          {{ getStatusBadge(order.productionStage).label }}
                        </span>
                        <span 
                          class="dispatch-badge" 
                          :class="getDispatchBadge(order.dispatchStatus).class"
                        >
                          <i class="fas fa-truck-loading"></i> {{ getDispatchBadge(order.dispatchStatus).label }}
                        </span>
                      </div>
                      <div class="action-col">
                        <!-- Actions removed for production view -->
                      </div>
                    </div>
                  </td>
                </tr>
                <tr v-if="dispatchedOrders.length === 0">
                  <td colspan="5" class="empty-row">No hay pedidos enviados</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>

    <div v-else class="empty-state">
      <i class="fas fa-box-open"></i>
      <p>No hay órdenes activas en este momento.</p>
    </div>

    <!-- Modals -->
    <DispatchReportModal
      v-if="selectedOrder"
      :is-open="showDispatchModal"
      :order-id="selectedOrder._id"
      :destination="dispatchDestination"
      :products="selectedOrder.products"
      @close="showDispatchModal = false"
      @confirm="handleDispatchConfirm"
    />

    <DispatchByDestinationModal 
      :is-open="showGlobalBatchModal"
      @close="showGlobalBatchModal = false"
      @success="handleGlobalBatchSuccess"
    />

    <ToastNotification 
       :show="showToast"
       :message="toastMessage"
       :type="toastType"
       @close="showToast = false"
    />
  </div>
</template>

<style lang="scss" scoped>
$font-stack: 'Inter', system-ui, sans-serif;
$color-whatsapp: #25D366;
$color-primary: #8e44ad;
$color-pending: #3498db;
$color-success: #2ecc71;
$color-warning: #f1c40f;
$color-danger: #e74c3c;

.orders-view {
  padding: 1.5rem;
  background-color: #f8f9fa;
  min-height: 100vh;
  font-family: $font-stack;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;

  h1 {
    font-size: 1.5rem;
    color: #2c3e50;
    margin: 0;
    font-weight: 700;
  }

  p {
    color: #7f8c8d;
    margin: 0.2rem 0 0 0;
    font-size: 0.9rem;
  }

  .actions-header {
    display: flex;
    gap: 0.5rem;
    align-items: center;

    .btn-primary {
      background: $color-primary;
      color: white;
      border: none;
      padding: 0.6rem 1.2rem;
      border-radius: 10px;
      font-weight: 700;
      font-size: 0.85rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 4px 6px rgba($color-primary, 0.15);

      &:hover {
        background: lighten($color-primary, 5%);
        transform: translateY(-2px);
        box-shadow: 0 6px 12px rgba($color-primary, 0.25);
      }

      &:active {
        transform: translateY(0);
      }
    }

    .btn-refresh {
      background: white;
      border: 1px solid #dfe6e9;
      width: 40px;
      height: 40px;
      border-radius: 10px;
      cursor: pointer;
      color: #7f8c8d;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;

      &:hover {
        border-color: #bdc3c7;
        color: #2c3e50;
        background: #f8f9fa;
      }
    }
  }
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;

  .stat-card {
    background: white;
    padding: 1.25rem;
    border-radius: 16px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.03);
    display: flex;
    align-items: center;
    gap: 1rem;
    border: 1px solid rgba(0, 0, 0, 0.03);
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    cursor: pointer;
    position: relative;
    overflow: hidden;

    &:hover {
      transform: translateY(-3px);
      box-shadow: 0 8px 15px rgba(0, 0, 0, 0.05);
    }

    &.active {
      border: 2px solid $color-primary;
      background: #fdfaff; // Very subtle purple tint
      box-shadow: 0 4px 12px rgba($color-primary, 0.15);

      .icon-box {
        background: $color-primary !important;
        color: white !important;
      }
    }

    .icon-box {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.2rem;

      &.sm {
        background: rgba($color-pending, 0.1);
        color: $color-pending;
      }

      &.mds {
        background: rgba($color-warning, 0.1);
        color: #d4ac0d;
      }

      &.cp {
        background: rgba($color-primary, 0.1);
        color: $color-primary;
      }

      &.del {
        background: rgba(#e67e22, 0.1);
        color: #e67e22;
      }
    }

    .info {
      display: flex;
      flex-direction: column;

      .count {
        font-size: 1.5rem;
        font-weight: 800;
        color: #2c3e50;
        line-height: 1.1;
      }

      .label {
        font-size: 0.75rem;
        color: #95a5a6;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
    }
  }
}

.filter-bar-container {
  margin-bottom: 2rem;
  background: white;
  padding: 0.5rem;
  border-radius: 14px;
  display: inline-flex;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.02);
  border: 1px solid #f1f2f6;

  .filter-bar {
    display: flex;
    gap: 0.25rem;

    .filter-pill {
      background: transparent;
      border: none;
      color: #7f8c8d;
      padding: 0.6rem 1.4rem;
      border-radius: 10px;
      font-size: 0.85rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s;
      white-space: nowrap;

      &:hover {
        background: #f8f9fa;
        color: #2c3e50;
      }

      &.active {
        background: #2c3e50;
        color: white;
        box-shadow: 0 4px 10px rgba(52, 73, 94, 0.15);
      }
    }
  }
}

.sections-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.order-section {
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
  border: 1px solid #f1f2f6;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &.collapsed {
    .section-header .chevron {
      transform: rotate(0deg);
    }
  }

  &.dispatched {
    border-top: 4px solid #bdc3c7;

    .section-header {
      background: #fdfdfd;

      h3 {
        color: #7f8c8d;
      }
    }
  }

  .section-header {
    padding: 1.25rem 1.5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    user-select: none;
    border-bottom: 1px solid transparent;
    transition: background 0.2s;

    &:hover {
      background: #fafafa;
    }

    .header-main {
      display: flex;
      align-items: center;
      gap: 1rem;

      .chevron {
        font-size: 0.9rem;
        color: #bdc3c7;
        transform: rotate(90deg);
        transition: transform 0.3s;
      }

      h3 {
        margin: 0;
        font-size: 1.1rem;
        font-weight: 700;
        color: #2c3e50;
      }

      .badge {
        font-size: 0.8rem;
        padding: 2px 10px;
        border-radius: 20px;
        font-weight: 800;

        &.pending {
          background: rgba($color-pending, 0.1);
          color: $color-pending;
        }

        &.sent {
          background: rgba(#bdc3c7, 0.2);
          color: #7f8c8d;
        }
      }
    }

    .header-actions {
      .btn-bulk {
        background: $color-success;
        color: white;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 8px;
        font-weight: 700;
        font-size: 0.8rem;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        animation: pulse 2s infinite;

        &:hover {
          background: darken($color-success, 5%);
        }
      }
    }
  }

  .section-content {
    border-top: 1px solid #f1f2f6;
  }
}

.table-container {
  overflow-x: auto;
}

.orders-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 900px;

  th {
    background: #fcfcfc;
    text-align: left;
    padding: 1rem 1.5rem;
    font-size: 0.7rem;
    text-transform: uppercase;
    color: #95a5a6;
    font-weight: 800;
    letter-spacing: 0.5px;
    border-bottom: 2px solid #f8f9fa;
  }

  td {
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid #f8f9fa;
    vertical-align: middle;
    font-size: 0.9rem;
    color: #2c3e50;
  }

  tr:last-child td {
    border-bottom: none;
  }

  tr:hover td {
    background: #fafbfc;
  }

  .empty-row {
    text-align: center;
    padding: 3rem;
    color: #bdc3c7;
    font-style: italic;
  }
}

.col-check {
  width: 40px;

  input {
    width: 18px;
    height: 18px;
    cursor: pointer;
  }
}

.col-client {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;

  .name {
    font-weight: 700;
    font-size: 1rem;
  }

  .phone {
    font-size: 0.85rem;
    color: #7f8c8d;
    display: flex;
    align-items: center;
    gap: 4px;

    i {
      color: $color-whatsapp;
      font-size: 0.75rem;
    }
  }

  .date-created {
    font-size: 0.7rem;
    color: #bdc3c7;
    text-transform: uppercase;
    font-weight: 600;
  }
}

.col-date {
  .delivery-date {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
    color: #2c3e50;

    i {
      color: #95a5a6;
    }
  }
}

.destination-box {
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  max-width: 220px;

  &.dest-delivery {
    background: #fef5e7;
    border: 1px solid rgba(#e67e22, 0.1);
  }

  &.dest-pickup {
    background: #eaf2f8;
    border: 1px solid rgba($color-pending, 0.1);
  }

  .dest-header {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.75rem;
    font-weight: 800;
    text-transform: uppercase;
    margin-bottom: 2px;
  }

  .dest-detail {
    display: block;
    font-size: 0.7rem;
    color: #7f8c8d;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.channel-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 800;
  text-transform: uppercase;

  &.whatsapp {
    background: rgba($color-whatsapp, 0.1);
    color: darken($color-whatsapp, 10%);
  }

  &.default {
    background: #f1f2f6;
    color: #7f8c8d;
  }
}

.items-dropdown {
  position: relative;
  min-width: 180px;

  &.is-expanded {
    .toggle-icon {
      transform: rotate(180deg);
    }
  }

  .items-summary {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    padding: 6px 10px;
    background: #f8f9fa;
    border-radius: 8px;
    border: 1px solid transparent;
    transition: all 0.2s;
    width: fit-content;

    &:hover {
      background: #f1f2f6;
      border-color: #dfe6e9;
    }

    .main-item {
      font-size: 0.85rem;
      color: #2c3e50;
      white-space: nowrap;

      strong {
        color: $color-primary;
      }
    }

    .more-count {
      background: #34495e;
      color: white;
      font-size: 0.65rem;
      font-weight: 800;
      padding: 2px 6px;
      border-radius: 5px;
      text-transform: uppercase;
    }

    .toggle-icon {
      font-size: 0.7rem;
      color: #95a5a6;
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
  }

  .items-expanded-list {
    position: absolute;
    top: 100%;
    left: 0;
    z-index: 100;
    margin-top: 6px;
    background: white;
    min-width: 250px;
    border-radius: 12px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.12);
    border: 1px solid #f1f2f6;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    animation: slideDown 0.2s cubic-bezier(0, 0, 0.2, 1);

    .expanded-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 8px;
      border-radius: 6px;
      transition: background 0.15s;

      &:hover {
        background: #f8f9fa;
      }

      .item-meta {
        display: flex;
        gap: 8px;
        font-size: 0.85rem;
        color: #2c3e50;

        strong {
          color: $color-primary;
          min-width: 25px;
        }
      }

      i {
        font-size: 0.9rem;
      }
    }
  }
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Redesigned Status Action Row */
.status-action-row {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.status-col {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 100px;
}

.action-col {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.status-pill {
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.65rem;
  font-weight: 800;
  text-align: center;
  letter-spacing: 0.3px;

  &.status-pending {
    background: #ebf5fb;
    color: #3498db;
  }

  &.status-process {
    background: #fff8e1;
    color: #f39c12;
  }

  &.status-finished {
    background: #e8f5e9;
    color: #2ecc71;
  }

  &.status-delayed {
    background: #ffebee;
    color: #e74c3c;
  }
}

.dispatch-badge {
  font-size: 0.65rem;
  font-weight: 800;
  padding: 3px 8px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 4px;

  &.disp-sent {
    color: $color-success;
    background: rgba($color-success, 0.1);
  }

  &.disp-partial {
    color: $color-warning;
    background: rgba($color-warning, 0.1);
  }

  &.disp-problem {
    color: $color-danger;
    background: rgba($color-danger, 0.1);
  }

  &.disp-none {
    color: #95a5a6;
    background: #f1f2f6;
  }
}

.btn-dispatch {
  background: $color-primary;
  color: white;
  border: none;
  padding: 8px 14px;
  border-radius: 8px;
  font-weight: 700;
  font-size: 0.75rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
  box-shadow: 0 4px 8px rgba($color-primary, 0.1);

  &:hover {
    background: lighten($color-primary, 5%);
    transform: translateX(2px);
  }
}



@keyframes pulse {
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba($color-success, 0.4);
  }

  70% {
    transform: scale(1.02);
    box-shadow: 0 0 0 10px rgba($color-success, 0);
  }

  100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba($color-success, 0);
  }
}

.loading,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 6rem 2rem;
  color: #bdc3c7;

  i {
    font-size: 4rem;
    margin-bottom: 1.5rem;
    opacity: 0.3;
  }

  .loader {
    width: 40px;
    height: 40px;
    border: 4px solid #f1f2f6;
    border-top-color: $color-primary;
    border-radius: 50%;
    animation: spin 1s infinite linear;
    margin-bottom: 2rem;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Mobile Adaptations */
@media (max-width: 768px) {
  .orders-view {
    padding: 1rem;
  }

  .header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }

  .status-action-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .filter-bar-container {
    width: 100%;
    overflow-x: auto;
  }
}
</style>
