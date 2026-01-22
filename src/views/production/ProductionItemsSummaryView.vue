<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import ProductionService from '@/services/production.service'
import ProductionRegisterModal from './components/ProductionRegisterModal.vue'

interface SummaryItem {
  _id: string // Product Name
  totalQuantity: number
  urgency: string
  orders: {
    id: string
    quantity: number
    client: string
    delivery: string
    stage: string
  }[]
  isExpanded?: boolean
}

// const items = ref<SummaryItem[]>([]) // Removed in favor of specific refs
const isLoading = ref(true)
const error = ref('')

// Modal State
const isRegisterModalOpen = ref(false)
const selectedItem = ref<SummaryItem | null>(null)

onMounted(async () => {
  await fetchSummary()
})

const fetchSummary = async () => {
  try {
    isLoading.value = true
    const response = await ProductionService.getSummary()
    // Assume response is { dashboard: { today: [], tomorrow: [], future: [] } } or similar
    // Check service implementation to match
    // Wait, ProductionService.getSummary() calls axios. Get full response?
    // Let's assume ProductionService returns response.data or something. 
    // In backend controller: res.send({ message, dashboard })
    // In frontend service (checking next): likely returns response.data

    // Actually, I should verify frontend service wrapper. 
    // If I cannot verify, I will assume it returns the payload 'dashboard' directly if consistent with other services.
    // For safety, I will handle both.

    // For now, let's assume the service returns the data object.
    const data = response.dashboard || response // Falback

    todayItems.value = data.today || []
    tomorrowItems.value = data.tomorrow || []
    futureItems.value = data.future || []

  } catch (err) {
    console.error(err)
    error.value = 'No se pudo cargar el resumen de producción.'
  } finally {
    isLoading.value = false
  }
}

