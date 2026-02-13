<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import POSService, { type POSOrder } from '@/services/pos.service'
import BulkReceptionModal from './components/BulkReceptionModal.vue'
import DeliveryModal from './components/DeliveryModal.vue'
import ToastNotification from '@/components/ToastNotification.vue'
import POSFilterBar, { type POSFilterMode } from './components/POSFilterBar.vue'
import { formatECT } from '@/utils/dateUtils'

const isLoading = ref(false)
const orders = ref<POSOrder[]>([])
const pendingDispatchesForBulk = ref<any[]>([])
const selectedBranch = ref('Mall del Sol')
const branches = ['San Marino', 'Mall del Sol', 'Centro de Producción']

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

const fetchOrders = async () => {
  isLoading.value = true
  try {
    const filters = {
      search: searchQuery.value,
      filterMode: filterMode.value,
      date: customDate.value
    }

    // Now focusing only on pickup/delivery ready orders
    const data = await POSService.getPickupOrders(selectedBranch.value, filters)
    orders.value = data
  } catch (error) {
    console.error('Error fetching orders:', error)
    toast.value = { show: true, message: 'Error cargando información', type: 'error' }
  } finally {
    isLoading.value = false
  }
}

const fetchPendingForBulk = async () => {
  try {
    // Fetch dispatches with "all" filter to get everything pending regardless of main view date
    const data = await POSService.getIncomingDispatches(selectedBranch.value, { filterMode: 'all' })
    pendingDispatchesForBulk.value = data.filter(o => o.posStatus === 'IN_TRANSIT').flatMap(o =>
      o.dispatches.filter(d => d.receptionStatus === 'PENDING').map(d => ({ ...o, orderId: o._id, dispatch: d }))
    )
  } catch (e) {
    console.error('Error fetching bulk dispatches:', e)
  }
}

