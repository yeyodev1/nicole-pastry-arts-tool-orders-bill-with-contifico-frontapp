<script setup lang="ts">
import { ref, onMounted } from 'vue'
import OrderService from '@/services/order.service'
import { generateOrderSummary } from '@/utils/orderSummary'
import ToastNotification from '@/components/ToastNotification.vue'
import OrderWhatsAppModal from './components/OrderWhatsAppModal.vue'
import PaymentModal from './components/PaymentModal.vue'
import InvoiceEditModal from './components/InvoiceEditModal.vue'

const orders = ref<any[]>([])
const isLoading = ref(false)

// Toast State
const toast = ref({
  show: false,
  message: '',
  type: 'success' as 'success' | 'error' | 'info'
})

// Modal State
const showWhatsAppModal = ref(false)
const whatsAppModalMessage = ref('')

// Payment Modal State
const showPaymentModal = ref(false)
const selectedOrderForPayment = ref<any>(null)

// Invoice Edit Modal State
const showInvoiceEditModal = ref(false)
const selectedOrderForInvoice = ref<any>(null)

const fetchOrders = async () => {
  isLoading.value = true
  try {
    const data = await OrderService.getOrders()
    orders.value = data
  } catch (error) {
    console.error('Error fetching orders:', error)
  } finally {
    isLoading.value = false
  }
}

const copySummary = async (order: any) => {
  const text = generateOrderSummary(order)
  whatsAppModalMessage.value = text

  try {
    await navigator.clipboard.writeText(text)

    // Show Toast Feedback
    toast.value = {
      show: true,
      message: 'Copiado! Verificando contenido...',
      type: 'success'
    }

    // Open Modal to show what was copied
    showWhatsAppModal.value = true
  } catch (err) {
    console.error('Failed to copy: ', err);
    toast.value = {
      show: true,
      message: 'Error al copiar resumen.',
      type: 'error'
    }
  }
}

const openWhatsApp = () => {
  // Encode and open - reuse logic or simple open
  // For now, simpler is creating a link 
  const text = encodeURIComponent(whatsAppModalMessage.value)
  window.open(`https://wa.me/?text=${text}`, '_blank')
}

const openPaymentModal = (order: any) => {
  selectedOrderForPayment.value = order
  showPaymentModal.value = true
}

const openInvoiceEditModal = (order: any) => {
  if (order.invoiceStatus === 'PROCESSED') {
    toast.value = { show: true, message: 'Factura ya procesada, no se puede editar.', type: 'info' }
    return
  }
  selectedOrderForInvoice.value = order
  showInvoiceEditModal.value = true
}

const handleInvoiceSaved = (updatedOrder: any) => {
  // Update local list
  const index = orders.value.findIndex(o => o._id === updatedOrder._id)
  if (index !== -1) {
    orders.value[index] = updatedOrder
  }
  toast.value = { show: true, message: 'Datos de facturación actualizados.', type: 'success' }
  // Refetch to be sure of statuses
  fetchOrders()
}

const handlePaymentRegister = async (payload: any) => {
  if (!selectedOrderForPayment.value) return

  // Optimistic UI or wait for reload? 
  // Let's reload to be safe and ensure status is updated if backend changes it
  try {
    await OrderService.registerCollection(selectedOrderForPayment.value._id, payload)

    toast.value = {
      show: true,
      message: 'Cobro registrado exitosamente',
      type: 'success'
    }
    showPaymentModal.value = false
    // Refresh orders to see any status updates (future proof)
    fetchOrders()
  } catch (error: any) {
    console.error("Payment error", error)
    toast.value = {
      show: true,
      message: error.response?.data?.message || 'Error registrando cobro',
      type: 'error'
    }
  }
}

onMounted(() => {
  fetchOrders()
})

</script>