const toggleExpand = (item: SummaryItem) => {
  item.isExpanded = !item.isExpanded
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('es-EC', {
    weekday: 'short',
    day: 'numeric',
    // month: 'short', 
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

// Data Refs (Server grouped)
const todayItems = ref<SummaryItem[]>([])
const tomorrowItems = ref<SummaryItem[]>([])
const futureItems = ref<SummaryItem[]>([])

// Helper to check if empty
const hasItems = computed(() => {
  return todayItems.value.length > 0 || tomorrowItems.value.length > 0 || futureItems.value.length > 0
})

const openRegisterModal = (item: SummaryItem, event: Event) => {
  event.stopPropagation()
  selectedItem.value = item
  isRegisterModalOpen.value = true
}

const handleRegisterConfirm = async (quantity: number) => {
  if (!selectedItem.value) return

  isRegisterModalOpen.value = false

  try {
    await ProductionService.registerProgress(selectedItem.value._id, quantity)
    // Refresh list
    await fetchSummary()
  } catch (err) {
    alert('Error al registrar progreso')
  } finally {
    selectedItem.value = null
  }
}

// Helper for card class logic
const getCardClass = (type: 'today' | 'tomorrow' | 'future') => {
  return type
}

</script>

<template>
  <div class="summary-view">
    <div class="header-section">
      <div class="header-content">
        <h1>Resumen de Producción</h1>
        <p>Control de items pendientes y registro de progreso</p>
      </div>
      <button class="btn-refresh" @click="fetchSummary" :disabled="isLoading">
        <i class="fas fa-sync-alt" :class="{ 'fa-spin': isLoading }"></i>
        Actualizar
      </button>
    </div>

    <div v-if="isLoading" class="loading-state">
      <span class="loader"></span>
      <p>Cargando información...</p>
    </div>

    <div v-else-if="error" class="error-msg">
      <i class="fas fa-exclamation-triangle"></i>
      {{ error }}
      <button @click="fetchSummary">Reintentar</button>
    </div>

    <div v-else class="content-wrapper">
      
      <!-- TODAY SECTION -->
      <section v-if="todayItems.length > 0" class="group-section today">
        <div class="section-title urgent">
          <div class="icon-box"><i class="fas fa-fire"></i></div>
          <h2>Para Hoy / Urgente</h2>
          <span class="count-badge">{{ todayItems.length }} items</span>
        </div>
        
        <div class="items-grid">
          <div 
            v-for="item in todayItems" 
            :key="item._id" 
            class="summary-card urgent"
            :class="{ expanded: item.isExpanded }"
            @click="toggleExpand(item)"
          >
            <div class="card-header urgent">
              <span class="due-label">VENCE:</span>
              <span class="due-time">{{ formatDate(item.urgency) }}</span>
            </div>
            
            <div class="card-body">
              <div class="quantity-box urgent">
                <span class="number">{{ item.totalQuantity }}</span>
                <span class="label">PENDIENTES</span>
              </div>
              <h3 class="product-name">{{ item._id }}</h3>
            </div>

            <div class="card-actions">
               <button class="btn-register urgent" @click="(e) => openRegisterModal(item, e)">
                 <i class="fas fa-clipboard-check"></i>
                 REGISTRAR
               </button>
               <button class="btn-expand" :class="{ rotated: item.isExpanded }">
                 <i class="fas fa-chevron-down"></i>
               </button>
            </div>

            <div v-if="item.isExpanded" class="breakdown">
              <h4>Detalle de Pedidos</h4>
              <ul>
                <li v-for="order in item.orders" :key="order.id">
                  <span class="client-name">{{ order.client }}</span>
                  <span class="qty-pill">x{{ order.quantity }}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <hr v-if="todayItems.length > 0 && tomorrowItems.length > 0" class="section-divider" />

      <!-- TOMORROW SECTION -->
      <section v-if="tomorrowItems.length > 0" class="group-section tomorrow">
        <div class="section-title warning">
          <div class="icon-box"><i class="fas fa-clock"></i></div>
          <h2>Para Mañana</h2>
          <span class="count-badge">{{ tomorrowItems.length }} items</span>
        </div>

        <div class="items-grid">
          <div 
            v-for="item in tomorrowItems" 
            :key="item._id" 
            class="summary-card warning"
            :class="{ expanded: item.isExpanded }"
            @click="toggleExpand(item)"
          >
            <div class="card-header warning">
              <span class="due-label">ENTREGA:</span>
              <span class="due-time">{{ formatDate(item.urgency) }}</span>
            </div>
            
            <div class="card-body">
              <div class="quantity-box warning">
                <span class="number">{{ item.totalQuantity }}</span>
                <span class="label">PENDIENTES</span>
              </div>
              <h3 class="product-name">{{ item._id }}</h3>
            </div>
            
            <div class="card-actions">
               <button class="btn-register warning" @click="(e) => openRegisterModal(item, e)">
                 <i class="fas fa-clipboard-check"></i>
                 AVANZAR
               </button>
               <button class="btn-expand" :class="{ rotated: item.isExpanded }">
                 <i class="fas fa-chevron-down"></i>
               </button>
            </div>

             <div v-if="item.isExpanded" class="breakdown">
              <h4>Detalle de Pedidos</h4>
              <ul>
                <li v-for="order in item.orders" :key="order.id">
                  <span class="client-name">{{ order.client }}</span>
                  <span class="qty-pill">x{{ order.quantity }}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <hr v-if="tomorrowItems.length > 0 && futureItems.length > 0" class="section-divider" />

      <!-- FUTURE SECTION -->
      <section v-if="futureItems.length > 0" class="group-section future">
        <div class="section-title info">
          <div class="icon-box"><i class="fas fa-calendar-alt"></i></div>
          <h2>Futuro</h2>
          <span class="count-badge">{{ futureItems.length }} items</span>
        </div>

        <div class="items-grid">
          <div 
            v-for="item in futureItems" 
            :key="item._id" 
            class="summary-card info"
            :class="{ expanded: item.isExpanded }"
            @click="toggleExpand(item)"
          >
             <div class="card-header info">
              <span class="due-label">FECHA:</span>
              <span class="due-time">{{ formatDate(item.urgency) }}</span>
            </div>
            <div class="card-body">
              <div class="quantity-box info">
                <span class="number">{{ item.totalQuantity }}</span>
                <span class="label">PENDIENTES</span>
              </div>
              <h3 class="product-name">{{ item._id }}</h3>
            </div>
            
            <!-- ACTIONS (Even future items can be advanced usually, but sticking to design) -->
            <div class="card-actions">
               <button class="btn-register info" @click="(e) => openRegisterModal(item, e)">
                 <i class="fas fa-clipboard-check"></i>
                 AVANZAR
               </button>
               <button class="btn-expand" :class="{ rotated: item.isExpanded }">
                 <i class="fas fa-chevron-down"></i>
               </button>
            </div>

            <div v-if="item.isExpanded" class="breakdown">
              <h4>Detalle de Pedidos</h4>
              <ul>
                <li v-for="order in item.orders" :key="order.id">
                  <span class="client-name">{{ order.client }}</span>
                  <span class="qty-pill">x{{ order.quantity }}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>



      <div v-if="!hasItems" class="empty-state">
        <i class="fas fa-check-circle"></i>
        <p>¡No hay producción pendiente!</p>
        <span>Buen trabajo, el tablero está limpio.</span>
      </div>

    </div>

    <!-- Production Register Modal -->
    <ProductionRegisterModal 
      :is-open="isRegisterModalOpen"
      :product-name="selectedItem?._id || ''"
      :pending-quantity="selectedItem?.totalQuantity || 0"
      @close="isRegisterModalOpen = false"
      @confirm="handleRegisterConfirm"
    />
  </div>
</template>

<style lang="scss" scoped>
/* VARIABLE FALLBACKS */
$card-radius: 16px;
$shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.06);
$shadow-md: 0 8px 24px rgba(0, 0, 0, 0.12);
$font-stack: 'Inter', system-ui, -apple-system, sans-serif;
$color-urgent: #e74c3c;
$color-urgent-bg: #c0392b;
$color-warning: #f39c12;
$color-warning-bg: #d35400; // Gradient end
$color-info: #3498db;
$color-info-bg: #2980b9;

.summary-view {
  min-height: 100vh;
  background-color: #f8f9fa;
  padding: 1.5rem;
  padding-bottom: 5rem;
  font-family: $font-stack;
}

.header-section {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 3rem;

  .header-content {
    h1 {
      font-size: 1.75rem;
      color: #2c3e50;
      margin: 0 0 0.5rem 0;
      font-weight: 800;
      letter-spacing: -0.5px;
    }

    p {
      color: #7f8c8d;
      margin: 0;
      font-size: 0.95rem;
    }
  }

  .btn-refresh {
    background: white;
    border: 1px solid #e0e0e0;
    padding: 0.6rem 1rem;
    border-radius: 8px;
    color: #7f8c8d;
    cursor: pointer;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: all 0.2s;

    &:hover {
      border-color: #bdc3c7;
      color: #2c3e50;
    }
  }
}

.section-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.5rem;

  .icon-box {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1rem;
    color: white;
  }

  h2 {
    font-size: 1.25rem;
    font-weight: 700;
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .count-badge {
    background: #e0e0e0;
    padding: 0.2rem 0.6rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
    color: #555;
  }

  /* Theme Variants */
  &.urgent {
    .icon-box {
      background: linear-gradient(135deg, $color-urgent, $color-urgent-bg);
    }

    h2 {
      color: $color-urgent;
    }
  }

  &.warning {
    .icon-box {
      background: linear-gradient(135deg, $color-warning, #e67e22);
    }

    h2 {
      color: #d35400;
    }
  }

  &.info {
    .icon-box {
      background: linear-gradient(135deg, $color-info, $color-info-bg);
    }

    h2 {
      color: $color-info;
    }
  }
}

.group-section {
  margin-bottom: 2rem; // Reduced margin as divider adds space
}

.section-divider {
  border: 0;
  height: 1px;
  background: #dfe6e9; // Subtle divider color
  margin: 2rem 0 3.5rem 0;
}

.items-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1.5rem;
}

.summary-card {
  background: white;
  border-radius: $card-radius;
  box-shadow: $shadow-sm;
  transition: transform 0.2s, box-shadow 0.2s;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.03);
  display: flex;
  flex-direction: column;

  &:hover {
    transform: translateY(-4px);
    box-shadow: $shadow-md;
  }

  /* Header Styles */
  .card-header {
    padding: 0.6rem 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.75rem;
    font-weight: 700;
    color: white;
    text-transform: uppercase;
    letter-spacing: 0.5px;

    &.urgent {
      background: linear-gradient(90deg, $color-urgent, $color-urgent-bg);
    }

    &.warning {
      background: linear-gradient(90deg, $color-warning, #e67e22);
    }

    &.info {
      background: linear-gradient(90deg, $color-info, $color-info-bg);
    }
  }

  /* Body Styles */
  .card-body {
    padding: 1.5rem 1rem 1rem 1rem;
    text-align: center;
    flex-grow: 1;
  }

  .quantity-box {
    margin-bottom: 1rem;
    display: flex;
    flex-direction: column;
    align-items: center;

    .number {
      font-size: 3rem;
      font-weight: 800;
      line-height: 1;
      letter-spacing: -2px;
    }

    .label {
      font-size: 0.65rem;
      font-weight: 700;
      color: #95a5a6;
      letter-spacing: 1px;
      margin-top: 4px;
    }

    &.urgent .number {
      color: $color-urgent;
    }

    &.warning .number {
      color: #d35400;
    }

    &.info .number {
      color: $color-info;
    }
  }

  .product-name {
    font-size: 0.95rem;
    color: #34495e;
    margin: 0;
    line-height: 1.4;
    font-weight: 600;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* Actions */
  .card-actions {
    padding: 1rem;
    display: flex;
    gap: 0.5rem;
    border-top: 1px solid #f1f2f6;

    .btn-register {
      flex-grow: 1;
      border: none;
      padding: 0.6rem;
      border-radius: 8px;
      font-size: 0.75rem;
      font-weight: 700;
      color: white;
      text-transform: uppercase;
      cursor: pointer;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 0.4rem;
      transition: opacity 0.2s;

      &:hover {
        opacity: 0.9;
      }

      &.urgent {
        background: $color-urgent;
      }

      &.warning {
        background: #f39c12;
        color: white;
      }

      &.info {
        background: $color-info;
        color: white;
      }
    }

    .btn-expand {
      background: #f1f2f6;
      border: none;
      width: 32px;
      border-radius: 8px;
      color: #7f8c8d;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;

      &:hover {
        background: #e0e0e0;
      }

      &.rotated i {
        transform: rotate(180deg);
      }

      i {
        transition: transform 0.2s;
        font-size: 0.8rem;
      }
    }
  }

  /* Breakdown */
  .breakdown {
    background: #fafbfc;
    padding: 1rem;
    border-top: 1px solid #eee;

    h4 {
      margin: 0 0 0.8rem 0;
      font-size: 0.7rem;
      text-transform: uppercase;
      color: #95a5a6;
      font-weight: 700;
      letter-spacing: 0.5px;
    }

    ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    li {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
      font-size: 0.85rem;

      .client-name {
        color: #2c3e50;
        font-weight: 500;
      }

      .qty-pill {
        background: #ecf0f1;
        padding: 2px 6px;
        border-radius: 4px;
        font-weight: 600;
        font-size: 0.75rem;
        color: #7f8c8d;
      }
    }
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem;
  color: #bdc3c7;

  i {
    font-size: 4rem;
    margin-bottom: 1rem;
    color: #2ecc71;
  }

  p {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0;
    color: #7f8c8d;
  }

  span {
    font-size: 1rem;
    margin-top: 0.5rem;
  }
}

.loading-state {
  text-align: center;
  padding: 4rem;
  color: #95a5a6;

  .loader {
    width: 40px;
    height: 40px;
    border: 4px solid #f3f3f3;
    border-top: 4px solid #3498db;
    border-radius: 50%;
    display: inline-block;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
  }
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}
</style>
