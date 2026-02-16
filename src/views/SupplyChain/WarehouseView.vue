<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import WarehouseService from '@/services/warehouse.service'
import RawMaterialService from '@/services/raw-material.service'
import ProviderService from '@/services/provider.service'
import { useToast } from '@/composables/useToast'
import ConfirmationModal from '@/components/ConfirmationModal.vue'
import WarehouseFilters from '@/components/SupplyChain/WarehouseFilters.vue'
import SearchableSelect from '@/components/ui/SearchableSelect.vue'

const { success, error: showError } = useToast()

// Data State
const materials = ref<any[]>([])
const providers = ref<any[]>([])
const movements = ref<any[]>([])
const isLoading = ref(false)
const isSubmitting = ref(false)
const activeTab = ref<'movements' | 'in' | 'out'>('movements')

// Filters State
const activeFilters = ref({
  type: '',
  materialId: '',
  startDate: '',
  endDate: ''
})

// Pagination
const currentPage = ref(1)
const totalPages = ref(1)

// Utils: Strictly America/Guayaquil (Ecuador)
const getEcuadorTime = () => {
  return new Intl.DateTimeFormat('es-EC', {
    timeZone: 'America/Guayaquil',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date())
}

const getEcuadorDate = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Guayaquil',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date())

  const y = parts.find(p => p.type === 'year')?.value
  const m = parts.find(p => p.type === 'month')?.value
  const d = parts.find(p => p.type === 'day')?.value

  return `${y}-${m}-${d}`
}

// Forms
const inForm = ref({
  date: getEcuadorDate(),
  time: getEcuadorTime(),
  rawMaterial: '',
  quantity: 0,
  provider: '',
  observation: ''
})

const outForm = ref({
  date: getEcuadorDate(),
  time: getEcuadorTime(),
  rawMaterial: '',
  quantity: 0,
  entity: '',
  observation: ''
})

// Modals State
const showInModal = ref(false)
const showOutModal = ref(false)
const isHolding = ref(false)
const holdProgress = ref(0)
let holdTimer: any = null
const HOLD_DURATION = 1200 // 1.2s

// Timer for auto-update
let dateTimeInterval: any = null

// Constants
const entities = [
  "Nicole Pastry Arts - San marino",
  "Nicole Pastry Arts - Mall del sol",
  "Finestra - CDP",
  "Delacrem - Mall del sol",
  "Casa mía - Mall del sol",
  "Sucreenda - CDP",
  "Sucree - Vivantino"
]

// Computed
const selectedInMaterial = computed(() => materials.value.find(m => m._id === inForm.value.rawMaterial))
const selectedOutMaterial = computed(() => materials.value.find(m => m._id === outForm.value.rawMaterial))

// Options for SearchableSelect components
const materialOptions = computed(() => {
  return materials.value.map(m => ({
    value: m._id,
    label: m.name,
    subtitle: `Stock: ${getDisplayQuantity(m.quantity, m.unit)} ${getDisplayUnit(m.unit)}`
  }))
})

const providerOptions = computed(() => {
  return providers.value.map(p => ({
    value: p._id,
    label: p.name
  }))
})

// Filtered providers based on selected material (for IN form)
const filteredProviderOptions = computed(() => {
  // Si hay un material seleccionado y tiene proveedor principal, priorizarlo
  if (selectedInMaterial.value?.provider) {
    const mainProviderId = typeof selectedInMaterial.value.provider === 'object'
      ? selectedInMaterial.value.provider._id
      : selectedInMaterial.value.provider

    // Encontrar el proveedor principal
    const mainProvider = providers.value.find(p => p._id === mainProviderId)

    if (mainProvider) {
      // Mostrar el proveedor principal primero, luego los demás
      const otherProviders = providers.value.filter(p => p._id !== mainProviderId)
      return [
        {
          value: mainProvider._id,
          label: `${mainProvider.name} ⭐ (Principal)`,
        },
        ...otherProviders.map(p => ({
          value: p._id,
          label: p.name
        }))
      ]
    }
  }

  // Si no hay material seleccionado o no tiene proveedor, mostrar todos
  return providerOptions.value
})

