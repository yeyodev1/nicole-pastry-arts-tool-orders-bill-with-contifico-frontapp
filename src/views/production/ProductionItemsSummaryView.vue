<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import ProductionService from '@/services/production.service'
import ProductionRegisterModal from './components/ProductionRegisterModal.vue' // Keeping for fallback/advanced if needed, or removing usage
import ActionHoldButton from '@/components/common/ActionHoldButton.vue'

interface SummaryItem {
  _id: string // Product Name
  totalQuantity: number
  urgency: string
  // Added category field
  category?: string
  orders: {
    id: string
    quantity: number
    client: string
    delivery: string
    stage: string
  }[]
  isExpanded?: boolean
  currentInput?: number // New field for inline input
  mode?: 'all' | 'custom' // Mode selector
}

// Grouping structure: Category -> Items
interface CategoryGroup {
  name: string
  items: SummaryItem[]
  isExpanded: boolean
  id: string // simplified id for keys
}

const isLoading = ref(true)
const error = ref('')

// Modal State (kept for detail view or fallback)
const isRegisterModalOpen = ref(false)
const selectedItem = ref<SummaryItem | null>(null)

// Categories order definition
const CATEGORY_ORDER = [
  'cakes enteros',
  'cakes porcion',
  'pack de turrones',
  'panetton',
  'secos market',
  'individual',
  'panaderais'
]

onMounted(async () => {
  await fetchSummary()
})

