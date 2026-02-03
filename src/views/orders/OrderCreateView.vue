<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import OrderService from '@/services/order.service'
import { useRouter } from 'vue-router'
import type { Product, CartItem, OrderFormData } from '@/types/order'

// Components
import OrderProductSelector from './components/OrderProductSelector.vue'
import OrderForm from './components/OrderForm.vue'
import OrderCart from './components/OrderCart.vue'
import OrderWhatsAppModal from './components/OrderWhatsAppModal.vue'
import OrderConfirmationModal from './components/OrderConfirmationModal.vue'

const router = useRouter()

// UI State
const isSubmitting = ref(false)
const showWhatsAppModal = ref(false)
const showConfirmationModal = ref(false)
const generatedWhatsAppMessage = ref('')
const isCourtesyMode = ref(false)

// Form Data - Strictly Typed
const formData = reactive<OrderFormData>({
  customerName: '',
  customerPhone: '',
  deliveryDate: '',
  deliveryTime: '',
  deliveryType: 'pickup',
  branch: 'San Marino', // Default or undefined
  deliveryAddress: '',
  googleMapsLink: '',
  invoiceNeeded: false,
  comments: '',
  responsible: 'Web',
  salesChannel: 'Web',
  paymentMethod: 'Por confirmar',
  invoiceData: {
    ruc: '',
    businessName: '',
    email: '',
    address: ''
  },
  totalValue: 0,
  // Default Payment at Creation
  registerPaymentNow: false,
  isCredit: false,
  settledInIsland: false,
  settledIslandName: 'San Marino',
  paymentDetails: {
    forma_cobro: 'TRA',
    monto: 0,
    fecha: new Date().toISOString().split('T')[0] || '',
    numero_comprobante: '',
    numero_tarjeta: '',
    cuenta_bancaria_id: '',
    tipo_ping: 'D'
  }
})

// Cart
const cart = ref<CartItem[]>([])

// Sync totalValue with Cart (Logic replicated from OrderCart)
watch(cart, (newCart) => {
  const subtotal = newCart.reduce((sum, item) => sum + (item.price * item.quantity), 0)

  const iva = newCart.reduce((sum, item) => {
    // Delivery items have 0% IVA
    const isDelivery = item.name && item.name.toLowerCase().includes('delivery')
    return sum + (isDelivery ? 0 : (item.price * item.quantity * 0.15))
  }, 0)

  formData.totalValue = Number((subtotal + iva).toFixed(2))
}, { deep: true })

const addToCart = (product: Product) => {
  const existing = cart.value.find(item => item.contifico_id === product.id)

  if (existing) {
    existing.quantity++
  } else {
    // Determine price and courtesy status based on mode
    const price = isCourtesyMode.value ? 0 : parseFloat(product.pvp1 || '0')
    const isCourtesy = isCourtesyMode.value

    cart.value.push({
      id: product.id,
      contifico_id: product.id,
      name: product.nombre,
      price: price,
      quantity: 1,
      isCourtesy: isCourtesy // Add this property to CartItem type definition if needed, but JS will allow it. Ideally update Type.
    })
  }
}

const removeFromCart = (index: number) => {
  cart.value.splice(index, 1)
}

const updateQuantity = (index: number, change: number) => {
  const item = cart.value[index]
  if (item) {
    item.quantity += change
    if (item.quantity < 1) {
      removeFromCart(index)
    }
  }
}

