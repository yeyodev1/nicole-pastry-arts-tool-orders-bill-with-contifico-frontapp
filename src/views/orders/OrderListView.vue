<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { generateOrderSummary } from '@/utils/orderSummary'
import { useToast } from '@/composables/useToast'
import { useOrderFilters } from '@/composables/useOrderFilters'
import { useBatchOrders } from '@/composables/useBatchOrders'
import { useOrderExport } from '@/composables/useOrderExport'
import OrderService from '@/services/order.service'
import { useDialog } from '@/composables/useDialog'

// Components
import OrderFilterBar from './components/OrderFilterBar.vue'
import OrderBatchToolbar from './components/OrderBatchToolbar.vue'
import OrderCard from './components/OrderCard.vue'
import ExportProductionModal from './components/ExportProductionModal.vue'

// Modals
import OrderWhatsAppModal from './components/OrderWhatsAppModal.vue'
import PaymentModal from './components/PaymentModal.vue'
import InvoiceEditModal from './components/InvoiceEditModal.vue'
import SettleInIslandModal from './components/SettleInIslandModal.vue'
import OrderDeleteModal from './components/OrderDeleteModal.vue'
import BatchRetryModal from './components/BatchRetryModal.vue'

const router = useRouter()
const { success, error: showError, info } = useToast()
const dialog = useDialog()

// --- COMPOSABLES ---
const {
  orders,
  isLoading,
  filterMode,
  dateType,
  customDate,
  searchQuery,
  showDatePicker,
  fetchOrders
} = useOrderFilters()

const {
  selectedOrderIds,
  isBatchProcessing,
  showBatchRetryModal,
  batchSkippedCount,
  batchValidCount,
  toggleSelection,
  toggleSelectAll,

  handleBatchRetry,
  executeBatchRetry
} = useBatchOrders(orders, fetchOrders)

// --- EXPORT LOGIC ---
const { isExporting, exportProductionOrder, exportDispatchOrder } = useOrderExport()
const showExportProductionModal = ref(false)

const handleExportProductionClick = () => {
  showExportProductionModal.value = true
}

const executeExportProduction = async (responsibleName: string) => {
  try {
    await exportProductionOrder(orders.value, responsibleName)
    showExportProductionModal.value = false
    success('Orden de Producción exportada')
  } catch (err) {
    showError('Error al exportar')
  }
}

const handleExportDispatch = async () => {
  try {
    // Export currently loaded orders
    await exportDispatchOrder(orders.value, 'General (Lista de Pedidos)')
    success('Reporte de Entregas exportado')
  } catch (err) {
    showError('Error al exportar')
  }
}

// --- MODAL STATE ---
const showWhatsAppModal = ref(false)
const whatsAppModalMessage = ref('')
const showPaymentModal = ref(false)
const selectedOrderForPayment = ref<any>(null)
const showInvoiceEditModal = ref(false)
const selectedOrderForInvoice = ref<any>(null)
const showSettleModal = ref(false)
const selectedOrderForSettle = ref<any>(null)
const isSettling = ref(false)
const showDeleteModal = ref(false)
const orderToDelete = ref<any>(null)

// --- ACTIONS ---
const goToDetail = (id: string) => {
  router.push(`/orders/${id}`)
}

const handleCardClick = (order: any) => {
  if (filterMode.value === 'invoiceError') {
    toggleSelection(order._id)
  } else {
    goToDetail(order._id)
  }
}

// WhatsApp
const copySummary = async (order: any) => {
  const text = generateOrderSummary(order)
  whatsAppModalMessage.value = text
  try {
    await navigator.clipboard.writeText(text)
    success('Copiado! Verificando contenido...')
    showWhatsAppModal.value = true
  } catch (err) {
    console.error('Failed to copy: ', err)
    showError('Error al copiar resumen.')
  }
}
const openWhatsApp = () => {
  const text = encodeURIComponent(whatsAppModalMessage.value)
  window.open(`https://wa.me/?text=${text}`, '_blank')
}

// Payment
const openPaymentModal = (order: any) => {
  selectedOrderForPayment.value = order
  showPaymentModal.value = true
}
const handlePaymentRegister = async (payload: any) => {
  if (!selectedOrderForPayment.value) return
  try {
    await OrderService.registerCollection(selectedOrderForPayment.value._id, payload)
    success('Cobro registrado exitosamente')
    showPaymentModal.value = false
    fetchOrders()
  } catch (error: any) {
    console.error("Payment error", error)
    showError(error.data?.message || error.message || 'Error registrando cobro')
  }
}

