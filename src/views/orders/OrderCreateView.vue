<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue'
import ProductService from '@/services/product.service'
import OrderService from '@/services/order.service'
import { useRouter } from 'vue-router'

const router = useRouter()

// UI State
const isLoading = ref(false)
const isSubmitting = ref(false)
const showWhatsAppModal = ref(false)
const generatedWhatsAppMessage = ref('')
const searchTerm = ref('')
const products = ref<any[]>([])
const currentPage = ref(1)
const hasMore = ref(true)
const pageSize = 20

// Form Data
const formData = reactive({
  customerName: '',
  customerPhone: '',
  deliveryDate: '',
  deliveryType: 'pickup' as 'pickup' | 'delivery',
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
  }
})

// Cart
interface CartItem {
  id?: string
  contifico_id?: string
  name: string
  price: number
  quantity: number
}
const cart = ref<CartItem[]>([])

const cartTotal = computed(() => {
  return cart.value.reduce((total, item) => total + (item.price * item.quantity), 0)
})

const cartSubtotal = computed(() => {
  // Assuming 15% IVA is included in price or added? 
  // Based on backend service: base_gravable = totalLine (so price includes or is base?)
  // Backend calc: totalLine = cant * price. 
  // If product has IVA (backend assumes YES for now), then base_gravable is totalLine.
  // Then IVA is calculated ON TOP.
  // Let's display simple total for now.
  return cartTotal.value
})

const cartIVA = computed(() => {
  // Backend: iva_line = base_gravable * 0.15
  return cartSubtotal.value * 0.15
})

const finalTotal = computed(() => {
  return cartSubtotal.value + cartIVA.value
})

// Methods
const fetchProducts = async (isNewSearch = true) => {
  if (isNewSearch) {
    currentPage.value = 1
    products.value = []
    hasMore.value = true
  }

  if (!hasMore.value) return

  isLoading.value = true
  try {
    const data = await ProductService.getProducts({
      filtro: searchTerm.value,
      page: currentPage.value,
      limit: pageSize
    })

    if (data.length < pageSize) {
      hasMore.value = false
    }

    if (isNewSearch) {
      products.value = data
    } else {
      products.value = [...products.value, ...data]
    }

    currentPage.value++
  } catch (e) {
    console.error(e)
  } finally {
    isLoading.value = false
  }
}

const loadMore = () => {
  fetchProducts(false)
}

const addToCart = (product: any) => {
  const existing = cart.value.find(item => item.name === product.nombre) // matching by name if no ID, preferably use ID
  // Backend product format from Contifico: { id: "...", nombre: "...", pvp1: "..." }
  // Let's assume structure based on typical contifico usage or log to debug

  if (existing) {
    existing.quantity++
  } else {
    cart.value.push({
      id: product.id,
      contifico_id: product.id, // mapping ID to contifico_id
      name: product.nombre || product.name || 'Unknown Product',
      price: parseFloat(product.pvp1 || product.price || 0),
      quantity: 1
    })
  }
}

const removeFromCart = (index: number) => {
  cart.value.splice(index, 1)
}

const submitOrder = async () => {
  if (cart.value.length === 0) return

  isSubmitting.value = true
  try {
    // Prepare payload
    const payload = {
      ...formData,
      products: cart.value.map(item => ({
        contifico_id: item.contifico_id,
        name: item.name,
        quantity: item.quantity,
        price: item.price
      })),
      // Ensure RUC is copied to invoiceData if needed, or validate
    }

    const response = await OrderService.createOrder(payload)

    generatedWhatsAppMessage.value = response.whatsappMessage
    showWhatsAppModal.value = true

    // Reset form? Keep it for now until close.
  } catch (e) {
    alert('Error creating order. Please try again.')
    console.error(e)
  } finally {
    isSubmitting.value = false
  }
}

const sendWhatsApp = () => {
  const encoded = encodeURIComponent(generatedWhatsAppMessage.value)
  window.open(`https://wa.me/?text=${encoded}`, '_blank')
  // Maybe clear cart after sending?
  showWhatsAppModal.value = false
  cart.value = []
  router.push('/orders/new') // refresh
}

const handleSearch = () => {
  fetchProducts(true)
}

onMounted(() => {
  fetchProducts(true)
})
</script>

