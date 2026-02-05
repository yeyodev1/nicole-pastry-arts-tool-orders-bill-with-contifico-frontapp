<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import OrderService from '@/services/order.service'
import { useToast } from '@/composables/useToast'

// Components
import InvoiceEditModal from './components/InvoiceEditModal.vue'
import PaymentModal from './components/PaymentModal.vue'
import OrderSummaryInfo from './components/OrderSummaryInfo.vue'
import OrderProductsList from './components/OrderProductsList.vue'
import OrderPaymentsList from './components/OrderPaymentsList.vue'
import OrderClientInfo from './components/OrderClientInfo.vue'
import OrderInvoiceInfo from './components/OrderInvoiceInfo.vue'
import InvoiceGenerationModal from './components/InvoiceGenerationModal.vue'
import OrderDeleteModal from './components/OrderDeleteModal.vue'
import OrderDeliveryAssign from './components/OrderDeliveryAssign.vue'
import { useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const order = ref<any>(null)
const isLoading = ref(false)
const showInvoiceModal = ref(false)
const showPaymentModal = ref(false)
const showInvoiceConfirmModal = ref(false)
const showDeleteModal = ref(false)

const fetchOrder = async () => {
  const id = route.params.id as string
  if (!id) return

  isLoading.value = true
  try {
    const data = await OrderService.getOrder(id)
    order.value = data
  } catch (error) {
    console.error('Error fetching order:', error)
  } finally {
    isLoading.value = false
  }
}

const totalPaid = computed(() => {
  if (!order.value?.payments) return 0
  return order.value.payments.reduce((sum: number, p: any) => sum + (p.monto || 0), 0)
})

const computedTotal = computed(() => {
  if (!order.value || !order.value.products) return 0

  // Robust calculation: Sum of products (price * qty) excluding courtesy
  const productSum = order.value.products.reduce((sum: number, p: any) => {
    if (p.isCourtesy) return sum
    return sum + (Number(p.price) * Number(p.quantity))
  }, 0)

  return productSum + (order.value.deliveryValue || 0)
})

const outstandingBalance = computed(() => {
  return Math.max(0, computedTotal.value - totalPaid.value)
})

const handleOrderUpdated = (updatedOrder: any) => {
  order.value = updatedOrder
}

const { success, error: showError } = useToast()

const registerCollection = async (payload: any) => {
  if (!order.value) return;

  isLoading.value = true
  try {
    const response = await OrderService.registerCollection(order.value._id, payload);
    success("Cobro registrado exitosamente en Contífico.");
    showPaymentModal.value = false;
    fetchOrder();
  } catch (error: any) {
    console.error("Error registering collection:", error);
    showError(error.response?.data?.message || "Error al registrar el cobro.");
  } finally {
    isLoading.value = false;
  }
}

const handleGenerateInvoice = () => {
  if (!order.value) return
  showInvoiceConfirmModal.value = true
}

const executeInvoiceGeneration = async () => {
  showInvoiceConfirmModal.value = false
  isLoading.value = true
  try {
    await OrderService.generateInvoice(order.value._id)
    success("Factura generada y autorizada exitosamente.")
    fetchOrder()
  } catch (e: any) {
    showError(e.response?.data?.message || "Error al generar factura")
  } finally {
    isLoading.value = false
  }
}

const handleViewInvoice = async () => {
  if (!order.value) return
  isLoading.value = true
  try {
    const response = await OrderService.getInvoicePdf(order.value._id)
    const doc = response.document
    // Confirmed 'url_ride' is the PDF link based on user feedback
    const link = doc.url_ride || doc.pdf_link || doc.descargar_pdf || doc.url || doc.mensaje

    if (link && typeof link === 'string' && link.startsWith('http')) {
      window.open(link, '_blank')
    } else {
      showError("No se encontró enlace PDF. Revise la consola.")
      console.log("Full Doc:", doc)
    }
  } catch (e: any) {
    showError("Error al obtener PDF de la factura.")
  } finally {
    isLoading.value = false
  }
}

const executeDeleteOrder = async () => {
  if (!order.value) return
  showDeleteModal.value = false
  isLoading.value = true
  try {
    await OrderService.deleteOrder(order.value._id)
    success("La orden ha sido eliminada permanentemente.")
    router.push('/orders')
  } catch (e: any) {
    showError(e.response?.data?.message || "Error al eliminar la orden")
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchOrder()
})
</script>

<template>
  <div class="order-detail-page">
    <header class="app-header">
      <div class="container">
        <div class="header-left">
          <router-link to="/orders" class="back-link">← Volver</router-link>
          <h1>Detalle del Pedido</h1>
        </div>
        <div class="header-actions">
           <button 
             v-if="order && order.invoiceStatus !== 'PROCESSED'" 
             class="btn-edit-header" 
             @click="router.push({ name: 'create-order', query: { edit: order._id } })"
           >
             <i class="fa-solid fa-pen"></i> Editar
           </button>
        </div>
      </div>
    </header>

    <main class="container" v-if="order">
      <!-- Summary Grid -->
      <OrderSummaryInfo :order="order" />

      <div class="content-grid">
        <div class="main-column">
          <!-- Products -->
          <OrderProductsList 
            :products="order.products" 
            :computedTotal="computedTotal" 
          />

          <!-- Payments History -->
          <OrderPaymentsList
            style="margin-top: 1.5rem;"
            :payments="order.payments"
            :totalPaid="totalPaid"
            :outstandingBalance="outstandingBalance"
            @open-modal="showPaymentModal = true"
          />
        </div>

        <!-- Details Sidebar -->
        <section class="side-info">
          <OrderDeliveryAssign
            v-if="order.deliveryType === 'delivery'"
            :order="order"
            @updated="handleOrderUpdated"
          />

          <OrderClientInfo
            :customerName="order.customerName"
            :customerPhone="order.customerPhone"
            :deliveryType="order.deliveryType"
            :comments="order.comments"
          />

          <OrderInvoiceInfo
            :invoiceStatus="order.invoiceStatus"
            :invoiceNeeded="order.invoiceNeeded"
            :invoiceData="order.invoiceData"
            :generatedInvoice="order.invoiceInfo"
            @open-invoice-modal="showInvoiceModal = true"
            @open-payment-modal="showPaymentModal = true"
            @generate-invoice="handleGenerateInvoice"
            @view-invoice="handleViewInvoice"
          />
        </section>
      </div>

      <!-- Danger Zone -->
      <section class="danger-zone-section" v-if="order && order.invoiceStatus !== 'PROCESSED' && !order.settledInIsland && outstandingBalance > 0.05">
        <div class="danger-header">
           <i class="fas fa-radiation"></i>
           <h3>Zona de Peligro</h3>
        </div>
        <div class="danger-card">
           <div class="danger-info">
             <strong>Eliminar este pedido</strong>
             <p>Una vez eliminado, no hay vuelta atrás. La orden y su historial desaparecerán.</p>
           </div>
           <button class="btn-danger-outline" @click="showDeleteModal = true">
             Eliminar Pedido
           </button>
        </div>
      </section>
      
    <!-- Modals -->
    <InvoiceEditModal
      :is-open="showInvoiceModal"
      :order-id="order._id"
      :invoice-needed="order.invoiceNeeded"
      :current-invoice-data="order.invoiceData"
      @close="showInvoiceModal = false"
      @saved="handleOrderUpdated"
    />

    <PaymentModal
      v-if="order && showPaymentModal"
      :is-open="showPaymentModal"
      :order-id="order._id"
      :default-amount="outstandingBalance"
      @close="showPaymentModal = false"
      @submit="registerCollection"
    />

    <InvoiceGenerationModal
      v-if="order && showInvoiceConfirmModal"
      :is-open="showInvoiceConfirmModal"
      :invoice-data="order.invoiceData"
      :total-value="computedTotal"
      @close="showInvoiceConfirmModal = false"
      @confirm="executeInvoiceGeneration"
    />

    <OrderDeleteModal
      v-if="order"
      :is-open="showDeleteModal"
      :order-id="order._id"
      :customer-name="order.customerName"
      @close="showDeleteModal = false"
      @confirm="executeDeleteOrder"
    />
    </main>

    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
/* Mobile First Layout Styles */

.order-detail-page {
  background-color: #f8fafc;
  min-height: 100vh;
  padding-bottom: 2rem;
}

.app-header {
  background-color: white;
  border-bottom: 1px solid $border-light;
  padding: 1rem 0;
  margin-bottom: 1.5rem;

  .container {
    display: flex;
    align-items: center;
    justify-content: space-between; // Ensure spacing between left and right
    margin: 0 auto;
    padding: 0 1rem;
    max-width: 1280px;
  }
}

.header-actions {
  display: flex;
  gap: 1rem;
}

.btn-edit-header {
  background: white;
  border: 1px solid #d1d5db;
  color: #374151;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s;
  font-size: 0.9rem;

  &:hover {
    border-color: #3b82f6;
    color: #2563eb;
    background: #eff6ff;
  }
  
  i {
    font-size: 0.9rem;
  }
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
  width: 100%;

  h1 {
    margin: 0;
    font-family: $font-principal;
    color: $NICOLE-PURPLE;
    font-size: 1.4rem;
    font-weight: 700;
  }

  .back-link {
    text-decoration: none;
    color: $text-light;
    font-weight: 600;
    background: white;
    padding: 0.4rem 0.8rem;
    border: 1px solid $border-light;
    border-radius: 8px;
    font-size: 0.85rem;
    white-space: nowrap;

    &:hover {
      color: $NICOLE-PURPLE;
      border-color: $NICOLE-PURPLE;
    }
  }
}

.container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 1rem;
}

