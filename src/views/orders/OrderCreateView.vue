<script setup lang="ts">
import { ref, reactive } from 'vue'
import OrderService from '@/services/order.service'
import { useRouter } from 'vue-router'
import type { Product, CartItem, OrderFormData } from '@/types/order'

// Components
import OrderProductSelector from './components/OrderProductSelector.vue'
import OrderForm from './components/OrderForm.vue'
import OrderCart from './components/OrderCart.vue'
import OrderWhatsAppModal from './components/OrderWhatsAppModal.vue'

const router = useRouter()

// UI State
const isSubmitting = ref(false)
const showWhatsAppModal = ref(false)
const generatedWhatsAppMessage = ref('')

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
  // Default Payment at Creation
  registerPaymentNow: false,
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

const addToCart = (product: Product) => {
  const existing = cart.value.find(item => item.contifico_id === product.id)

  if (existing) {
    existing.quantity++
  } else {
    cart.value.push({
      id: product.id,
      contifico_id: product.id,
      name: product.nombre,
      price: parseFloat(product.pvp1 || '0'),
      quantity: 1
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

const submitOrder = async () => {
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

  isSubmitting.value = true
  try {
    const payload = {
      ...formData,
      products: cart.value.map(item => ({
        contifico_id: item.contifico_id,
        name: item.name,
        quantity: item.quantity,
        price: item.price
      })),
    }

    const response = await OrderService.createOrder(payload)

    generatedWhatsAppMessage.value = response.whatsappMessage
    showWhatsAppModal.value = true
  } catch (e: any) {
    alert(e.response?.data?.message || 'Error creating order. Please try again.')
    console.error(e)
  } finally {
    isSubmitting.value = false
  }
}

const sendWhatsApp = () => {
  const encoded = encodeURIComponent(generatedWhatsAppMessage.value)
  window.open(`https://wa.me/?text=${encoded}`, '_blank')
  showWhatsAppModal.value = false
  cart.value = []
  router.push('/orders/new')
}
</script>

<template>
  <div class="order-page">
    <div class="container page-header">
      <h1>Nuevo Pedido</h1>
    </div>

    <main class="container main-content">
      <!-- Left Column: Product Selection -->
      <OrderProductSelector @add-to-cart="addToCart" />

      <!-- Right Column: Order Details & Cart -->
      <section class="order-form-section">
        <OrderForm v-model="formData" />
        
        <OrderCart 
          :cart="cart" 
          :isSubmitting="isSubmitting"
          @remove="removeFromCart"
          @update-quantity="updateQuantity"
          @submit="submitOrder"
        />
      </section>
    </main>

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
.app-header {
  // Keeping header styles locally or global as needed, but for scoped:
  background-color: white;
  border-bottom: 1px solid $border-light;
  padding: 1rem 0;
  margin-bottom: 2rem;
}

.page-header {
  margin-bottom: 2rem;
  margin-top: 1.5rem;

  h1 {
    margin: 0;
    font-family: $font-principal;
    color: $NICOLE-PURPLE;
    font-size: 1.8rem;
  }
}

.main-content {
  display: grid;
  grid-template-columns: 1fr 400px;
  gap: 2rem;
  padding-bottom: 4rem;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
}

.container {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1.5rem;
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
</style>
