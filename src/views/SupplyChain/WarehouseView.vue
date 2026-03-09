<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import WarehouseService from '@/services/warehouse.service'
import SupplierOrderService from '@/services/supplier-order.service'
import WarehouseSettingsService from '@/services/warehouse-settings.service'
import { useWarehouse } from '@/composables/useWarehouse'

// Components
import WarehouseHistoryTable from './components/WarehouseHistoryTable.vue'
import WarehouseReceptionForm from './components/WarehouseReceptionForm.vue'
import WarehouseDispatchForm from './components/WarehouseDispatchForm.vue'
import WarehouseLossForm from './components/WarehouseLossForm.vue'

const {
  materials, providers, movements, suggestedOrders, isLoading,
  getEcuadorTime, getEcuadorDate, getEcuadorMonthStart,
  fetchDependencies, fetchMovements, fetchTodaySuggestions,
  success, showError
} = useWarehouse()

// Warehouse Settings (dynamic points)
const receptionPoints = ref<{ _id?: string; name: string; isActive: boolean }[]>([])
const dispatchPoints = ref<{ _id?: string; name: string; isActive: boolean }[]>([])

const fetchWarehouseSettings = async () => {
  try {
    const data = await WarehouseSettingsService.getSettings()
    receptionPoints.value = data.receptionPoints.filter(p => p.isActive)
    dispatchPoints.value = data.dispatchPoints.filter(p => p.isActive)
  } catch { /* non-critical */ }
}

// View State
const activeTab = ref<'movements' | 'in' | 'out' | 'loss'>('movements')
const isSubmitting = ref(false)

// Pagination & Filters State (coordinated here)
const currentPage = ref(1)
const totalPages = ref(1)
const activeFilters = ref({
  type: '',
  materialId: '',
  startDate: getEcuadorMonthStart(),
  endDate: getEcuadorDate()
})

// --- Forms Initialization ---
const inForm = ref({
  date: getEcuadorDate(), time: getEcuadorTime(), rawMaterial: '', quantity: 0,
  unitCost: 0, provider: '', responsible: 'Danny', observation: '', suggestedOrderId: '', receptionPoint: ''
})

const outForm = ref({
  date: getEcuadorDate(), time: getEcuadorTime(), rawMaterial: '', quantity: 0,
  responsible: '', entity: '', observation: '', expectedSaleValue: 0, receptionPoint: ''
})

const lossForm = ref({
  date: getEcuadorDate(), time: getEcuadorTime(), rawMaterial: '', quantity: 0,
  responsible: 'Danny', observation: '', reason: 'CADUCIDAD'
})

// Dispatch Specific
const holdProgress = ref(0)
const isHolding = ref(false)
let holdTimer: any = null
const HOLD_DURATION = 1200
const locationStocks = ref<{ location: string; stock: number }[]>([])

// --- Shared Computed / Options ---
const materialOptions = computed(() => materials.value.map(m => ({
  value: m._id, label: m.name, subtitle: `Stock: ${(m.quantity / (m.unit === 'u' ? 1 : 1000)).toFixed(2)} ${m.unit === 'u' ? 'u' : (m.unit === 'ml' ? 'lt' : 'kg')}`
})))

const filteredProviderOptions = computed(() => {
  const selMat = materials.value.find(m => m._id === inForm.value.rawMaterial)
  if (selMat?.provider) {
    const mainId = typeof selMat.provider === 'object' ? selMat.provider._id : selMat.provider
    const main = providers.value.find(p => p._id === mainId)
    if (main) {
      return [{ value: main._id, label: `${main.name} ⭐ (Principal)` }, ...providers.value.filter(p => p._id !== mainId).map(p => ({ value: p._id, label: p.name }))]
    }
  }
  return providers.value.map(p => ({ value: p._id, label: p.name }))
})

const entityOptions = computed(() =>
  dispatchPoints.value.map(p => ({ value: p.name, label: p.name }))
)

const receptionPointOptions = computed(() =>
  receptionPoints.value.map(p => ({ value: p.name, label: p.name }))
)

// --- Logic Coordination ---
const handlePageChange = (page: number) => {
  currentPage.value = page
  runFetchMovements()
}

