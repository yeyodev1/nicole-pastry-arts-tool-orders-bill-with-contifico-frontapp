<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import OrderService from '@/services/order.service'
import { generateOrderSummary } from '@/utils/orderSummary'
import { useToast } from '@/composables/useToast'
import { getECTTodayString, parseECTDate } from '@/utils/dateUtils'

// Components
import OrderWhatsAppModal from './components/OrderWhatsAppModal.vue'
import PaymentModal from './components/PaymentModal.vue'
import InvoiceEditModal from './components/InvoiceEditModal.vue'
import CustomDatePicker from '@/components/ui/CustomDatePicker.vue'
import SettleInIslandModal from './components/SettleInIslandModal.vue'
import OrderDeleteModal from './components/OrderDeleteModal.vue'
import BatchRetryModal from './components/BatchRetryModal.vue'

const router = useRouter()
const { success, error: showError, info } = useToast()

const orders = ref<any[]>([])
const isLoading = ref(false)

// Filter State
const filterMode = ref<'today' | 'yesterday' | 'tomorrow' | 'all' | 'custom' | 'invoiceError'>('today')
const dateType = ref<'deliveryDate' | 'createdAt'>('deliveryDate')
const customDate = ref('')
const searchQuery = ref('')


// Batch Selection State
const selectedOrderIds = ref<Set<string>>(new Set())
const isBatchProcessing = ref(false)

// Modal States
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
const showBatchRetryModal = ref(false)

// --- FETCHING ---
const fetchOrders = async () => {
  isLoading.value = true
  try {
    const filters: any = {
      dateType: dateType.value
    }

    // 1. Search filter
    if (searchQuery.value) {
      filters.search = searchQuery.value
    }

    // 2. Date filters
    const todayStr = getECTTodayString()
    const [y, m, d] = todayStr.split('-').map(Number) as [number, number, number]

    if (filterMode.value !== 'all') {
      let targetDate: Date

      if (filterMode.value === 'today') {
        filters.startDate = todayStr
        filters.endDate = todayStr
      } else if (filterMode.value === 'yesterday') {
        targetDate = new Date(y, m - 1, d)
        targetDate.setDate(targetDate.getDate() - 1)
        const dateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`
        filters.startDate = dateStr
        filters.endDate = dateStr
      } else if (filterMode.value === 'tomorrow') {
        targetDate = new Date(y, m - 1, d)
        targetDate.setDate(targetDate.getDate() + 1)
        const dateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`
        filters.startDate = dateStr
        filters.endDate = dateStr
      } else if (filterMode.value === 'custom' && customDate.value) {
        filters.startDate = customDate.value
        filters.endDate = customDate.value
      } else if (filterMode.value === 'custom' && customDate.value) {
        filters.startDate = customDate.value
        filters.endDate = customDate.value
      } else if (filterMode.value === 'invoiceError') {
        filters.invoiceStatus = 'ERROR'
        // Enable date filtering for errors too, default to 'today' if not custom
        if (customDate.value) {
          filters.startDate = customDate.value
          filters.endDate = customDate.value
        } else {
          // If user just clicked "Errores", maybe default to ALL or TODAY? 
          // User asked: "errores de facturacion tambien peudan tener fecha, por defecto" -> implies default to current filter date logic
          // Let's reuse the logic from 'today'/'yesterday'/etc if we can, but UI has `filterMode` as the switch.
          // Actually, if filterMode is 'invoiceError', we lose the 'today/yesterday' granularity unless we add a secondary date filter.
          // BUT the user said "poner fecha". 
          // Simplest robust way: When in 'invoiceError', default to showing ALL errors (no date) unless a date is picked? 
          // OR, assume the user wants to see errors for "Today" by default? 
          // Let's default to *Today* for consistency with the app, but allow picking a date.

          // However, `filterMode` IS the date selector in this UI (Yesterday/Today/Tomorrow).
          // If I switch to 'invoiceError', I lose the date context. 
          // Refinement: Allow date picking *while* in invoiceError mode. 
          // For now, let's just make sure if they pick a custom date it works. 
          // If no custom date, let's fetch ALL errors to be safe/visible, or user might miss them.
          // *User said*: "por defecto ayudame con esto" -> likely wants to see errors relevant to *now* or *all*.
          // Let's stick to ALL errors if no date specified for maximum visibility, as errors are critical.
        }
      }
    }

    const data = await OrderService.getOrders(filters)
    orders.value = data
  } catch (error) {
    console.error('Error fetching orders:', error)
    showError('Error al cargar los pedidos')
  } finally {
    isLoading.value = false
  }
}

