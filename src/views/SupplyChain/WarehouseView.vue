<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import WarehouseService from '@/services/warehouse.service'
import RawMaterialService from '@/services/raw-material.service'
import ProviderService from '@/services/provider.service'
import SupplierOrderService from '@/services/supplier-order.service'
import { useToast } from '@/composables/useToast'
import ConfirmationModal from '@/components/ConfirmationModal.vue'
import WarehouseFilters from '@/components/SupplyChain/WarehouseFilters.vue'
import SearchableSelect from '@/components/ui/SearchableSelect.vue'

const { success, error: showError } = useToast()

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

const getEcuadorMonthStart = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Guayaquil',
    year: 'numeric',
    month: '2-digit'
  }).formatToParts(new Date())

  const y = parts.find(p => p.type === 'year')?.value
  const m = parts.find(p => p.type === 'month')?.value

  return `${y}-${m}-01`
}

// Data State
const materials = ref<any[]>([])
const providers = ref<any[]>([])
const movements = ref<any[]>([])
const suggestedOrders = ref<any[]>([])
const isLoading = ref(false)
const isLoadingSuggestions = ref(false)
const isSubmitting = ref(false)
const activeTab = ref<'movements' | 'in' | 'out' | 'loss'>('movements')

// Filters State
const activeFilters = ref({
  type: '',
  materialId: '',
  startDate: getEcuadorMonthStart(),
  endDate: getEcuadorDate()
})

// Pagination
const currentPage = ref(1)
const totalPages = ref(1)

// Forms
const inForm = ref({
  date: getEcuadorDate(),
  time: getEcuadorTime(),
  rawMaterial: '',
  quantity: 0,
  unitCost: 0,   // cost in display units (USD/kg or USD/L), editable by user
  provider: '',
  responsible: 'Danny', // Default suggested for Recepción
  observation: '',
  suggestedOrderId: '' // To track if this intake comes from a suggestion
})

const outForm = ref({
  date: getEcuadorDate(),
  time: getEcuadorTime(),
  rawMaterial: '',
  quantity: 0,
  responsible: '',
  entity: '',
  observation: '',
  expectedSaleValue: 0
})

const lossForm = ref({
  date: getEcuadorDate(),
  time: getEcuadorTime(),
  rawMaterial: '',
  quantity: 0,
  responsible: 'Danny', // Suggested default
  observation: '',
  reason: 'CADUCIDAD' // Default reason
})

// Modals State
const showInModal = ref(false)
const showOutModal = ref(false)
const showLossModal = ref(false)
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
const selectedLossMaterial = computed(() => materials.value.find(m => m._id === lossForm.value.rawMaterial))

// Real-time value calculator for IN form (uses editable unitCost in display units)
const inTotalValue = computed(() => {
  if (!selectedInMaterial.value || !inForm.value.quantity || inForm.value.quantity <= 0) return 0
  return inForm.value.quantity * (inForm.value.unitCost || 0)
})

// Real-time value calculator for OUT form
const outTotalValue = computed(() => {
  if (!selectedOutMaterial.value || !outForm.value.quantity || outForm.value.quantity <= 0) return 0
  const displayCost = getDisplayCost(selectedOutMaterial.value.cost || 0, selectedOutMaterial.value.unit)
  return outForm.value.quantity * displayCost
})

// Rentability alert: cost >= expected sale revenue
const showRentabilityAlert = computed(() => {
  if (!outForm.value.expectedSaleValue || outForm.value.expectedSaleValue <= 0) return false
  return outTotalValue.value >= outForm.value.expectedSaleValue
})

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