<template>
  <div class="order-page">
    <header class="app-header">
      <div class="container">
        <h1>Nuevo Pedido</h1>
        <div class="user-info">
          <span>ventas@nicole.com.ec</span>
        </div>
      </div>
    </header>

    <main class="container main-content">
      <!-- Left Column: Product Selection -->
      <section class="products-section">
        <div class="search-bar">
          <input 
            v-model="searchTerm" 
            @keyup.enter="handleSearch"
            placeholder="Buscar productos..." 
            type="text" 
          />
          <button @click="handleSearch" class="btn-search">Buscar</button>
        </div>

        <div class="products-container-scroll">
          <div class="products-grid">
            <div 
              v-for="product in products" 
              :key="product.id" 
              class="product-card"
              @click="addToCart(product)"
            >
              <div class="product-info">
                <h3>{{ product.nombre || product.name }}</h3>
                <p class="price">${{ parseFloat(product.pvp1 || product.price || 0).toFixed(2) }}</p>
              </div>
              <button class="btn-add">+</button>
            </div>
          </div>
          
          <div v-if="isLoading" class="loading-state">
            <div class="spinner"></div>
            <span>Cargando productos...</span>
          </div>

          <div v-if="!isLoading && products.length > 0 && hasMore" class="load-more-container">
            <button @click="loadMore" class="btn-secondary">Cargar más productos</button>
          </div>

          <div v-if="!isLoading && products.length === 0" class="empty-state">
            No se encontraron productos.
          </div>
        </div>
      </section>

      <!-- Right Column: Order Details & Cart -->
      <section class="order-form-section">
        <div class="card">
          <h2>Datos del Cliente</h2>
          <div class="form-grid">
            <div class="form-group">
              <label>Nombre Cliente</label>
              <input v-model="formData.customerName" required />
            </div>
            <div class="form-group">
              <label>Teléfono</label>
              <input v-model="formData.customerPhone" required />
            </div>
            <div class="form-group">
              <label>Fecha Entrega</label>
              <input type="datetime-local" v-model="formData.deliveryDate" required />
            </div>
            <div class="form-group">
              <label>Tipo Entrega</label>
              <select v-model="formData.deliveryType">
                <option value="pickup">Retiro en Local</option>
                <option value="delivery">Delivery</option>
              </select>
            </div>
            <div class="form-group">
              <label>Responsable</label>
              <select v-model="formData.responsible">
                <option value="Web">Web</option>
                <option value="Hillary">Hillary</option>
                <option value="E">E</option>
                <option value="Ivin">Ivin</option>
              </select>
            </div>
          </div>

          <div class="form-group" style="margin-top: 1rem;">
            <label>Notas Especiales (Comentarios)</label>
            <textarea v-model="formData.comments" rows="3" placeholder="Detalles adicionales del pedido..."></textarea>
          </div>


          <div class="invoice-toggle">
            <label>
              <input type="checkbox" v-model="formData.invoiceNeeded" />
              Requiere Factura
            </label>
          </div>

          <div v-if="formData.invoiceNeeded" class="invoice-fields">
            <h3>Datos de Facturación</h3>
            <div class="form-group">
              <label>RUC / Cédula</label>
              <input v-model="formData.invoiceData.ruc" />
            </div>
            <div class="form-group">
              <label>Razón Social / Nombre</label>
              <input v-model="formData.invoiceData.businessName" />
            </div>
            <div class="form-group">
              <label>Email</label>
              <input v-model="formData.invoiceData.email" type="email" />
            </div>
            <div class="form-group">
              <label>Dirección</label>
              <input v-model="formData.invoiceData.address" />
            </div>
          </div>
        </div>

        <div class="card cart-card">
          <h2>Detalle del Pedido</h2>
          <div class="cart-items">
            <div v-for="(item, index) in cart" :key="index" class="cart-item">
              <div class="item-details">
                <span class="item-name">{{ item.name }}</span>
                <span class="item-price">${{ item.price.toFixed(2) }}</span>
              </div>
              <div class="item-controls">
                <button @click="item.quantity > 1 ? item.quantity-- : removeFromCart(index)">-</button>
                <span>{{ item.quantity }}</span>
                <button @click="item.quantity++">+</button>
              </div>
            </div>
            <div v-if="cart.length === 0" class="empty-cart">
              No hay items en el pedido
            </div>
          </div>

          <div class="totals">
            <div class="total-row">
              <span>Subtotal:</span>
              <span>${{ cartSubtotal.toFixed(2) }}</span>
            </div>
            <div class="total-row">
              <span>IVA (15% est):</span>
              <span>${{ cartIVA.toFixed(2) }}</span>
            </div>
            <div class="total-row final">
              <span>Total:</span>
              <span>${{ finalTotal.toFixed(2) }}</span>
            </div>
          </div>

          <button 
            class="btn-submit" 
            @click="submitOrder" 
            :disabled="cart.length === 0 || isSubmitting"
          >
            {{ isSubmitting ? 'Procesando...' : 'Generar Pedido' }}
          </button>
        </div>
      </section>
    </main>

    <!-- WhatsApp Modal -->
    <div v-if="showWhatsAppModal" class="modal-overlay">
      <div class="modal">
        <h2>Pedido Creado con Éxito</h2>
        <p>El pedido ha sido guardado. Envía la confirmación por WhatsApp:</p>
        <textarea readonly v-model="generatedWhatsAppMessage" rows="10"></textarea>
        <div class="modal-actions">
          <button @click="showWhatsAppModal = false" class="btn-secondary">Cerrar</button>
          <button @click="sendWhatsApp" class="btn-whatsapp">Enviar WhatsApp</button>
        </div>
      </div>
    </div>
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

  h1 {
    margin: 0;
    font-family: $font-principal;
    color: $NICOLE-PURPLE;
  }

  .user-info {
    font-size: 0.9rem;
    color: $text-light;
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

.card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  border: 1px solid $border-light;
  margin-bottom: 1.5rem;

  h2 {
    font-family: $font-principal;
    font-size: 1.25rem;
    color: $NICOLE-SECONDARY;
    margin-top: 0;
    border-bottom: 1px solid $border-light;
    padding-bottom: 0.5rem;
    margin-bottom: 1rem;
  }
}

