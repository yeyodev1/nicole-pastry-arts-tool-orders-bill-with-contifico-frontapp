<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
// @ts-ignore
import XLSX from 'xlsx-js-style'
import WarehouseService from '@/services/warehouse.service'
import { posRestockService, type LeftoverRow } from '@/services/pos-restock.service'
import { useBranches } from '@/composables/useBranches'
import { useToast } from '@/composables/useToast'

const { error: showError } = useToast()

const tab = ref<'dispatch' | 'expiring' | 'leftovers'>('dispatch')

// Envíos por rango
const today = new Date()
const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
const toISO = (d: Date) => d.toISOString().slice(0, 10)
const from = ref(toISO(monthStart))
const to = ref(toISO(today))
const entity = ref('')
const summary = ref<any[]>([])
const totals = ref<any>(null)
const isLoadingSummary = ref(false)

// Caducidades
const days = ref(30)
const expiring = ref<any[]>([])
const expiredCount = ref(0)
const isLoadingExpiring = ref(false)

// Sobrantes POS (F10)
const { branchNames, load: loadBranches } = useBranches()
const posFrom = ref(toISO(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6)))
const posTo = ref(toISO(today))
const posBranch = ref('all')
const posProduct = ref('')
const leftovers = ref<LeftoverRow[]>([])
const leftoverTotals = ref<any>(null)
const missingDays = ref<Array<{ date: string; branch: string }>>([])
const isLoadingLeftovers = ref(false)

const filteredLeftovers = computed(() => {
  const q = posProduct.value.trim().toLowerCase()
  if (!q) return leftovers.value
  return leftovers.value.filter(r => r.productName.toLowerCase().includes(q))
})

const fetchLeftovers = async () => {
  if (!posFrom.value || !posTo.value) return
  isLoadingLeftovers.value = true
  try {
    const res = await posRestockService.getLeftovers({
      from: posFrom.value,
      to: posTo.value,
      branch: posBranch.value,
    })
    leftovers.value = res.rows
    leftoverTotals.value = res.totals
    missingDays.value = res.missing
  } catch {
    showError('Error cargando los sobrantes de punto de venta')
  } finally {
    isLoadingLeftovers.value = false
  }
}