// Watchers for filtering
import { watch } from 'vue'
watch([filterMode, customDate, dateType], () => {
  selectedOrderIds.value.clear() // Clear selection on filter change
  if (filterMode.value !== 'custom' || customDate.value) {
    fetchOrders()
  }
})

// Debounced search could be better, but for now simple button or enter is fine.
// Or just watch and fetch.
let searchTimeout: any = null
watch(searchQuery, () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    fetchOrders()
  }, 500)
})

// --- FILTERING ---
const filteredOrders = computed(() => {
  // Since we now filter on server-side, filteredOrders is just orders.value
  // We keep the computed property in case we want to add extra client-side logic later
  return orders.value
})

// --- ACTIONS ---
const copySummary = async (order: any) => {
  const text = generateOrderSummary(order)
  whatsAppModalMessage.value = text

  try {
    await navigator.clipboard.writeText(text)
    success('Copiado! Verificando contenido...')
    showWhatsAppModal.value = true
  } catch (err) {
    console.error('Failed to copy: ', err);
    showError('Error al copiar resumen.')
  }
}

const openWhatsApp = () => {
  const text = encodeURIComponent(whatsAppModalMessage.value)
  window.open(`https://wa.me/?text=${text}`, '_blank')
}

const openPaymentModal = (order: any) => {
  selectedOrderForPayment.value = order
  showPaymentModal.value = true
}

const openInvoiceEditModal = (order: any) => {
  if (order.invoiceStatus === 'PROCESSED') {
    info('Factura ya procesada, no se puede editar.')
    return
  }
  selectedOrderForInvoice.value = order
  showInvoiceEditModal.value = true
}

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

