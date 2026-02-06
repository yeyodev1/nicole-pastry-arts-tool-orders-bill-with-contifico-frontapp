<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { generateOrderSummary } from '@/utils/orderSummary'
import { useToast } from '@/composables/useToast'
import { useOrderFilters } from '@/composables/useOrderFilters'
import { useBatchOrders } from '@/composables/useBatchOrders'
import OrderService from '@/services/order.service'

// Components
import OrderFilterBar from './components/OrderFilterBar.vue'
import OrderBatchToolbar from './components/OrderBatchToolbar.vue'
import OrderCard from './components/OrderCard.vue'

// Modals
import OrderWhatsAppModal from './components/OrderWhatsAppModal.vue'
import PaymentModal from './components/PaymentModal.vue'
import InvoiceEditModal from './components/InvoiceEditModal.vue'
import SettleInIslandModal from './components/SettleInIslandModal.vue'
import OrderDeleteModal from './components/OrderDeleteModal.vue'
import BatchRetryModal from './components/BatchRetryModal.vue'

const router = useRouter()
const { success, error: showError, info } = useToast()

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
    showError(error.response?.data?.message || 'Error registrando cobro')
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
  if (!confirm(`¿Reintentar facturación para la orden de ${order.customerName}?`)) return
  try {
    isLoading.value = true // Reuse global loading or add local? Global is simpler.
    await OrderService.generateInvoice(order._id)
    success('Factura generada exitosamente')
    fetchOrders()
  } catch (error: any) {
    console.error("Retry Invoice error", error)
    showError(error.response?.data?.message || 'Error al reintentar facturación')
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
    showError(err.response?.data?.message || 'Error al registrar facturación en isla')
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
    showError(err.response?.data?.message || 'Error al eliminar el pedido')
  } finally {
    orderToDelete.value = null
  }
}

onMounted(() => {
  // If we want to ensure data is fetched on mount.
  // The composable watchers might handle it if filterMode changes, 
  // but initial fetch is good.
  fetchOrders()
})
</script>

<template>
  <div class="orders-list-page">
    <div class="container-constrained">
      <!-- Header -->
      <div class="page-header">
        <div class="title-group">
          <h1>Lista de Pedidos</h1>
          <p>Gestiona, factura y controla tus entregas</p>
        </div>
        <button @click="fetchOrders" class="btn-refresh" :disabled="isLoading">
           <i class="fas fa-sync-alt" :class="{ 'fa-spin': isLoading }"></i>
        </button>
      </div>

      <!-- Batch Toolbar (Sticky) -->
      <OrderBatchToolbar 
         v-if="selectedOrderIds.size > 0"
         :selected-count="selectedOrderIds.size"
         :is-processing="isBatchProcessing"
         @clear="selectedOrderIds.clear()"
         @retry="handleBatchRetry"
      />

      <!-- Filters -->
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
      />

      <!-- Loading State -->
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
.orders-list-page {
  min-height: 100vh;
  background-color: #f8fafc;
  padding-bottom: 3rem;
}

.container-constrained {
  max-width: 1000px;
  margin: 0 auto;
  padding: 1.5rem;
}

/* Header */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;

  h1 {
    font-size: 1.6rem;
    color: #8b5cf6;
    font-family: inherit;
    margin: 0;
    font-weight: 700;
  }

  p {
    margin: 0.25rem 0 0;
    color: #64748b;
    font-size: 0.9rem;
  }

  .btn-refresh {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 1px solid #e2e8f0;
    background: white;
    color: #64748b;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      color: #8b5cf6;
      border-color: #8b5cf6;
    }
  }
}

/* Grid Layout */
.orders-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;

  @media (min-width: 640px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (min-width: 1024px) {
    grid-template-columns: repeat(3, 1fr);
  }
}

/* Loading & Empty */
.loading-state,
.empty-state {
  text-align: center;
  padding: 4rem 1rem;
  color: #94a3b8;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;

  i {
    font-size: 2rem;
    opacity: 0.5;
  }
}

.loading-state .spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(139, 92, 246, 0.2);
  border-top-color: #8b5cf6;
  border-radius: 50%;
  animation: spin 1s infinite linear;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Animations */
.list-move,
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

.list-leave-active {
  position: absolute;
  /* Ensures smooth removal flow */
}
</style>