<template>
  <div class="orders-list-page">
    <main class="container">
      <div class="page-header">
        <h1>Lista de Pedidos</h1>
      </div>

      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <span>Cargando pedidos...</span>
      </div>

      <div v-else class="table-container">
        <table>
          <thead>
            <tr>
              <th>Fecha Entrega</th>
              <th>Cliente</th>
              <th>Tipo</th>
              <th>Responsable</th>
              <th>Total</th>
              <th>Facturación</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="order in orders" :key="order._id" @click="$router.push(`/orders/${order._id}`)" class="clickable-row">
               <td>{{ new Date(order.deliveryDate).toLocaleDateString() }} {{ new Date(order.deliveryDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}</td>
               <td>
                 <div class="client-column">
                   <span class="name">{{ order.customerName }}</span>
                   <span class="phone">{{ order.customerPhone }}</span>
                 </div>
               </td>
               <td>
                 <span class="badge" :class="order.deliveryType">
                    {{ order.deliveryType === 'delivery' ? 'Delivery' : 'Retiro' }}
                 </span>
               </td>
               <td>{{ order.responsible }}</td>
               <td class="total">${{ order.totalValue.toFixed(2) }}</td>
               <td>
                  <span v-if="order.invoiceNeeded" class="status-badge" :class="order.invoiceStatus">
                    {{ order.invoiceStatus }}
                  </span>
                  <span v-else class="status-text">-</span>
               </td>
               <td class="actions-cell" @click.stop>
                  <button class="btn-icon" @click="copySummary(order)" title="Copiar Resumen WhatsApp">
                    <i class="fa-regular fa-copy"></i>
                  </button>
                  
                  <!-- Payment Action -->
                  <button 
                    class="btn-icon" 
                    :class="order.paymentDetails?.monto ? 'paid-icon' : 'pay-icon'" 
                    @click="openPaymentModal(order)" 
                    :title="order.paymentDetails?.monto ? 'Ver/Editar Cobro' : 'Registrar Cobro'"
                  >
                    <i :class="order.paymentDetails?.monto ? 'fa-solid fa-file-invoice-dollar' : 'fa-solid fa-dollar-sign'"></i>
                  </button>

                  <!-- Invoice Edit Action -->
                  <button 
                    v-if="order.invoiceStatus !== 'PROCESSED'"
                    class="btn-icon edit-icon" 
                    @click="openInvoiceEditModal(order)" 
                    title="Editar Datos Facturación"
                  >
                    <i class="fa-solid fa-pen-to-square"></i>
                  </button>
               </td>
            </tr>
            <tr v-if="orders.length === 0">
              <td colspan="6" class="empty-cell">No hay pedidos registrados</td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>

    <!-- Feedback Notification -->
    <ToastNotification 
      :show="toast.show" 
      :message="toast.message" 
      :type="toast.type"
      @close="toast.show = false"
    />

    <!-- Copy Confirmation Modal -->
    <OrderWhatsAppModal
      :is-open="showWhatsAppModal"
      :message="whatsAppModalMessage"
      @close="showWhatsAppModal = false"
      @send="openWhatsApp"
    />

    <!-- Payment Modal -->
    <PaymentModal
      v-if="selectedOrderForPayment"
      :is-open="showPaymentModal"
      :order-id="selectedOrderForPayment._id"
      :default-amount="selectedOrderForPayment.totalValue"
      :existing-payment="selectedOrderForPayment.paymentDetails"
      @close="showPaymentModal = false"
      @submit="handlePaymentRegister"
    />

    <!-- Invoice Edit Modal -->
    <InvoiceEditModal
      v-if="selectedOrderForInvoice"
      :is-open="showInvoiceEditModal"
      :order-id="selectedOrderForInvoice._id"
      :invoice-needed="selectedOrderForInvoice.invoiceNeeded"
      :current-invoice-data="selectedOrderForInvoice.invoiceData"
      @close="showInvoiceEditModal = false"
      @saved="handleInvoiceSaved"
    />
  </div>
</template>

<style lang="scss" scoped>
.app-header {
  background-color: white;
  border-bottom: 1px solid $border-light;
  padding: 1rem 0;
  margin-bottom: 2rem;

  .container {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .actions {
    display: flex;
    gap: 1rem;
    align-items: center;
  }

  h1 {
    margin: 0;
    font-family: $font-principal;
    color: $NICOLE-PURPLE;
  }
}

.table-container {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  border: 1px solid $border-light;
  overflow-x: auto;

  table {
    width: 100%;
    border-collapse: collapse;

    thead {
      background: $gray-50;

      th {
        padding: 1rem;
        text-align: left;
        font-family: $font-secondary;
        font-weight: 600;
        color: $text-light;
        font-size: 0.9rem;
        border-bottom: 1px solid $border-light;
      }
    }

    tbody {
      tr {
        border-bottom: 1px solid $border-light;

        &:last-child {
          border-bottom: none;
        }

        &:hover {
          background-color: $gray-50;
        }

        &.clickable-row {
          cursor: pointer;
          transition: background-color 0.2s;

          &:hover {
            background-color: rgba($NICOLE-PURPLE, 0.05);
          }
        }
      }

      td {
        padding: 1rem;
        font-size: 0.9rem;
        color: $text-dark;
      }
    }
  }
}

.client-column {
  display: flex;
  flex-direction: column;

  .name {
    font-weight: 500;
  }

  .phone {
    font-size: 0.8rem;
    color: $text-light;
  }
}

.badge {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 500;
  text-transform: capitalize;

  &.delivery {
    background-color: rgba($NICOLE-PURPLE, 0.1);
    color: $NICOLE-PURPLE;
  }

  &.retiro {
    background-color: $gray-200;
    color: $text-dark;
  }
}

.status-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;

  &.PENDING {
    background-color: rgba($warning, 0.1);
    color: $warning;
  }

  &.PROCESSED {
    background-color: rgba($success, 0.1);
    color: $success;
  }

  &.ERROR {
    background-color: rgba($error, 0.1);
    color: $error;
  }
}

.status-text {
  color: $gray-400;
}

.total {
  font-weight: 600;
  color: $NICOLE-SECONDARY;
}

.btn-primary {
  background-color: $NICOLE-PURPLE;
  color: white;
  padding: 0.6rem 1.2rem;
  border-radius: 8px;
  text-decoration: none;
  font-weight: 600;
  font-size: 0.9rem;

  &:hover {
    background-color: $purple-hover;
  }
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem;
  gap: 1rem;
  color: $text-light;

  .spinner {
    width: 30px;
    height: 30px;
    border: 3px solid rgba($NICOLE-PURPLE, 0.3);
    border-radius: 50%;
    border-top-color: $NICOLE-PURPLE;
    animation: spin 1s ease-in-out infinite;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.empty-cell {
  text-align: center;
  color: $text-light;
  padding: 2rem !important;
}

.actions-cell {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.btn-icon {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.1rem;
  padding: 0.5rem;
  border-radius: 6px;
  color: $text-light;
  transition: all 0.2s;

  &:hover {
    background-color: rgba($NICOLE-PURPLE, 0.1);
    color: $NICOLE-PURPLE;
    transform: scale(1.05);
  }

  &.pay-icon {
    color: $success;

    &:hover {
      background-color: rgba($success, 0.1);
      color: darken($success, 10%);
    }
  }

  &.paid-icon {
    color: $NICOLE-PURPLE;
    background-color: rgba($NICOLE-PURPLE, 0.1);

    &:hover {
      background-color: rgba($NICOLE-PURPLE, 0.2);
    }
  }

  &.edit-icon {
    color: $text-light;

    &:hover {
      background-color: $gray-200;
      color: $text-dark;
    }
  }
}

.container {
  width: 100%;
  max-width: 100%;
  padding: 0 2rem;
}
</style>