// Convert backend cost (per g/ml/unit) to display cost (per kg/L/unit)
const getDisplayCost = (cost: number, unit: string): number => {
  if (unit === 'g' || unit === 'ml') return cost * 1000
  return cost
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

const fetchTodaySuggestions = async () => {
  if (isLoadingSuggestions.value) return
  isLoadingSuggestions.value = true
  try {
    const today = getEcuadorDate()
    const response = await SupplierOrderService.getOrders({
      startDate: today,
      endDate: today,
      status: 'SENT', // Only suggested orders already sent to providers
      limit: 10
    })
    suggestedOrders.value = response.orders
  } catch (err: any) {
    console.error('Error fetching suggestions:', err)
  } finally {
    isLoadingSuggestions.value = false
  }
}

const applySuggestion = (order: any, item: any) => {
  inForm.value = {
    ...inForm.value,
    rawMaterial: item.material._id || item.material,
    quantity: item.quantity,
    provider: order.provider?._id || order.provider,
    observation: `[PEDIDO SUGERIDO] ${order.whatsappMessage ? 'Basado en orden #' + order._id.slice(-4) : ''}`,
    suggestedOrderId: order._id
  }

  // Also try to find the material to set the cost if it has it in catalogue
  const mat = materials.value.find((m: any) => (m._id === (item.material._id || item.material)))
  if (mat) {
    inForm.value.unitCost = getDisplayCost(mat.cost || 0, mat.unit)
  }

  success(`Formulario autocompletado con: ${item.name}`)
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
    lossForm.value.date = date
    lossForm.value.time = time
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
  const combinedDate = `${inForm.value.date}T${inForm.value.time}:00-05:00`

  // Convert quantity to backend units
  const backendQty = selectedInMaterial.value
    ? toBackendQuantity(inForm.value.quantity, selectedInMaterial.value.unit)
    : inForm.value.quantity

  // Convert unitCost back to backend units (per g/ml/unit) for storage
  const unit = selectedInMaterial.value?.unit ?? ''
  const backendUnitCost = (unit === 'g' || unit === 'ml')
    ? inForm.value.unitCost / 1000
    : inForm.value.unitCost

  try {
    await WarehouseService.createMovement({
      type: 'IN',
      ...inForm.value,
      quantity: backendQty,       // backend units (g / ml / u)
      unitCost: backendUnitCost,  // backend units (USD/g or USD/ml) — for audit trail
      totalValue: inTotalValue.value, // pre-computed total in USD
      date: combinedDate,
      user: user._id
    })

    const displayUnit = selectedInMaterial.value ? getDisplayUnit(selectedInMaterial.value.unit) : ''
    success(`<i class="fa-solid fa-clipboard-check"></i> Recepción registrada: <strong>${inForm.value.quantity} ${displayUnit}</strong> de ${selectedInMaterial.value?.name}`)

    // Optional: Mark suggested order as RECEIVED
    if (inForm.value.suggestedOrderId) {
      try {
        await SupplierOrderService.updateOrder(inForm.value.suggestedOrderId, { status: 'RECEIVED' })
        fetchTodaySuggestions() // Refresh suggestions
      } catch (e) {
        console.error('Error updating order status:', e)
      }
    }

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

const confirmOut = async () => {
  isSubmitting.value = true
  showOutModal.value = false

  const userStr = localStorage.getItem('user_info')
  const user = userStr ? JSON.parse(userStr) : null

  if (!user || !user._id) {
    showError('Error de sesión: No se encontró usuario.')
    isSubmitting.value = false
    isHolding.value = false
    holdProgress.value = 0
    return
  }

  const combinedDate = `${outForm.value.date}T${outForm.value.time}:00-05:00`

  const backendQty = selectedOutMaterial.value
    ? toBackendQuantity(outForm.value.quantity, selectedOutMaterial.value.unit)
    : outForm.value.quantity

  const outUnit = selectedOutMaterial.value?.unit ?? ''
  const outBackendUnitCost = selectedOutMaterial.value
    ? ((outUnit === 'g' || outUnit === 'ml')
      ? getDisplayCost(selectedOutMaterial.value.cost || 0, outUnit) / 1000
      : (selectedOutMaterial.value.cost || 0))
    : 0

  try {
    await WarehouseService.createMovement({
      type: 'OUT',
      ...outForm.value,
      quantity: backendQty,
      unitCost: outBackendUnitCost,
      totalValue: outTotalValue.value,
      date: combinedDate,
      user: user._id
    })

    const unit = selectedOutMaterial.value ? getDisplayUnit(selectedOutMaterial.value.unit) : ''
    success(`<i class="fa-solid fa-truck-moving"></i> Despacho registrado: <strong>${outForm.value.quantity} ${unit}</strong> de ${selectedOutMaterial.value?.name}`)

    if (selectedOutMaterial.value) {
      selectedOutMaterial.value.quantity -= backendQty
    }
    resetForms()
    updateDateTime()

    setTimeout(() => {
      activeTab.value = 'movements'
    }, 500)
  } catch (err: any) {
    showError(err.response?.data?.message || err.message || 'Error al registrar despacho')
  } finally {
    isSubmitting.value = false
    isHolding.value = false
    holdProgress.value = 0
  }
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

// --- LOSS Logic ---
const handleLossSubmit = () => {
  if (!lossForm.value.rawMaterial || lossForm.value.quantity <= 0) return

  if (selectedLossMaterial.value) {
    const requestQtyBackend = toBackendQuantity(lossForm.value.quantity, selectedLossMaterial.value.unit)
    if (selectedLossMaterial.value.quantity < requestQtyBackend) {
      const stockDisplay = getDisplayQuantity(selectedLossMaterial.value.quantity, selectedLossMaterial.value.unit)
      const unitDisplay = getDisplayUnit(selectedLossMaterial.value.unit)
      showError(`Error: El stock actual (${stockDisplay} ${unitDisplay}) es insuficiente para registrar esta baja.`)
      return
    }
  }

  showLossModal.value = true
}

const confirmLoss = async () => {
  isSubmitting.value = true
  showLossModal.value = false

  const userStr = localStorage.getItem('user_info')
  const user = userStr ? JSON.parse(userStr) : null

  if (!user || !user._id) {
    showError('Error de sesión: No se encontró usuario.')
    isSubmitting.value = false
    return
  }

  const combinedDate = `${lossForm.value.date}T${lossForm.value.time}:00-05:00`

  const backendQty = selectedLossMaterial.value
    ? toBackendQuantity(lossForm.value.quantity, selectedLossMaterial.value.unit)
    : lossForm.value.quantity

  // For LOSS, we use catalog cost as loss value
  const outUnit = selectedLossMaterial.value?.unit ?? ''
  const lossBackendUnitCost = selectedLossMaterial.value
    ? ((outUnit === 'g' || outUnit === 'ml')
      ? getDisplayCost(selectedLossMaterial.value.cost || 0, outUnit) / 1000
      : (selectedLossMaterial.value.cost || 0))
    : 0

  const lossTotalValue = lossForm.value.quantity * getDisplayCost(selectedLossMaterial.value?.cost || 0, selectedLossMaterial.value?.unit || '')

  try {
    await WarehouseService.createMovement({
      type: 'LOSS',
      ...lossForm.value,
      quantity: backendQty,
      unitCost: lossBackendUnitCost,
      totalValue: lossTotalValue,
      date: combinedDate,
      user: user._id,
      observation: `[${lossForm.value.reason}] ${lossForm.value.observation}`
    })

    const unit = selectedLossMaterial.value ? getDisplayUnit(selectedLossMaterial.value.unit) : ''
    success(`<i class="fa-solid fa-trash-can"></i> Baja registrada: <strong>${lossForm.value.quantity} ${unit}</strong> de ${selectedLossMaterial.value?.name}`)

    if (selectedLossMaterial.value) {
      selectedLossMaterial.value.quantity -= backendQty
    }
    resetForms()
    updateDateTime()

    setTimeout(() => {
      activeTab.value = 'movements'
    }, 500)
  } catch (err: any) {
    showError(err.response?.data?.message || err.message || 'Error al registrar baja')
  } finally {
    isSubmitting.value = false
  }
}

const resetForms = () => {
  inForm.value = {
    date: getEcuadorDate(),
    time: getEcuadorTime(),
    rawMaterial: '',
    quantity: 0,
    unitCost: 0,
    provider: '',
    responsible: 'Danny',
    observation: '',
    suggestedOrderId: ''
  }
  outForm.value = {
    date: getEcuadorDate(),
    time: getEcuadorTime(),
    rawMaterial: '',
    quantity: 0,
    responsible: '',
    entity: '',
    observation: '',
    expectedSaleValue: 0
  }
  lossForm.value = {
    date: getEcuadorDate(),
    time: getEcuadorTime(),
    rawMaterial: '',
    quantity: 0,
    responsible: 'Danny',
    observation: '',
    reason: 'CADUCIDAD'
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

// Auto-select provider and unit cost when material changes
watch(() => inForm.value.rawMaterial, (newMaterialId) => {
  if (newMaterialId) {
    const material = materials.value.find(m => m._id === newMaterialId)
    if (material?.provider) {
      // Auto-select primary provider
      const providerId = typeof material.provider === 'object'
        ? material.provider._id
        : material.provider
      inForm.value.provider = providerId
    }
    // Pre-fill unit cost in display units (editable by user if provider charges differently)
    if (material?.cost !== undefined) {
      inForm.value.unitCost = getDisplayCost(material.cost, material.unit)
    }
  } else {
    inForm.value.provider = ''
    inForm.value.unitCost = 0
  }
})

watch(activeTab, (newTab) => {
  if (newTab === 'movements') {
    fetchMovements()
  } else if (newTab === 'in') {
    fetchTodaySuggestions()
  }
})

onMounted(() => {
  fetchDependencies()
  fetchMovements()
  fetchTodaySuggestions()
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

    <!-- Tabs (Mobile First) -->
    <div class="tabs">
      <button 
        :class="{ active: activeTab === 'movements' }" 
        @click="activeTab = 'movements'"
      >
        <i class="fas fa-history"></i>
        <span class="tab-label">Historial</span>
      </button>
      <button 
        :class="{ active: activeTab === 'in' }" 
        @click="activeTab = 'in'"
      >
        <i class="fas fa-box-open"></i>
        <span class="tab-label">Recepción</span>
      </button>
      <button 
        :class="{ active: activeTab === 'out' }" 
        @click="activeTab = 'out'"
      >
        <i class="fas fa-truck-loading"></i>
        <span class="tab-label">Despacho</span>
      </button>
      <button 
        :class="{ active: activeTab === 'loss' }" 
        @click="activeTab = 'loss'"
      >
        <i class="fas fa-trash-alt"></i>
        <span class="tab-label">Bajas</span>
      </button>
    </div>

    <div class="content-area">
      <!-- HISTORIAL -->
      <div v-if="activeTab === 'movements'" class="movements-tab">
        <WarehouseFilters 
          :materials="materials"
          :initialFilters="activeFilters"
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
                <th>Responsable</th>
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
                  <span class="badge" :class="{
                    'badge-in': m.type === 'IN',
                    'badge-out': m.type === 'OUT',
                    'badge-loss': m.type === 'LOSS'
                  }">
                    {{ m.type === 'IN' ? 'ENTRADA' : m.type === 'OUT' ? 'SALIDA' : 'BAJA' }}
                  </span>
                </td>
                <td>{{ m.rawMaterial?.name || 'Desconocido' }}</td>
                <td class="text-right fw-600">
                  {{ getDisplayQuantity(m.quantity, m.rawMaterial?.unit) }} <span class="unit-text">{{ getDisplayUnit(m.rawMaterial?.unit) }}</span>
                </td>
                <td class="text-right money-cell" :class="{ 'in-value': m.type === 'IN', 'loss-value': m.type === 'LOSS' }">
                  <span v-if="m.type === 'IN'">+ ${{ getMovementValue(m).toFixed(2) }}</span>
                  <span v-else-if="m.type === 'LOSS'">- ${{ getMovementValue(m).toFixed(2) }}</span>
                  <span v-else class="text-muted">- ${{ getMovementValue(m).toFixed(2) }}</span>
                </td>
                <td>
                  <span v-if="m.type === 'IN'">{{ m.provider?.name || '-' }}</span>
                  <span v-else-if="m.type === 'LOSS'">Pérdida Directa</span>
                  <span v-else>{{ m.entity || '-' }}</span>
                </td>
                <td>
                  <span class="responsible-tag">
                    <i class="fas fa-user-tag"></i> {{ m.responsible || '-' }}
                  </span>
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
        <!-- SUGGESTIONS SECTION -->
        <div v-if="suggestedOrders.length > 0" class="suggestions-section">
          <div class="suggestions-header">
             <div class="suggestions-title">
               <i class="fas fa-magic"></i>
               <h3>Sugerencias de Hoy</h3>
             </div>
             <p>Haz clic en un ítem para autocompletar el formulario de recepción.</p>
          </div>
          <div class="suggestions-grid">
            <template v-for="order in suggestedOrders" :key="order._id">
              <div 
                v-for="(item, idx) in order.items" 
                :key="order._id + '-' + idx"
                class="suggestion-card"
                @click="applySuggestion(order, item)"
              >
                <div class="suggestion-card__main">
                  <span class="suggestion-card__material">{{ item.name }}</span>
                  <span class="suggestion-card__qty">{{ item.quantity }} {{ getDisplayUnit(item.unit) }}</span>
                </div>
                <div class="suggestion-card__footer">
                  <i class="fas fa-truck"></i>
                  <span>{{ order.provider?.name || 'Proveedor' }}</span>
                </div>
              </div>
            </template>
          </div>
        </div>

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

          <!-- IN: Editable unit cost field -->
          <div v-if="selectedInMaterial" class="form-group">
            <label>
              Costo por {{ getDisplayUnit(selectedInMaterial.unit) }}
              <span class="label-optional">(USD / {{ getDisplayUnit(selectedInMaterial.unit) }} — editable si el proveedor cobra diferente)</span>
            </label>
            <div class="input-prefix-wrapper">
              <span class="input-prefix">USD</span>
              <input
                type="number"
                v-model.number="inForm.unitCost"
                min="0"
                step="0.0001"
                placeholder="0.0000"
              />
            </div>
          </div>

          <!-- IN: Real-time value calculator -->
          <div v-if="selectedInMaterial && inForm.quantity > 0 && inForm.unitCost > 0" class="value-calculator value-calculator--in">
            <div class="value-calculator__header">
              <i class="fas fa-calculator"></i>
              <span>Valor total de esta recepción</span>
            </div>
            <div class="value-calculator__amount">
              USD ${{ inTotalValue.toFixed(2) }}
            </div>
            <p class="value-calculator__hint">
              {{ inForm.quantity }} {{ getDisplayUnit(selectedInMaterial.unit) }}
              × USD ${{ inForm.unitCost.toFixed(4) }} / {{ getDisplayUnit(selectedInMaterial.unit) }}
              &nbsp;— Verifica que coincida con la factura del proveedor.
            </p>
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
            <label>Responsable de Recepción (Bodeguero)</label>
            <input type="text" v-model="inForm.responsible" placeholder="Nombre completo..." />
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

          <!-- OUT: Real-time value of dispatch -->
          <div v-if="selectedOutMaterial && outForm.quantity > 0" class="value-calculator value-calculator--out">
            <div class="value-calculator__header">
              <i class="fas fa-boxes"></i>
              <span>Valor del despacho</span>
            </div>
            <div class="value-calculator__amount">
              USD ${{ outTotalValue.toFixed(2) }}
            </div>
            <p class="value-calculator__hint">
              {{ outForm.quantity }} {{ getDisplayUnit(selectedOutMaterial.unit) }}
              × USD ${{ getDisplayCost(selectedOutMaterial.cost || 0, selectedOutMaterial.unit).toFixed(4) }} / {{ getDisplayUnit(selectedOutMaterial.unit) }}
            </p>
          </div>

          <!-- OUT: Rentability check -->
          <div class="form-group">
            <label>Venta esperada de producción <span class="label-optional">(Opcional — para control de rentabilidad)</span></label>
            <div class="input-prefix-wrapper">
              <span class="input-prefix">$</span>
              <input type="number" v-model.number="outForm.expectedSaleValue" min="0" step="0.01" placeholder="Ej: 6000" />
            </div>
          </div>

          <!-- Rentability Alert -->
          <div v-if="showRentabilityAlert" class="rentability-alert">
            <div class="rentability-alert__icon">⚠️</div>
            <div class="rentability-alert__body">
              <strong>ALERTA DE RENTABILIDAD</strong>
              <p>
                El valor de los insumos despachados
                (<strong>${{ outTotalValue.toFixed(2) }}</strong>) no permite alcanzar el margen proyectado
                para esta producción (<strong>${{ outForm.expectedSaleValue.toFixed(2) }}</strong>).
              </p>
              <p class="rentability-alert__sub">
                🔍 Posible Error: Revisar cantidades en el reporte de entrega o error en la planificación inicial.
              </p>
            </div>
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
            <label>Recibido por (Responsable)</label>
            <input type="text" v-model="outForm.responsible" placeholder="Ej: Bryan, Danny, Saraí..." />
            <div class="suggested-tags">
               <span v-for="name in ['Bryan', 'Danny', 'Saraí']" :key="name" class="tag" @click="outForm.responsible = name">
                 {{ name }}
               </span>
            </div>
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
      <!-- BAJAS (LOSS) -->
      <div v-if="activeTab === 'loss'" class="form-tab loss-tab">
        <div class="form-card">
          <h2>Registrar Baja de Inventario</h2>
          <div class="form-row">
            <div class="form-group half">
              <label>Fecha</label>
              <div class="readonly-display">
                <i class="fas fa-calendar-day"></i>
                <span>{{ lossForm.date }}</span>
              </div>
            </div>
            <div class="form-group half">
              <label>Hora</label>
              <div class="readonly-display">
                <i class="fas fa-clock"></i>
                <span>{{ lossForm.time }}</span>
              </div>
            </div>
          </div>
          <div class="form-group">
            <label>Materia Prima</label>
            <SearchableSelect
              v-model="lossForm.rawMaterial"
              :options="materialOptions"
              placeholder="Buscar materia prima..."
            />
          </div>
          <div class="form-group">
            <label>Cantidad a dar de baja ({{ selectedLossMaterial ? getDisplayUnit(selectedLossMaterial.unit) : 'Unidad' }})</label>
            <input type="number" v-model.number="lossForm.quantity" min="0" step="0.01" />
            <span v-if="selectedLossMaterial && selectedLossMaterial.quantity < toBackendQuantity(lossForm.quantity, selectedLossMaterial.unit)" class="error-text">
               Stock insuficiente ({{ getDisplayQuantity(selectedLossMaterial.quantity, selectedLossMaterial.unit) }} {{ getDisplayUnit(selectedLossMaterial.unit) }})
            </span>
          </div>

          <div class="form-group">
            <label>Motivo de la Baja</label>
            <select v-model="lossForm.reason">
              <option value="CADUCIDAD">CADUCIDAD</option>
              <option value="MAL_ESTADO">MAL ESTADO / DAÑADO</option>
              <option value="ROBO_EXTRAVIO">ROBO / EXTRAVÍO</option>
              <option value="ERROR_PESAJE">ERROR DE PESAJE</option>
              <option value="OTRO">OTRO</option>
            </select>
          </div>

          <div class="form-group">
            <label>Responsable</label>
            <input type="text" v-model="lossForm.responsible" placeholder="Nombre de quien registra..." />
          </div>

          <div class="form-group">
            <label>Observación Detallada</label>
            <textarea v-model="lossForm.observation" rows="3" placeholder="Ej: Lote expirado el 20/02..."></textarea>
          </div>

          <div class="actions">
             <button class="btn-primary btn-loss" @click="handleLossSubmit" :disabled="isSubmitting || !lossForm.rawMaterial || lossForm.quantity <= 0">
               {{ isSubmitting ? 'Guardando...' : 'Registrar Baja' }}
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
           <li><strong>Costo unitario:</strong> <span class="modal-value">USD ${{ inForm.unitCost.toFixed(4) }} / {{ selectedInMaterial ? getDisplayUnit(selectedInMaterial.unit) : '' }}</span></li>
           <li><strong>Total recepción:</strong> <span class="modal-value">USD ${{ inTotalValue.toFixed(2) }}</span></li>
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
           <li><strong>Valor del despacho:</strong> <span class="modal-value">${{ outTotalValue.toFixed(4) }}</span></li>
           <li><strong>Destino:</strong> {{ outForm.entity }}</li>
         </ul>
         <!-- Inline alert inside modal -->
         <div v-if="showRentabilityAlert" class="modal-rentability-alert">
           ⚠️ <strong>ALERTA DE RENTABILIDAD:</strong> El costo (${{ outTotalValue.toFixed(2) }}) supera la venta esperada (${{ outForm.expectedSaleValue.toFixed(2) }}).
         </div>
        
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

    <ConfirmationModal
      :isOpen="showLossModal"
      title="Confirmar Baja"
      message=""
      confirmText="Confirmar Pérdida"
      @close="showLossModal = false"
      @confirm="confirmLoss"
    >
      <template #default> 
         <p>Se registrará una <strong>BAJA (Pérdida)</strong> de:</p>
         <ul class="modal-list">
           <li><strong>Materia Prima:</strong> {{ selectedLossMaterial?.name }}</li>
           <li><strong>Cantidad:</strong> {{ lossForm.quantity }} {{ selectedLossMaterial ? getDisplayUnit(selectedLossMaterial.unit) : '' }}</li>
           <li><strong>Motivo:</strong> {{ lossForm.reason }}</li>
           <li><strong>Responsable:</strong> {{ lossForm.responsible }}</li>
         </ul>
         <p class="text-danger small">Esta acción restará el stock permanentemente.</p>
      </template>
    </ConfirmationModal>

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

/* TABS (Mobile First) */
.tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  border-bottom: 2px solid #f1f5f9;
  padding-bottom: 0;
  overflow-x: auto;
  scrollbar-width: none; // Firefox

  &::-webkit-scrollbar {
    display: none;
  }

  // Chrome/Safari
  -webkit-overflow-scrolling: touch;

  // Center tabs if they don't overflow
  @media (min-width: 640px) {
    justify-content: flex-start;
    gap: 1rem;
    margin-bottom: 2rem;
    overflow-x: visible;
  }
}

.tabs button {
  background: none;
  border: none;
  padding: 0.75rem 0.5rem;
  font-size: 0.85rem;
  color: $text-light;
  cursor: pointer;
  border-bottom: 3px solid transparent;
  display: flex;
  flex-direction: column; // Stack icon and text on very small devices
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  font-weight: 700;
  transition: all 0.2s;
  white-space: nowrap;
  flex: 1;
  min-width: 80px;

  @media (min-width: 480px) {
    flex-direction: row; // Reset to horizontal for small mobiles
    padding: 0.8rem 1.25rem;
    font-size: 0.95rem;
    gap: 0.5rem;
  }

  @media (min-width: 640px) {
    flex: none;
    padding: 1rem 2rem;
    font-size: 1rem;
    min-width: auto;
  }

  i {
    font-size: 1.1rem;

    @media (min-width: 640px) {
      font-size: 1.25rem;
    }
  }

  &:hover {
    color: $NICOLE-PURPLE;
  }

  &.active {
    color: $NICOLE-PURPLE;
    border-bottom-color: $NICOLE-PURPLE;
    background: rgba($NICOLE-PURPLE, 0.05);
    border-radius: 12px 12px 0 0;
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

.badge-loss {
  background: #fef2f2;
  color: #991b1b;
  border: 1px solid #fee2e2;
}

.text-danger {
  color: #ef4444;
}

.small {
  font-size: 0.85rem;
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
  font-weight: 501;
  transition: all 0.2s;

  &:hover {
    background: $purple-dark;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba($NICOLE-PURPLE, 0.2);
  }

  &.btn-loss {
    background: #ef4444;

    &:hover {
      background: #dc2626;
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.2);
    }
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
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

  &.loss-value {
    color: #991b1b;
    font-weight: 600;
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

/* Value Calculator Panel */
.value-calculator {
  border-radius: 10px;
  padding: 1rem 1.25rem;
  margin-bottom: 1.2rem;
  border: 1px solid;

  &--in {
    background: #f0fdf4;
    border-color: #86efac;

    .value-calculator__amount {
      color: #15803d;
    }
  }

  &--out {
    background: #eff6ff;
    border-color: #93c5fd;

    .value-calculator__amount {
      color: #1d4ed8;
    }
  }

  &__header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: $text-light;
    margin-bottom: 0.5rem;
  }

  &__amount {
    font-size: 1.8rem;
    font-weight: 800;
    line-height: 1;
    margin-bottom: 0.4rem;
  }

  &__hint {
    font-size: 0.78rem;
    color: $text-light;
    margin: 0;
  }
}

/* Rentability Alert */
.rentability-alert {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  background: #fff7ed;
  border: 1.5px solid #fb923c;
  border-radius: 10px;
  padding: 1rem 1.25rem;
  margin-bottom: 1.2rem;

  &__icon {
    font-size: 1.5rem;
    flex-shrink: 0;
    line-height: 1;
    margin-top: 2px;
  }

  &__body {
    flex: 1;

    strong {
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #c2410c;
    }

    p {
      margin: 0.4rem 0 0;
      font-size: 0.9rem;
      color: #7c2d12;
      line-height: 1.5;
    }
  }

  &__sub {
    font-size: 0.82rem !important;
    color: #9a3412 !important;
    margin-top: 0.5rem !important;
  }
}

/* Rentability alert inside modal */
.modal-rentability-alert {
  background: #fff7ed;
  border: 1px solid #fb923c;
  border-radius: 8px;
  padding: 0.75rem 1rem;
  font-size: 0.88rem;
  color: #9a3412;
  margin: 0.5rem 0 0;
  text-align: left;
}

.modal-value {
  color: #1d4ed8;
  font-weight: 700;
}

/* Optional label hint */
.label-optional {
  font-size: 0.75rem;
  font-weight: 400;
  color: $text-light;
  margin-left: 0.25rem;
}

/* Input with $ prefix */
.input-prefix-wrapper {
  display: flex;
  align-items: center;
  border: 1px solid $border-light;
  border-radius: 6px;
  overflow: hidden;

  &:focus-within {
    border-color: $NICOLE-PURPLE;
    box-shadow: 0 0 0 2px rgba($NICOLE-PURPLE, 0.1);
  }

  input {
    border: none !important;
    box-shadow: none !important;
    border-radius: 0 !important;
    padding-left: 0.5rem !important;

    &:focus {
      outline: none;
      border: none;
      box-shadow: none;
    }
  }
}

.input-prefix {
  padding: 0.75rem 0.6rem 0.75rem 0.75rem;
  background: $gray-50;
  color: $text-light;
  font-weight: 600;
  font-size: 1rem;
  border-right: 1px solid $border-light;
  line-height: 1;
}

.responsible-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: #475569;
  background: #f1f5f9;
  padding: 0.2rem 0.6rem;
  border-radius: 6px;

  i {
    font-size: 0.75rem;
    color: $NICOLE-PURPLE;
  }
}

.suggested-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.4rem;

  .tag {
    font-size: 0.75rem;
    font-weight: 700;
    color: $NICOLE-PURPLE;
    background: rgba($NICOLE-PURPLE, 0.08);
    padding: 0.25rem 0.75rem;
    border-radius: 999px;
    cursor: pointer;
    transition: all 0.2s;
    border: 1px solid transparent;

    &:hover {
      background: rgba($NICOLE-PURPLE, 0.15);
      border-color: $NICOLE-PURPLE;
    }
  }
}

/* Suggestions Style */
.suggestions-section {
  background: white;
  border: 1px solid $border-light;
  border-radius: 12px;
  padding: 1.25rem;
  margin-bottom: 2rem;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.03);
}

.suggestions-header {
  margin-bottom: 1.25rem;

  p {
    margin: 0.25rem 0 0;
    font-size: 0.85rem;
    color: $text-light;
  }
}

.suggestions-title {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  color: $NICOLE-PURPLE;

  i {
    font-size: 1rem;
    filter: drop-shadow(0 0 5px rgba($NICOLE-PURPLE, 0.2));
  }

  h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
}

.suggestions-grid {
  display: flex;
  gap: 1rem;
  overflow-x: auto;
  padding-bottom: 0.5rem;

  /* Modern scrollbar */
  &::-webkit-scrollbar {
    height: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: #e2e8f0;
    border-radius: 10px;
  }
}

.suggestion-card {
  flex: 0 0 220px;
  background: #f8fafc;
  border: 1.5px solid #e2e8f0;
  border-radius: 10px;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;

  &:hover {
    transform: translateY(-3px);
    border-color: $NICOLE-PURPLE;
    background: white;
    box-shadow: 0 10px 20px rgba($NICOLE-PURPLE, 0.08);

    .suggestion-card__material {
      color: $NICOLE-PURPLE;
    }
  }

  &__main {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  &__material {
    font-size: 0.95rem;
    font-weight: 700;
    color: $text-dark;
    transition: color 0.2s;
    /* Truncate text */
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__qty {
    font-size: 1.1rem;
    font-weight: 800;
    color: $NICOLE-PURPLE;
  }

  &__footer {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.75rem;
    color: $text-light;
    border-top: 1px solid #e2e8f0;
    padding-top: 0.6rem;

    i {
      font-size: 0.7rem;
    }

    span {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
}
</style>
