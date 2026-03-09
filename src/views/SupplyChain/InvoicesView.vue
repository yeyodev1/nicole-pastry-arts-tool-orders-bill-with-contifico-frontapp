<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import WarehouseService from '@/services/warehouse.service'
import { useToast } from '@/composables/useToast'
import type { InvoiceGroup } from '@/types/warehouse'

const { success, error: showError } = useToast()

const invoices = ref<InvoiceGroup[]>([])
const isLoading = ref(false)
const showPaid = ref(false)

const now = new Date()

const enriched = computed(() =>
  invoices.value.map(inv => {
    const due = new Date(inv.invoiceDueDate)
    const msLeft = due.getTime() - now.getTime()
    const daysUntilDue = Math.ceil(msLeft / (1000 * 60 * 60 * 24))
    const status: 'overdue' | 'expiring' | 'ok' =
      daysUntilDue < 0 ? 'overdue' : daysUntilDue <= 7 ? 'expiring' : 'ok'
    return { ...inv, daysUntilDue, status }
  })
)

const counts = computed(() => ({
  overdue:  enriched.value.filter(i => i.status === 'overdue').length,
  expiring: enriched.value.filter(i => i.status === 'expiring').length,
  ok:       enriched.value.filter(i => i.status === 'ok').length,
}))

const fetchInvoices = async () => {
  isLoading.value = true
  try {
    const data = await WarehouseService.getInvoices(showPaid.value)
    invoices.value = data.data || []
  } catch { showError('Error cargando facturas') }
  finally { isLoading.value = false }
}

const markPaid = async (invoiceRef: string) => {
  try {
    await WarehouseService.markInvoicePaid(invoiceRef)
    success('Factura marcada como pagada')
    await fetchInvoices()
  } catch { showError('Error al marcar factura') }
}

const formatDate = (d: string) =>
  new Intl.DateTimeFormat('es-EC', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(d))

const fmt = (n: number) => n.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

onMounted(fetchInvoices)
watch(showPaid, fetchInvoices)
</script>

<template>
  <div class="invoices-view">
    <!-- Header -->
    <div class="inv-header">
      <div class="inv-title">
        <h1><i class="fas fa-file-invoice-dollar"></i> Facturas de Compra</h1>
        <p>Control de pagos y vencimientos de facturas de proveedores</p>
      </div>
      <label class="toggle-paid">
        <input type="checkbox" v-model="showPaid" />
        <span>Mostrar pagadas</span>
      </label>
    </div>

    <!-- Status chips -->
    <div class="status-chips" v-if="!isLoading && enriched.length > 0">
      <div class="status-chip chip-overdue">
        <i class="fas fa-exclamation-circle"></i>
        <span>{{ counts.overdue }}</span> vencida{{ counts.overdue !== 1 ? 's' : '' }}
      </div>
      <div class="status-chip chip-expiring">
        <i class="fas fa-clock"></i>
        <span>{{ counts.expiring }}</span> vence pronto
      </div>
      <div class="status-chip chip-ok">
        <i class="fas fa-check-circle"></i>
        <span>{{ counts.ok }}</span> al día
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <p>Cargando facturas...</p>
    </div>

    <!-- Empty -->
    <div v-else-if="enriched.length === 0" class="empty-state">
      <i class="fas fa-file-invoice"></i>
      <p>No hay facturas{{ showPaid ? '' : ' pendientes' }}</p>
    </div>

    <!-- Invoice cards -->
    <div v-else class="invoices-grid">
      <div
        v-for="inv in enriched"
        :key="inv._id"
        class="invoice-card"
        :class="`invoice-card--${inv.status}`"
      >
        <!-- Card header -->
        <div class="inv-card-header">
          <div class="inv-ref">
            <i class="fas fa-file-invoice-dollar"></i>
            <span>{{ inv._id }}</span>
          </div>
          <div class="inv-status-badge" :class="`badge--${inv.status}`">
            <template v-if="inv.isPaid">
              <i class="fas fa-check-circle"></i> Pagada
            </template>
            <template v-else-if="inv.status === 'overdue'">
              <i class="fas fa-exclamation-circle"></i> Vencida hace {{ Math.abs(inv.daysUntilDue!) }} día{{ Math.abs(inv.daysUntilDue!) !== 1 ? 's' : '' }}
            </template>
            <template v-else-if="inv.status === 'expiring'">
              <i class="fas fa-clock"></i> Vence en {{ inv.daysUntilDue }} día{{ inv.daysUntilDue !== 1 ? 's' : '' }}
            </template>
            <template v-else>
              <i class="fas fa-check"></i> Al día
            </template>
          </div>
        </div>

        <!-- Card body -->
        <div class="inv-card-body">
          <div class="inv-meta">
            <div class="inv-meta-item">
              <span class="inv-meta-label"><i class="fas fa-store"></i> Proveedor</span>
              <span class="inv-meta-value">{{ inv.provider?.name ?? 'Sin proveedor' }}</span>
            </div>
            <div class="inv-meta-item">
              <span class="inv-meta-label"><i class="fas fa-calendar-alt"></i> Fecha límite</span>
              <span class="inv-meta-value">{{ formatDate(inv.invoiceDueDate) }}</span>
            </div>
            <div class="inv-meta-item">
              <span class="inv-meta-label"><i class="fas fa-boxes"></i> Materiales</span>
              <span class="inv-meta-value">{{ inv.count }} movimiento{{ inv.count !== 1 ? 's' : '' }}</span>
            </div>
          </div>

          <div class="inv-total">
            <span class="inv-total-label">Total Factura</span>
            <span class="inv-total-amount">${{ fmt(inv.totalValue) }}</span>
          </div>
        </div>

        <!-- Card footer -->
        <div class="inv-card-footer">
          <button
            v-if="!inv.isPaid"
            class="btn-mark-paid"
            @click="markPaid(inv._id)"
          >
            <i class="fas fa-check"></i> Marcar como pagada
          </button>
          <span v-else class="paid-label">
            <i class="fas fa-check-double"></i> Pagada
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.invoices-view {
  width: 100%;
  min-height: 100vh;
  background: var(--color-background);
}