const entityOptions = computed(() => {
  return entities.map(e => ({
    value: e,
    label: e
  }))
})

// Methods
const getDisplayUnit = (unit: string) => {
  if (unit === 'g') return 'kg'
  if (unit === 'ml') return 'L'
  return unit
}

const getDisplayQuantity = (quantity: number, unit: string) => {
  if (unit === 'g' || unit === 'ml') return (quantity / 1000).toFixed(2)
  return quantity.toFixed(2)
}

const getMovementValue = (m: any) => {
  if (!m.rawMaterial || !m.rawMaterial.quantity || !m.rawMaterial.cost) return 0
  // Value = movement amount * unit cost
  // The cost in the DB is already the Unit Cost (e.g. 0.001836)
  const unitCost = m.rawMaterial.cost
  return m.quantity * unitCost
}

const totalInValue = computed(() => {
  return movements.value
    .filter(m => m.type === 'IN')
    .reduce((sum, m) => sum + getMovementValue(m), 0)
})

// Helper to convert form input (Kg/L) to backend storage (g/ml)
const toBackendQuantity = (inputQty: number, unit: string) => {
  if (unit === 'g' || unit === 'ml') return inputQty * 1000
  return inputQty
}

const fetchDependencies = async () => {
  try {
    const [materialsData, providersData] = await Promise.all([
      RawMaterialService.getRawMaterials(),
      ProviderService.getProviders()
    ])
    materials.value = materialsData
    providers.value = providersData
  } catch (err) {
    console.error(err)
    showError('Error loading dependencies')
  }
}

const fetchMovements = async () => {
  isLoading.value = true
  try {
    const data = await WarehouseService.getMovements({
      page: currentPage.value,
      ...activeFilters.value
    })
    movements.value = data.movements
    currentPage.value = data.page
    totalPages.value = data.pages
  } catch (err) {
    console.error(err)
    showError('Error loading movements')
  } finally {
    isLoading.value = false
  }
}

const handleFilterChange = (newFilters: any) => {
  activeFilters.value = newFilters
  currentPage.value = 1 // Reset to first page
  fetchMovements()
}

// --- Auto Update Date/Time ---
const updateDateTime = () => {
  const date = getEcuadorDate()
  const time = getEcuadorTime()

  // Only update if not currently submitting to avoid weird jumps (though it shouldn't matter for readonly)
  if (!isSubmitting.value) {
    inForm.value.date = date
    inForm.value.time = time
    outForm.value.date = date
    outForm.value.time = time
  }
}

// --- IN Logic ---
const handleInSubmit = () => {
  if (!inForm.value.rawMaterial || inForm.value.quantity <= 0) return
  showInModal.value = true
}

const confirmIn = async () => {
  isSubmitting.value = true
  showInModal.value = false

  // Get User from LocalStorage (since we don't have a Pinia store yet)
  const userStr = localStorage.getItem('user_info')
  const user = userStr ? JSON.parse(userStr) : null

  if (!user || !user._id) {
    showError('Error de sesión: No se encontró usuario. Recargue la página.')
    isSubmitting.value = false
    return
  }

  // Combine Date and Time as local Ecuador time
  // We create a string "YYYY-MM-DDTHH:mm:00-05:00" to ensure backend parses as ECU
  const combinedDate = `${inForm.value.date}T${inForm.value.time}:00-05:00`

  // Convert quantity to backend units
  const backendQty = selectedInMaterial.value
    ? toBackendQuantity(inForm.value.quantity, selectedInMaterial.value.unit)
    : inForm.value.quantity

  try {
    await WarehouseService.createMovement({
      type: 'IN',
      ...inForm.value,
      quantity: backendQty, // Send converted quantity
      date: combinedDate,
      user: user._id // Send user ID explicitly
    })

    const unit = selectedInMaterial.value ? getDisplayUnit(selectedInMaterial.value.unit) : ''
    success(`<i class="fa-solid fa-clipboard-check"></i> Recepción registrada: <strong>${inForm.value.quantity} ${unit}</strong> de ${selectedInMaterial.value?.name}`)
    // Reset but keep date/time current
    resetForms()
    updateDateTime()

    // Delay tab change for celebration
    setTimeout(() => {
      activeTab.value = 'movements'
    }, 500)
  } catch (err: any) {
    // Check if it's an authentication error
    if (err.status === 401 || err.response?.status === 401) {
      showError('⚠️ Sesión expirada o token inválido. Por favor, cierre sesión y vuelva a iniciar sesión para continuar.')
    } else {
      showError(err.response?.data?.message || err.message || 'Error al registrar recepción')
    }
  } finally {
    isSubmitting.value = false
  }
}

