<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import WarehouseService from '@/services/warehouse.service'
import SupplierOrderService from '@/services/supplier-order.service'
import WarehouseSettingsService from '@/services/warehouse-settings.service'
import { useWarehouse } from '@/composables/useWarehouse'
import type { WarehouseInForm, WarehouseOutForm, ReceptionItem, DispatchItem } from '@/types/warehouse'

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
  endDate: getEcuadorDate(),
  receptionPoint: ''
})
const aggregates = ref<{ _id: { type: string; receptionPoint: string }; totalValue: number; count: number }[]>([])

// Expiring invoices banner
const expiringInvoiceCount = ref(0)

// --- Forms Initialization ---
const inForm = ref<WarehouseInForm>({
  date: getEcuadorDate(),
  time: getEcuadorTime(),
  provider: '',
  receptionPoint: '',
  invoiceRef: '',
  invoiceDueDate: '',
  responsible: 'Danny',
  observation: '',
  suggestedOrderId: '',
  items: [{ rawMaterial: '', quantity: 0, unitCost: 0 }]
})

const outForm = ref<WarehouseOutForm>({
  date: getEcuadorDate(),
  time: getEcuadorTime(),
  entity: '',
  responsible: '',
  observation: '',
  items: [{ rawMaterial: '', sourceReceptionPoint: '', quantity: 0 }]
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
const locationStocksMap = ref<Record<string, { location: string; stock: number }[]>>({})

// --- Shared Computed / Options ---
const materialOptions = computed(() => materials.value.map(m => ({
  value: m._id, label: m.name, subtitle: `Stock: ${(m.quantity / (m.unit === 'u' ? 1 : 1000)).toFixed(2)} ${m.unit === 'u' ? 'u' : (m.unit === 'ml' ? 'lt' : 'kg')}`
})))

const providerOptions = computed(() =>
  providers.value.map(p => ({ value: p._id, label: p.name }))
)

const filteredProviderOptions = computed(() => providerOptions.value)

const entityOptions = computed(() =>
  dispatchPoints.value.map(p => ({ value: p.name, label: p.name }))
)

const receptionPointOptions = computed(() =>
  receptionPoints.value.map(p => ({ value: p.name, label: p.name }))
)

// Provider mismatch detection for reception items
const providerMismatchIndices = computed(() => {
  const indices: number[] = []
  if (!inForm.value.provider) return indices
  inForm.value.items.forEach((item, idx) => {
    if (!item.rawMaterial) return
    const mat = materials.value.find(m => m._id === item.rawMaterial)
    if (!mat?.provider) return
    const matProviderId = typeof mat.provider === 'object' ? mat.provider._id : mat.provider
    if (matProviderId !== inForm.value.provider) {
      indices.push(idx)
    }
  })
  return indices
})

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
    aggregates.value = data.aggregates || []
  }
}

// --- Helpers ---
const getCostPerDisplayUnit = (mat: typeof materials.value[0]) => {
  const isWeight = mat.unit === 'g' || mat.unit === 'ml'
  if (mat.presentationPrice && mat.presentationQuantity && mat.presentationQuantity > 0) {
    const displayQty = isWeight ? mat.presentationQuantity / 1000 : mat.presentationQuantity
    return displayQty > 0 ? mat.presentationPrice / displayQty : 0
  }
  return isWeight ? mat.cost * 1000 : mat.cost
}

const resetInForm = () => {
  inForm.value = {
    date: getEcuadorDate(), time: getEcuadorTime(),
    provider: '', receptionPoint: '', invoiceRef: '', invoiceDueDate: '',
    responsible: 'Danny', observation: '', suggestedOrderId: '',
    items: [{ rawMaterial: '', quantity: 0, unitCost: 0 }]
  }
}

const resetOutForm = () => {
  outForm.value = {
    date: getEcuadorDate(), time: getEcuadorTime(),
    entity: '', responsible: '', observation: '',
    items: [{ rawMaterial: '', sourceReceptionPoint: '', quantity: 0 }]
  }
  locationStocksMap.value = {}
}

const resetLossForm = () => {
  lossForm.value = { date: getEcuadorDate(), time: getEcuadorTime(), rawMaterial: '', quantity: 0, responsible: 'Danny', observation: '', reason: 'CADUCIDAD' }
}