.inv-header {
  padding: 1.75rem 1.5rem 0;
  display: flex; align-items: flex-start; justify-content: space-between;
  flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem;

  @media (min-width: 768px) { padding: 2rem 2.5rem 0; }
}

.inv-title {
  h1 {
    margin: 0; font-size: 1.75rem; font-weight: 800;
    color: $NICOLE-PURPLE; letter-spacing: -0.5px;
    display: flex; align-items: center; gap: 0.65rem;
    i { font-size: 1.4rem; opacity: 0.85; }
  }
  p { margin: 0.35rem 0 0; color: #64748b; font-size: 0.9rem; font-weight: 500; }
}

.toggle-paid {
  display: flex; align-items: center; gap: 0.5rem;
  font-size: 0.88rem; font-weight: 600; color: #475569; cursor: pointer;
  input { width: 16px; height: 16px; accent-color: $NICOLE-PURPLE; cursor: pointer; }
}

.status-chips {
  display: flex; gap: 0.75rem; flex-wrap: wrap;
  padding: 0 1.5rem 1.5rem;
  @media (min-width: 768px) { padding: 0 2.5rem 1.5rem; }
}

.status-chip {
  display: inline-flex; align-items: center; gap: 0.4rem;
  padding: 0.4rem 0.9rem; border-radius: 20px;
  font-size: 0.82rem; font-weight: 700;
  span { font-size: 1rem; font-weight: 800; }

  &.chip-overdue  { background: #fee2e2; color: #991b1b; }
  &.chip-expiring { background: #fef3c7; color: #92400e; }
  &.chip-ok       { background: #d1fae5; color: #065f46; }
}

.loading-state, .empty-state {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: 4rem 2rem; color: #94a3b8;
  i { font-size: 2.5rem; margin-bottom: 1rem; opacity: 0.4; }
  p { margin: 0; font-size: 0.95rem; }
}

.spinner {
  width: 40px; height: 40px; border-radius: 50%;
  border: 3px solid rgba($NICOLE-PURPLE, 0.2);
  border-top-color: $NICOLE-PURPLE;
  animation: spin 0.9s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin { to { transform: rotate(360deg); } }

.invoices-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
  padding: 0 1.5rem 2rem;

  @media (min-width: 640px)  { grid-template-columns: repeat(2, 1fr); }
  @media (min-width: 1024px) { grid-template-columns: repeat(3, 1fr); padding: 0 2.5rem 2rem; }
}

.invoice-card {
  background: white; border-radius: 14px;
  border: 1px solid $border-light; border-left-width: 4px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  overflow: hidden; display: flex; flex-direction: column;
  transition: box-shadow 0.2s;

  &:hover { box-shadow: 0 6px 20px rgba(0,0,0,0.09); }
  &--overdue  { border-left-color: #dc2626; }
  &--expiring { border-left-color: #d97706; }
  &--ok       { border-left-color: #059669; }
}

.inv-card-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1rem 1.25rem 0.75rem; gap: 0.5rem;
  border-bottom: 1px solid #f1f5f9;
  flex-wrap: wrap;
}

.inv-ref {
  display: flex; align-items: center; gap: 0.5rem;
  font-size: 0.95rem; font-weight: 800; color: #1e293b;
  i { color: $NICOLE-PURPLE; }
}

.inv-status-badge {
  display: inline-flex; align-items: center; gap: 0.3rem;
  padding: 0.25rem 0.65rem; border-radius: 20px;
  font-size: 0.75rem; font-weight: 700;

  &.badge--overdue  { background: #fee2e2; color: #991b1b; }
  &.badge--expiring { background: #fef3c7; color: #92400e; }
  &.badge--ok       { background: #d1fae5; color: #065f46; }
  &.badge--paid     { background: #f0fdf4; color: #059669; }
}

.inv-card-body {
  padding: 1rem 1.25rem; flex: 1;
  display: flex; flex-direction: column; gap: 0.75rem;
}

.inv-meta { display: flex; flex-direction: column; gap: 0.4rem; }

.inv-meta-item {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 0.85rem;
}

.inv-meta-label {
  color: #94a3b8; font-weight: 500;
  display: flex; align-items: center; gap: 0.35rem;
  i { font-size: 0.75rem; }
}

.inv-meta-value { font-weight: 600; color: #334155; }

.inv-total {
  display: flex; justify-content: space-between; align-items: center;
  background: #f8fafc; border-radius: 10px; padding: 0.75rem 1rem;
  margin-top: 0.25rem;
}

.inv-total-label { font-size: 0.78rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.4px; }
.inv-total-amount { font-size: 1.2rem; font-weight: 800; color: #1e293b; }

.inv-card-footer {
  padding: 0.75rem 1.25rem;
  border-top: 1px solid #f1f5f9;
  display: flex; justify-content: flex-end;
}

.btn-mark-paid {
  display: inline-flex; align-items: center; gap: 0.4rem;
  padding: 0.5rem 1.1rem; border: none; border-radius: 8px;
  background: $NICOLE-PURPLE; color: white;
  font-size: 0.85rem; font-weight: 700; cursor: pointer;
  transition: all 0.15s;

  &:hover { opacity: 0.88; }
}

.paid-label {
  display: inline-flex; align-items: center; gap: 0.4rem;
  font-size: 0.85rem; font-weight: 700; color: #059669;
}
</style>