// Invoice Edit
const openInvoiceEditModal = (order: any) => {
  if (order.invoiceStatus === 'PROCESSED') {
    info('Factura ya procesada, no se puede editar.')
    return
  }
  selectedOrderForInvoice.value = order
  showInvoiceEditModal.value = true
}
const handleInvoiceSaved = (updatedOrder: any) => {
  const index = orders.value.findIndex(o => o._id === updatedOrder._id)
  if (index !== -1) orders.value[index] = updatedOrder
  success('Datos de facturación actualizados.')
  fetchOrders()
}

// Single Retry
const handleSingleRetry = async (order: any) => {
  const ok = await dialog.confirm(`¿Reintentar la facturación para la orden de ${order.customerName}?`, {
    title: 'Reintentar Facturación',
    confirmLabel: 'Sí, reintentar',
    variant: 'warning'
  })
  if (!ok) return
  try {
    isLoading.value = true
    await OrderService.generateInvoice(order._id)
    success('Factura generada exitosamente')
    fetchOrders()
  } catch (error: any) {
    console.error("Retry Invoice error", error)
    const data = error.data
    const contificoMsg = data?.contificoMessage
    if (contificoMsg) {
      showError(`⚠️ Contífico rechazó la factura:<br><small>${contificoMsg}</small>`, 10000)
    } else {
      showError(data?.message || error.message || 'Error al reintentar facturación')
    }
  } finally {
    isLoading.value = false
  }
}

// Settle
const openSettleModal = (order: any) => {
  selectedOrderForSettle.value = order
  showSettleModal.value = true
}
const handleSettleInIsland = async (islandName: string) => {
  if (!selectedOrderForSettle.value) return
  isSettling.value = true
  try {
    await OrderService.settleOrderInIsland(selectedOrderForSettle.value._id, islandName)
    success(`Pedido registrado como facturado en ${islandName}`)
    showSettleModal.value = false
    fetchOrders()
  } catch (err: any) {
    console.error("Settle error", err)
    showError(err.data?.message || err.message || 'Error al registrar facturación en isla')
  } finally {
    isSettling.value = false
  }
}

// Edit & Delete
const handleEditOrder = (order: any) => {
  // Redirect to create view but with order data for editing
  router.push({
    name: 'create-order',
    query: { edit: order._id }
  })
}
const handleDeleteOrder = (order: any) => {
  orderToDelete.value = order
  showDeleteModal.value = true
}
const executeDeleteOrder = async () => {
  if (!orderToDelete.value) return
  const orderId = orderToDelete.value._id
  showDeleteModal.value = false
  try {
    await OrderService.deleteOrder(orderId)
    success('Pedido eliminado correctamente')
    fetchOrders()
  } catch (err: any) {
    console.error('Delete error', err)
    showError(err.data?.message || err.message || 'Error al eliminar el pedido')
  } finally {
    orderToDelete.value = null
  }
}

// Return Order
const handleReturnOrder = async (order: any) => {
  const notes = await dialog.prompt(`Motivo de la devolución para "${order.customerName}":`, {
    title: 'Devolución de Pedido',
    placeholder: 'El pedido saldrá de producción y quedará marcado como devuelto...',
    confirmLabel: 'Confirmar devolución',
    variant: 'warning'
  })
  if (notes === null) return

  try {
    await OrderService.returnOrder(order._id, notes)
    success('Pedido marcado como devuelto y retirado de producción.')
    fetchOrders()
  } catch (err: any) {
    console.error('Return error', err)
    showError(err.data?.message || err.message || 'Error al devolver el pedido')
  }
}

const sidebarOpen = ref(false)

onMounted(() => {
  fetchOrders()
})
</script>