// --- Submit Actions ---
const onInSubmit = async () => {
  isSubmitting.value = true
  const combinedDate = `${inForm.value.date}T${inForm.value.time}:00-05:00`
  const user = JSON.parse(localStorage.getItem('user_info') || '{}')

  // Build items payload
  const items = inForm.value.items
    .filter(item => item.rawMaterial && item.quantity > 0)
    .map(item => {
      const mat = materials.value.find(m => m._id === item.rawMaterial)
      const isWeight = mat?.unit === 'g' || mat?.unit === 'ml'
      const backendQty = isWeight ? item.quantity * 1000 : item.quantity
      const backendCost = isWeight ? item.unitCost / 1000 : item.unitCost
      return {
        rawMaterial: item.rawMaterial,
        quantity: backendQty,
        unitCost: backendCost,
        totalValue: item.quantity * item.unitCost,
      }
    })

  try {
    await WarehouseService.createBatch({
      type: 'IN',
      date: combinedDate,
      user: user._id,
      responsible: inForm.value.responsible,
      observation: inForm.value.observation,
      provider: inForm.value.provider || undefined,
      invoiceRef: inForm.value.invoiceRef,
      invoiceDueDate: inForm.value.invoiceDueDate,
      receptionPoint: inForm.value.receptionPoint || undefined,
      items,
    })
    success('Recepción registrada exitosamente')
    if (inForm.value.suggestedOrderId) {
      await SupplierOrderService.updateOrder(inForm.value.suggestedOrderId, { status: 'RECEIVED' })
      fetchTodaySuggestions()
    }
    resetInForm()
    activeTab.value = 'movements'
    await Promise.all([runFetchMovements(), fetchDependencies()])
    fetchExpiringInvoices()
  } catch (e: any) { showError(e.message || 'Error al guardar') }
  finally { isSubmitting.value = false }
}

const onOutSubmit = async () => {
  isSubmitting.value = true
  const combinedDate = `${outForm.value.date}T${outForm.value.time}:00-05:00`
  const user = JSON.parse(localStorage.getItem('user_info') || '{}')

  const items = outForm.value.items
    .filter(item => item.rawMaterial && item.quantity > 0)
    .map(item => {
      const mat = materials.value.find(m => m._id === item.rawMaterial)
      const isWeight = mat?.unit === 'g' || mat?.unit === 'ml'
      const backendQty = isWeight ? item.quantity * 1000 : item.quantity
      return {
        rawMaterial: item.rawMaterial,
        quantity: backendQty,
        receptionPoint: item.sourceReceptionPoint || undefined,
      }
    })

  try {
    await WarehouseService.createBatch({
      type: 'OUT',
      date: combinedDate,
      user: user._id,
      entity: outForm.value.entity,
      responsible: outForm.value.responsible,
      observation: outForm.value.observation,
      items,
    })
    success('Despacho registrado')
    resetOutForm()
    activeTab.value = 'movements'
    await Promise.all([runFetchMovements(), fetchDependencies()])
  } catch (e: any) { showError(e.message || 'Error al guardar') }
  finally { isSubmitting.value = false; stopHold() }
}

const onLossSubmit = async () => {
  isSubmitting.value = true
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
  // Fill the first empty item slot or add a new one
  const emptyIdx = inForm.value.items.findIndex(i => !i.rawMaterial)
  const mat = materials.value.find(m => m._id === (item.material?._id || item.material))
  const unitCost = mat ? getCostPerDisplayUnit(mat) : 0

  const newItem: ReceptionItem = {
    rawMaterial: item.material._id || item.material,
    quantity: item.quantity,
    unitCost,
  }

  if (emptyIdx >= 0) {
    const items = [...inForm.value.items]
    items[emptyIdx] = newItem
    inForm.value = { ...inForm.value, items }
  } else {
    inForm.value = { ...inForm.value, items: [...inForm.value.items, newItem] }
  }

  if (!inForm.value.provider) {
    inForm.value.provider = order.provider?._id || order.provider || ''
  }
  if (!inForm.value.suggestedOrderId) {
    inForm.value.suggestedOrderId = order._id
  }
  if (!inForm.value.observation) {
    inForm.value.observation = `[O.COMPRA #${order._id.slice(-4)}]`
  }
}

