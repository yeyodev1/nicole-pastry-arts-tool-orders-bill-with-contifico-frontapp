<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import POSService, { type POSOrder } from '@/services/pos.service'
import { useOrderExport } from '@/composables/useOrderExport'
import POSPageHeader from './components/POSPageHeader.vue'
import POSShipmentCard from './components/POSShipmentCard.vue'
import DeliveryModal from './components/DeliveryModal.vue'
import BulkReceptionModal from './components/BulkReceptionModal.vue'
import RestockDailyModal from './components/RestockDailyModal.vue'
import { useToast } from '@/composables/useToast'
import POSFilterBar, { type POSFilterMode } from './components/POSFilterBar.vue'

const isLoading = ref(false)
const orders = ref<POSOrder[]>([])
const pendingDispatchesForBulk = ref<any[]>([])
const selectedBranch = ref('Mall del Sol')
const branches = ['Todas las sucursales', 'San Marino', 'Mall del Sol', 'Centro de Producción']

const filterMode = ref<POSFilterMode>('today')
const customDate = ref('')
const searchQuery = ref('')
const showDatePicker = computed(() => filterMode.value === 'custom')

const showBulkModal = ref(false)
const showDeliveryModal = ref(false)
const showRestockModal = ref(false)
const selectedOrder = ref<POSOrder | null>(null)
const selectedOrderIds = ref<Set<string>>(new Set())

const isAllSelected = computed(() => {
  if (orders.value.length === 0) return false
  return orders.value.every(o => selectedOrderIds.value.has(o._id))
})

const toggleOrderSelection = (orderId: string) => {
  if (selectedOrderIds.value.has(orderId)) {
    selectedOrderIds.value.delete(orderId)
  } else {
    selectedOrderIds.value.add(orderId)
  }
}

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedOrderIds.value.clear()
  } else {
    orders.value.forEach(o => selectedOrderIds.value.add(o._id))
  }
}

const { success, error: showError, info } = useToast()

const fetchData = async () => {
  isLoading.value = true
  selectedOrderIds.value.clear()
  try {
    const filters = { search: searchQuery.value, filterMode: filterMode.value, date: customDate.value }
    const [pickupData, incomingData, bulkData] = await Promise.all([
      POSService.getPickupOrders(selectedBranch.value, filters),
      POSService.getIncomingDispatches(selectedBranch.value, filters),
      POSService.getIncomingDispatches(selectedBranch.value, {
        filterMode: 'all',
        receptionStatus: ['PENDING', 'PROBLEM']
      })
    ])
    const pickups = pickupData || []
    const incoming = incomingData
      .filter(o => o.posStatus === 'IN_TRANSIT')
      .flatMap(o => (o.dispatches || []).filter(d => d.receptionStatus === 'PENDING').map(d => ({ ...o, orderId: o._id, dispatch: d })))

    pendingDispatchesForBulk.value = bulkData
      .flatMap(o => (o.dispatches || [])
        .filter(d => ['PENDING', 'PROBLEM'].includes(d.receptionStatus))
        .map(d => ({ ...o, orderId: o._id, dispatch: d }))
      )

    const mergedMap = new Map()
    pickups.forEach(o => mergedMap.set(o._id, o))
    incoming.forEach(o => mergedMap.set(o._id, o))
    const allOrders = Array.from(mergedMap.values())
    allOrders.sort((a, b) => new Date(a.deliveryDate).getTime() - new Date(b.deliveryDate).getTime())
    orders.value = allOrders
  } catch (error) {
    console.error('Error fetching data:', error)
    showError('Error cargando información')
  } finally {
    isLoading.value = false
  }
}

let searchTimeout: any = null
watch(searchQuery, () => { if (searchTimeout) clearTimeout(searchTimeout); searchTimeout = setTimeout(fetchData, 500) })
watch([selectedBranch, filterMode], fetchData)
watch(customDate, (val) => { if (val && filterMode.value === 'custom') fetchData() })

const handleMarkAsDeliveredPrep = (order: POSOrder) => { selectedOrder.value = order; showDeliveryModal.value = true }

const handleMarkAsDelivered = async (orderId: string) => {
  try {
    await POSService.markAsDelivered(orderId)
    success('Orden marcada como entregada')
    showDeliveryModal.value = false
    fetchData()
  } catch {
    showError('Error al actualizar estado')
  }
}

const handleBulkSuccess = () => { success('Recepción Masiva Completada'); showBulkModal.value = false; fetchData() }
const handleRestockSuccess = () => {
  success('Cierre de Producción enviado exitosamente')
  showRestockModal.value = false
  fetchData()
}
const handleNotification = (n: { message: string; type: 'success' | 'error' | 'info' }) => {
  if (n.type === 'success') success(n.message)
  else if (n.type === 'error') showError(n.message)
  else info(n.message)
}