const fetchSummary = async () => {
  try {
    isLoading.value = true
    const response = await ProductionService.getSummary()
    const data = response.dashboard || response

    // Helper to init items
    const processItems = (items: SummaryItem[]) => {
      return items.map(i => ({
        ...i,
        currentInput: undefined, // Start empty
        mode: 'custom' as const, // Default to custom
        // Use category provided by backend
        category: i.category || 'Otros'
      }))
    }

    todayItems.value = processItems(data.today || [])
    tomorrowItems.value = processItems(data.tomorrow || [])
    futureItems.value = processItems(data.future || [])

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

const toggleCategory = (categoryGroup: CategoryGroup) => {
  // Toggle presence in the collapsed set
  if (collapsedCategoryIds.value.has(categoryGroup.id)) {
    collapsedCategoryIds.value.delete(categoryGroup.id)
  } else {
    collapsedCategoryIds.value.add(categoryGroup.id)
  }
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('es-EC', {
    weekday: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

// Data Refs 
const todayItems = ref<SummaryItem[]>([])
const tomorrowItems = ref<SummaryItem[]>([])
const futureItems = ref<SummaryItem[]>([])

const hasItems = computed(() => {
  return todayItems.value.length > 0 || tomorrowItems.value.length > 0 || futureItems.value.length > 0
})

// Collapsed state tracking (using ID set)
const collapsedCategoryIds = ref<Set<string>>(new Set())

// Grouping Logic
const groupByCategory = (items: SummaryItem[], prefix: string): CategoryGroup[] => {
  const groups: Record<string, SummaryItem[]> = {}

  // Initialize with empty arrays to ensure order if we want to show empty sections (optional)
  // For now, let's only show what exists

  items.forEach(item => {
    const cat = item.category || 'Otros'
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(item)
  })

  // Map to array and sort based on predefined order
  return Object.keys(groups)
    .map(key => {
      const id = `${prefix}-${key.replace(/\s+/g, '-').toLowerCase()}`
      return {
        name: key,
        items: groups[key] || [],
        isExpanded: !collapsedCategoryIds.value.has(id),
        id: id
      }
    })
    .sort((a, b) => {
      const idxA = CATEGORY_ORDER.indexOf(a.name)
      const idxB = CATEGORY_ORDER.indexOf(b.name)
      // If not found in list, put at end
      const posA = idxA === -1 ? 999 : idxA
      const posB = idxB === -1 ? 999 : idxB
      return posA - posB
    })
}

const todayGroups = computed(() => groupByCategory(todayItems.value, 'today'))
const tomorrowGroups = computed(() => groupByCategory(tomorrowItems.value, 'tomorrow'))
const futureGroups = computed(() => groupByCategory(futureItems.value, 'future'))


const handleQuickRegister = async (item: SummaryItem) => {
  const qty = item.currentInput
  if (!qty || qty <= 0) {
    alert('Ingrese una cantidad válida') // Or use a toast
    return
  }

  if (qty > item.totalQuantity) {
    alert(`La cantidad no puede exceder ${item.totalQuantity}`)
    item.currentInput = item.totalQuantity
    return
  }

  try {
    isLoading.value = true // Optional: global loading or per-item loading state
    await ProductionService.registerProgress(item._id, qty)
    await fetchSummary()
    // item.currentInput = undefined // Reset handled by fetchSummary re-init
  } catch (err) {
    console.error(err)
    alert('Error al registrar progreso')
    isLoading.value = false
  }
}

const setMode = (item: SummaryItem, mode: 'all' | 'custom') => {
  item.mode = mode
  if (mode === 'all') {
    item.currentInput = item.totalQuantity
  } else {
    item.currentInput = undefined
  }
}

const validateInput = (item: SummaryItem) => {
  if (item.currentInput && item.currentInput > item.totalQuantity) {
    item.currentInput = item.totalQuantity
  }
  if (item.currentInput && item.currentInput < 0) {
    item.currentInput = undefined
  }
}

// Keep modal just in case, but primary flow is now inline
const openRegisterModal = (item: SummaryItem, event: Event) => {
  event.stopPropagation()
  selectedItem.value = item
  isRegisterModalOpen.value = true
}

const handleRegisterConfirm = async (quantity: number) => {
  // ... existing logic if modal is used
  if (!selectedItem.value) return
  isRegisterModalOpen.value = false
  try {
    await ProductionService.registerProgress(selectedItem.value._id, quantity)
    await fetchSummary()
  } catch (err) {
    alert('Error al registrar progreso')
  } finally {
    selectedItem.value = null
  }
}

// --- Transition Hooks for Smooth Accordion ---
const enter = (el: Element) => {
  const element = el as HTMLElement
  element.style.height = '0'
  element.style.opacity = '0'
  // Force reflow
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  element.offsetHeight

  element.style.transition = 'height 0.3s ease-out, opacity 0.3s ease-out'
  element.style.height = element.scrollHeight + 'px'
  element.style.opacity = '1'
}

const afterEnter = (el: Element) => {
  const element = el as HTMLElement
  element.style.height = 'auto'
}

const leave = (el: Element) => {
  const element = el as HTMLElement
  element.style.height = element.scrollHeight + 'px'
  element.style.opacity = '1'
  // Force reflow
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  element.offsetHeight

  element.style.transition = 'height 0.3s ease-in, opacity 0.3s ease-in'
  element.style.height = '0'
  element.style.opacity = '0'
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
      
      <!-- List Groups by Time -->
      <div v-for="(timeGroup, type) in { today: todayGroups, tomorrow: tomorrowGroups, future: futureGroups }" :key="type">
        
        <!-- Only show section if there are categories in it -->
        <section v-if="timeGroup.length > 0" class="list-section" :class="type">
            <div class="section-title" :class="type">
                <h2>
                    {{ type === 'today' ? 'Para Hoy / Urgente' : type === 'tomorrow' ? 'Para Mañana' : 'Futuro' }}
                </h2>
                <!-- Total count across all categories -->
                 <!-- Note: Logic update to count items inside categories -->
                <span class="count-badge">
                  {{timeGroup.reduce((acc, cat) => acc + cat.items.length, 0)}} items
                </span>
            </div>

            <div class="list-container">
                <!-- Category Accordions -->
                 <div v-for="category in timeGroup" :key="category.id" class="category-group">
                    
                    <div class="category-header" @click="toggleCategory(category)">
                       <div class="cat-title">
                          <i class="fas fa-folder-open" v-if="category.isExpanded"></i>
                          <i class="fas fa-folder" v-else></i>
                          {{ category.name }}
                       </div>
                       <div class="cat-meta">
                          <span class="cat-count">{{ category.items.length }} items</span>
                          <i class="fas fa-chevron-down" :class="{ rotated: category.isExpanded }"></i>
                       </div>
                    </div>

                    <Transition
                      name="accordion"
                      @enter="enter"
                      @after-enter="afterEnter"
                      @leave="leave"
                    >
                      <div v-show="category.isExpanded" class="category-items">
                           <div 
                              v-for="item in category.items" 
                              :key="item._id" 
                              class="list-row"
                              :class="{ expanded: item.isExpanded }"
                          >
                              <div class="row-main">
                                  <!-- Left: Info -->
                                  <div class="info-col" @click="toggleExpand(item)">
                                      <div class="urgency-tag" :class="type">
                                          <i class="far fa-clock"></i>
                                          {{ formatDate(item.urgency) }}
                                      </div>
                                      <h3 class="product-name">{{ item._id }}</h3>
                                      <button class="btn-expand-mobile" @click.stop="toggleExpand(item)">
                                          <i class="fas fa-chevron-down" :class="{ rotated: item.isExpanded }"></i>
                                      </button>
                                  </div>

                                  <!-- Center: Stats -->
                                  <div class="stats-col">
                                      <span class="qty-total">{{ item.totalQuantity }}</span>
                                      <span class="qty-label">PENDIENTES</span>
                                  </div>

                                  <!-- Right: Action -->
                                  <div class="action-col">
                                      <!-- Mode Toggles -->
                                      <div class="mode-toggles">
                                          <button 
                                              class="mode-btn" 
                                              :class="{ active: item.mode === 'all' }"
                                              @click.stop="setMode(item, 'all')"
                                          >
                                              TODO
                                          </button>
                                          <button 
                                              class="mode-btn" 
                                              :class="{ active: item.mode === 'custom' }"
                                              @click.stop="setMode(item, 'custom')"
                                          >
                                              MANUAL
                                          </button>
                                      </div>

                                      <!-- Input Area -->
                                      <div class="input-wrapper" v-if="item.mode === 'custom'">
                                          <input 
                                              type="number" 
                                              v-model="item.currentInput" 
                                              placeholder="#"
                                              min="1"
                                              :max="item.totalQuantity"
                                              class="qty-input"
                                              @click.stop
                                              @input="validateInput(item)"
                                          />
                                      </div>
                                      <!-- Static Label for 'All' mode -->
                                      <div class="all-mode-label" v-else>
                                          {{ item.totalQuantity }} Unid.
                                      </div>

                                      <div class="hold-btn-wrapper">
                                          <ActionHoldButton 
                                              label="Mantener" 
                                              :color="type === 'today' ? '#e74c3c' : '#2ecc71'"
                                              :disabled="!item.currentInput"
                                              @trigger="handleQuickRegister(item)"
                                          />
                                      </div>
                                  </div>
                              </div>

                              <!-- Details Drawer -->
                              <div v-if="item.isExpanded" class="row-details">
                                  <h4>Detalle de Pedidos</h4>
                                  <div class="orders-list">
                                      <div v-for="order in item.orders" :key="order.id" class="order-pill">
                                          <b>{{ order.client }}</b>
                                          <span>x{{ order.quantity }}</span>
                                      </div>
                                  </div>
                              </div>
                          </div>
                      </div>
                    </Transition>
                 </div>
            </div>
        </section>
        <hr v-if="timeGroup.length > 0" class="section-divider"/>
      </div>

      <div v-if="!hasItems" class="empty-state">
        <i class="fas fa-check-circle"></i>
        <p>¡No hay producción pendiente!</p>
        <span>Buen trabajo, el tablero está limpio.</span>
      </div>

    </div>

    <!-- Production Register Modal (Fallback/Legacy) -->
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
$font-stack: 'Inter', system-ui, -apple-system, sans-serif;
$color-urgent: #e74c3c;
$color-warning: #f39c12;
$color-info: #3498db;

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
  margin-bottom: 2rem;

  .header-content {
    h1 {
      font-size: 1.5rem;
      color: #2c3e50;
      margin: 0;
      font-weight: 800;
      letter-spacing: -0.5px;
    }

    p {
      color: #7f8c8d;
      margin: 0;
      font-size: 0.9rem;
    }
  }

  .btn-refresh {
    background: white;
    border: 1px solid #e0e0e0;
    padding: 0.5rem 1rem;
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
      transform: translateY(-1px);
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);

    }
  }
}

.section-title {
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;

  h2 {
    font-size: 1.25rem;
    font-weight: 800;
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .count-badge {
    background: #e0e0e0;
    padding: 2px 10px;
    border-radius: 12px;
    font-size: 0.8rem;
    font-weight: 700;
    color: #555;
  }

  &.today h2 {
    color: $color-urgent;
  }

  &.tomorrow h2 {
    color: #d35400;
  }

  &.future h2 {
    color: $color-info;
  }
}

/* Category Styles */
.category-group {
  margin-bottom: 1.5rem;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.02);
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.04);
}

.category-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  cursor: pointer;
  background: $NICOLE-PRIMARY;
  transition: background 0.2s;
  user-select: none;



  .cat-title {
    display: flex;
    align-items: center;
    gap: 0.8rem;
    font-weight: 700;
    font-size: 1.1rem;
    color: white;

    i {
      color: white;
      font-size: 1rem;
    }

  }

  .cat-meta {
    display: flex;
    align-items: center;
    gap: 1rem;

    .cat-count {
      font-size: 0.85rem;
      color: white;
      font-weight: 600;
    }

    i {
      color: white;
      transition: transform 0.3s ease;

      &.rotated {
        transform: rotate(180deg);
      }
    }
  }
}

.category-items {
  border-top: 1px solid #f1f2f6;
  padding: 0.5rem;
  background: #fcfcfc;
}


.list-container {
  display: flex;
  flex-direction: column;
}

.list-row {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
  border: 1px solid rgba(0, 0, 0, 0.04);
  overflow: hidden;
  transition: all 0.2s;
  margin-bottom: 0.8rem;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 15px rgba(0, 0, 0, 0.06);
  }

  .row-main {
    padding: 1rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap; // Responsive wrapping

    @media (min-width: 768px) {
      flex-wrap: nowrap;
    }
  }

  /* Column Styles */
  .info-col {
    flex: 1;
    min-width: 200px;
    cursor: pointer;

    .urgency-tag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.7rem;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
      margin-bottom: 6px;
      text-transform: uppercase;

      &.today {
        color: $color-urgent;
        background: rgba($color-urgent, 0.1);
      }

      &.tomorrow {
        color: #d35400;
        background: rgba(#d35400, 0.1);
      }

      &.future {
        color: $color-info;
        background: rgba($color-info, 0.1);
      }
    }

    .product-name {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 700;
      color: #2c3e50;
      line-height: 1.3;
    }

    .btn-expand-mobile {
      display: none; // Hidden on desktop
    }
  }

  .stats-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 80px;
    padding: 0 1rem;
    border-right: 1px solid #f1f2f6;
    border-left: 1px solid #f1f2f6;

    .qty-total {
      font-size: 1.5rem;
      font-weight: 900;
      color: #2c3e50;
      line-height: 1;
    }

    .qty-label {
      font-size: 0.6rem;
      color: #95a5a6;
      font-weight: 800;
      letter-spacing: 0.5px;
      margin-top: 4px;
    }
  }

  .action-col {
    display: flex;
    align-items: center;
    gap: 0.8rem;
    margin-left: auto; // Push to right

    .mode-toggles {
      display: flex;
      background: #f1f2f6;
      padding: 3px;
      border-radius: 8px;
      margin-right: 0.5rem;

      .mode-btn {
        border: none;
        background: transparent;
        padding: 6px 10px;
        font-size: 0.7rem;
        font-weight: 700;
        color: #95a5a6;
        cursor: pointer;
        border-radius: 6px;
        transition: all 0.2s;

        &.active {
          background: white;
          color: #2c3e50;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
      }
    }

    .input-wrapper {
      width: 80px;

      .qty-input {
        width: 100%;
        padding: 0.5rem;
        border: 2px solid #e0e0e0;
        border-radius: 8px;
        font-size: 1.2rem;
        font-weight: 800;
        text-align: center;
        transition: all 0.2s;
        color: #2c3e50;

        &:focus {
          outline: none;
          border-color: #3498db;
          box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
        }
      }
    }

    .all-mode-label {
      font-size: 1rem;
      font-weight: 800;
      color: #2c3e50;
      padding: 0 1rem;
      background: #e8f6f3;
      border-radius: 8px;
      padding: 0.5rem 1rem;
      color: #16a085;
    }

    .hold-btn-wrapper {
      width: 140px;
      // Ensures button has consistent width
    }
  }
}