/* Layout Grid */
.content-grid {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.main-column {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.side-info {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.loading-state {
  position: fixed;
  inset: 0;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 99;

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba($NICOLE-PURPLE, 0.2);
    border-top-color: $NICOLE-PURPLE;
    border-radius: 50%;
    animation: spin 0.8s infinite linear;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* MEDIA QUERIES */
@media (min-width: 768px) {
  .header-left h1 {
    font-size: 1.8rem;
  }

}

@media (min-width: 1024px) {
  .content-grid {
    display: grid;
    grid-template-columns: 1fr 380px;
    /* Sidebar layout */
    align-items: start;
  }

  .side-info {
    position: sticky;
    top: 2rem;
  }
}

/* Danger Zone Styles */
.danger-zone-section {
  margin-top: 4rem;
  border-top: 1px solid #fee2e2;
  padding-top: 2rem;
  margin-bottom: 2rem;

  .danger-header {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    color: #dc2626;
    margin-bottom: 1rem;

    i {
      font-size: 1.2rem;
    }

    h3 {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
  }
}

.danger-card {
  background: white;
  border: 1px solid #fecaca;
  border-radius: 12px;
  padding: 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1.5rem;

  @media (max-width: 640px) {
    flex-direction: column;
    text-align: center;
  }

  .danger-info {
    text-align: left;

    strong {
      display: block;
      color: #111827;
      font-size: 1rem;
      margin-bottom: 0.25rem;
    }

    p {
      margin: 0;
      color: #6b7280;
      font-size: 0.85rem;
    }
  }

  .btn-danger-outline {
    background: transparent;
    border: 2px solid #ef4444;
    color: #ef4444;
    padding: 0.75rem 1.5rem;
    border-radius: 10px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;

    &:hover {
      background: #ef4444;
      color: white;
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.2);
    }
  }
}
</style>