const handleFilter = (filters: any) => {
  activeFilters.value = filters
  currentPage.value = 1
  runFetchMovements()
}

const runFetchMovements = async () => {
  const data = await fetchMovements({ page: currentPage.value, ...activeFilters.value })
  if (data) {
    totalPages.value = data.pages
  }
}

// --- Submit Actions ---
const onInSubmit = async () => {
  isSubmitting.value = true
  const combinedDate = `${inForm.value.date}T${inForm.value.time}:00-05:00`
  const user = JSON.parse(localStorage.getItem('user_info') || '{}')

  const selMat = materials.value.find(m => m._id === inForm.value.rawMaterial)
  const backendQty = (selMat?.unit === 'g' || selMat?.unit === 'ml') ? inForm.value.quantity * 1000 : inForm.value.quantity
  const backendCost = (selMat?.unit === 'g' || selMat?.unit === 'ml') ? inForm.value.unitCost / 1000 : inForm.value.unitCost

  try {
    await WarehouseService.createMovement({
      type: 'IN', ...inForm.value, quantity: backendQty, unitCost: backendCost,
      totalValue: inForm.value.quantity * inForm.value.unitCost, date: combinedDate, user: user._id
    })
    success('Recepción registrada exitosamente')
    if (inForm.value.suggestedOrderId) {
      await SupplierOrderService.updateOrder(inForm.value.suggestedOrderId, { status: 'RECEIVED' })
      fetchTodaySuggestions()
    }
    resetInForm()
    activeTab.value = 'movements'
    await Promise.all([runFetchMovements(), fetchDependencies()])
  } catch (e: any) { showError(e.message || 'Error al guardar') }
  finally { isSubmitting.value = false }
}

const onOutSubmit = async () => {
  isSubmitting.value = true
  const combinedDate = `${outForm.value.date}T${outForm.value.time}:00-05:00`
  const user = JSON.parse(localStorage.getItem('user_info') || '{}')
  const selMat = materials.value.find(m => m._id === outForm.value.rawMaterial)
  const backendQty = (selMat?.unit === 'g' || selMat?.unit === 'ml') ? outForm.value.quantity * 1000 : outForm.value.quantity

  try {
    await WarehouseService.createMovement({
      type: 'OUT', ...outForm.value, quantity: backendQty, date: combinedDate, user: user._id,
      totalValue: selMat ? outForm.value.quantity * getCostPerDisplayUnit(selMat) : 0
    })
    success('Despacho registrado')
    resetOutForm()
    activeTab.value = 'movements'
    await Promise.all([runFetchMovements(), fetchDependencies()])
  } catch (e: any) { showError(e.message) }
  finally { isSubmitting.value = false; stopHold() }
}

const onLossSubmit = async () => {
  isSubmitting.value = true
  // Similar implementation... skipped for brevity in this draft but fully implemented in final
  const selMat = materials.value.find(m => m._id === lossForm.value.rawMaterial)
  const backendQty = (selMat?.unit === 'g' || selMat?.unit === 'ml') ? lossForm.value.quantity * 1000 : lossForm.value.quantity
  const combinedDate = `${lossForm.value.date}T${lossForm.value.time}:00-05:00`
  const user = JSON.parse(localStorage.getItem('user_info') || '{}')

  try {
    await WarehouseService.createMovement({
      type: 'LOSS', ...lossForm.value, quantity: backendQty, date: combinedDate, user: user._id,
      observation: `[${lossForm.value.reason}] ${lossForm.value.observation}`
    })
    success('Baja registrada')
    resetLossForm()
    activeTab.value = 'movements'
    await Promise.all([runFetchMovements(), fetchDependencies()])
  } catch (e: any) { showError(e.message) }
  finally { isSubmitting.value = false }
}

const applySuggestion = (order: any, item: any) => {
  inForm.value.rawMaterial = item.material._id || item.material
  inForm.value.quantity = item.quantity
  inForm.value.provider = order.provider?._id || order.provider
  inForm.value.suggestedOrderId = order._id
  inForm.value.observation = `[O.COMPRA #${order._id.slice(-4)}]`
  const mat = materials.value.find(m => m._id === inForm.value.rawMaterial)
  if (mat) inForm.value.unitCost = getCostPerDisplayUnit(mat)
}

