<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import POSService, { type POSOrder } from '@/services/pos.service'
import BulkReceptionModal from './components/BulkReceptionModal.vue'
import DeliveryModal from './components/DeliveryModal.vue'
import ToastNotification from '@/components/ToastNotification.vue'
import POSFilterBar, { type POSFilterMode } from './components/POSFilterBar.vue'
import { formatECT } from '@/utils/dateUtils'
import { useOrderExport } from '@/composables/useOrderExport'

const isLoading = ref(false)
const orders = ref<POSOrder[]>([])
const pendingDispatchesForBulk = ref<any[]>([])
const selectedBranch = ref('Mall del Sol')
const branches = ['Todas las sucursales', 'San Marino', 'Mall del Sol', 'Centro de Producción']

// POS-Specific Filter States
const filterMode = ref<POSFilterMode>('today')
const customDate = ref('')
const searchQuery = ref('')
const showDatePicker = computed(() => filterMode.value === 'custom')

// Modal States
const showBulkModal = ref(false)
const showDeliveryModal = ref(false)
const selectedOrder = ref<POSOrder | null>(null)

// Toast
const toast = ref<{ show: boolean; message: string; type: 'success' | 'error' | 'info' }>({ show: false, message: '', type: 'success' })

const fetchData = async () => {
  isLoading.value = true
  try {
    const filters = {
      search: searchQuery.value,
      filterMode: filterMode.value,
      date: customDate.value
    }

    // Fetch both endpoints in parallel
    const [pickupData, incomingData] = await Promise.all([
      POSService.getPickupOrders(selectedBranch.value, filters),
      POSService.getIncomingDispatches(selectedBranch.value, filters)
    ])

    // 1. Process Pickups (Orders ready for delivery or delivered)
    const pickups = pickupData || []

    // 2. Process Incoming Dispatches (In Transit -> Pending Reception)
    // Flatten dispatches to treat each dispatch as an actionable item if needed, 
    // or just show the order. The user likely wants to see the order.
    // The previous logic mapped to { ...o, dispatch: d }. We'll keep that for consistency.
    const incoming = incomingData
      .filter(o => o.posStatus === 'IN_TRANSIT')
      .flatMap(o =>
        (o.dispatches || [])
          .filter(d => d.receptionStatus === 'PENDING')
          .map(d => ({ ...o, orderId: o._id, dispatch: d }))
      )

    // Update the ref for the Bulk Modal
    pendingDispatchesForBulk.value = incoming

    // 3. Merge and Deduplicate for the Main Grid
    // We prioritize 'incoming' version if it exists because it has the 'dispatch' info attached
    const mergedMap = new Map()

    pickups.forEach(o => mergedMap.set(o._id, o))
    incoming.forEach(o => mergedMap.set(o._id, o))

    const allOrders = Array.from(mergedMap.values())

    // 4. Sort by Delivery Date (Oldest first to prioritize immediate attention)
    allOrders.sort((a, b) => new Date(a.deliveryDate).getTime() - new Date(b.deliveryDate).getTime())

    orders.value = allOrders
  } catch (error) {
    console.error('Error fetching data:', error)
    toast.value = { show: true, message: 'Error cargando información', type: 'error' }
  } finally {
    isLoading.value = false
  }
}

// Search debounce
let searchTimeout: any = null
watch(searchQuery, () => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    fetchData()
  }, 500)
})

// Quick Filter Watchers
watch([selectedBranch, filterMode], () => {
  fetchData()
})

// Custom Date Watcher
watch(customDate, (newVal) => {
  if (newVal && filterMode.value === 'custom') {
    fetchData()
  }
})

const handleMarkAsDeliveredPrep = (order: POSOrder) => {
  selectedOrder.value = order
  showDeliveryModal.value = true
}

const handleMarkAsDelivered = async (orderId: string) => {
  try {
    await POSService.markAsDelivered(orderId)
    toast.value = { show: true, message: 'Orden marcada como entregada', type: 'success' }
    showDeliveryModal.value = false
    fetchData()
  } catch (error) {
    console.error('Error marking as delivered:', error)
    toast.value = { show: true, message: 'Error al actualizar estado', type: 'error' }
  }
}

const handleBulkSuccess = () => {
  toast.value = { show: true, message: 'Recepción Masiva Completada', type: 'success' };
  showBulkModal.value = false;
  fetchData();
}