// --- Fetch Expiring Invoices ---
const fetchExpiringInvoices = async () => {
  try {
    const data = await WarehouseService.getInvoices(false)
    const invoices: any[] = data.data || []
    const now = new Date()
    expiringInvoiceCount.value = invoices.filter(inv => {
      const due = new Date(inv.invoiceDueDate)
      const daysLeft = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      return daysLeft <= 7
    }).length
  } catch { /* non-critical */ }
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

// --- Lifecycle ---
onMounted(() => {
  fetchDependencies()
  runFetchMovements()
  fetchWarehouseSettings()
  fetchExpiringInvoices()
})

// Auto-fill cost when rawMaterial changes in each reception item
watch(() => inForm.value.items, (items) => {
  items.forEach((item, idx) => {
    if (item.rawMaterial) {
      const mat = materials.value.find(m => m._id === item.rawMaterial)
      if (mat && item.unitCost === 0) {
        const newItems = [...inForm.value.items]
        newItems[idx] = { ...item, unitCost: getCostPerDisplayUnit(mat) }
        inForm.value = { ...inForm.value, items: newItems }
      }
    }
  })
}, { deep: true })

watch(activeTab, (tab) => { if (tab === 'in') fetchTodaySuggestions() })

// Watch outForm items for rawMaterial changes to fetch locationStocks per item
watch(() => outForm.value.items.map(i => i.rawMaterial), async (rawMaterialIds, oldIds) => {
  for (let idx = 0; idx < rawMaterialIds.length; idx++) {
    const id = rawMaterialIds[idx]
    const oldId = oldIds?.[idx]
    if (id && id !== oldId && !locationStocksMap.value[id]) {
      try {
        const stocks = await WarehouseService.getStockByLocation(id)
        locationStocksMap.value = { ...locationStocksMap.value, [id]: stocks }
      } catch { /* non-critical */ }
    }
  }
}, { deep: true })

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

    <!-- Expiring invoice banner -->
    <div v-if="activeTab === 'movements' && expiringInvoiceCount > 0" class="invoice-alert-banner">
      <i class="fas fa-exclamation-triangle"></i>
      <span>
        Tienes <strong>{{ expiringInvoiceCount }} factura{{ expiringInvoiceCount !== 1 ? 's' : '' }}</strong>
        que vence{{ expiringInvoiceCount !== 1 ? 'n' : '' }} pronto o ya venci{{ expiringInvoiceCount !== 1 ? 'eron' : 'ó' }}.
      </span>
      <router-link to="/supply-chain/invoices" class="invoice-alert-link">Ver facturas</router-link>
    </div>

    <!-- Content -->
    <div class="wh-content">
      <WarehouseHistoryTable v-if="activeTab === 'movements'"
        :materials="materials" :movements="movements" :isLoading="isLoading"
        :activeFilters="activeFilters" :currentPage="currentPage" :totalPages="totalPages"
        :aggregates="aggregates" :receptionPoints="receptionPoints"
        @filter="handleFilter" @page-change="handlePageChange"
      />

      <WarehouseReceptionForm v-if="activeTab === 'in'"
        v-model:form="inForm" :materials="materials" :providers="providers"
        :suggestedOrders="suggestedOrders" :isSubmitting="isSubmitting"
        :materialOptions="materialOptions" :filteredProviderOptions="filteredProviderOptions"
        :receptionPointOptions="receptionPointOptions"
        :providerMismatchIndices="providerMismatchIndices"
        @submit="onInSubmit" @apply-suggestion="applySuggestion"
      />

      <WarehouseDispatchForm v-if="activeTab === 'out'"
        v-model:form="outForm" :materials="materials" :materialOptions="materialOptions"
        :entityOptions="entityOptions" :isSubmitting="isSubmitting"
        :holdProgress="holdProgress" :isHolding="isHolding"
        :locationStocksMap="locationStocksMap"
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

// ─── Invoice alert banner ─────────────────────────────────────────────────────

.invoice-alert-banner {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.75rem 1.5rem;
  background: #fffbeb;
  border-bottom: 1px solid #fde68a;
  font-size: 0.88rem;
  color: #92400e;

  @media (min-width: 768px) { padding: 0.75rem 2.5rem; }

  i { color: #d97706; flex-shrink: 0; }
  span { flex: 1; }
}

.invoice-alert-link {
  font-weight: 700;
  color: $NICOLE-PURPLE;
  text-decoration: none;
  white-space: nowrap;
  font-size: 0.82rem;
  padding: 0.25rem 0.6rem;
  background: rgba($NICOLE-PURPLE, 0.08);
  border-radius: 6px;
  transition: background 0.15s;

  &:hover { background: rgba($NICOLE-PURPLE, 0.16); }
}

// ─── Content ──────────────────────────────────────────────────────────────────

.wh-content {
  padding: 1.5rem;

  @media (min-width: 768px) {
    padding: 2rem 2.5rem;
  }
}
</style>