.row-details {
  background: #fafbfc;
  padding: 1rem 1.5rem;
  border-top: 1px solid #f1f2f6;

  h4 {
    margin: 0 0 0.8rem 0;
    font-size: 0.75rem;
    text-transform: uppercase;
    color: #95a5a6;
    font-weight: 700;
    letter-spacing: 0.5px;
  }

  .orders-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;

    .order-pill {
      background: white;
      border: 1px solid #e0e0e0;
      padding: 6px 10px;
      border-radius: 8px;
      font-size: 0.85rem;
      color: #34495e;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);

      span {
        color: #7f8c8d;
        margin-left: 6px;
        font-weight: 600;
        background: #f5f6fa;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 0.75rem;
      }
    }
  }
}

.section-divider {
  border: 0;
  height: 1px;
  background: transparent;
  margin: 1rem 0;
}

.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  color: #bdc3c7;

  i {
    font-size: 4rem;
    margin-bottom: 1.5rem;
    color: #2ecc71;
    opacity: 0.8;
  }

  p {
    font-weight: 800;
    margin: 0;
    font-size: 1.2rem;
    color: #7f8c8d;
    margin-bottom: 0.5rem;
  }
}

.loading-state,
.error-msg {
  text-align: center;
  padding: 4rem 2rem;
  color: #95a5a6;
}