// --- EXPORT LOGIC ---
const { isExporting, exportDispatchOrder } = useOrderExport()

const handleExportDispatch = async () => {
  if (orders.value.length === 0) {
    toast.value = { show: true, message: 'No hay pedidos para exportar', type: 'info' }
    return
  }
  try {
    const branchName = selectedBranch.value === 'Todas las sucursales' ? 'General (Todas)' : selectedBranch.value
    await exportDispatchOrder(orders.value, branchName)
    toast.value = { show: true, message: 'Reporte de Entregas exportado', type: 'success' }
  } catch (err) {
    toast.value = { show: true, message: 'Error al exportar reporte', type: 'error' }
  }
}

const getEffectivePaymentMethod = (order: POSOrder) => {
  if (order.paymentMethod && order.paymentMethod !== 'Por confirmar' && order.paymentMethod !== 'Por Cobrar') {
    return order.paymentMethod
  }

  if (order.payments && order.payments.length > 0) {
    // Map common codes to readable names if needed, or join unique methods
    const methods = [...new Set(order.payments.map(p => {
      const m = p.forma_cobro
      if (m === 'TRA') return 'Transferencia'
      if (m === 'EFE') return 'Efectivo'
      if (m === 'TC') return 'Tarjeta Crédito'
      if (m === 'TD') return 'Tarjeta Débito'
      return m
    }))]
    return methods.join(', ')
  }

  return order.paymentMethod || 'Por confirmar'
}

// Helpers for Status Styling
const getStatusLabel = (order: POSOrder) => {
  if (order.posStatus === 'DELIVERED') return 'Entregado'
  if (order.posStatus === 'RECEIVED') return 'Recibido en Sucursal'
  if (order.posStatus === 'IN_TRANSIT') return 'En Tránsito'
  return 'Esperando Producción'
}

const getStatusColorClass = (order: POSOrder) => {
  const status = order.posStatus
  if (status === 'RECEIVED') return 'status-blue'
  if (status === 'IN_TRANSIT') return 'status-yellow'
  if (status === 'DELIVERED') return 'status-green'
  return 'status-gray'
}

// Payment Calc Helpers
const calculateTotalPaid = (order: POSOrder) => {
  const history = (order.payments || []).reduce((sum, p) => sum + Number(p.monto), 0)
  return history
}

const calculateRemainingBalance = (order: POSOrder) => {
  if (order.isGlobalCourtesy) return 0
  const total = order.totalValue || 0
  const paid = calculateTotalPaid(order)
  return Math.max(0, total - paid)
}

const isOrderFullyPaid = (order: POSOrder) => {
  if (order.isGlobalCourtesy) return true
  if (order.settledInIsland) return true
  if (order.isCredit) return false
  return calculateRemainingBalance(order) < 0.01
}

onMounted(() => {
  fetchData()
})
</script>