// --- OUT Logic ---
const handleOutSubmit = () => {
  if (!outForm.value.rawMaterial || outForm.value.quantity <= 0 || !outForm.value.entity) return

  // Validation: Convert input to backend unit to compare with stock
  if (selectedOutMaterial.value) {
    const requestQtyBackend = toBackendQuantity(outForm.value.quantity, selectedOutMaterial.value.unit)
    if (selectedOutMaterial.value.quantity < requestQtyBackend) {
      const stockDisplay = getDisplayQuantity(selectedOutMaterial.value.quantity, selectedOutMaterial.value.unit)
      const unitDisplay = getDisplayUnit(selectedOutMaterial.value.unit)
      showError(`Error: El stock actual (${stockDisplay} ${unitDisplay}) es menor a la cantidad a despachar.`)
      return
    }
  }

  showOutModal.value = true
}

// --- Hold Button Logic ---
const startHold = () => {
  if (isSubmitting.value) return
  isHolding.value = true
  holdProgress.value = 0

  const step = 100 / (HOLD_DURATION / 50) // Update every 50ms

  holdTimer = setInterval(() => {
    holdProgress.value += step
    if (holdProgress.value >= 100) {
      clearInterval(holdTimer)
      confirmOut()
    }
  }, 50)
}

const cancelHold = () => {
  if (holdProgress.value < 100) {
    isHolding.value = false
    holdProgress.value = 0
    clearInterval(holdTimer)
  }
}

const confirmOut = async () => {
  isSubmitting.value = true
  showOutModal.value = false

  // Get User
  const userStr = localStorage.getItem('user_info')
  const user = userStr ? JSON.parse(userStr) : null

  if (!user || !user._id) {
    showError('Error de sesión: No se encontró usuario. Recargue la página.')
    isSubmitting.value = false
    isHolding.value = false
    holdProgress.value = 0
    return
  }

  // Combine Date and Time as local Ecuador time
  const combinedDate = `${outForm.value.date}T${outForm.value.time}:00-05:00`

  // Convert quantity
  const backendQty = selectedOutMaterial.value
    ? toBackendQuantity(outForm.value.quantity, selectedOutMaterial.value.unit)
    : outForm.value.quantity

  try {
    await WarehouseService.createMovement({
      type: 'OUT',
      ...outForm.value,
      quantity: backendQty, // Send converted
      date: combinedDate,
      user: user._id // Send user ID explicitly
    })

    const unit = selectedOutMaterial.value ? getDisplayUnit(selectedOutMaterial.value.unit) : ''
    success(`<i class="fa-solid fa-truck-moving"></i> Despacho registrado: <strong>${outForm.value.quantity} ${unit}</strong> de ${selectedOutMaterial.value?.name}`)
    // Update local material quantity immediately
    if (selectedOutMaterial.value) {
      selectedOutMaterial.value.quantity -= backendQty
    }
    resetForms()
    updateDateTime()

    // Delay tab change for celebration
    setTimeout(() => {
      activeTab.value = 'movements'
    }, 500)
  } catch (err: any) {
    // Check if it's an authentication error
    if (err.status === 401 || err.response?.status === 401) {
      showError('⚠️ Sesión expirada o token inválido. Por favor, cierre sesión y vuelva a iniciar sesión para continuar.')
    } else {
      showError(err.response?.data?.message || err.message || 'Error al registrar despacho')
    }
  } finally {
    isSubmitting.value = false
    isHolding.value = false
    holdProgress.value = 0
  }
}