// --- Hold Logic ---
const startHold = () => {
  isHolding.value = true; holdProgress.value = 0
  const step = 100 / (HOLD_DURATION / 50)
  holdTimer = setInterval(() => {
    holdProgress.value += step
    if (holdProgress.value >= 100) { clearInterval(holdTimer); onOutSubmit() }
  }, 50)
}
const stopHold = () => { isHolding.value = false; holdProgress.value = 0; clearInterval(holdTimer) }

// --- Helpers ---
const resetInForm = () => { inForm.value = { date: getEcuadorDate(), time: getEcuadorTime(), rawMaterial: '', quantity: 0, unitCost: 0, provider: '', responsible: 'Danny', observation: '', suggestedOrderId: '', receptionPoint: '' } }
const resetOutForm = () => { outForm.value = { date: getEcuadorDate(), time: getEcuadorTime(), rawMaterial: '', quantity: 0, responsible: '', entity: '', observation: '', expectedSaleValue: 0, receptionPoint: '' }; locationStocks.value = [] }
const resetLossForm = () => { lossForm.value = { date: getEcuadorDate(), time: getEcuadorTime(), rawMaterial: '', quantity: 0, responsible: 'Danny', observation: '', reason: 'CADUCIDAD' } }

// --- Lifecycle ---
onMounted(() => { fetchDependencies(); runFetchMovements(); fetchWarehouseSettings() })

// Compute cost per display unit ($/kg or $/lt or $/u) from a material
// Uses presentationPrice/presentationQuantity as source of truth (avoids unit ambiguity in stored cost field)
const getCostPerDisplayUnit = (mat: typeof materials.value[0]) => {
  const isWeight = mat.unit === 'g' || mat.unit === 'ml'
  if (mat.presentationPrice && mat.presentationQuantity && mat.presentationQuantity > 0) {
    const displayQty = isWeight ? mat.presentationQuantity / 1000 : mat.presentationQuantity
    return displayQty > 0 ? mat.presentationPrice / displayQty : 0
  }
  // Fallback: cost field (assumed $/g for weight materials)
  return isWeight ? mat.cost * 1000 : mat.cost
}

// Auto-fill cost when material changes in Reception
watch(() => inForm.value.rawMaterial, (id) => {
  const mat = materials.value.find(m => m._id === id)
  if (mat) {
    inForm.value.unitCost = getCostPerDisplayUnit(mat)
    if (mat.provider) inForm.value.provider = typeof mat.provider === 'object' ? mat.provider._id : mat.provider
  }
})

watch(activeTab, (tab) => { if (tab === 'in') fetchTodaySuggestions() })

watch(() => outForm.value.rawMaterial, async (id) => {
  locationStocks.value = []
  outForm.value.receptionPoint = ''
  if (id) {
    try { locationStocks.value = await WarehouseService.getStockByLocation(id) } catch { /* non-critical */ }
  }
})

</script>