<template>
  <div class="pos-reception-page">
    <main class="container">
      <div class="page-header">
        <div class="title-group">
            <h1><i class="fa-solid fa-store"></i> Gestión de Sucursal</h1>
            <div class="active-location-banner" :class="selectedBranch.toLowerCase().replace(/\s+/g, '-')">
                <div class="banner-icon">
                    <i class="fa-solid fa-location-dot"></i>
                </div>
                <div class="banner-text">
                    <span class="label">Operando en</span>
                    <span class="branch-name">{{ selectedBranch === 'Todas las sucursales' ? 'Global (Todas)' : selectedBranch }}</span>
                </div>
                <div class="banner-tag">{{ selectedBranch === 'Todas las sucursales' ? 'REPORTES' : 'ACTIVO' }}</div>
            </div>
        </div>
        
        <div class="controls">
            <button class="btn-export-dispatch" @click="handleExportDispatch" :disabled="isExporting || orders.length === 0">
                <i class="fas fa-file-excel"></i> Exportar Reporte de Entrega
            </button>

            <div class="separator"></div>

            <button v-if="pendingDispatchesForBulk.length > 0" class="btn-bulk" @click="showBulkModal = true">
                <i class="fa-solid fa-boxes-stacked"></i> Recepción Masiva
            </button>

            <div class="separator"></div>

            <div class="branch-selector-group">
                <span class="selector-label">Estás en:</span>
                <div class="branch-selector">
                    <i class="fa-solid fa-store"></i>
                    <select v-model="selectedBranch">
                        <option v-for="branch in branches" :key="branch" :value="branch">
                            {{ branch }}
                        </option>
                    </select>
                    <i class="fa-solid fa-chevron-down select-arrow"></i>
                </div>
            </div>
            <button class="btn-refresh" @click="fetchData" title="Actualizar" :class="{ 'fa-spin': isLoading }">
                <i class="fa-solid fa-arrows-rotate"></i>
            </button>
        </div>
      </div>

      <POSFilterBar 
        v-model:filterMode="filterMode"
        v-model:customDate="customDate"
        v-model:searchQuery="searchQuery"
        :showDatePicker="showDatePicker"
        @search="fetchData"
      />

      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <span>Cargando información...</span>
      </div>

      <div v-else class="view-content">
        <div class="info-bar" v-if="orders.length > 0">
           <span>
             <i class="fa-solid fa-circle-check"></i> 
             <strong v-if="selectedBranch === 'Todas las sucursales'">Reporte Unificado de todas las sucursales</strong>
             <template v-else>Gestión de <strong>{{ selectedBranch }}</strong>: Pedidos listos para entrega al cliente.</template>
           </span>
        </div>

        <div class="shipments-grid">
           <div v-if="orders.length === 0" class="empty-state">
              <i class="fa-regular fa-calendar-xmark"></i>
              <h3>Todo al día en {{ selectedBranch }}</h3>
              <p v-if="searchQuery">No encontramos ningún pedido o cliente con "{{ searchQuery }}".</p>
              <p v-else>No hay pedidos pendientes de entrega en <strong>{{ selectedBranch }}</strong> por ahora.</p>
           </div>

           <div 
               v-for="order in orders" 
               :key="order._id" 
               class="shipment-card"
               :class="getStatusColorClass(order)"
            >
               <div class="card-header">
                   <div class="header-left">
                       <div class="order-id-track">
                           <span class="id-label">ID:</span>
                           <span class="id-value">{{ order._id.slice(-6).toUpperCase() }}</span>
                       </div>
                       <span class="order-badge">#{{ order.orderNumber }}</span>
                       <div class="status-pill">
                           <i v-if="order.posStatus === 'DELIVERED'" class="fa-solid fa-check-circle"></i>
                           <i v-else-if="order.posStatus === 'RECEIVED'" class="fa-solid fa-store"></i>
                           <i v-else-if="order.posStatus === 'IN_TRANSIT'" class="fa-solid fa-truck-fast"></i>
                           <i v-else class="fa-solid fa-clock"></i>
                           <span>{{ getStatusLabel(order) }}</span>
                       </div>
                       <div v-if="selectedBranch === 'Todas las sucursales'" class="branch-mini-pill">
                           <i class="fa-solid fa-map-location-dot"></i> {{ order.branch }}
                       </div>
                   </div>
                   <div class="header-right">
                       <div class="delivery-time-badge">
                           <i class="fa-regular fa-clock"></i>
                           <span>{{ order.deliveryTime }}</span>
                       </div>
                       <span class="date">{{ formatECT(order.deliveryDate, false) }}</span>
                   </div>
               </div>
               
               <div class="card-body">
                   <div class="customer-info">
                        <div class="customer-avatar">
                            <i class="fa-solid fa-user"></i>
                        </div>
                        <div class="customer-details">
                            <span class="label">Cliente</span>
                            <span class="value">{{ order.customerName }}</span>
                        </div>
                   </div>
                   
                   <div class="items-preview">
                       <div class="preview-header">
                           <i class="fa-solid fa-box-open"></i> Productos ({{ order.products.length }})
                       </div>
                       <div class="products-list">
                           <div v-for="p in order.products" :key="p._id" class="product-item">
                               <span class="qty">{{ p.quantity }}x</span>
                               <span class="name">{{ p.name }}</span>
                           </div>
                       </div>
                   </div>

                   <div class="payment-info">
                       <div class="p-row">
                           <div class="payment-method">
                               <i class="fa-solid fa-credit-card"></i>
                               <span>{{ getEffectivePaymentMethod(order) }}</span>
                           </div>
                           <div class="payment-status">
                               <div v-if="order.settledInIsland" class="settled-badge">
                                   <i class="fa-solid fa-umbrella-beach"></i> Facturado en Isla
                               </div>
                               <div v-else-if="isOrderFullyPaid(order)" class="paid-badge">
                                   <i class="fa-solid fa-circle-check"></i> Pedido Pagado Completo
                               </div>
                               <div v-else class="balance-badge">
                                   <span class="label">Por Cobrar:</span>
                                   <span class="value">${{ calculateRemainingBalance(order).toFixed(2) }}</span>
                               </div>
                           </div>
                           <span class="total-amount">${{ order.totalValue.toFixed(2) }}</span>
                       </div>
                   </div>
               </div>

              <div class="card-actions">
                  <button 
                    v-if="order.posStatus !== 'DELIVERED'"
                    class="btn-deliver action-btn" 
                    @click="handleMarkAsDeliveredPrep(order)"
                  >
                      <i class="fa-solid fa-hand-holding-heart"></i> Entregar a Cliente
                  </button>
                  <button v-else class="btn-delivered-static action-btn" disabled>
                      <i class="fa-solid fa-check-double"></i> Entregado
                  </button>
              </div>
           </div>
        </div>
      </div>

    </main>

    <BulkReceptionModal
        :is-open="showBulkModal"
        :dispatches="pendingDispatchesForBulk"
        @close="showBulkModal = false"
        @success="handleBulkSuccess"
    />

    <DeliveryModal
        :is-open="showDeliveryModal"
        :order="selectedOrder || ({} as POSOrder)"
        @close="showDeliveryModal = false"
        @confirm="handleMarkAsDelivered"
    />

    <ToastNotification 
      :show="toast.show" 
      :message="toast.message" 
      :type="toast.type"
      @close="toast.show = false"
    />

    <!-- Floating Flashy Location Badge -->
    <div class="floating-location-badge" :class="selectedBranch.toLowerCase().replace(/\s+/g, '-')">
        <div class="badge-icon"><i class="fa-solid fa-store"></i></div>
        <div class="badge-content">
            <span class="badge-label">Vista actual</span>
            <span class="badge-name">{{ selectedBranch === 'Todas las sucursales' ? 'Todas' : selectedBranch }}</span>
        </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use 'sass:color';