.search-bar {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;

  input {
    flex: 1;
    padding: 0.75rem 1rem;
    border: 1px solid $border-light;
    border-radius: 8px;
    font-family: $font-secondary;

    &:focus {
      outline: none;
      border-color: $NICOLE-PURPLE;
    }
  }

  .btn-search {
    background: $NICOLE-PURPLE;
    color: white;
    border: none;
    padding: 0 1.5rem;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;

    &:hover {
      background: $purple-hover;
    }
  }
}

.products-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

.product-card {
  background: white;
  border: 1px solid $border-light;
  border-radius: 8px;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  justify-content: space-between;
  align-items: start;

  &:hover {
    border-color: $NICOLE-PURPLE;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  }

  .product-info {
    h3 {
      font-size: 0.95rem;
      margin: 0 0 0.25rem 0;
      color: $text-dark;
    }

    .price {
      font-weight: 600;
      color: $NICOLE-PURPLE;
      margin: 0;
    }
  }

  .btn-add {
    background: $gray-100;
    border: none;
    color: $NICOLE-PURPLE;
    font-weight: bold;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover {
      background: $NICOLE-PURPLE;
      color: white;
    }
  }
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;

  label {
    font-size: 0.85rem;
    color: $text-light;
    font-weight: 500;
  }

  input,
  select {
    padding: 0.5rem;
    border: 1px solid $border-light;
    border-radius: 6px;

    &:focus {
      outline: none;
      border-color: $NICOLE-PURPLE;
    }
  }
}

.invoice-toggle {
  margin: 1.5rem 0 1rem;
  padding: 0.5rem;
  background: $gray-50;
  border-radius: 6px;

  label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-weight: 500;
    color: $text-dark;
  }
}

.invoice-fields {
  display: grid;
  gap: 1rem;
  animation: fadeIn 0.3s ease;

  h3 {
    font-size: 1rem;
    color: $text-dark;
    margin: 0.5rem 0 0;
  }
}

.cart-items {
  margin-bottom: 1.5rem;
  max-height: 300px;
  overflow-y: auto;
}

.cart-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 0;
  border-bottom: 1px solid $border-light;

  .item-details {
    flex: 1;

    .item-name {
      display: block;
      font-size: 0.9rem;
      font-weight: 500;
    }

    .item-price {
      font-size: 0.85rem;
      color: $text-light;
    }
  }

  .item-controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;

    button {
      width: 24px;
      height: 24px;
      border: 1px solid $border-light;
      background: white;
      border-radius: 4px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;

      &:hover {
        background: $gray-100;
      }
    }

    span {
      font-weight: 600;
      min-width: 20px;
      text-align: center;
    }
  }
}

.totals {
  border-top: 2px solid $border-light;
  padding-top: 1rem;
  margin-bottom: 1.5rem;

  .total-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.5rem;
    font-size: 0.9rem;
    color: $text-light;

    &.final {
      font-size: 1.1rem;
      font-weight: 700;
      color: $text-dark;
      margin-top: 0.5rem;
    }
  }
}

.btn-submit {
  width: 100%;
  background: $NICOLE-PURPLE;
  color: white;
  border: none;
  padding: 1rem;
  border-radius: 8px;
  font-weight: 700;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    background: $purple-dark;
    transform: translateY(-2px);
  }

  &:disabled {
    background: $gray-400;
    cursor: not-allowed;
  }
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal {
  background: white;
  width: 90%;
  max-width: 500px;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2);

  h2 {
    color: $success;
    margin-top: 0;
  }

  textarea {
    width: 100%;
    margin: 1rem 0;
    padding: 1rem;
    border: 1px solid $border-light;
    border-radius: 8px;
    background: $gray-50;
    font-family: monospace;
    resize: none;
  }

  .modal-actions {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;

    button {
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      border: none;
    }

    .btn-secondary {
      background: $gray-200;
      color: $text-dark;

      &:hover {
        background: $gray-300;
      }
    }

    .btn-whatsapp {
      background: #25D366;
      color: white;

      &:hover {
        background: #128C7E;
      }
    }
  }
}

.container {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1.5rem;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: $text-light;
  gap: 1rem;

  .spinner {
    width: 30px;
    height: 30px;
    border: 3px solid rgba($NICOLE-PURPLE, 0.3);
    border-radius: 50%;
    border-top-color: $NICOLE-PURPLE;
    animation: spin 1s ease-in-out infinite;
  }
}

.load-more-container {
  display: flex;
  justify-content: center;
  padding: 1.5rem 0;

  button {
    background: $gray-100;
    border: 1px solid $border-light;
    padding: 0.75rem 2rem;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 500;
    color: $NICOLE-PURPLE;
    transition: all 0.2s;

    &:hover {
      background: $NICOLE-PURPLE;
      color: white;
    }
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