<template>
  <div class="orders-layout">

    <!-- Mobile overlay -->
    <Transition name="fade">
      <div v-if="sidebarOpen" class="sidebar-overlay" @click="sidebarOpen = false"></div>
    </Transition>

    <!-- Sidebar -->
    <aside class="sidebar" :class="{ 'sidebar-open': sidebarOpen }">
      <div class="sidebar-head">
        <div class="sidebar-brand">
          <i class="fas fa-clipboard-list"></i>
          <span>Pedidos</span>
        </div>
        <button class="btn-close-sidebar" @click="sidebarOpen = false" title="Cerrar">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <OrderFilterBar
        v-model:filter-mode="filterMode"
        v-model:date-type="dateType"
        v-model:custom-date="customDate"
        v-model:search-query="searchQuery"
        :show-date-picker="showDatePicker"
        :show-select-all="filterMode === 'invoiceError' && orders.length > 0"
        :is-select-all-active="selectedOrderIds.size === orders.length && orders.length > 0"
        @search="fetchOrders"
        @toggle-select-all="toggleSelectAll(orders)"
        @export-production="handleExportProductionClick"
        @export-dispatch="handleExportDispatch"
      />
    </aside>

    <!-- Main Content -->
    <div class="main-content">

      <!-- Top Bar -->
      <div class="topbar">
        <button class="btn-menu" @click="sidebarOpen = true" title="Filtros">
          <i class="fas fa-sliders-h"></i>
        </button>
        <div class="topbar-title">
          <h1>Lista de Pedidos</h1>
          <p v-if="!isLoading && orders.length > 0">{{ orders.length }} pedidos</p>
          <p v-else-if="isLoading">Cargando...</p>
          <p v-else>Sin resultados</p>
        </div>
        <button @click="fetchOrders" class="btn-refresh" :disabled="isLoading" title="Actualizar">
          <i class="fas fa-sync-alt" :class="{ 'fa-spin': isLoading }"></i>
        </button>
      </div>

      <!-- Batch Toolbar -->
      <OrderBatchToolbar
        v-if="selectedOrderIds.size > 0"
        :selected-count="selectedOrderIds.size"
        :is-processing="isBatchProcessing"
        @clear="selectedOrderIds.clear()"
        @retry="handleBatchRetry"
      />

      <!-- Loading -->
      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <span>Cargando pedidos...</span>
      </div>

      <!-- Orders Grid -->
      <TransitionGroup
        v-else-if="orders.length > 0"
        name="list"
        tag="div"
        class="orders-grid"
      >
        <OrderCard
          v-for="order in orders"
          :key="order._id"
          :order="order"
          :is-selected="selectedOrderIds.has(order._id)"
          :batch-mode="filterMode === 'invoiceError'"
          @click="handleCardClick(order)"
          @toggle-select="toggleSelection(order._id)"
          @copy-summary="copySummary(order)"
          @payment="openPaymentModal(order)"
          @invoice-edit="openInvoiceEditModal(order)"
          @retry-invoice="handleSingleRetry(order)"
          @settle="openSettleModal(order)"
          @edit="handleEditOrder(order)"
          @delete="handleDeleteOrder(order)"
          @return="handleReturnOrder(order)"
        />
      </TransitionGroup>

      <!-- Empty State -->
      <div v-else class="empty-state">
        <i class="fas fa-box-open"></i>
        <p>No se encontraron pedidos.</p>
      </div>

    </div>

    <!-- Modals -->
    <OrderWhatsAppModal
      :is-open="showWhatsAppModal"
      :message="whatsAppModalMessage"
      @close="showWhatsAppModal = false"
      @send="openWhatsApp"
    />

    <PaymentModal
      v-if="selectedOrderForPayment"
      :is-open="showPaymentModal"
      :order-id="selectedOrderForPayment._id"
      :default-amount="selectedOrderForPayment.totalValue"
      :existing-payment="selectedOrderForPayment.paymentDetails"
      @close="showPaymentModal = false"
      @submit="handlePaymentRegister"
    />

    <InvoiceEditModal
      v-if="selectedOrderForInvoice"
      :is-open="showInvoiceEditModal"
      :order-id="selectedOrderForInvoice._id"
      :invoice-needed="selectedOrderForInvoice.invoiceNeeded"
      :current-invoice-data="selectedOrderForInvoice.invoiceData"
      @close="showInvoiceEditModal = false"
      @saved="handleInvoiceSaved"
    />

    <SettleInIslandModal
      :is-open="showSettleModal"
      :order-id="selectedOrderForSettle?._id"
      :is-loading="isSettling"
      @close="showSettleModal = false"
      @confirm="handleSettleInIsland"
    />

    <OrderDeleteModal
      v-if="orderToDelete"
      :is-open="showDeleteModal"
      :order-id="orderToDelete._id"
      :customer-name="orderToDelete.customerName"
      @close="showDeleteModal = false"
      @confirm="executeDeleteOrder"
    />

    <ExportProductionModal
      :is-open="showExportProductionModal"
      :is-loading="isExporting"
      @close="showExportProductionModal = false"
      @confirm="executeExportProduction"
    />

    <BatchRetryModal
      :is-open="showBatchRetryModal"
      :count="batchValidCount"
      :skipped-count="batchSkippedCount"
      @close="showBatchRetryModal = false"
      @confirm="executeBatchRetry"
    />

  </div>