/* Define Breakpoints */
$tablet: 768px;
$desktop: 1024px;

@mixin from-tablet {
  @media (min-width: #{$tablet}) {
    @content;
  }
}

.pos-reception-page {
  padding-bottom: 2rem;
  min-height: 100vh;
  background-color: $background-light;
  width: 100vw;
  overflow-x: hidden;
}

.container {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
  box-sizing: border-box;

  @include from-tablet {
    padding: 0 1.5rem;
  }
}

.page-header {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 1.5rem 0 1rem 0;
  width: 100%;

  @include from-tablet {
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    padding: 2rem 0 1rem 0;
  }

  .title-group {
    flex: 1 1 auto;
    min-width: 0;

    h1 {
      font-family: $font-principal;
      color: $NICOLE-PURPLE;
      margin: 0;
      font-size: 1.4rem;
      line-height: 1.2;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;

      @include from-tablet {
        font-size: 1.8rem;
        flex-wrap: nowrap;
      }
    }

    .active-location-banner {
      margin-top: 1.25rem;
      display: inline-flex;
      align-items: center;
      gap: 1.5rem;
      background: #F8FAFC;
      padding: 1rem 2rem;
      border-radius: 20px;
      border-left: 8px solid $NICOLE-PURPLE;
      animation: pulseIn 0.5s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
      position: relative;
      overflow: hidden;

      &.mall-del-sol {
        border-left-color: #3B82F6;

        .banner-icon {
          background: rgba(#3B82F6, 0.1);

          i {
            color: #3B82F6;
          }
        }
      }

      &.san-marino {
        border-left-color: #A855F7;

        .banner-icon {
          background: rgba(#A855F7, 0.1);

          i {
            color: #A855F7;
          }
        }
      }

      &.centro-de-producción {
        border-left-color: #F59E0B;

        .banner-icon {
          background: rgba(#F59E0B, 0.1);

          i {
            color: #F59E0B;
          }
        }
      }

      .banner-icon {
        width: 48px;
        height: 48px;
        background: white;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);

        i {
          font-size: 1.5rem;
          color: $NICOLE-PURPLE;
        }
      }

      .banner-text {
        display: flex;
        flex-direction: column;

        .label {
          font-size: 0.75rem;
          font-weight: 800;
          color: #64748B;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          margin-bottom: 2px;
        }

        .branch-name {
          font-size: 1.6rem;
          font-weight: 900;
          color: #0F172A;
          line-height: 1;
        }
      }

      .banner-tag {
        font-size: 0.7rem;
        background: #E2E8F0;
        color: #475569;
        padding: 0.2rem 0.7rem;
        border-radius: 20px;
        font-weight: 900;
        margin-left: 1rem;
        letter-spacing: 1px;
      }

      &::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
        transform: translateX(-100%);
        animation: shine 3s infinite;
      }
    }
  }

  @keyframes pulseIn {
    from {
      transform: scale(0.95);
      opacity: 0;
    }

    to {
      transform: scale(1);
      opacity: 1;
    }
  }

  @keyframes shine {
    0% {
      transform: translateX(-100%);
    }

    20% {
      transform: translateX(100%);
    }

    100% {
      transform: translateX(100%);
    }
  }

  .controls {
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
    width: 100%;

    @include from-tablet {
      width: auto;
      flex-direction: row;
      flex-wrap: wrap;
      align-items: center;
      justify-content: flex-end;
    }
  }

  .btn-export-dispatch {
    background: #F0FDF4; // Light Green background
    color: #16A34A;
    border: 1px solid #DCFCE7;
    padding: 0.8rem 1.2rem;
    border-radius: 8px;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    transition: all 0.2s;
    width: 100%;
    font-size: 0.95rem;

    @include from-tablet {
      width: auto;
      padding: 0.6rem 1.2rem;
      font-size: 0.85rem;
    }

    &:hover:not(:disabled) {
      background: #DCFCE7;
      border-color: #BBF7D0;
      transform: translateY(-1px);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    i {
      font-size: 1rem;
    }
  }

  .btn-bulk {
    background: $NICOLE-SECONDARY;
    color: white;
    border: none;
    padding: 0.8rem 1rem;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    box-shadow: 0 4px 10px rgba($NICOLE-SECONDARY, 0.2);
    transition: all 0.2s;
    width: 100%;
    font-size: 0.95rem;

    @include from-tablet {
      width: auto;
      padding: 0.6rem 1.2rem;
      font-size: 0.9rem;
    }

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 14px rgba($NICOLE-SECONDARY, 0.3);
    }
  }

  .separator {
    display: none;
    width: 1px;
    height: 24px;
    background: $border-light;
    margin: 0 0.5rem;

    @include from-tablet {
      display: block;
    }
  }

  .branch-selector-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;

    @include from-tablet {
      width: auto;
    }

    .selector-label {
      font-size: 0.75rem;
      font-weight: 800;
      color: #64748B;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      white-space: nowrap;
      display: none;

      @include from-tablet {
        display: block;
      }
    }
  }

  .branch-selector {
    position: relative;
    display: flex;
    align-items: center;
    background: #F8FAFC;
    border-radius: 12px;
    padding: 0 1rem;
    border: 1px solid #E2E8F0;
    transition: all 0.2s;
    width: 100%;
    overflow: hidden;

    @include from-tablet {
      width: auto;
      min-width: 200px;
    }

    &:hover {
      border-color: $NICOLE-PURPLE;
      background: white;
      box-shadow: 0 4px 12px rgba($NICOLE-PURPLE, 0.08);
    }

    i:not(.select-arrow) {
      color: $NICOLE-PURPLE;
      margin-right: 0.5rem;
      font-size: 0.9rem;
    }

    .select-arrow {
      position: absolute;
      right: 1rem;
      font-size: 0.7rem;
      color: #94A3B8;
      pointer-events: none;
    }

    select {
      border: none;
      padding: 0.8rem 1.5rem 0.8rem 1.5rem; // Adjust for arrow and icon
      font-family: $font-principal;
      font-size: 0.95rem;
      font-weight: 700;
      color: #1E293B;
      background: transparent;
      cursor: pointer;
      outline: none;
      width: 100%;
      appearance: none;

      @include from-tablet {
        padding: 0.65rem 1.5rem 0.65rem 1.5rem;
      }
    }
  }

  .btn-refresh {
    background: white;
    border: 1px solid $border-light;
    width: 100%;
    height: 44px;
    border-radius: 8px;
    cursor: pointer;
    color: $text-light;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.03);

    @include from-tablet {
      width: 40px;
      height: 40px;
    }

    &:hover {
      color: $NICOLE-PURPLE;
      border-color: $NICOLE-PURPLE;
      transform: rotate(180deg);
    }
  }
}

