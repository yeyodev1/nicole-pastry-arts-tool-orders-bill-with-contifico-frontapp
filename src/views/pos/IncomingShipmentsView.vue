<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import POSService, { type POSOrder } from '@/services/pos.service'
import { useOrderExport } from '@/composables/useOrderExport'
import POSPageHeader from './components/POSPageHeader.vue'
import POSShipmentCard from './components/POSShipmentCard.vue'
import DeliveryModal from './components/DeliveryModal.vue'
import BulkReceptionModal from './components/BulkReceptionModal.vue'
import RestockDailyModal from './components/RestockDailyModal.vue'
import ToastNotification from '@/components/ToastNotification.vue'
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

const toast = ref<{ show: boolean; message: string; type: 'success' | 'error' | 'info' }>({
  show: false, message: '', type: 'success',
})

const fetchData = async () => {
  isLoading.value = true
  try {
    const filters = { search: searchQuery.value, filterMode: filterMode.value, date: customDate.value }
    const [pickupData, incomingData] = await Promise.all([
      POSService.getPickupOrders(selectedBranch.value, filters),
      POSService.getIncomingDispatches(selectedBranch.value, filters),
    ])
    const pickups = pickupData || []
    const incoming = incomingData
      .filter(o => o.posStatus === 'IN_TRANSIT')
      .flatMap(o => (o.dispatches || []).filter(d => d.receptionStatus === 'PENDING').map(d => ({ ...o, orderId: o._id, dispatch: d })))

    pendingDispatchesForBulk.value = incoming

    const mergedMap = new Map()
    pickups.forEach(o => mergedMap.set(o._id, o))
    incoming.forEach(o => mergedMap.set(o._id, o))
    const allOrders = Array.from(mergedMap.values())
    allOrders.sort((a, b) => new Date(a.deliveryDate).getTime() - new Date(b.deliveryDate).getTime())
    orders.value = allOrders
  } catch (error) {
    console.error('Error fetching data:', error)
    toast.value = { show: true, message: 'Error cargando información', type: 'error' }
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
    toast.value = { show: true, message: 'Orden marcada como entregada', type: 'success' }
    showDeliveryModal.value = false
    fetchData()
  } catch {
    toast.value = { show: true, message: 'Error al actualizar estado', type: 'error' }
  }
}

const handleBulkSuccess = () => { toast.value = { show: true, message: 'Recepción Masiva Completada', type: 'success' }; showBulkModal.value = false; fetchData() }
const handleRestockSuccess = () => { toast.value = { show: true, message: 'Cierre de Producción enviado exitosamente', type: 'success' }; showRestockModal.value = false }
const handleNotification = (n: { message: string; type: 'success' | 'error' | 'info' }) => { toast.value = { show: true, ...n } }

const { isExporting, exportDispatchOrder } = useOrderExport()
const handleExportDispatch = async () => {
  if (orders.value.length === 0) { toast.value = { show: true, message: 'No hay pedidos para exportar', type: 'info' }; return }
  try {
    const branchName = selectedBranch.value === 'Todas las sucursales' ? 'General (Todas)' : selectedBranch.value
    await exportDispatchOrder(orders.value, branchName)
    toast.value = { show: true, message: 'Reporte de Entregas exportado', type: 'success' }
  } catch {
    toast.value = { show: true, message: 'Error al exportar reporte', type: 'error' }
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
          <i class="fa-solid fa-circle-check"></i>
          <strong v-if="selectedBranch === 'Todas las sucursales'">Reporte Unificado de todas las sucursales</strong>
          <template v-else>Gestión de <strong>{{ selectedBranch }}</strong>: Pedidos listos para entrega al cliente.</template>
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
            @deliver="handleMarkAsDeliveredPrep"
          />
        </div>
      </div>
    </main>

    <BulkReceptionModal :is-open="showBulkModal" :dispatches="pendingDispatchesForBulk" @close="showBulkModal = false" @success="handleBulkSuccess" />
    <DeliveryModal :is-open="showDeliveryModal" :order="selectedOrder || ({} as POSOrder)" @close="showDeliveryModal = false" @confirm="handleMarkAsDelivered" />
    <RestockDailyModal :is-open="showRestockModal" :branch="selectedBranch === 'Todas las sucursales' ? 'San Marino' : selectedBranch" @close="showRestockModal = false" @success="handleRestockSuccess" @notify="handleNotification" />
    <ToastNotification :show="toast.show" :message="toast.message" :type="toast.type" @close="toast.show = false" />

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