const handleInvoiceSaved = (updatedOrder: any) => {
  const index = orders.value.findIndex(o => o._id === updatedOrder._id)
  if (index !== -1) orders.value[index] = updatedOrder
  success('Datos de facturación actualizados.')
  fetchOrders()
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

const handleRetryInvoice = async (order: any) => {
  if (!confirm(`¿Reintentar facturación para la orden de ${order.customerName}?`)) return

  try {
    isLoading.value = true
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

// Logic for calculating pay status in list
const getPaymentStatus = (order: any) => {
  if (order.settledInIsland) return 'settled'

  const totalPaid = (order.payments || []).reduce((sum: number, p: any) => sum + (p.monto || 0), 0)
  const totalValue = order.totalValue || 0

  if (totalPaid >= totalValue - 0.05) return 'paid'
  if (totalPaid > 0) return 'partial'
  return 'pending'
}

const goToDetail = (id: string) => {
  router.push(`/orders/${id}`)
}

const handleEditOrder = (order: any) => {
  if (order.invoiceStatus === 'PROCESSED') {
    info('No se puede editar una orden ya facturada.')
    return
  }
  // Redirect to create view but with order data for editing
  router.push({
    name: 'create-order',
    query: { edit: order._id }
  })
}
const handleDeleteOrder = (order: any) => {
  if (order.invoiceStatus === 'PROCESSED') {
    info('No se puede eliminar una orden ya facturada.')
    return
  }

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

const formatOrderTime = (order: any) => {
  if (order.deliveryTime && order.deliveryTime.includes(':')) {
    return order.deliveryTime
  }
  if (!order.deliveryDate) return '--:--'

  const date = parseECTDate(order.deliveryDate)
  const isMidnight = date.getHours() === 0 && date.getMinutes() === 0

  if (isMidnight) return '--:--'

  const timeOpts: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }
  return new Intl.DateTimeFormat('es-EC', timeOpts).format(date).toUpperCase()
}

// --- BATCH LOGIC ---
const toggleSelection = (orderId: string) => {
  if (selectedOrderIds.value.has(orderId)) {
    selectedOrderIds.value.delete(orderId)
  } else {
    selectedOrderIds.value.add(orderId)
  }
}

const toggleSelectAll = () => {
  if (selectedOrderIds.value.size === filteredOrders.value.length) {
    selectedOrderIds.value.clear()
  } else {
    filteredOrders.value.forEach(order => selectedOrderIds.value.add(order._id))
  }
}

// --- CONCURRENCY HELPER ---
const chunkArray = (arr: any[], size: number) => {
  const chunks = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

const handleBatchRetry = async () => {
  const ids = Array.from(selectedOrderIds.value)
  if (ids.length === 0) return

  // 1. Validation
  const ordersToRetry = ids.map(id => orders.value.find(o => o._id === id)).filter(Boolean)

  const validOrders = ordersToRetry.filter(o =>
    o.invoiceData?.ruc?.trim() &&
    o.invoiceData?.email?.trim() &&
    o.invoiceData?.businessName?.trim()
  )

  const skippedCount = ordersToRetry.length - validOrders.length

  if (skippedCount > 0) {
    if (!confirm(`${skippedCount} ordenes no tienen datos completos (RUC/Email). ¿Continuar con las ${validOrders.length} validas?`)) {
      return
    }
  }

  if (validOrders.length === 0) {
    showError('Ninguna orden valida seleccionada.')
    return
  }

  // Open Modal instead of immediate execution
  showBatchRetryModal.value = true
}

const executeBatchRetry = async () => {
  showBatchRetryModal.value = false

  const ids = Array.from(selectedOrderIds.value)
  // Re-validate (rare edge case but safe)
  const validOrders = ids.map(id => orders.value.find(o => o._id === id))
    .filter(o => o && o.invoiceData?.ruc?.trim())
  // Simple check, assumed validated in handleBatchRetry

  if (validOrders.length === 0) return

  // 2. Background Processing with Concurrency Limit
  isBatchProcessing.value = true
  selectedOrderIds.value.clear()
  info(`Procesando ${validOrders.length} facturas... (Lotes de 5)`)

  const BATCH_SIZE = 5
  const chunks = chunkArray(validOrders, BATCH_SIZE)

  let successCount = 0
  let failCount = 0

  // Process chunks sequentially
  for (const chunk of chunks) {
    const promises = chunk.map(order => OrderService.generateInvoice(order._id))
    const results = await Promise.allSettled(promises)

    successCount += results.filter(r => r.status === 'fulfilled').length
    failCount += results.filter(r => r.status === 'rejected').length
  }

  isBatchProcessing.value = false

  if (failCount === 0) {
    success(`Proceso finalizado. ${successCount} facturas exitosas.`)
  } else {
    showError(`Finalizado: ${successCount} exitosas, ${failCount} fallidas.`)
  }
  fetchOrders()
}

onMounted(() => {
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

      <!-- Filter Bar -->
      <div class="filter-bar">
        <!-- Sticky Batch Action Bar (Top) -->
        <div v-if="selectedOrderIds.size > 0" class="batch-action-bar">
           <div class="batch-info">
             <span class="count">{{ selectedOrderIds.size }} seleccionados</span>
             <button class="btn-text-clear" @click="selectedOrderIds.clear()">Cancelar</button>
           </div>
           
           <button class="btn-batch-primary" @click="handleBatchRetry" :disabled="isBatchProcessing">
             <i class="fas fa-rotate-right" :class="{ 'fa-spin': isBatchProcessing }"></i>
             {{ isBatchProcessing ? 'Procesando...' : `Reintentar (${selectedOrderIds.size})` }}
           </button>
        </div>

        <div class="filter-upper-row">
          <!-- Search Input -->
          <div class="search-wrapper">
            <i class="fas fa-search"></i>
            <input 
              type="text" 
              v-model="searchQuery" 
              placeholder="Nombre, RUC o email..."
              @keyup.enter="fetchOrders"
            />
          </div>

          <!-- Date Type Selector -->
          <div class="date-type-selector">
            <button 
              class="type-btn" 
              :class="{ active: dateType === 'deliveryDate' }" 
              @click="dateType = 'deliveryDate'"
            >
              Entrega
            </button>
            <button 
              class="type-btn" 
              :class="{ active: dateType === 'createdAt' }" 
              @click="dateType = 'createdAt'"
            >
              Registro
            </button>
          </div>
        </div>

        <div class="filter-lower-row">
          <div class="quick-filters">
             <button 
               class="filter-pill" 
               :class="{ active: filterMode === 'yesterday' }"
               @click="filterMode = 'yesterday'"
             >
               Ayer
             </button>
             <button 
               class="filter-pill" 
               :class="{ active: filterMode === 'today' }"
               @click="filterMode = 'today'"
             >
               Hoy
             </button>
             <button 
               class="filter-pill" 
               :class="{ active: filterMode === 'tomorrow' }"
               @click="filterMode = 'tomorrow'"
             >
               Mañana
             </button>
             <button 
               class="filter-pill" 
               :class="{ active: filterMode === 'all' }"
               @click="filterMode = 'all'"
             >
               Todas
             </button>
             <button 
               class="filter-pill" 
               :class="{ active: filterMode === 'custom' }"
               @click="filterMode = 'custom'"
             >
                Fecha...
              </button>
              <button 
                class="filter-pill error" 
                :class="{ active: filterMode === 'invoiceError' }"
                @click="filterMode = 'invoiceError'"
              >
                Errores Facturación
               </button>
           </div>
           
           <!-- Date Picker for Errors (Enable when invoiceError is active too) -->
           <div class="date-picker-wrapper" v-if="filterMode === 'custom' || filterMode === 'invoiceError'">
               <CustomDatePicker 
                 v-model="customDate" 
                 :placeholder="filterMode === 'invoiceError' ? 'Filtrar x Fecha (Opcional)' : 'Seleccionar Fecha'"
               />
           </div>

           <!-- Old Select All moved to top bar logic or kept here as convenience -->
           <div v-if="filterMode === 'invoiceError' && orders.length > 0" class="batch-select-actions">
              <button class="btn-text" @click="toggleSelectAll">
                {{ selectedOrderIds.size === filteredOrders.length ? 'Deseleccionar' : 'Todos' }}
              </button>
           </div>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <span>Cargando pedidos...</span>
      </div>

      <!-- Orders Grid -->
      <div v-else-if="filteredOrders.length > 0" class="orders-grid">
         <article 
            v-for="order in filteredOrders" 
            :key="order._id" 
            class="order-card"
            :class="{ 'selecting': selectedOrderIds.has(order._id) }"
            @click="filterMode === 'invoiceError' ? toggleSelection(order._id) : goToDetail(order._id)"
         >
            <!-- Checkbox for Batch Selection -->
            <div v-if="filterMode === 'invoiceError'" class="batch-checkbox">
               <input 
                 type="checkbox" 
                 :checked="selectedOrderIds.has(order._id)"
                 @click.stop="toggleSelection(order._id)"
               >
            </div>

            <!-- Card Header: Time & Type -->
            <div class="card-header">
               <div class="date-badge">
                 <i class="far fa-clock"></i>
                 {{ formatOrderTime(order) }}
               </div>
               <span class="type-badge" :class="order.deliveryType">
                  {{ order.deliveryType === 'delivery' ? 'Delivery' : 'Retiro' }}
               </span>
            </div>

            <!-- Client Info -->
            <div class="client-section">
               <h3 class="client-name" :title="order.customerName">{{ order.customerName }}</h3>
               <p class="client-detail">
                  <i class="fas fa-user-circle"></i> {{ order.responsible }}
               </p>
               
               <!-- Comments Preview -->
               <div v-if="order.comments" class="order-comments" :title="order.comments">
                  <i class="far fa-comment-dots"></i>
                  <span>{{ order.comments }}</span>
               </div>
            </div>

            <!-- Financials -->
            <div class="financial-row">
               <div class="amount-group">
                  <span class="label">Total</span>
                  <span class="amount">${{ order.totalValue.toFixed(2) }}</span>
               </div>
               <div class="status-group">
                  <!-- Settlement / Payment Badge -->
                  <div v-if="order.settledInIsland" class="settled-badge" :title="'Facturado en ' + order.settledIslandName">
                     <i class="fas fa-store"></i>
                     <span>{{ order.settledIslandName }}</span>
                  </div>
                  <!-- Payment Icon -->
                  <div v-else class="payment-status" :class="getPaymentStatus(order)" title="Estado Pago">
                     <i :class="{
                      'fas fa-check-circle': getPaymentStatus(order) === 'paid',
                      'fas fa-adjust': getPaymentStatus(order) === 'partial',
                      'far fa-circle': getPaymentStatus(order) === 'pending'
                    }"></i>
                     {{
                      getPaymentStatus(order) === 'paid' ? 'Pagado' :
                        getPaymentStatus(order) === 'partial' ? 'Pago Parcial' : 'Pendiente'
                    }}
                  </div>
               </div>
            </div>

            <!-- Actions Footer -->
            <div class="card-actions" @click.stop>
               <button class="btn-whatsapp-copy" @click="copySummary(order)" title="Copiar Resumen para WhatsApp">
                  <i class="fa-brands fa-whatsapp"></i> Copiar Pedido
               </button>
              
                <div class="icon-actions">
                  <button 
                     class="btn-icon" 
                     @click="openPaymentModal(order)"
                     :class="{
                      'is-paid': getPaymentStatus(order) === 'paid',
                      'is-partial': getPaymentStatus(order) === 'partial'
                    }"
                     title="Registrar Cobro"
                  >
                     <i class="fa-solid fa-dollar-sign"></i>
                  </button>
                 <button 
                  v-if="order.invoiceStatus !== 'PROCESSED' && getPaymentStatus(order) !== 'paid' && getPaymentStatus(order) !== 'settled'"
                  class="btn-icon" 
                  @click="openInvoiceEditModal(order)"
                  title="Facturación"
                 >
                    <i class="fa-solid fa-file-invoice"></i>
                 </button>
                  <button 
                   v-if="order.invoiceStatus === 'ERROR'"
                   class="btn-icon btn-retry-invoice" 
                   @click="handleRetryInvoice(order)"
                   title="Reintentar Facturación"
                  >
                     <i class="fa-solid fa-rotate-right"></i>
                  </button>
                 <button 
                  v-if="!order.settledInIsland"
                  class="btn-icon btn-settle" 
                  @click="openSettleModal(order)"
                  title="Registrar Facturación en Isla"
                 >
                    <i class="fa-solid fa-store"></i>
                 </button>
                 <!-- Edit & Delete -->
                 <button 
                  v-if="order.invoiceStatus !== 'PROCESSED'"
                  class="btn-icon btn-edit" 
                  @click="handleEditOrder(order)"
                  title="Editar Pedido"
                 >
                    <i class="fa-solid fa-pen-to-square"></i>
                 </button>
                 <button 
                  v-if="order.invoiceStatus !== 'PROCESSED' && getPaymentStatus(order) !== 'paid' && getPaymentStatus(order) !== 'settled'"
                  class="btn-icon btn-delete" 
                  @click="handleDeleteOrder(order)"
                  title="Eliminar Pedido"
                 >
                    <i class="fa-solid fa-trash-can"></i>
                 </button>
              </div>
            </div>
         </article>
      </div>

      <!-- Empty State -->
      <div v-else class="empty-state">
         <i class="fas fa-box-open"></i>
         <p>No se encontraron pedidos para esta fecha.</p>
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
      :count="selectedOrderIds.size" 
      @close="showBatchRetryModal = false"
      @confirm="executeBatchRetry"
    />

    <!-- Removed Bottom FAB -->
  </div>
</template>

<style lang="scss" scoped>
.orders-list-page {
  min-height: 100vh;
  background-color: #f8fafc;
  padding-bottom: 3rem;
}

.container-constrained {
  width: 100%;
  max-width: 1000px;
  /* Constrained max-width as requested */
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
    color: $NICOLE-PURPLE;
    /** Theme Color */
    font-family: $font-principal;
    margin: 0;
    font-weight: 700;
  }

  p {
    margin: 0.25rem 0 0;
    color: $text-light;
    font-size: 0.9rem;
  }

  .btn-refresh {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 1px solid $border-light;
    background: white;
    color: $text-light;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      color: $NICOLE-PURPLE;
      border-color: $NICOLE-PURPLE;
    }
  }
}

/* Filter Bar */
.filter-bar {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  margin-bottom: 2.5rem;
  background: white;
  padding: 1.25rem;
  border-radius: 16px;
  border: 1px solid $border-light;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.04);

  .filter-upper-row {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    align-items: center;
  }

  .filter-lower-row {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    align-items: center;
    padding-top: 1rem;
    border-top: 1px solid $gray-50;
  }

  .search-wrapper {
    position: relative;
    flex: 2;
    min-width: 260px;

    i {
      position: absolute;
      left: 14px;
      top: 50%;
      transform: translateY(-50%);
      color: $text-light;
      font-size: 0.9rem;
    }

    input {
      width: 100%;
      padding: 0.75rem 1rem 0.75rem 2.5rem;
      border-radius: 12px;
      border: 1px solid $border-light;
      background: $gray-50;
      font-size: 0.95rem;
      transition: all 0.2s;
      outline: none;

      &:focus {
        background: white;
        border-color: $NICOLE-PURPLE;
        box-shadow: 0 0 0 4px rgba($NICOLE-PURPLE, 0.1);
      }

      &::placeholder {
        color: #94a3b8;
      }
    }
  }

  .date-type-selector {
    display: flex;
    background: $gray-100;
    padding: 0.3rem;
    border-radius: 12px;
    gap: 0.2rem;
    flex: 1;
    min-width: 200px;

    .type-btn {
      flex: 1;
      border: none;
      background: transparent;
      padding: 0.5rem;
      border-radius: 9px;
      font-size: 0.85rem;
      font-weight: 700;
      color: $text-light;
      cursor: pointer;
      transition: all 0.2s;

      &.active {
        background: white;
        color: $NICOLE-PURPLE;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
      }

      &:hover:not(.active) {
        color: $text-dark;
      }
    }
  }

  .quick-filters {
    display: flex;
    gap: 0.5rem;
    overflow-x: auto;
    padding-bottom: 2px;
    flex: 1;

    .filter-pill {
      padding: 0.5rem 1.25rem;
      border-radius: 20px;
      border: 1px solid $border-light;
      background: white;
      color: $text-light;
      font-weight: 700;
      font-size: 0.85rem;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.2s;

      &:hover {
        background: $gray-50;
        color: $text-dark;
      }

      &.active {
        background: $NICOLE-PURPLE;
        color: white;
        border-color: $NICOLE-PURPLE;
        box-shadow: 0 4px 12px rgba($NICOLE-PURPLE, 0.25);
      }
    }
  }

  .date-picker-wrapper {
    min-width: 200px;
    max-width: 100%;
  }
}

/* Grid Layout */
.orders-grid {
  display: grid;
  grid-template-columns: 1fr;
  /* Mobile First: 1 Col */
  gap: 1rem;

  @media (min-width: 640px) {
    grid-template-columns: repeat(2, 1fr);
    /* Tablet: 2 Cols */
  }

  @media (min-width: 1024px) {
    grid-template-columns: repeat(3, 1fr);
    /* Desktop: 3 Cols */
  }
}

/* Card Styles */
.order-card {
  background: white;
  border-radius: 16px;
  border: 1px solid $border-light;
  padding: 1.25rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
  transition: all 0.2s ease;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  position: relative; // For checkbox positioning
  gap: 1rem;
  overflow: hidden;
  /* Added to contain long content */

  &.selecting {
    border-color: $NICOLE-PURPLE;
    background: #fdf4ff; // Light purple bg when selected
  }

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
  }

  /* Header */
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .date-badge {
      font-size: 0.85rem;
      color: $text-light;
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .type-badge {
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      padding: 4px 8px;
      border-radius: 6px;

      &.delivery {
        background: #fee2e2;
        color: #b91c1c;
      }

      &.retiro {
        background: #e0f2fe;
        color: #0369a1;
      }
    }
  }

  /* Client */
  .client-section {
    min-width: 0;

    .client-name {
      font-size: 1.1rem;
      font-weight: 700;
      color: $text-dark;
      margin: 0 0 0.25rem 0;

      /* Strict Truncation */
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: block;
      max-width: 100%;
    }

    .client-detail {
      font-size: 0.85rem;
      color: $text-light;
      margin: 0 0 0.5rem 0;
    }

    .order-comments {
      font-size: 0.8rem;
      color: $text-light;
      background: $gray-50;
      padding: 0.4rem 0.6rem;
      border-radius: 6px;

      /* Line Clamping */
      display: -webkit-box;
      line-clamp: 2;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      text-overflow: ellipsis;

      margin-top: 0.5rem;
      border: 1px solid $border-light;

      i {
        color: $NICOLE-PURPLE;
        margin-right: 0.3rem;
      }
    }
  }

  /* Info Row */
  .financial-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    padding-top: 0.5rem;
    border-top: 1px dashed $gray-100;

    .amount-group {
      display: flex;
      flex-direction: column;

      .label {
        font-size: 0.7rem;
        text-transform: uppercase;
        color: $text-light;
        font-weight: 700;
      }

      .amount {
        font-size: 1.2rem;
        font-weight: 800;
        color: $NICOLE-PURPLE;
        font-family: $font-principal;
      }
    }

    .payment-status {
      font-size: 0.8rem;
      font-weight: 600;
      color: $error;
      display: flex;
      align-items: center;
      gap: 0.3rem;

      &.paid {
        color: $success;
      }

      &.partial {
        color: $warning;
      }
    }

    .settled-badge {
      font-size: 0.75rem;
      font-weight: 700;
      color: $NICOLE-PURPLE;
      background: rgba($NICOLE-PURPLE, 0.08);
      padding: 4px 10px;
      border-radius: 20px;
      display: flex;
      align-items: center;
      gap: 0.4rem;
      border: 1px solid rgba($NICOLE-PURPLE, 0.15);

      i {
        font-size: 0.8rem;
      }
    }
  }

  /* Actions */
  .card-actions {
    margin-top: auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
    padding-top: 1rem;
    border-top: 1px solid $gray-50;

    @media (max-width: 480px) {
      flex-direction: column;
      align-items: stretch;
    }

    .btn-whatsapp-copy {
      flex: 1;
      /* Take available space */
      background: #25D366;
      color: white;
      border: none;
      padding: 0.6rem 1rem;
      border-radius: 8px;
      font-weight: 700;
      font-size: 0.9rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      cursor: pointer;
      transition: all 0.2s;
      box-shadow: 0 2px 4px rgba(37, 211, 102, 0.2);

      &:hover {
        background: #128c7e;
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(37, 211, 102, 0.3);
      }
    }

    .icon-actions {
      display: flex;
      gap: 0.4rem;
      flex-wrap: wrap;
      justify-content: flex-end;

      @media (max-width: 480px) {
        justify-content: center;
        margin-top: 0.5rem;
      }

      .btn-icon {
        width: 36px;
        height: 36px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid $border-light;
        background: white;
        color: $text-light;
        cursor: pointer;
        transition: all 0.2s;
        font-size: 1rem;

        &:hover {
          border-color: $NICOLE-PURPLE;
          color: $NICOLE-PURPLE;
          background: $gray-50;
        }

        &.is-paid {
          color: $success;
          border-color: $success;
          background: #f0fdf4;
        }

        &.is-partial {
          color: $warning;
          border-color: $warning;
          background: #fffbeb;
        }

        &.btn-settle {
          &:hover {
            color: $NICOLE-SECONDARY;
            border-color: $NICOLE-SECONDARY;
            background: rgba($NICOLE-SECONDARY, 0.04);
          }
        }

        &.btn-edit {
          &:hover {
            color: #2563eb;
            border-color: #2563eb;
            background: #eff6ff;
          }
        }

        &.btn-delete {
          &:hover {
            color: $error;
            border-color: $error;
            background: #fef2f2;
          }
        }
      }
    }
  }
}