/* Shipments Grid */
.shipments-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
  width: 100%;

  @include from-tablet {
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1.5rem;
  }
}

.shipment-card {
  background: white;
  border-radius: 16px;
  border: 1px solid #E2E8F0;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 20px -5px rgba(0, 0, 0, 0.1);
  }

  &.status-blue {
    border-left: 6px solid #3B82F6;
    background-color: #EFF6FF;
    border-color: #DBEAFE;
  }

  &.status-yellow {
    border-left: 6px solid #F59E0B;
    background-color: #FFFBEB;
    border-color: #FEF3C7;
  }

  &.status-green {
    border-left: 6px solid #22C55E;
    background-color: #F0FDF4;
    border-color: #DCFCE7;
  }

  &.status-gray {
    border-left: 6px solid #94A3B8;
    background-color: #F8FAFC;
    border-color: #E2E8F0;
  }
}

.card-header {
  padding: 1rem;
  background: rgba(255, 255, 255, 0.4);
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.5rem;

  .header-left {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;

    .order-id-track {
      display: flex;
      gap: 0.3rem;
      font-size: 0.65rem;
      font-weight: 800;
      color: #94A3B8;
      letter-spacing: 0.05em;

      .id-value {
        color: #64748B;
      }
    }

    .order-badge {
      background: $NICOLE-PURPLE;
      color: white;
      padding: 0.25rem 0.6rem;
      border-radius: 6px;
      font-weight: 800;
      font-size: 0.85rem;
      width: fit-content;
    }

    .status-pill {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      color: #475569;
    }

    .branch-mini-pill {
      margin-top: 0.2rem;
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      font-size: 0.7rem;
      font-weight: 800;
      color: $NICOLE-PURPLE;
      background: rgba($NICOLE-PURPLE, 0.1);
      padding: 2px 8px;
      border-radius: 4px;
      text-transform: uppercase;
    }
  }

  .header-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.4rem;

    .delivery-time-badge {
      background: #FEF3C7;
      color: #92400E;
      padding: 0.3rem 0.6rem;
      border-radius: 6px;
      font-size: 0.9rem;
      font-weight: 800;
      display: flex;
      align-items: center;
      gap: 0.4rem;
      border: 1px solid #FDE68A;
    }

    .date {
      font-size: 0.8rem;
      font-weight: 600;
      color: #64748B;
    }
  }
}