const onCartSubmit = () => {
  if (cart.value.length === 0) {
    alert("El carrito está vacío.")
    return
  }

  // Frontend Validation
  if (!formData.customerName) { alert("Nombre del cliente es obligatorio"); return; }
  if (!formData.customerPhone) { alert("Teléfono del cliente es obligatorio"); return; }
  if (!formData.deliveryDate) { alert("Fecha de entrega es obligatoria"); return; }
  if (!formData.deliveryTime) { alert("Hora de entrega es obligatoria"); return; }
  if (!formData.branch) { alert("Sucursal de origen es obligatoria"); return; }

  if (formData.deliveryType === 'delivery') {
    if (!formData.deliveryAddress) { alert("Dirección de entrega es obligatoria para Delivery"); return; }
    if (!formData.googleMapsLink) { alert("Link de Google Maps es obligatorio para Delivery"); return; }
  }

  if (formData.invoiceNeeded) {
    if (!formData.invoiceData.ruc) { alert("RUC/Cédula es obligatorio para factura"); return; }
  }

  if (formData.settledInIsland && !formData.settledIslandName) {
    alert("Debe seleccionar la isla donde se facturó.");
    return;
  }

  // Show Confirmation Modal
  showConfirmationModal.value = true
}

const executeOrderCreation = async () => {
  showConfirmationModal.value = false
  isSubmitting.value = true

  try {
    const payload = {
      ...formData,
      // Handle Credit Sale override
      ...(formData.isCredit ? {
        registerPaymentNow: true,
        paymentDetails: {
          ...formData.paymentDetails,
          forma_cobro: 'CR',
          monto: formData.totalValue,
          fecha: new Date().toISOString().split('T')[0]
        }
      } : {}),
      products: cart.value.map(item => ({
        contifico_id: item.contifico_id,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        isCourtesy: item.isCourtesy || false
      })),
    }

    const response = await OrderService.createOrder(payload)

    generatedWhatsAppMessage.value = response.whatsappMessage
    resetForm()
    showWhatsAppModal.value = true
  } catch (e: any) {
    alert(e.response?.data?.message || 'Error creating order. Please try again.')
    console.error(e)
  } finally {
    isSubmitting.value = false
  }
}

