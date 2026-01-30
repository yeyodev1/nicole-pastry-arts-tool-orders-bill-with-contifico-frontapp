<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import ProductionService from '@/services/production.service'
import DispatchReportModal from './components/DispatchReportModal.vue'
import DispatchByDestinationModal from './components/DispatchByDestinationModal.vue'
import ToastNotification from '@/components/ToastNotification.vue'

interface Order {
  // ... (Order interface content is unchanged, omitted for brevity if tool allows partial match but using full replacement block for safety in this tool usually)
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
  }[]
  productionStage: string
  deliveryType: string
  branch?: string
  deliveryAddress?: string

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
const filterMode = ref('today') // Default to Today for focus

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

const handleRevert = async (order: Order) => {
  if (!confirm(`¿Estás seguro de devolver este ítem a producción? Se reiniciará el progreso.`)) return

  try {
    isLoading.value = true
    await ProductionService.revertOrder(order._id)
    await fetchOrders()
    toastMessage.value = 'Ítem devuelto a producción.'
    toastType.value = 'success'
    showToast.value = true
  } catch (err: any) {
    console.error(err)
    toastMessage.value = 'Error al devolver ítem. Reintente.'
    toastType.value = 'error'
    showToast.value = true
  } finally {
    isLoading.value = false
  }
}

// ... (rest of utils same)
// Helper to strip time for date comparison
const isSameDay = (d1: Date, d2: Date) => {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
}

const filteredOrders = computed(() => {
  if (filterMode.value === 'all') return orders.value

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  return orders.value.filter(o => {
    const dDate = new Date(o.deliveryDate)

    if (filterMode.value === 'today') {
      return isSameDay(dDate, today)
    }
    if (filterMode.value === 'tomorrow') {
      return isSameDay(dDate, tomorrow)
    }
    if (filterMode.value === 'yesterday') {
      // Strictly yesterday? Or overdue? 
      // User asked for "Ayer", usually implying "What happened yesterday" or "Overdue from yesterday". 
      // Given it's a list, probably strictly yesterday's delivery date.
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      return isSameDay(dDate, yesterday)
    }
    if (filterMode.value === 'future') {
      return dDate > tomorrow
    }
    if (filterMode.value === 'overdue') {
      // Extra utility: things due before today
      return dDate < today
    }
    return true
  })
})