const { isExporting, exportDispatchOrder } = useOrderExport()
const handleExportDispatch = async () => {
  const exportOrders = selectedOrderIds.value.size > 0
    ? orders.value.filter(o => selectedOrderIds.value.has(o._id))
    : orders.value

  if (exportOrders.length === 0) { info('No hay pedidos para exportar'); return }

  try {
    const branchName = selectedBranch.value === 'Todas las sucursales' ? 'General (Todas)' : selectedBranch.value
    await exportDispatchOrder(exportOrders, branchName)
    success('Reporte de Entregas exportado')
  } catch {
    showError('Error al exportar reporte')
  }
}

onMounted(fetchData)
</script>

<template>
  <div class="pos-reception-page">
    <main class="container">
      <POSPageHeader
        v-model:selectedBranch="selectedBranch"
        :branches="branches"
        :hasPendingDispatches="pendingDispatchesForBulk.length > 0"
        :isLoading="isLoading"
        :isExporting="isExporting"
        :selectedCount="selectedOrderIds.size"
        @open-restock="showRestockModal = true"
        @open-bulk="showBulkModal = true"
        @export="handleExportDispatch"
        @refresh="fetchData"
      />

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
          <div class="info-text">
            <i class="fa-solid fa-circle-check"></i>
            <strong v-if="selectedBranch === 'Todas las sucursales'">Reporte Unificado de todas las sucursales</strong>
            <template v-else>Gestión de <strong>{{ selectedBranch }}</strong>: Pedidos listos para entrega al cliente.</template>
          </div>
          
          <button class="btn-select-all" @click="toggleSelectAll">
            <i :class="isAllSelected ? 'fa-solid fa-square-check' : 'fa-regular fa-square'"></i>
            {{ isAllSelected ? 'Deseleccionar todos' : 'Seleccionar todos' }}
          </button>
        </div>

        <div class="shipments-grid">
          <div v-if="orders.length === 0" class="empty-state">
            <i class="fa-regular fa-calendar-xmark"></i>
            <h3>Todo al día en {{ selectedBranch }}</h3>
            <p v-if="searchQuery">No encontramos ningún pedido o cliente con "{{ searchQuery }}".</p>
            <p v-else>No hay pedidos pendientes de entrega en <strong>{{ selectedBranch }}</strong> por ahora.</p>
          </div>
          <POSShipmentCard
            v-for="order in orders"
            :key="order._id"
            :order="order"
            :selectedBranch="selectedBranch"
            :isSelected="selectedOrderIds.has(order._id)"
            @deliver="handleMarkAsDeliveredPrep"
            @toggle-selection="toggleOrderSelection"
          />
        </div>
      </div>
    </main>

    <BulkReceptionModal 
      :is-open="showBulkModal" 
      :dispatches="pendingDispatchesForBulk" 
      @close="showBulkModal = false" 
      @success="handleBulkSuccess" 
      @open-restock="showBulkModal = false; showRestockModal = true"
    />
    <DeliveryModal :is-open="showDeliveryModal" :order="selectedOrder || ({} as POSOrder)" @close="showDeliveryModal = false" @confirm="handleMarkAsDelivered" />
    <RestockDailyModal :is-open="showRestockModal" :branch="selectedBranch === 'Todas las sucursales' ? 'San Marino' : selectedBranch" @close="showRestockModal = false" @success="handleRestockSuccess" @notify="handleNotification" />


    <div class="floating-badge" :class="selectedBranch.toLowerCase().replace(/\s+/g, '-')">
      <div class="badge-icon"><i class="fa-solid fa-store"></i></div>
      <div class="badge-content">
        <span class="badge-label">Vista actual</span>
        <span class="badge-name">{{ selectedBranch === 'Todas las sucursales' ? 'Todas' : selectedBranch }}</span>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
$tablet: 768px;

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

.info-bar {
  background: #F0F9FF;
  border: 1px solid #BAE6FD;
  padding: 0.6rem 1rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
  color: #0369A1;
  font-size: 0.85rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.info-text {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-select-all {
  background: transparent;
  border: none;
  color: #0369A1;
  font-size: 0.85rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;

  &:hover {
    background: rgba(#0369A1, 0.05);
    color: $NICOLE-PURPLE;
  }

  i {
    font-size: 1.1rem;
  }
}

.loading-state,
.empty-state {
  grid-column: 1/-1;
  text-align: center;
  padding: 4rem 1rem;
  background: white;
  border-radius: 16px;
  border: 1px dashed #E2E8F0;
}

.loading-state i,
.empty-state i {
  font-size: 3rem;
  margin-bottom: 1.5rem;
  color: #CBD5E1;
  display: block;
}

.empty-state h3 {
  margin: 0.5rem 0;
  color: #1E293B;
  font-family: $font-principal;
  font-size: 1.3rem;
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

.floating-badge {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
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
}

.floating-badge.mall-del-sol {
  border-color: #3B82F6;

  .badge-icon {
    background: rgba(#3B82F6, 0.1);
    color: #3B82F6;
  }
}

.floating-badge.san-marino {
  border-color: #A855F7;

  .badge-icon {
    background: rgba(#A855F7, 0.1);
    color: #A855F7;
  }
}

.floating-badge.centro-de-producción {
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
}

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

@media (max-width: 480px) {
  .floating-badge {
    padding: 0.6rem;
    border-radius: 50%;
  }

  .badge-content {
    display: none;
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