const resetForm = () => {
  // Reset Form Data
  Object.assign(formData, {
    customerName: '',
    customerPhone: '',
    deliveryDate: '',
    deliveryTime: '',
    deliveryType: 'pickup',
    branch: 'San Marino',
    deliveryAddress: '',
    googleMapsLink: '',
    invoiceNeeded: false,
    comments: '',
    responsible: 'Web',
    salesChannel: 'Web',
    paymentMethod: 'Por confirmar',
    invoiceData: { ruc: '', businessName: '', email: '', address: '' },
    totalValue: 0,
    registerPaymentNow: false,
    isCredit: false,
    settledInIsland: false,
    settledIslandName: 'San Marino',
    paymentDetails: {
      forma_cobro: 'TRA',
      monto: 0,
      fecha: new Date().toISOString().split('T')[0] || '',
      numero_comprobante: '',
      numero_tarjeta: '',
      cuenta_bancaria_id: '',
      tipo_ping: 'D'
    }
  })

  // Clear Cart & State
  cart.value = []
  isCourtesyMode.value = false
  // generatedWhatsAppMessage.value = '' // Keep message for modal

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const sendWhatsApp = () => {
  const encoded = encodeURIComponent(generatedWhatsAppMessage.value)
  window.open(`https://wa.me/?text=${encoded}`, '_blank')
  showWhatsAppModal.value = false
}
</script>

<template>
  <div class="order-page">
    <div class="container page-header">
      <h1>Nuevo Pedido</h1>
    </div>

    <main class="container main-content">
      <!-- Left Column: Product Selection -->
      <section class="left-column">
        <div class="mode-toggle-container">
           <button 
             class="btn-courtesy-toggle" 
             :class="{ active: isCourtesyMode }"
             @click="isCourtesyMode = !isCourtesyMode"
           >
             <i class="fa-solid fa-gift"></i>
             {{ isCourtesyMode ? 'Modo Cortesía ACTIVO' : 'Activar Modo Cortesía' }}
           </button>
           <div v-if="isCourtesyMode" class="courtesy-banner">
             <small>Los productos agregados tendrán costo $0.00</small>
           </div>
        </div>
        <OrderProductSelector @add-to-cart="addToCart" />
      </section>

      <!-- Right Column: Order Details & Cart -->
      <section class="order-form-section">
        <OrderForm v-model="formData" />
        
        <OrderCart 
          :cart="cart" 
          :isSubmitting="isSubmitting"
          @remove="removeFromCart"
          @update-quantity="updateQuantity"
          @submit="onCartSubmit"
        />
      </section>
    </main>

    <!-- Confirmation Modal -->
    <OrderConfirmationModal
      :is-open="showConfirmationModal"
      :order-data="formData"
      :cart="cart"
      @close="showConfirmationModal = false"
      @confirm="executeOrderCreation"
    />

    <!-- WhatsApp Modal -->
    <OrderWhatsAppModal 
      :is-open="showWhatsAppModal" 
      :message="generatedWhatsAppMessage"
      @close="showWhatsAppModal = false"
      @send="sendWhatsApp"
    />
  </div>
</template>

<style lang="scss" scoped>
.order-page {
  background-color: #f8fafc; // Light background for the whole page
  min-height: 100vh;
}

.app-header {
  background-color: white;
  border-bottom: 1px solid $border-light;
  padding: 1rem 0;
  // margin-bottom removed to merge with page-header nicely
}

.page-header {
  padding: 2rem 0;
  margin-bottom: 1rem;

  h1 {
    margin: 0;
    font-family: $font-principal;
    color: $NICOLE-PURPLE;
    font-size: 2rem;
    font-weight: 700;
    letter-spacing: -1px;
    display: flex;
    align-items: center;
    gap: 0.75rem;

    &::before {
      content: '';
      display: block;
      width: 6px;
      height: 32px;
      background: $NICOLE-PURPLE;
      border-radius: 4px;
    }
  }
}

.main-content {
  display: grid;
  grid-template-columns: 1fr 450px; // Slightly wider right column
  gap: 2.5rem;
  padding-bottom: 4rem;
  align-items: start; // Important for sticky

  @media (max-width: 1024px) {
    grid-template-columns: 1fr 400px;
    gap: 1.5rem;
  }

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
}

.container {
  max-width: 1400px; // Wider container
  margin: 0 auto;
  padding: 0 2rem;
}

@media (max-width: 900px) {
  .main-content {
    grid-template-columns: 1fr;
    padding-bottom: 2rem;
  }

  .container {
    padding: 0 1rem;
  }
}

.order-form-section {
  position: sticky;
  top: 2rem;
  height: max-content;
  // Ensure it doesn't get cut off if too tall, though sticky works best for bounded content
  // Adding max-height and overflow if needed, but form might be long.
  // For now, let's keep basic sticky. 
}

.mode-toggle-container {
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: white;
  padding: 1rem;
  border-radius: 12px;
  border: 1px solid $border-light;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
  flex-wrap: wrap;
  gap: 1rem;
}

.btn-courtesy-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  padding: 0.75rem 1.25rem;
  border-radius: 8px;
  border: 2px solid $NICOLE-PURPLE;
  background-color: white;
  color: $NICOLE-PURPLE;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: $font-principal;
  font-size: 0.95rem;

  &:hover {
    background-color: rgba($NICOLE-PURPLE, 0.05);
    transform: translateY(-1px);
  }

  &.active {
    background-color: $NICOLE-PURPLE;
    color: white;
    box-shadow: 0 4px 12px rgba($NICOLE-PURPLE, 0.3);
  }

  i {
    font-size: 1.1rem;
  }
}

.courtesy-banner {
  background-color: #f0f9ff; // Light blue
  border: 1px solid #bae6fd;
  color: #0369a1;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  text-align: center;
  font-size: 0.9rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  &::before {
    content: '\f05a'; // Info circle
    font-family: 'Font Awesome 6 Free';
    font-weight: 900;
  }
}
</style>