.card-body {
  padding: 1.25rem;
  flex: 1;
  background: transparent;

  .customer-info {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.25rem;

    .customer-avatar {
      width: 40px;
      height: 40px;
      background: #F1F5F9;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #64748B;
      font-size: 1.1rem;
    }

    .customer-details {
      display: flex;
      flex-direction: column;

      .label {
        font-size: 0.75rem;
        font-weight: 700;
        color: #94A3B8;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .value {
        font-size: 1rem;
        font-weight: 800;
        color: #1E293B;
      }
    }
  }

  .items-preview {
    background: rgba(255, 255, 255, 0.6);
    border-radius: 12px;
    padding: 1rem;
    border: 1px solid rgba(0, 0, 0, 0.05);
    margin-bottom: 1.25rem;

    .preview-header {
      font-size: 0.75rem;
      font-weight: 800;
      color: #64748B;
      text-transform: uppercase;
      margin-bottom: 0.75rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .products-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;

      .product-item {
        display: flex;
        gap: 0.75rem;
        font-size: 0.9rem;
        color: #334155;
        line-height: 1.4;

        .qty {
          font-weight: 800;
          color: $NICOLE-PURPLE;
          min-width: 2.5ch;
        }

        .name {
          font-weight: 600;
        }
      }
    }
  }

  .payment-info {
    padding-top: 1rem;
    border-top: 1px solid #F1F5F9;

    .p-row {
      display: flex;
      justify-content: space-between;
      align-items: center;

      .payment-method {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.85rem;
        font-weight: 600;
        color: #64748B;
      }

      .payment-status {
        display: flex;
        flex-direction: column;
        align-items: center;

        .paid-badge,
        .settled-badge {
          padding: 0.25rem 0.6rem;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 800;
          display: flex;
          align-items: center;
          gap: 0.3rem;
          text-transform: uppercase;
        }

        .paid-badge {
          background: #DCFCE7;
          color: #166534;
        }

        .settled-badge {
          background: #F3E8FF;
          color: #6B21A8;
        }

        .balance-badge {
          display: flex;
          flex-direction: column;
          align-items: center;
          line-height: 1;

          .label {
            font-size: 0.65rem;
            font-weight: 800;
            color: #94A3B8;
            text-transform: uppercase;
          }

          .value {
            font-size: 1rem;
            font-weight: 900;
            color: #E11D48;
          }
        }
      }

      .total-amount {
        font-size: 1.1rem;
        font-weight: 900;
        color: $NICOLE-SECONDARY;
      }
    }
  }
}

