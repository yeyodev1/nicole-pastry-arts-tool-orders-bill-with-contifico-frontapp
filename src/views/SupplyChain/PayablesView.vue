<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import PayablesService, { type Payable } from '@/services/payables.service'
import { useToast } from '@/composables/useToast'

const { error: showError } = useToast()

const payables = ref<Payable[]>([])
const summary = ref<any>(null)
const isLoading = ref(false)
const source = ref<'nicole' | 'sucree'>('nicole')
const search = ref('')
const showPaid = ref(false)

const filtered = computed(() =>
  payables.value.filter(p => {
    if (!showPaid.value && p.urgency === 'PAID') return false
    if (!search.value) return true
    const q = search.value.toLowerCase()
    return p.proveedor.toLowerCase().includes(q) || (p.ruc || '').includes(q) || (p.documento || '').toLowerCase().includes(q)
  })
)

const urgencyLabel: Record<string, string> = {
  OVERDUE: 'Vencida',
  DUE_SOON: 'Vence pronto',
  OK: 'Al día',
  PAID: 'Pagada',
}

const fetchPayables = async () => {
  isLoading.value = true
  try {
    const res = await PayablesService.getPayables({ source: source.value })
    payables.value = res.data || []
    summary.value = res.summary
  } catch {
    showError('Error cargando cuentas por pagar desde Contífico')
  } finally {
    isLoading.value = false
  }
}

const fmt = (n: number) => (n ?? 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

onMounted(fetchPayables)
watch(source, fetchPayables)
</script>

<template>
  <div class="payables-view">
    <div class="pay-header">
      <div class="pay-title">
        <h1><i class="fas fa-hand-holding-usd"></i> Cuentas por Pagar</h1>
        <p>Facturas de proveedores desde Contífico, con semáforo de vencimiento</p>
      </div>
      <div class="pay-actions">
        <select v-model="source" class="source-select">
          <option value="nicole">Nicole</option>
          <option value="sucree">Sucree</option>
        </select>
        <label class="toggle-paid">
          <input type="checkbox" v-model="showPaid" />
          <span>Mostrar pagadas</span>
        </label>
      </div>
    </div>

    <div class="status-chips" v-if="summary">
      <div class="status-chip chip-overdue">
        <i class="fas fa-exclamation-circle"></i>
        <span>{{ summary.overdue }}</span> vencida{{ summary.overdue !== 1 ? 's' : '' }}
      </div>
      <div class="status-chip chip-expiring">
        <i class="fas fa-clock"></i>
        <span>{{ summary.dueSoon }}</span> vence pronto
      </div>
      <div class="status-chip chip-ok">
        <i class="fas fa-check-circle"></i>
        <span>{{ summary.ok }}</span> al día
      </div>
      <div class="status-chip chip-total">
        <i class="fas fa-dollar-sign"></i>
        Pendiente: ${{ fmt(summary.totalPendingAmount) }}
      </div>
    </div>

    <div class="search-bar">
      <i class="fas fa-search"></i>
      <input v-model="search" type="text" placeholder="Buscar por proveedor, RUC o documento..." />
    </div>

    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <p>Consultando Contífico...</p>
    </div>

    <div v-else-if="filtered.length === 0" class="empty-state">
      <i class="fas fa-file-invoice"></i>
      <p>No hay facturas por pagar</p>
    </div>

    <div v-else class="pay-table-wrap">
      <table class="pay-table">
        <thead>
          <tr>
            <th>Estado</th>
            <th>Proveedor</th>
            <th>Documento</th>
            <th>Emisión</th>
            <th>Vencimiento</th>
            <th>Crédito</th>
            <th class="num">Total</th>
            <th class="num">Saldo</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in filtered" :key="p.contificoId" :class="`row--${p.urgency.toLowerCase()}`">
            <td>
              <span class="badge" :class="`badge--${p.urgency.toLowerCase()}`">{{ urgencyLabel[p.urgency] }}</span>
            </td>
            <td>
              <strong>{{ p.proveedor }}</strong>
              <div class="ruc" v-if="p.ruc">{{ p.ruc }}</div>
            </td>
            <td>{{ p.documento || '—' }}</td>
            <td>{{ p.fechaEmision || '—' }}</td>
            <td>{{ p.fechaVencimiento || '—' }}</td>
            <td>{{ p.creditDays !== null ? `${p.creditDays} días` : '—' }}</td>
            <td class="num">${{ fmt(p.total) }}</td>
            <td class="num">${{ fmt(p.saldo ?? p.total) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.payables-view {
  padding: 1.5rem;
  max-width: 1200px;
  margin: 0 auto;
}

.pay-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;

  h1 {
    font-size: 1.4rem;
    margin: 0 0 0.25rem;
    i { color: #7c3aed; margin-right: 0.5rem; }
  }
  p { color: #6b7280; margin: 0; font-size: 0.9rem; }
}

.pay-actions {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.source-select {
  padding: 0.45rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-weight: 600;
}

.toggle-paid {
  display: flex;
  gap: 0.4rem;
  align-items: center;
  font-size: 0.9rem;
  cursor: pointer;
}

.status-chips {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.status-chip {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.8rem;
  border-radius: 999px;
  font-size: 0.85rem;
  font-weight: 600;

  &.chip-overdue { background: #fee2e2; color: #b91c1c; }
  &.chip-expiring { background: #fef3c7; color: #b45309; }
  &.chip-ok { background: #d1fae5; color: #047857; }
  &.chip-total { background: #ede9fe; color: #6d28d9; }
}

.search-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 0.5rem 0.9rem;
  margin-bottom: 1rem;

  i { color: #9ca3af; }
  input {
    border: none;
    outline: none;
    flex: 1;
    font-size: 0.95rem;
  }
}

.pay-table-wrap {
  overflow-x: auto;
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}

.pay-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;

  th, td {
    padding: 0.7rem 0.9rem;
    text-align: left;
    border-bottom: 1px solid #f3f4f6;
  }
  th {
    background: #f9fafb;
    font-weight: 700;
    color: #4b5563;
    white-space: nowrap;
  }
  .num { text-align: right; white-space: nowrap; }
  .ruc { font-size: 0.78rem; color: #9ca3af; }

  .row--overdue { background: #fff5f5; }
  .row--due_soon { background: #fffbeb; }
}

.badge {
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  white-space: nowrap;

  &.badge--overdue { background: #fee2e2; color: #b91c1c; }
  &.badge--due_soon { background: #fef3c7; color: #b45309; }
  &.badge--ok { background: #d1fae5; color: #047857; }
  &.badge--paid { background: #e5e7eb; color: #4b5563; }
}

.loading-state, .empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: #6b7280;

  i { font-size: 2rem; margin-bottom: 0.5rem; color: #d1d5db; }
}

.spinner {
  width: 36px;
  height: 36px;
  border: 3px solid #e5e7eb;
  border-top-color: #7c3aed;
  border-radius: 50%;
  margin: 0 auto 0.75rem;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }
</style>