/* Loader Animation */
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

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

// Mobile Adjustments
@media (max-width: 768px) {
  .list-row {
    .row-main {
      flex-direction: column;
      align-items: stretch;
      gap: 1.5rem;
    }

    .info-col {
      display: flex;
      align-items: center;
      justify-content: space-between;

      .btn-expand-mobile {
        display: block; // Show only on mobile
        background: none;
        border: none;
        padding: 0.5rem;
        font-size: 1.2rem;
        color: #bdc3c7;

        i {
          transition: transform 0.3s;

          &.rotated {
            transform: rotate(180deg);
          }
        }
      }
    }

    .stats-col {
      flex-direction: row;
      justify-content: center;
      gap: 1rem;
      border: none;
      background: #f8f9fa;
      padding: 1rem;
      border-radius: 8px;

      .qty-total {
        font-size: 1.8rem;
      }
    }

    .action-col {
      flex-direction: column;
      width: 100%;
      gap: 1rem;

      .mode-toggles {
        width: 100%;
        justify-content: center;
        margin: 0;

        .mode-btn {
          flex: 1;
          text-align: center;
          padding: 10px;
        }
      }

      .input-wrapper {
        width: 100%;
      }

      .qty-input {
        padding: 0.8rem;
        font-size: 1.5rem;
      }

      .hold-btn-wrapper {
        width: 100%;
      }
    }
  }
}
</style>