const exportLeftovers = () => {
  if (filteredLeftovers.value.length === 0) {
    showError('No hay datos para exportar')
    return
  }
  const rows = filteredLeftovers.value.map(r => ({
    Fecha: r.date,
    Sucursal: r.branch,
    Producto: r.productName,
    Unidad: r.unit,
    'Stock inicial': r.stockInicial ?? 'sin cierre',
    Recibido: r.recibido,
    Bajas: r.bajas,
    'Nota bajas': r.bajasNote || '',
    'Sobrante (cierre)': r.stockFinal,
    'Venta implícita': r.ventaImplicita ?? 'sin cierre previo',
    'Objetivo mañana': r.stockObjectiveTomorrow,
    'Pedido final': r.pedidoFinal,
    Registró: r.submittedBy,
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sobrantes POS')
  XLSX.writeFile(wb, `sobrantes-pos_${posFrom.value}_${posTo.value}.xlsx`)
}

const fetchSummary = async () => {
  if (!from.value || !to.value) return
  isLoadingSummary.value = true
  try {
    const res = await WarehouseService.getDispatchSummary({
      from: from.value,
      to: to.value,
      entity: entity.value || undefined,
    })
    summary.value = res.data || []
    totals.value = res.totals
  } catch {
    showError('Error generando el reporte de envíos')
  } finally {
    isLoadingSummary.value = false
  }
}

const fetchExpiring = async () => {
  isLoadingExpiring.value = true
  try {
    const res = await WarehouseService.getExpiring(days.value)
    expiring.value = res.data || []
    expiredCount.value = res.expired || 0
  } catch {
    showError('Error cargando caducidades')
  } finally {
    isLoadingExpiring.value = false
  }
}

const fmt = (n: number) => (n ?? 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = (d?: string) => d
  ? new Intl.DateTimeFormat('es-EC', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d))
  : '—'

onMounted(() => {
  fetchSummary()
  fetchExpiring()
  loadBranches()
  fetchLeftovers()
})
</script>

<template>
  <div class="wreports-view">
    <div class="rep-header">
      <h1><i class="fas fa-chart-bar"></i> Reportes de Bodega</h1>
      <div class="filter-tabs">
        <button :class="{ active: tab === 'dispatch' }" @click="tab = 'dispatch'">Envíos por rango</button>
        <button :class="{ active: tab === 'expiring' }" @click="tab = 'expiring'">
          Caducidades
          <span v-if="expiredCount" class="alert-dot">{{ expiredCount }}</span>
        </button>
        <button :class="{ active: tab === 'leftovers' }" @click="tab = 'leftovers'">
          Sobrantes POS
          <span v-if="missingDays.length" class="alert-dot">{{ missingDays.length }}</span>
        </button>
      </div>
    </div>

    <!-- Envíos por rango -->
    <section v-if="tab === 'dispatch'">
      <div class="filters">
        <div class="filter">
          <label>Desde</label>
          <input type="date" v-model="from" />
        </div>
        <div class="filter">
          <label>Hasta</label>
          <input type="date" v-model="to" />
        </div>
        <div class="filter grow">
          <label>Destino (opcional)</label>
          <input type="text" v-model="entity" placeholder="Ej. La Creme, Cocina..." />
        </div>
        <button class="btn-primary" @click="fetchSummary">Generar</button>
      </div>

      <div v-if="isLoadingSummary" class="loading-state">
        <div class="spinner"></div>
      </div>

      <template v-else>
        <div class="totals-bar" v-if="totals">
          <span><strong>{{ totals.items }}</strong> ítems distintos</span>
          <span>Valor total: <strong>${{ fmt(totals.totalValue) }}</strong></span>
        </div>

        <div v-if="summary.length === 0" class="empty-state">
          <p>No hay despachos en el rango seleccionado.</p>
        </div>

        <div v-else class="table-wrap">
          <table class="rep-table">
            <thead>
              <tr>
                <th>Destino</th>
                <th>Ítem</th>
                <th class="num">Cantidad</th>
                <th class="num">Valor</th>
                <th class="num">Movimientos</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, idx) in summary" :key="idx">
                <td>{{ row.entity || '—' }}</td>
                <td>{{ row.materialName || '—' }}</td>
                <td class="num">{{ row.totalQuantity }} {{ row.unit }}</td>
                <td class="num">${{ fmt(row.totalValue) }}</td>
                <td class="num">{{ row.movements }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </section>

    <!-- Caducidades -->
    <section v-else-if="tab === 'expiring'">
      <div class="filters">
        <div class="filter">
          <label>Próximos días</label>
          <input type="number" min="1" v-model.number="days" />
        </div>
        <button class="btn-primary" @click="fetchExpiring">Actualizar</button>
      </div>

      <div v-if="isLoadingExpiring" class="loading-state">
        <div class="spinner"></div>
      </div>

      <div v-else-if="expiring.length === 0" class="empty-state">
        <p>No hay lotes próximos a caducar. Registra la fecha de caducidad al ingresar mercadería.</p>
      </div>

      <div v-else class="table-wrap">
        <table class="rep-table">
          <thead>
            <tr>
              <th>Estado</th>
              <th>Materia prima</th>
              <th>Caduca</th>
              <th class="num">Cantidad</th>
              <th>Bodega</th>
              <th>Factura</th>
              <th>Ingresado</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="lot in expiring" :key="lot._id" :class="{ 'row--expired': lot.status === 'EXPIRED' }">
              <td>
                <span class="badge" :class="lot.status === 'EXPIRED' ? 'badge--expired' : 'badge--soon'">
                  {{ lot.status === 'EXPIRED' ? 'Caducado' : 'Por caducar' }}
                </span>
              </td>
              <td>{{ lot.material?.name || '—' }}</td>
              <td><strong>{{ fmtDate(lot.expiryDate) }}</strong></td>
              <td class="num">{{ lot.quantity }} {{ lot.material?.unit }}</td>
              <td>{{ lot.receptionPoint || '—' }}</td>
              <td>{{ lot.invoiceRef || '—' }}</td>
              <td>{{ fmtDate(lot.date) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Sobrantes POS (F10) -->
    <section v-else>
      <div class="filters">
        <div class="filter">
          <label>Desde</label>
          <input type="date" v-model="posFrom" />
        </div>
        <div class="filter">
          <label>Hasta</label>
          <input type="date" v-model="posTo" />
        </div>
        <div class="filter">
          <label>Sucursal</label>
          <select v-model="posBranch">
            <option value="all">Todas</option>
            <option v-for="b in branchNames" :key="b" :value="b">{{ b }}</option>
          </select>
        </div>
        <div class="filter grow">
          <label>Producto (opcional)</label>
          <input type="text" v-model="posProduct" placeholder="Filtrar por nombre..." />
        </div>
        <button class="btn-primary" @click="fetchLeftovers">Generar</button>
        <button class="btn-ghost" @click="exportLeftovers"><i class="fas fa-file-excel"></i> Excel</button>
      </div>

      <div v-if="isLoadingLeftovers" class="loading-state">
        <div class="spinner"></div>
      </div>

      <template v-else>
        <div class="totals-bar" v-if="leftoverTotals">
          <span><strong>{{ leftoverTotals.rows }}</strong> registros</span>
          <span>Sobrante total: <strong>{{ leftoverTotals.stockFinal }}</strong></span>
          <span>Recibido: <strong>{{ leftoverTotals.recibido }}</strong></span>
          <span>Bajas: <strong>{{ leftoverTotals.bajas }}</strong></span>
          <span>Venta implícita: <strong>{{ leftoverTotals.ventaImplicita }}</strong></span>
        </div>

        <div v-if="missingDays.length" class="warn-bar">
          <i class="fas fa-triangle-exclamation"></i>
          <span>
            <strong>{{ missingDays.length }}</strong> día(s) sin cierre registrado —
            no se puede cuadrar inventario:
            <em>{{ missingDays.slice(0, 6).map(m => `${m.branch} ${m.date}`).join(' · ') }}</em>
            <span v-if="missingDays.length > 6"> y {{ missingDays.length - 6 }} más</span>
          </span>
        </div>

        <div v-if="filteredLeftovers.length === 0" class="empty-state">
          <p>No hay cierres de punto de venta en el rango seleccionado.</p>
        </div>

        <div v-else class="table-wrap">
          <table class="rep-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Sucursal</th>
                <th>Producto</th>
                <th class="num">Stock inicial</th>
                <th class="num">Recibido</th>
                <th class="num">Bajas</th>
                <th class="num">Sobrante</th>
                <th class="num">Venta implícita</th>
                <th class="num">Pedido</th>
                <th>Registró</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, idx) in filteredLeftovers" :key="idx">
                <td>{{ fmtDate(row.date) }}</td>
                <td><span class="badge badge--branch">{{ row.branch }}</span></td>
                <td>{{ row.productName }}</td>
                <td class="num">
                  <span v-if="row.stockInicial === null" class="muted">sin cierre</span>
                  <template v-else>{{ row.stockInicial }}</template>
                </td>
                <td class="num">{{ row.recibido }}</td>
                <td class="num" :class="{ 'cell--warn': row.bajas > 0 }" :title="row.bajasNote || ''">{{ row.bajas }}</td>
                <td class="num"><strong>{{ row.stockFinal }}</strong> {{ row.unit }}</td>
                <td class="num">
                  <span v-if="row.ventaImplicita === null" class="muted">—</span>
                  <template v-else>{{ row.ventaImplicita }}</template>
                </td>
                <td class="num">{{ row.pedidoFinal }}</td>
                <td>{{ row.submittedBy }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </section>
  </div>
</template>

<style lang="scss" scoped>
.wreports-view {
  padding: 1.5rem;
  max-width: 1100px;
  margin: 0 auto;
}

.rep-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1.25rem;

  h1 {
    font-size: 1.4rem;
    margin: 0;
    i { color: #7c3aed; margin-right: 0.5rem; }
  }
}

.filter-tabs {
  display: flex;
  gap: 0.4rem;

  button {
    position: relative;
    padding: 0.45rem 1rem;
    border: 1px solid #d1d5db;
    background: white;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.85rem;

    &.active { background: #7c3aed; color: white; border-color: #7c3aed; }
  }
}

.alert-dot {
  background: #dc2626;
  color: white;
  border-radius: 999px;
  font-size: 0.68rem;
  padding: 0.05rem 0.4rem;
  margin-left: 0.3rem;
}

.filters {
  display: flex;
  gap: 0.75rem;
  align-items: flex-end;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.filter {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;

  &.grow { flex: 1; min-width: 180px; }

  label { font-size: 0.78rem; font-weight: 600; color: #4b5563; }
  input {
    padding: 0.45rem 0.7rem;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 0.9rem;
  }
}

.btn-primary {
  background: #7c3aed;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 0.5rem 1rem;
  font-weight: 600;
  cursor: pointer;

  &:hover { background: #6d28d9; }
}

.totals-bar {
  display: flex;
  gap: 1.5rem;
  background: #ede9fe;
  color: #4c1d95;
  border-radius: 10px;
  padding: 0.6rem 1rem;
  font-size: 0.9rem;
  margin-bottom: 1rem;
}

.table-wrap {
  overflow-x: auto;
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}

.rep-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;

  th, td {
    padding: 0.65rem 0.9rem;
    text-align: left;
    border-bottom: 1px solid #f3f4f6;
  }
  th { background: #f9fafb; font-weight: 700; color: #4b5563; white-space: nowrap; }
  .num { text-align: right; white-space: nowrap; }

  .row--expired { background: #fff5f5; }
}

.badge {
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;

  &.badge--expired { background: #fee2e2; color: #b91c1c; }
  &.badge--soon { background: #fef3c7; color: #b45309; }
}

.loading-state, .empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: #6b7280;
}

.spinner {
  width: 36px;
  height: 36px;
  border: 3px solid #e5e7eb;
  border-top-color: #7c3aed;
  border-radius: 50%;
  margin: 0 auto;
  animation: spin 0.8s linear infinite;
}

.btn-ghost {
  background: white;
  color: #4c1d95;
  border: 1px solid #c4b5fd;
  border-radius: 8px;
  padding: 0.5rem 0.9rem;
  font-weight: 600;
  cursor: pointer;

  &:hover { background: #f5f3ff; }
  i { margin-right: 0.35rem; }
}

.warn-bar {
  display: flex;
  gap: 0.6rem;
  align-items: flex-start;
  background: #fef3c7;
  color: #92400e;
  border-radius: 10px;
  padding: 0.6rem 1rem;
  font-size: 0.85rem;
  margin-bottom: 1rem;

  em { font-style: normal; opacity: 0.85; }
}

.muted { color: #9ca3af; font-size: 0.8rem; }
.cell--warn { color: #b45309; font-weight: 700; }

.badge--branch { background: #ede9fe; color: #5b21b6; }

.filter select {
  padding: 0.45rem 0.7rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.9rem;
  background: white;
}

@keyframes spin { to { transform: rotate(360deg); } }
</style>