const stats = computed(() => {
  const s = {
    sanMarino: 0,
    mallDelSol: 0,
    centroProduccion: 0,
    delivery: 0
  }

  // Calculate stats based on FILTERED views to match what the user sees
  filteredOrders.value.forEach(o => {
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

onMounted(async () => {
  await fetchOrders()
})

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

const formatDate = (dateString: string) => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('es-EC', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

const getChannelParams = (channel: string) => {
  const norm = (channel || '').toLowerCase()
  // User Rule: Currently all "Web" orders are actually "WhatsApp"
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

  // Retiro
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

    <!-- Stats Summary -->
    <div class="stats-grid" v-if="orders.length > 0">
      <div class="stat-card">
        <div class="icon-box sm"><i class="fas fa-store-alt"></i></div>
        <div class="info">
          <span class="count">{{ stats.sanMarino }}</span>
          <span class="label">San Marino</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="icon-box mds"><i class="fas fa-shopping-bag"></i></div>
        <div class="info">
          <span class="count">{{ stats.mallDelSol }}</span>
          <span class="label">Mall del Sol</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="icon-box cp"><i class="fas fa-industry"></i></div>
        <div class="info">
          <span class="count">{{ stats.centroProduccion }}</span>
          <span class="label">Centro Prod.</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="icon-box del"><i class="fas fa-motorcycle"></i></div>
        <div class="info">
          <span class="count">{{ stats.delivery }}</span>
          <span class="label">Delivery</span>
        </div>
      </div>
    </div>

    <!-- Filter Bar -->
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

    <div v-if="isLoading && orders.length === 0" class="loading">
      <div class="loader"></div>
      <p>Cargando órdenes...</p>
    </div>

    <div v-else-if="filteredOrders.length > 0" class="table-container">
      
      <!-- Bulk Actions Bar -->
      <div class="bulk-actions" v-if="selectedIds.length > 0">
        <span class="count">{{ selectedIds.length }} seleccionados</span>
        <button class="btn-bulk" @click="handleBatchDispatch">
          <i class="fas fa-shipping-fast"></i> Reportar {{ selectedIds.length }} Envíos
        </button>
      </div>

      <table class="orders-table">
        <thead>
          <tr>
            <th class="col-check">
              <input 
                type="checkbox" 
                :checked="selectedIds.length === filteredOrders.length && filteredOrders.length > 0"
                @change="toggleSelectAll"
              >
            </th>
            <th>Cliente</th>
            <th>Canal</th>
            <th>Destino / Entrega</th>
            <th>Items</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="order in filteredOrders" :key="order._id" :class="{ selected: selectedIds.includes(order._id) }">
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
                {{ formatDate(order.deliveryDate) }}
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
              <ul class="items-list">
                <li v-for="(prod, idx) in order.products" :key="idx">
                  <strong>x{{ prod.quantity }}</strong> {{ prod.name }}
                  <i 
                    v-if="prod.productionStatus === 'COMPLETED'" 
                    class="fas fa-check-circle" 
                    title="Terminado"
                    style="color: #2ecc71; margin-left: 4px;"
                  ></i>
                </li>
              </ul>
            </td>
            <td>
              <div class="status-stack">
                <span class="status-pill" :class="getStatusBadge(order.productionStage).class">
                  {{ getStatusBadge(order.productionStage).label }}
                </span>
                
                <div class="dispatch-group">
                  <span 
                    class="dispatch-badge" 
                    :class="getDispatchBadge(order.dispatchStatus).class"
                    v-if="order.dispatchStatus && order.dispatchStatus !== 'NOT_SENT'"
                  >
                    <i class="fas fa-truck"></i> {{ getDispatchBadge(order.dispatchStatus).label }}
                  </span>
                  
                  <button class="btn-dispatch" @click="openDispatchModal(order)">
                    <i class="fas fa-paper-plane"></i> Reportar Envío
                  </button>

                  <button 
                    v-if="order.productionStage === 'FINISHED'"
                    class="btn-revert-inline" 
                    @click="handleRevert(order)"
                  >
                    <i class="fas fa-undo-alt"></i> Devolver
                  </button>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
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
      background: #8e44ad;
      color: white;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 8px;
      font-weight: 700;
      font-size: 0.85rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
      box-shadow: 0 2px 5px rgba(142, 68, 173, 0.2);

      &:hover {
        background: #9b59b6;
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(142, 68, 173, 0.3);
      }
    }
  }

  .btn-refresh {
    background: white;
    border: 1px solid #dfe6e9;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    cursor: pointer;
    color: #7f8c8d;
    transition: all 0.2s;

    &:hover {
      border-color: #bdc3c7;
      color: #2c3e50;
    }
  }

  .btn-revert-inline {
    background: white;
    border: 1px solid #ffecec;
    color: #e74c3c;
    padding: 0.3rem 0.6rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
    transition: all 0.2s;
    margin-top: 4px;

    &:hover {
      background: #fff5f5;
      border-color: #e74c3c;
    }
  }
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;

  .stat-card {
    background: white;
    padding: 1rem;
    border-radius: 12px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
    display: flex;
    align-items: center;
    gap: 1rem;
    border: 1px solid rgba(0, 0, 0, 0.02);

    .icon-box {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.2rem;

      &.sm {
        background: #eaf2f8;
        color: #3498db;
      }

      &.mds {
        background: #fef5e7;
        color: #f1c40f;
      }

      &.cp {
        background: #e8daef;
        color: #9b59b6;
      }

      &.del {
        background: #fae5d3;
        color: #e67e22;
      }
    }

    .info {
      display: flex;
      flex-direction: column;

      .count {
        font-size: 1.4rem;
        font-weight: 800;
        color: #2c3e50;
        line-height: 1;
      }

      .label {
        font-size: 0.7rem;
        color: #95a5a6;
        font-weight: 600;
        text-transform: uppercase;
      }
    }
  }
}

.filter-bar {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  overflow-x: auto;
  padding-bottom: 4px; // scrollbar spacing

  .filter-pill {
    background: white;
    border: 1px solid #e1e8ed;
    color: #7f8c8d;
    padding: 0.5rem 1.2rem;
    border-radius: 20px;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;

    &:hover {
      background: #f8f9fa;
      color: #34495e;
    }

    &.active {
      background: #34495e;
      color: white;
      border-color: #34495e;
      box-shadow: 0 4px 10px rgba(52, 73, 94, 0.2);
    }
  }
}

.table-container {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  overflow-x: auto;
}

.orders-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 800px; // Ensure horizontal scroll on mobile

  th {
    background: #fdfdfd;
    text-align: left;
    padding: 1rem;
    font-size: 0.75rem;
    text-transform: uppercase;
    color: #95a5a6;
    font-weight: 700;
    border-bottom: 1px solid #f1f2f6;
  }

  td {
    padding: 1rem;
    border-bottom: 1px solid #f5f6fa;
    vertical-align: top;
    font-size: 0.9rem;
    color: #2c3e50;
  }

  tr:last-child td {
    border-bottom: none;
  }

  tr:hover td {
    background: #fafbfc;
  }
}

.col-client {
  display: flex;
  flex-direction: column;

  .name {
    font-weight: 600;
    font-size: 1rem;
    margin-bottom: 0.2rem;
  }

  .date-created {
    font-size: 0.75rem;
    color: #bdc3c7;
  }
}

.col-date {
  .delivery-date {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-weight: 500;
    margin-bottom: 0.2rem;

    i {
      color: #95a5a6;
    }
  }

  .delivery-type {
    font-size: 0.75rem;
    background: #f1f2f6;
    padding: 2px 6px;
    border-radius: 4px;
    color: #7f8c8d;
  }
}

/* Channel Badges */
.channel-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem 0.6rem;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;

  &.whatsapp {
    background: rgba($color-whatsapp, 0.1);
    color: shade($color-whatsapp, 20%);
    border: 1px solid rgba($color-whatsapp, 0.2);

    i {
      font-size: 0.9rem;
    }
  }

  &.default {
    background: #f1f2f6;
    color: #7f8c8d;
  }
}

/* Items List */
.items-list {
  list-style: none;
  padding: 0;
  margin: 0;

  li {
    margin-bottom: 0.3rem;
    font-size: 0.85rem;
    line-height: 1.4;

    strong {
      color: #8e44ad;
      font-weight: 700;
    }
  }
}

/* Status Pills */
.status-pill {
  padding: 0.3rem 0.6rem;
  border-radius: 6px;
  font-size: 0.7rem;
  font-weight: 700;
  display: inline-block;

  &.status-pending {
    background: #ebf5fb;
    color: #3498db;
  }

  &.status-process {
    background: #fef9e7;
    color: #f1c40f;
  }

  &.status-finished {
    background: #eafaf1;
    color: #2ecc71;
  }

  &.status-delayed {
    background: #fdedec;
    color: #e74c3c;
  }
}

.status-stack {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: flex-start;
}

.dispatch-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 4px;

  .dispatch-badge {
    font-size: 0.7rem;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
    display: inline-flex;
    align-items: center;
    gap: 4px;

    &.disp-sent {
      color: #2ecc71;
      background: #eafaf1;
    }

    &.disp-partial {
      color: #f1c40f;
      background: #fef9e7;
    }

    &.disp-problem {
      color: #e74c3c;
      background: #fdedec;
    }
  }

  .btn-dispatch {
    font-size: 0.8rem;
    padding: 6px 12px;
    background: #8e44ad;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    color: white;
    font-weight: 600;
    transition: all 0.2s;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    box-shadow: 0 2px 4px rgba(142, 68, 173, 0.2);
    margin-top: 4px;

    &:hover {
      background: #9b59b6;
      transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba(142, 68, 173, 0.3);
    }

    i {
      font-size: 0.9rem;
    }
  }
}

.loading,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 4rem;
  color: #bdc3c7;

  i {
    font-size: 3rem;
    margin-bottom: 1rem;
  }

  .loader {
    /* ... spinner css ... */
    width: 30px;
    height: 30px;
    border: 3px solid #eee;
    border-top-color: #8e44ad;
    border-radius: 50%;
    animation: spin 1s infinite linear;
    margin: 0 auto 1rem auto;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