.card-actions {
  padding: 1rem;
  background: #FCFCFD;
  border-top: 1px solid #F1F5F9;
}

.action-btn {
  width: 100%;
  padding: 0.85rem;
  border-radius: 12px;
  font-weight: 800;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.95rem;
  transition: all 0.2s;
  cursor: pointer;
}

.btn-deliver {
  background: #22C55E;
  color: white;
  border: none;

  &:hover {
    background: #16A34A;
    box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
  }
}

.btn-delivered-static {
  background: #F0FDF4;
  color: #16A34A;
  border: 1px solid #DCFCE7;
  cursor: default;
}

.info-bar {
  background: #F0F9FF;
  border: 1px solid #BAE6FD;
  padding: 0.8rem 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
  color: #0369A1;
  font-size: 0.85rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.loading-state,
.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: 4rem 1rem;
  background: white;
  border-radius: 16px;
  border: 1px dashed #E2E8F0;

  i {
    font-size: 3rem;
    margin-bottom: 1.5rem;
    color: #CBD5E1;
  }

  h3 {
    margin: 0.5rem 0;
    color: #1E293B;
    font-family: $font-principal;
    font-size: 1.3rem;
  }
}

.spinner {
  margin: 0 auto 1.5rem;
  width: 40px;
  height: 40px;
  border: 4px solid #F1F5F9;
  border-top-color: $NICOLE-PURPLE;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Floating Location Badge */
.floating-location-badge {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  background: white;
  padding: 1.2rem 2.2rem;
  border-radius: 60px;
  box-shadow: 0 15px 50px rgba(0, 0, 0, 0.15);
  display: flex;
  align-items: center;
  gap: 1.2rem;
  z-index: 1000;
  border: 3px solid $NICOLE-PURPLE;
  animation: slideUpFade 0.6s cubic-bezier(0.16, 1, 0.3, 1);
  backdrop-filter: blur(12px);
  background: rgba(255, 255, 255, 0.98);

  @include from-tablet {
    bottom: 3rem;
    right: 3rem;
    padding: 1.5rem 2.5rem;
  }

  &.mall-del-sol {
    border-color: #3B82F6;

    .badge-icon {
      background: rgba(#3B82F6, 0.1);
      color: #3B82F6;
    }
  }

  &.san-marino {
    border-color: #A855F7;

    .badge-icon {
      background: rgba(#A855F7, 0.1);
      color: #A855F7;
    }
  }

  &.centro-de-producción {
    border-color: #F59E0B;

    .badge-icon {
      background: rgba(#F59E0B, 0.1);
      color: #F59E0B;
    }
  }

  .badge-icon {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.4rem;
    flex-shrink: 0;
  }

  .badge-content {
    display: flex;
    flex-direction: column;

    .badge-label {
      font-size: 0.8rem;
      text-transform: uppercase;
      font-weight: 900;
      color: #64748B;
      letter-spacing: 2px;
      line-height: 1;
      margin-bottom: 4px;
    }

    .badge-name {
      font-size: 1.3rem;
      font-weight: 900;
      color: #0F172A;
      line-height: 1;
      white-space: nowrap;
    }
  }

  // Hide on very small screens or make mini
  @media (max-width: 480px) {
    padding: 0.6rem;

    .badge-content {
      display: none;
    }

    border-radius: 50%;
  }
}

@keyframes slideUpFade {
  from {
    transform: translateY(30px);
    opacity: 0;
  }

  to {
    transform: translateY(0);
    opacity: 1;
  }
}
</style>