const resetForms = () => {
  inForm.value = {
    date: getEcuadorDate(),
    time: getEcuadorTime(),
    rawMaterial: '',
    quantity: 0,
    provider: '',
    observation: ''
  }
  outForm.value = {
    date: getEcuadorDate(),
    time: getEcuadorTime(),
    rawMaterial: '',
    quantity: 0,
    entity: '',
    observation: ''
  }
}

const formatDate = (date: string) => {
  if (!date) return '-'
  return new Intl.DateTimeFormat('es-EC', {
    timeZone: 'America/Guayaquil',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(date))
}

// Auto-select provider when material changes
watch(() => inForm.value.rawMaterial, (newMaterialId) => {
  if (newMaterialId) {
    const material = materials.value.find(m => m._id === newMaterialId)
    if (material?.provider) {
      // Auto-seleccionar el proveedor principal
      const providerId = typeof material.provider === 'object'
        ? material.provider._id
        : material.provider
      inForm.value.provider = providerId
    }
  } else {
    // Si se deselecciona el material, limpiar el proveedor
    inForm.value.provider = ''
  }
})

watch(activeTab, (newTab) => {
  if (newTab === 'movements') {
    fetchMovements()
  }
})

onMounted(() => {
  fetchDependencies()
  fetchMovements()
  // Start timer
  updateDateTime()
  dateTimeInterval = setInterval(updateDateTime, 1000)
})

onUnmounted(() => {
  if (dateTimeInterval) clearInterval(dateTimeInterval)
  if (holdTimer) clearInterval(holdTimer)
})
</script>

<template>
  <div class="warehouse-view">
    <div class="header">
      <div class="title">
        <h1>Bodega</h1>
        <p>Control de Inventario (Entradas y Salidas)</p>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs">
      <button 
        :class="{ active: activeTab === 'movements' }" 
        @click="activeTab = 'movements'"
      >
        <i class="fas fa-history"></i> Historial
      </button>
      <button 
        :class="{ active: activeTab === 'in' }" 
        @click="activeTab = 'in'"
      >
        <i class="fas fa-box-open"></i> Recepción (Entrada)
      </button>
      <button 
        :class="{ active: activeTab === 'out' }" 
        @click="activeTab = 'out'"
      >
        <i class="fas fa-truck-loading"></i> Despacho (Salida)
      </button>
    </div>

    <div class="content-area">
      <!-- HISTORIAL -->
      <div v-if="activeTab === 'movements'" class="movements-tab">
        <WarehouseFilters 
          :materials="materials"
          @filter="handleFilterChange"
        />

        <div v-if="isLoading" class="loading-container">
          <div class="spinner"></div>
          <p>Cargando movimientos...</p>
        </div>
        <div v-else class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Materia Prima</th>
                <th class="text-right">Cantidad</th>
                <th class="text-right">Valor ($)</th>
                <th>Origen / Destino</th>
                <th>Usuario</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="movements.length === 0">
                <td colspan="6" class="text-center">No hay movimientos registrados.</td>
              </tr>
              <tr v-for="m in movements" :key="m._id">
                <td>{{ formatDate(m.date || m.createdAt) }}</td>
                <td>
                  <span class="badge" :class="m.type === 'IN' ? 'badge-in' : 'badge-out'">
                    {{ m.type === 'IN' ? 'ENTRADA' : 'SALIDA' }}
                  </span>
                </td>
                <td>{{ m.rawMaterial?.name || 'Desconocido' }}</td>
                <td class="text-right fw-600">
                  {{ getDisplayQuantity(m.quantity, m.rawMaterial?.unit) }} <span class="unit-text">{{ getDisplayUnit(m.rawMaterial?.unit) }}</span>
                </td>
                <td class="text-right money-cell" :class="{ 'in-value': m.type === 'IN' }">
                  <span v-if="m.type === 'IN'">+ ${{ getMovementValue(m).toFixed(2) }}</span>
                  <span v-else class="text-muted">- ${{ getMovementValue(m).toFixed(2) }}</span>
                </td>
                <td>
                  <span v-if="m.type === 'IN'">{{ m.provider?.name || '-' }}</span>
                  <span v-else>{{ m.entity || '-' }}</span>
                </td>
                <td>{{ m.user?.name || 'Sistema' }}</td>
              </tr>
            </tbody>
            <tfoot v-if="movements.length > 0">
              <tr class="summary-row">
                <td colspan="4" class="text-right">Total Valor que Entró (Recepciones):</td>
                <td class="text-right total-value">${{ totalInValue.toFixed(2) }}</td>
                <td colspan="2"></td>
              </tr>
            </tfoot>
          </table>
          
          <!-- Simple Pagination -->
          <div class="pagination" v-if="totalPages > 1">
             <button :disabled="currentPage === 1" @click="currentPage--; fetchMovements()">Anterior</button>
             <span>Página {{ currentPage }} de {{ totalPages }}</span>
             <button :disabled="currentPage === totalPages" @click="currentPage++; fetchMovements()">Siguiente</button>
          </div>
        </div>
      </div>

      <!-- RECEPCION (IN) -->
      <div v-if="activeTab === 'in'" class="form-tab in-tab">
        <div class="form-card">
          <h2>Registrar Recepción</h2>
          <div class="form-row">
            <div class="form-group half">
              <label>Fecha</label>
              <div class="readonly-display">
                <i class="fas fa-calendar-day"></i>
                <span>{{ inForm.date }}</span>
              </div>
            </div>
            <div class="form-group half">
              <label>Hora</label>
              <div class="readonly-display">
                <i class="fas fa-clock"></i>
                <span>{{ inForm.time }}</span>
              </div>
            </div>
          </div>
          <div class="form-group">
            <label>Materia Prima</label>
            <SearchableSelect
              v-model="inForm.rawMaterial"
              :options="materialOptions"
              placeholder="Buscar materia prima..."
            />
          </div>
          <div class="form-group">
            <label>Cantidad ({{ selectedInMaterial ? getDisplayUnit(selectedInMaterial.unit) : 'Unidad' }})</label>
            <input type="number" v-model.number="inForm.quantity" min="0" step="0.01" />
          </div>
          <div class="form-group">
            <label>Proveedor (Opcional)</label>
            <SearchableSelect
              v-model="inForm.provider"
              :options="filteredProviderOptions"
              placeholder="Buscar proveedor..."
            />
          </div>
          <div class="form-group">
            <label>Observación</label>
            <textarea v-model="inForm.observation" rows="2"></textarea>
          </div>
          <div class="actions">
             <button class="btn-primary" @click="handleInSubmit" :disabled="isSubmitting || !inForm.rawMaterial || inForm.quantity <= 0">
               {{ isSubmitting ? 'Guardando...' : 'Registrar Entrada' }}
             </button>
          </div>
        </div>
      </div>

      <!-- DESPACHO (OUT) -->
      <div v-if="activeTab === 'out'" class="form-tab out-tab">
        <div class="form-card">
          <h2>Registrar Despacho</h2>
          <div class="form-row">
            <div class="form-group half">
              <label>Fecha</label>
              <div class="readonly-display">
                <i class="fas fa-calendar-day"></i>
                <span>{{ outForm.date }}</span>
              </div>
            </div>
            <div class="form-group half">
              <label>Hora</label>
               <div class="readonly-display">
                <i class="fas fa-clock"></i>
                <span>{{ outForm.time }}</span>
              </div>
            </div>
          </div>
          <div class="form-group">
            <label>Materia Prima</label>
            <SearchableSelect
              v-model="outForm.rawMaterial"
              :options="materialOptions"
              placeholder="Buscar materia prima..."
            />
          </div>
          <div class="form-group">
            <label>Cantidad ({{ selectedOutMaterial ? getDisplayUnit(selectedOutMaterial.unit) : 'Unidad' }})</label>
            <input type="number" v-model.number="outForm.quantity" min="0" step="0.01" />
            <span v-if="selectedOutMaterial && selectedOutMaterial.quantity < toBackendQuantity(outForm.quantity, selectedOutMaterial.unit)" class="error-text">
               Excede el stock actual ({{ getDisplayQuantity(selectedOutMaterial.quantity, selectedOutMaterial.unit) }} {{ getDisplayUnit(selectedOutMaterial.unit) }})
            </span>
          </div>
          <div class="form-group">
            <label>Destino (Entidad)</label>
            <SearchableSelect
              v-model="outForm.entity"
              :options="entityOptions"
              placeholder="Buscar destino..."
            />
          </div>
          <div class="form-group">
            <label>Observación</label>
            <textarea v-model="outForm.observation" rows="2"></textarea>
          </div>
          <div class="actions">
             <button class="btn-primary" @click="handleOutSubmit" :disabled="isSubmitting || !outForm.rawMaterial || outForm.quantity <= 0 || !outForm.entity">
               {{ isSubmitting ? 'Guardando...' : 'Registrar Salida' }}
             </button>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Modals -->
    <ConfirmationModal
      :isOpen="showInModal"
      title="Confirmar Recepción"
      message=""
      confirmText="Sí, registrar entrada"
      @close="showInModal = false"
      @confirm="confirmIn"
    >
      <template #default> 
         <p>Se registrará una <strong>ENTRADA</strong> de:</p>
         <ul class="modal-list">
           <li><strong>Materia Prima:</strong> {{ selectedInMaterial?.name }}</li>
           <li><strong>Cantidad:</strong> {{ inForm.quantity }} {{ selectedInMaterial ? getDisplayUnit(selectedInMaterial.unit) : '' }}</li>
           <li><strong>Proveedor:</strong> {{providers.find(p => p._id === inForm.provider)?.name || 'N/A'}}</li>
         </ul>
      </template>
    </ConfirmationModal>

    <!-- Custom Modal for Out (Touch/Hold) -->
    <div v-if="showOutModal" class="modal-overlay">
      <div class="modal-content">
        <h3>Confirmar Despacho</h3>
        <p>Estás a punto de registrar una <strong>SALIDA</strong> de:</p>
         <ul class="modal-list">
           <li><strong>Materia Prima:</strong> {{ selectedOutMaterial?.name }}</li>
           <li><strong>Cantidad:</strong> {{ outForm.quantity }} {{ selectedOutMaterial ? getDisplayUnit(selectedOutMaterial.unit) : '' }}</li>
           <li><strong>Destino:</strong> {{ outForm.entity }}</li>
         </ul>
        
        <div class="hold-button-container">
          <button 
            class="hold-btn" 
            @mousedown="startHold" 
            @mouseleave="cancelHold" 
            @mouseup="cancelHold"
            @touchstart.prevent="startHold"
            @touchend.prevent="cancelHold"
          >
            <span class="btn-text">Mantén para confirmar</span>
            <div class="progress-bar" :style="{ width: holdProgress + '%' }"></div>
          </button>
          <button class="btn-cancel" @click="showOutModal = false">Cancelar</button>
        </div>
      </div>
    </div>

  </div>
</template>

<style lang="scss" scoped>
.warehouse-view {
  padding: 2rem;
  max-width: 1000px;
  margin: 0 auto;
}

.header {
  margin-bottom: 2rem;

  h1 {
    color: $NICOLE-PURPLE;
    margin: 0;
  }

  p {
    color: $text-light;
    margin: 0.5rem 0 0;
  }
}

/* TABS */
.tabs {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  border-bottom: 1px solid $border-light;
  padding-bottom: 1px;
}

.tabs button {
  background: none;
  border: none;
  padding: 0.8rem 1.5rem;
  font-size: 1rem;
  color: $text-light;
  cursor: pointer;
  border-bottom: 3px solid transparent;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
  transition: all 0.2s;

  &:hover {
    color: $NICOLE-PURPLE;
  }

  &.active {
    color: $NICOLE-PURPLE;
    border-bottom-color: $NICOLE-PURPLE;
  }
}

/* CONTENT */
.content-area {
  min-height: 400px;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  color: $text-light;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba($NICOLE-PURPLE, 0.2);
  border-top-color: $NICOLE-PURPLE;
  border-radius: 50%;
  animation: spin 1s infinite linear;
  margin-bottom: 1rem;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* TABLE */
.table-responsive {
  overflow-x: auto;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  border: 1px solid $border-light;
}

.table {
  width: 100%;
  border-collapse: collapse;

  th,
  td {
    padding: 1rem;
    text-align: left;
    border-bottom: 1px solid $border-light;
  }

  th {
    background: $gray-50;
    font-weight: 600;
    color: $text-light;
    font-size: 0.9rem;
  }

  tr:last-child td {
    border-bottom: none;
  }
}

.badge {
  padding: 0.25rem 0.6rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 700;
}

.badge-in {
  background: #e6fffa;
  color: #047857;
}

.badge-out {
  background: #fff5f5;
  color: #c53030;
}

.text-center {
  text-align: center;
}

.pagination {
  padding: 1rem;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;

  button {
    padding: 0.5rem 1rem;
    cursor: pointer;
    background: white;
    border: 1px solid $border-light;
    border-radius: 6px;

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
}

/* FORMS */
.form-tab {
  display: flex;
  justify-content: center;
}

.form-card {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  width: 100%;
  max-width: 600px;
  border: 1px solid $border-light;

  h2 {
    margin-top: 0;
    color: $NICOLE-PURPLE;
    margin-bottom: 1.5rem;
  }
}

.form-row {
  display: flex;
  gap: 1rem;
}

.form-group {
  margin-bottom: 1.2rem;

  &.half {
    width: 50%;
  }

  label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
  }

  input,
  select,
  textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid $border-light;
    border-radius: 6px;
    font-size: 1rem;

    &:focus {
      outline: none;
      border-color: $NICOLE-PURPLE;
      box-shadow: 0 0 0 2px rgba($NICOLE-PURPLE, 0.1);
    }
  }
}

.readonly-display {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background-color: $gray-50;
  border: 1px solid $border-light;
  border-radius: 6px;
  padding: 0.75rem;
  color: $text-dark;
  font-weight: 500;

  i {
    color: $NICOLE-PURPLE;
    opacity: 0.7;
  }
}

.error-text {
  color: $error;
  font-size: 0.85rem;
  margin-top: 0.25rem;
  display: block;
}

.actions {
  margin-top: 2rem;
  display: flex;
  justify-content: flex-end;
}

.btn-primary {
  background: $NICOLE-PURPLE;
  color: white;
  border: none;
  padding: 0.8rem 1.5rem;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;

  &:hover {
    background: $purple-dark;
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
}

/* Modal List */
.modal-list {
  list-style: none;
  padding: 0;
  background: $gray-50;
  border-radius: 8px;
  padding: 1rem;
  margin: 1rem 0;

  li {
    margin-bottom: 0.5rem;
    font-size: 0.95rem;

    &:last-child {
      margin-bottom: 0;
    }
  }
}

/* Custom Modal Logic for Hold Button */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
}

.modal-content {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  width: 90%;
  max-width: 450px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  text-align: center;

  h3 {
    margin-top: 0;
    color: $NICOLE-PURPLE;
  }
}

.hold-button-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 2rem;
}