<template>
  <div class="warehouse-view">
    <!-- Header -->
    <div class="wh-header">
      <div class="wh-title">
        <h1><i class="fas fa-warehouse"></i> Bodega</h1>
        <p>Control de entradas, salidas y bajas de inventario</p>
      </div>
    </div>

    <!-- Tabs -->
    <div class="wh-tabs">
      <button
        v-for="t in [
          { key: 'movements', label: 'Historial',  icon: 'fa-history',       color: 'tab-neutral' },
          { key: 'in',        label: 'Recepción',  icon: 'fa-box-open',      color: 'tab-in'      },
          { key: 'out',       label: 'Despacho',   icon: 'fa-truck-loading', color: 'tab-out'     },
          { key: 'loss',      label: 'Bajas',      icon: 'fa-trash-alt',     color: 'tab-loss'    },
        ]"
        :key="t.key"
        :class="['wh-tab', t.color, { active: activeTab === t.key }]"
        @click="activeTab = (t.key as any)"
      >
        <i :class="'fas ' + t.icon"></i>
        <span>{{ t.label }}</span>
      </button>
    </div>

    <!-- Content -->
    <div class="wh-content">
      <WarehouseHistoryTable v-if="activeTab === 'movements'"
        :materials="materials" :movements="movements" :isLoading="isLoading"
        :activeFilters="activeFilters" :currentPage="currentPage" :totalPages="totalPages"
        :totalInValue="movements.filter(m => m.type === 'IN').reduce((s, m) => s + (m.quantity * (m.rawMaterial?.cost || 0)), 0)"
        @filter="handleFilter" @page-change="handlePageChange"
      />

      <WarehouseReceptionForm v-if="activeTab === 'in'"
        v-model:form="inForm" :materials="materials" :providers="providers"
        :suggestedOrders="suggestedOrders" :isSubmitting="isSubmitting"
        :materialOptions="materialOptions" :filteredProviderOptions="filteredProviderOptions"
        :receptionPointOptions="receptionPointOptions"
        @submit="onInSubmit" @apply-suggestion="applySuggestion"
      />

      <WarehouseDispatchForm v-if="activeTab === 'out'"
        v-model:form="outForm" :materials="materials" :materialOptions="materialOptions"
        :entityOptions="entityOptions" :isSubmitting="isSubmitting"
        :holdProgress="holdProgress" :isHolding="isHolding"
        :locationStocks="locationStocks"
        @submit="onOutSubmit" @start-hold="startHold" @cancel-hold="stopHold"
      />

      <WarehouseLossForm v-if="activeTab === 'loss'"
        v-model:form="lossForm" :materials="materials" :materialOptions="materialOptions"
        :isSubmitting="isSubmitting" @submit="onLossSubmit"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.warehouse-view {
  width: 100%;
  min-height: 100vh;
  background: var(--color-background);
  box-sizing: border-box;
}

// ─── Header ───────────────────────────────────────────────────────────────────

.wh-header {
  padding: 1.75rem 1.5rem 0;

  @media (min-width: 768px) {
    padding: 2rem 2.5rem 0;
  }
}

.wh-title {
  h1 {
    margin: 0;
    font-size: 1.75rem;
    font-weight: 800;
    color: $NICOLE-PURPLE;
    letter-spacing: -0.5px;
    display: flex;
    align-items: center;
    gap: 0.65rem;

    i { font-size: 1.4rem; opacity: 0.85; }

    @media (min-width: 640px) { font-size: 2rem; }
  }

  p {
    margin: 0.35rem 0 0;
    color: #64748b;
    font-size: 0.9rem;
    font-weight: 500;
  }
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

.wh-tabs {
  display: flex;
  gap: 0;
  padding: 1.25rem 1.5rem 0;
  border-bottom: 2px solid #e2e8f0;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;

  &::-webkit-scrollbar { display: none; }

  @media (min-width: 768px) {
    padding: 1.5rem 2.5rem 0;
    gap: 0.25rem;
  }
}

.wh-tab {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  border: none;
  background: none;
  font-size: 0.88rem;
  font-weight: 700;
  color: #94a3b8;
  cursor: pointer;
  border-bottom: 3px solid transparent;
  margin-bottom: -2px;
  white-space: nowrap;
  border-radius: 8px 8px 0 0;
  transition: all 0.2s;

  i { font-size: 0.95rem; }

  &:hover {
    color: #475569;
    background: #f8fafc;
  }

  &.active {
    color: $NICOLE-PURPLE;
    border-bottom-color: $NICOLE-PURPLE;
    background: rgba($NICOLE-PURPLE, 0.04);
  }

  &.tab-in.active   { color: #059669; border-bottom-color: #059669; background: rgba(#059669, 0.04); }
  &.tab-out.active  { color: #dc2626; border-bottom-color: #dc2626; background: rgba(#dc2626, 0.04); }
  &.tab-loss.active { color: #d97706; border-bottom-color: #d97706; background: rgba(#d97706, 0.04); }
}

// ─── Content ──────────────────────────────────────────────────────────────────

.wh-content {
  padding: 1.5rem;

  @media (min-width: 768px) {
    padding: 2rem 2.5rem;
  }
}
</style>
