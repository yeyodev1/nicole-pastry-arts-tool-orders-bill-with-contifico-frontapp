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

const route = useRoute()
const order = ref<any>(null)
const isLoading = ref(false)
const showInvoiceModal = ref(false)
const showPaymentModal = ref(false)

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
            @open-invoice-modal="showInvoiceModal = true"
            @open-payment-modal="showPaymentModal = true"
          />
        </section>
      </div>
      
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
    margin: 0 auto;
    padding: 0 1rem;
    max-width: 1280px;
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
</style>