const fetchData = () => {
  fetchOrders()
  fetchPendingForBulk()
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
    fetchOrders()
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
                    <span class="branch-name">{{ selectedBranch }}</span>
                </div>
                <div class="banner-tag">ACTIVO</div>
            </div>
        </div>
        
        <div class="controls">
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
             <i class="fa-solid fa-circle-check"></i> Gestión de <strong>{{ selectedBranch }}</strong>: Pedidos listos para entrega al cliente.
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
              v-else 
              v-for="order in orders" 
              :key="order._id" 
              class="shipment-card"
              :class="getStatusColorClass(order)"
           >
              <div class="card-header">
                  <div class="status-indicator">
                      <i v-if="order.posStatus === 'DELIVERED'" class="fa-solid fa-check-circle"></i>
                      <i v-else-if="order.posStatus === 'RECEIVED'" class="fa-solid fa-store"></i>
                      <i v-else-if="order.posStatus === 'IN_TRANSIT'" class="fa-solid fa-truck-fast"></i>
                      <i v-else class="fa-solid fa-clock"></i>
                      <span>{{ getStatusLabel(order) }}</span>
                  </div>
                  <span class="date">{{ formatECT(order.deliveryDate, false) }}</span>
              </div>
              
              <div class="card-body">
                  <div class="info-row highlight">
                      <span class="label"><i class="fa-solid fa-hashtag"></i> Orden</span>
                      <span class="value">#{{ order.orderNumber }}</span>
                  </div>
                  <div class="info-row">
                       <span class="label"><i class="fa-solid fa-user"></i> Cliente</span>
                       <span class="value">{{ order.customerName }}</span>
                  </div>
                  
                  <div class="items-preview">
                      <div class="preview-header">
                          <i class="fa-solid fa-box-open"></i> Productos ({{ order.products.length }})
                      </div>
                      <div class="preview-content">
                          <span v-for="(p, i) in order.products.slice(0, 3)" :key="p._id">
                              {{ p.quantity }} {{ p.name }}<span v-if="i < order.products.length - 1">, </span>
                          </span>
                          <span v-if="order.products.length > 3" class="more-items">
                              +{{ order.products.length - 3 }} más
                          </span>
                      </div>
                  </div>

                  <div class="payment-info">
                      <div class="p-row">
                          <span>Pago: {{ order.paymentMethod }}</span>
                          <span class="amount">${{ order.totalValue.toFixed(2) }}</span>
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
            <span class="badge-label">Sucursal</span>
            <span class="badge-name">{{ selectedBranch }}</span>
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
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: all 0.2s ease;
  position: relative;
  max-width: 100%;
  border-top: 5px solid #CBD5E1;
  border: 1px solid #E2E8F0;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.1);
  }

  &.status-yellow {
    background: #FFFBEB;
    border-color: #FDE047;
    border-top: 6px solid #FACC15;

    .card-header {
      background: rgba(#FDE68A, 0.2);
      border-bottom-color: rgba(#FACC15, 0.1);
    }
  }

  &.status-blue {
    background: #EFF6FF;
    border-color: #BFDBFE;
    border-top: 6px solid #3B82F6;

    .card-header {
      background: rgba(#DBEAFE, 0.3);
      border-bottom-color: rgba(#3B82F6, 0.1);
    }
  }

  &.status-green {
    background: #F0FDF4;
    border-color: #BBF7D0;
    border-top: 6px solid #22C55E;

    .card-header {
      background: rgba(#DCFCE7, 0.3);
      border-bottom-color: rgba(#22C55E, 0.1);
    }
  }

  &.status-gray {
    background: #F8FAFC;
    border-color: #E2E8F0;
    border-top: 6px solid #94A3B8;

    .card-header {
      background: #F1F5F9;
      border-bottom-color: #E2E8F0;
    }
  }
}

.card-header {
  padding: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid transparent;
  gap: 0.5rem;

  .status-indicator {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.85rem;
    font-weight: 700;
    color: #475569;
  }

  .date {
    font-size: 0.8rem;
    color: $text-light;
    font-weight: 600;
  }
}

.status-yellow .status-indicator {
  color: #854D0E;
}

.status-blue .status-indicator {
  color: #1E40AF;
}

.status-green .status-indicator {
  color: #166534;
}

.status-gray .status-indicator {
  color: #475569;
}

.card-body {
  padding: 1rem;
  flex: 1;

  .info-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.6rem;
    font-size: 0.95rem;

    .label {
      color: $text-light;
      font-size: 0.85rem;
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .value {
      font-weight: 700;
      color: $text-dark;
      text-align: right;
    }

    &.highlight .value {
      color: $NICOLE-PURPLE;
      font-size: 1rem;
    }
  }

  .items-preview {
    margin-top: 1rem;
    background: #F8FAFC;
    padding: 0.8rem;
    border-radius: 8px;
    border: 1px solid #F1F5F9;

    .preview-header {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748B;
      margin-bottom: 0.5rem;
      font-weight: 800;
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .preview-content {
      font-size: 0.9rem;
      color: #334155;
      line-height: 1.5;
    }
  }

  .payment-info {
    margin-top: 0.8rem;
    padding-top: 0.8rem;
    border-top: 1px dashed #E2E8F0;

    .p-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.85rem;
      color: #64748B;
      font-weight: 600;

      .amount {
        color: $NICOLE-SECONDARY;
        font-weight: 800;
        font-size: 0.95rem;
      }
    }
  }
}

.card-actions {
  padding: 1rem;
  border-top: 1px solid #F1F5F9;
  background: #FCFCFD;
}

.action-btn {
  width: 100%;
  border: none;
  padding: 0.85rem;
  border-radius: 10px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.9rem;
}

.btn-receive {
  display: none;
}

.btn-details {
  display: none;
}

.btn-deliver {
  background: #22C55E;
  color: white;

  &:hover {
    background: #16A34A;
  }
}

.btn-delivered-static {
  background: #F0FDF4;
  color: #16A34A;
  border: 1px solid #DCFCE7;
  cursor: default;
}

.btn-disabled {
  display: none;
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