.hold-btn {
  position: relative;
  background: $error;
  color: white;
  border: none;
  padding: 1rem;
  border-radius: 8px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  overflow: hidden;
  user-select: none;

  .btn-text {
    position: relative;
    z-index: 2;
  }

  .progress-bar {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    background: rgba(0, 0, 0, 0.2);
    z-index: 1;
    transition: width 0.05s linear;
  }

  &:active {
    transform: scale(0.98);
  }
}

.btn-cancel {
  background: transparent;
  border: 1px solid $border-light;
  padding: 0.8rem;
  border-radius: 8px;
  cursor: pointer;
  color: $text-light;
  font-weight: 500;

  &:hover {
    background: $gray-50;
    color: $text-dark;
  }
}

.text-right {
  text-align: right !important;
}

.fw-600 {
  font-weight: 600;
}

.unit-text {
  font-size: 0.8rem;
  color: $text-light;
  margin-left: 2px;
  text-transform: lowercase;
}

.money-cell {
  font-weight: 500;
  font-size: 0.95rem;

  &.in-value {
    color: #047857;
    font-weight: 700;
  }
}

.summary-row {
  background-color: $gray-50;

  td {
    padding: 1.25rem 1.5rem !important;
    font-weight: 700;
    color: $text-dark;
    border-top: 2px solid $border-light;
  }

  .total-value {
    color: #047857;
    font-size: 1.15rem;
    border-top: 2px solid $NICOLE-PURPLE;
  }
}
</style>