</template>

<style lang="scss" scoped>
/* ── Layout ────────────────────────────────────────────── */
.orders-layout {
  display: flex;
  min-height: 100vh;
  background: #f8fafc;
  position: relative;
}

/* ── Sidebar ───────────────────────────────────────────── */
.sidebar {
  width: 260px;
  flex-shrink: 0;
  background: white;
  border-right: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  position: sticky;
  top: 0;
  height: 100vh;

  // Hidden on mobile by default
  @media (max-width: 1023px) {
    position: fixed;
    left: 0;
    top: 52px;
    height: calc(100% - 52px);
    z-index: 300;
    transform: translateX(-100%);
    transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 4px 0 24px rgba(0, 0, 0, 0.12);

    &.sidebar-open {
      transform: translateX(0);
    }
  }
}

.sidebar-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1rem 1rem;
  border-bottom: 1px solid #f1f5f9;
  flex-shrink: 0;

  .sidebar-brand {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    color: #7c3aed;
    font-weight: 800;
    font-size: 1rem;

    i { font-size: 1rem; }
  }

  .btn-close-sidebar {
    width: 30px;
    height: 30px;
    border: none;
    background: #f1f5f9;
    border-radius: 6px;
    color: #64748b;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.85rem;
    transition: all 0.15s;

    &:hover { background: #e2e8f0; color: #1e293b; }

    // Hide on desktop since sidebar is always visible
    @media (min-width: 1024px) { display: none; }
  }
}

/* ── Mobile overlay ────────────────────────────────────── */
.sidebar-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.4);
  z-index: 299;
  backdrop-filter: blur(2px);
}

.fade-enter-active,
.fade-leave-active { transition: opacity 0.25s ease; }
.fade-enter-from,
.fade-leave-to { opacity: 0; }

/* ── Main content ──────────────────────────────────────── */
.main-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  gap: 1.25rem;

  @media (min-width: 1024px) {
    padding: 2rem;
  }
}

/* ── Top bar ───────────────────────────────────────────── */
.topbar {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 0.9rem 1.25rem;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);

  .btn-menu {
    width: 38px;
    height: 38px;
    border: 1px solid #e2e8f0;
    background: white;
    border-radius: 9px;
    color: #7c3aed;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1rem;
    transition: all 0.2s;
    flex-shrink: 0;

    &:hover { background: #ede9fe; border-color: #c4b5fd; }

    // Hide on desktop
    @media (min-width: 1024px) { display: none; }
  }

  .topbar-title {
    flex: 1;

    h1 {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 800;
      color: #7c3aed;
    }

    p {
      margin: 0;
      font-size: 0.8rem;
      color: #94a3b8;
      font-weight: 500;
    }
  }

  .btn-refresh {
    width: 38px;
    height: 38px;
    border-radius: 9px;
    border: 1px solid #e2e8f0;
    background: white;
    color: #64748b;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.95rem;
    transition: all 0.2s;
    flex-shrink: 0;

    &:hover { color: #7c3aed; border-color: #c4b5fd; background: #faf5ff; }
    &:disabled { opacity: 0.6; cursor: not-allowed; }
  }
}

/* ── Orders grid ───────────────────────────────────────── */
.orders-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
  align-content: start;

  @media (min-width: 640px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (min-width: 1280px) {
    grid-template-columns: repeat(3, 1fr);
  }
}

/* ── Loading & empty ───────────────────────────────────── */
.loading-state,
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 5rem 1rem;
  color: #94a3b8;
  gap: 1rem;

  i { font-size: 2.5rem; opacity: 0.4; }
  p { font-size: 1rem; font-weight: 500; margin: 0; }
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(124, 58, 237, 0.15);
  border-top-color: #7c3aed;
  border-radius: 50%;
  animation: spin 0.8s infinite linear;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* ── List transition ───────────────────────────────────── */
.list-move,
.list-enter-active,
.list-leave-active { transition: all 0.3s ease; }
.list-enter-from,
.list-leave-to { opacity: 0; transform: translateY(16px); }
.list-leave-active { position: absolute; }
</style>