/* Loading & Empty */
.loading-state,
.empty-state {
  text-align: center;
  padding: 4rem 1rem;
  color: $text-light;
  display: flex;
  flex-direction: column;
  position: relative;
  gap: 1rem;
  overflow: hidden;

  &.selecting {
    border-color: $NICOLE-PURPLE;
    background: #fdf4ff; // Light purple bg when active
  }

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
  }
}

.batch-checkbox {
  position: absolute;
  top: 1rem;
  right: 1rem;
  z-index: 10;

  input {
    width: 22px;
    height: 22px;
    cursor: pointer;
    accent-color: $NICOLE-PURPLE;
  }
}

.batch-action-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: $NICOLE-PURPLE;
  color: white;
  padding: 0.75rem 1.25rem;
  border-radius: 12px;
  margin-bottom: 1rem;
  animation: slideDown 0.3s ease;

  .batch-info {
    display: flex;
    align-items: center;
    gap: 1rem;

    .count {
      font-weight: 700;
      font-size: 0.95rem;
    }

    .btn-text-clear {
      background: transparent;
      border: none;
      color: rgba(255, 255, 255, 0.8);
      cursor: pointer;
      font-size: 0.85rem;
      text-decoration: underline;

      &:hover {
        color: white;
      }
    }
  }

  .btn-batch-primary {
    background: white;
    color: $NICOLE-PURPLE;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: transform 0.1s;

    &:active {
      transform: scale(0.98);
    }

    &:disabled {
      opacity: 0.8;
      cursor: not-allowed;
    }
  }
}

.batch-select-actions {
  margin-left: auto;

  .btn-text {
    background: none;
    border: none;
    color: $NICOLE-PURPLE;
    font-weight: 600;
    cursor: pointer;
    font-size: 0.9rem;

    &:hover {
      text-decoration: underline;
    }
  }
}

@keyframes slideDown {
  from {
    transform: translateY(-10px);
    opacity: 0;
  }

  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 4rem 0;

  i {
    font-size: 2rem;
    opacity: 0.5;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba($NICOLE-PURPLE, 0.2);
    border-top-color: $NICOLE-PURPLE;
    border-radius: 50%;
    animation: spin 1s infinite linear;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
