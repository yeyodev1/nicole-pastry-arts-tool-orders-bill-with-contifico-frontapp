<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import WarehouseService from '@/services/warehouse.service'
import SupplierOrderService from '@/services/supplier-order.service'
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
  unitCost: 0, provider: '', responsible: 'Danny', observation: '', suggestedOrderId: ''
})

const outForm = ref({
  date: getEcuadorDate(), time: getEcuadorTime(), rawMaterial: '', quantity: 0,
  responsible: '', entity: '', observation: '', expectedSaleValue: 0
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

// --- Shared Computed / Options ---
const materialOptions = computed(() => materials.value.map(m => ({
  value: m._id, label: m.name, subtitle: `Stock: ${(m.quantity / (m.unit === 'u' ? 1 : 1000)).toFixed(2)} ${m.unit === 'u' ? 'u' : (m.unit === 'ml' ? 'L' : 'kg')}`
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

const entityOptions = [
  "Nicole Pastry Arts - San marino", "Nicole Pastry Arts - Mall del sol", "Finestra - CDP",
  "Delacrem - Mall del sol", "Casa mía - Mall del sol", "Sucreenda - CDP", "Sucree - Vivantino"
].map(e => ({ value: e, label: e }))

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
    runFetchMovements()
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
      totalValue: outForm.value.quantity * (selMat?.cost * ((selMat?.unit === 'g' || selMat?.unit === 'ml') ? 1000 : 1))
    })
    success('Despacho registrado')
    resetOutForm()
    activeTab.value = 'movements'
    runFetchMovements()
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
    runFetchMovements()
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
  if (mat) inForm.value.unitCost = mat.cost * ((mat.unit === 'g' || mat.unit === 'ml') ? 1000 : 1)
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
const resetInForm = () => { inForm.value = { date: getEcuadorDate(), time: getEcuadorTime(), rawMaterial: '', quantity: 0, unitCost: 0, provider: '', responsible: 'Danny', observation: '', suggestedOrderId: '' } }
const resetOutForm = () => { outForm.value = { date: getEcuadorDate(), time: getEcuadorTime(), rawMaterial: '', quantity: 0, responsible: '', entity: '', observation: '', expectedSaleValue: 0 } }
const resetLossForm = () => { lossForm.value = { date: getEcuadorDate(), time: getEcuadorTime(), rawMaterial: '', quantity: 0, responsible: 'Danny', observation: '', reason: 'CADUCIDAD' } }

// --- Lifecycle ---
onMounted(() => { fetchDependencies(); runFetchMovements() })

// Auto-fill cost when material changes in Reception
watch(() => inForm.value.rawMaterial, (id) => {
  const mat = materials.value.find(m => m._id === id)
  if (mat) {
    inForm.value.unitCost = mat.cost * ((mat.unit === 'g' || mat.unit === 'ml') ? 1000 : 1)
    if (mat.provider) inForm.value.provider = typeof mat.provider === 'object' ? mat.provider._id : mat.provider
  }
})

watch(activeTab, (tab) => { if (tab === 'in') fetchTodaySuggestions() })

</script>

<template>
  <div class="warehouse-view">
    <div class="header">
      <div class="title">
        <h1>Bodega</h1>
        <p>Gestión de Inventario Modernizada</p>
      </div>
    </div>

    <div class="tabs">
      <button v-for="t in [['movements', 'Historial', 'fa-history'], ['in', 'Recepción', 'fa-box-open'], ['out', 'Despacho', 'fa-truck-loading'], ['loss', 'Bajas', 'fa-trash-alt']]"
        :key="t[0]" :class="{ active: activeTab === t[0] }" @click="activeTab = (t[0] as any)">
        <i :class="'fas ' + t[2]"></i> <span class="tab-label">{{ t[1] }}</span>
      </button>
    </div>

    <div class="main-content">
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
        @submit="onInSubmit" @apply-suggestion="applySuggestion"
      />

      <WarehouseDispatchForm v-if="activeTab === 'out'"
        v-model:form="outForm" :materials="materials" :materialOptions="materialOptions"
        :entityOptions="entityOptions" :isSubmitting="isSubmitting"
        :holdProgress="holdProgress" :isHolding="isHolding"
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
  padding: 1rem;
  max-width: 1100px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
  overflow-x: hidden;

  @media (min-width: 768px) {
    padding: 2rem;
  }
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
    font-size: 0.9rem;
  }
}

.tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 2rem;
  border-bottom: 2px solid #f1f5f9;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;

  &::-webkit-scrollbar {
    display: none;
  }

  @media (min-width: 640px) {
    gap: 1rem;
  }

  button {
    background: none;
    border: none;
    padding: 0.8rem 1rem;
    font-size: 0.9rem;
    color: $text-light;
    cursor: pointer;
    border-bottom: 3px solid transparent;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 700;
    transition: all 0.2s;
    white-space: nowrap;

    i {
      font-size: 1.1rem;
    }

    &.active {
      color: $NICOLE-PURPLE;
      border-bottom-color: $NICOLE-PURPLE;
      background: rgba($NICOLE-PURPLE, 0.05);
      border-radius: 12px 12px 0 0;
    }
  }
}
</style>
