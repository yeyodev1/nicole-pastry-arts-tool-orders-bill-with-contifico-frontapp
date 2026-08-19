<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import SupplierOrderService from '@/services/supplier-order.service'
import { useToast } from '@/composables/useToast'

const { success, error: showError } = useToast()

const arriving = ref<any[]>([])
const pendingOrders = ref<any[]>([])
const isLoading = ref(false)

// Modal de recepción
const receivingOrder = ref<any | null>(null)
const receivedBy = ref('')
const receptionNotes = ref('')
const invoiceRef = ref('')
const itemChecks = ref<{ itemId: string; name: string; quantity: number; unit: string; quantityReceived: number; itemStatus: string; itemNote: string }[]>([])
const isSaving = ref(false)

const userName = computed(() => {
  try {
    return JSON.parse(localStorage.getItem('user_info') || '{}')?.name || ''
  } catch { return '' }
})

const fetchData = async () => {
  isLoading.value = true
  try {
    const [today, pending] = await Promise.all([
      SupplierOrderService.getArrivingToday(),
      SupplierOrderService.getOrders({ status: 'SENT', limit: 100 }),
    ])
    arriving.value = today.orders || []
    const arrivingIds = new Set(arriving.value.map((o: any) => o._id))
    pendingOrders.value = (pending.orders || []).filter((o: any) => !arrivingIds.has(o._id))
  } catch {
    showError('Error cargando pedidos por recibir')
  } finally {
    isLoading.value = false
  }
}

const openReception = (order: any) => {
  receivingOrder.value = order
  receivedBy.value = userName.value
  receptionNotes.value = ''
  invoiceRef.value = ''
  itemChecks.value = (order.items || []).map((i: any) => ({
    itemId: i._id,
    name: i.name,
    quantity: i.quantity,
    unit: i.unit,
    quantityReceived: i.quantity,
    itemStatus: 'OK',
    itemNote: '',
  }))
}

const submitReception = async () => {
  if (!receivingOrder.value) return
  if (!receivedBy.value.trim()) {
    showError('Indica quién recibe (firma).')
    return
  }
  isSaving.value = true
  try {
    const items = itemChecks.value.map(c => ({
      itemId: c.itemId,
      quantityReceived: c.quantityReceived,
      itemStatus: c.quantityReceived < c.quantity ? 'MISSING' : c.itemStatus,
      itemNote: c.itemNote || undefined,
    }))
    await SupplierOrderService.receiveOrder(receivingOrder.value._id, {
      receivedBy: receivedBy.value.trim(),
      receptionNotes: receptionNotes.value || undefined,
      invoiceRef: invoiceRef.value || undefined,
      items,
    })
    success('Recepción registrada')
    receivingOrder.value = null
    await fetchData()
  } catch (e: any) {
    showError(e?.message || 'Error registrando recepción')
  } finally {
    isSaving.value = false
  }
}

const fmtDate = (d: string) =>
  new Intl.DateTimeFormat('es-EC', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(d))

onMounted(fetchData)
</script>

<template>
  <div class="receptions-view">
    <div class="rec-header">
      <h1><i class="fas fa-truck-loading"></i> Recepción de Mercadería</h1>
      <p>Pedidos a proveedores que llegan hoy y pendientes de recibir</p>
    </div>

    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <p>Cargando...</p>
    </div>

    <template v-else>
      <!-- Llega hoy -->
      <section class="section">
        <h2 class="section-title today">
          <i class="fas fa-bell"></i> Llega hoy ({{ arriving.length }})
        </h2>
        <div v-if="arriving.length === 0" class="empty-inline">Nada programado para hoy.</div>
        <div class="cards">
          <div v-for="order in arriving" :key="order._id" class="order-card card--today">
            <div class="card-head">
              <strong>{{ order.provider?.name || 'Proveedor' }}</strong>
              <span class="date-chip">{{ fmtDate(order.deliveryDate) }}</span>
            </div>
            <ul class="items-list">
              <li v-for="item in order.items" :key="item._id">
                {{ item.quantity }} {{ item.unit }} — {{ item.name }}
              </li>
            </ul>
            <button class="btn-receive" @click="openReception(order)">
              <i class="fas fa-check"></i> Marcar recibido
            </button>
          </div>
        </div>
      </section>

      <!-- Pendientes -->
      <section class="section">
        <h2 class="section-title">
          <i class="fas fa-hourglass-half"></i> Otros pedidos enviados ({{ pendingOrders.length }})
        </h2>
        <div v-if="pendingOrders.length === 0" class="empty-inline">Sin pedidos pendientes.</div>
        <div class="cards">
          <div v-for="order in pendingOrders" :key="order._id" class="order-card">
            <div class="card-head">
              <strong>{{ order.provider?.name || 'Proveedor' }}</strong>
              <span class="date-chip">{{ fmtDate(order.deliveryDate) }}</span>
            </div>
            <ul class="items-list">
              <li v-for="item in order.items" :key="item._id">
                {{ item.quantity }} {{ item.unit }} — {{ item.name }}
              </li>
            </ul>
            <button class="btn-receive" @click="openReception(order)">
              <i class="fas fa-check"></i> Marcar recibido
            </button>
          </div>
        </div>
      </section>
    </template>

    <!-- Modal recepción -->
    <div v-if="receivingOrder" class="modal-overlay" @click.self="receivingOrder = null">
      <div class="modal">
        <h3>Recepción — {{ receivingOrder.provider?.name }}</h3>

        <div class="check-table-wrap">
          <table class="check-table">
            <thead>
              <tr>
                <th>Ítem</th>
                <th>Pedido</th>
                <th>Recibido</th>
                <th>Nota</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="check in itemChecks" :key="check.itemId">
                <td>{{ check.name }}</td>
                <td>{{ check.quantity }} {{ check.unit }}</td>
                <td>
                  <input type="number" min="0" v-model.number="check.quantityReceived" class="qty-input" />
                </td>
                <td>
                  <input type="text" v-model="check.itemNote" placeholder="Opcional" class="note-input" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="form-row">
          <label>Recibido por (firma) *</label>
          <input type="text" v-model="receivedBy" placeholder="Nombre de quien recibe" />
        </div>
        <div class="form-row">
          <label>N° factura del proveedor</label>
          <input type="text" v-model="invoiceRef" placeholder="Ej. 001-001-000012345" />
        </div>
        <div class="form-row">
          <label>Notas de recepción</label>
          <textarea v-model="receptionNotes" rows="2" placeholder="Novedades, faltantes, estado de la mercadería..."></textarea>
        </div>

        <div class="modal-actions">
          <button class="btn-cancel" @click="receivingOrder = null">Cancelar</button>
          <button class="btn-confirm" :disabled="isSaving" @click="submitReception">
            <i class="fas fa-signature"></i> {{ isSaving ? 'Guardando...' : 'Confirmar recepción' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.receptions-view {
  padding: 1.5rem;
  max-width: 1100px;
  margin: 0 auto;
}

.rec-header {
  margin-bottom: 1.25rem;
  h1 {
    font-size: 1.4rem;
    margin: 0 0 0.25rem;
    i { color: #7c3aed; margin-right: 0.5rem; }
  }
  p { color: #6b7280; margin: 0; font-size: 0.9rem; }
}

.section { margin-bottom: 1.75rem; }

.section-title {
  font-size: 1.05rem;
  margin-bottom: 0.75rem;
  color: #374151;
  i { margin-right: 0.4rem; }
  &.today i { color: #d97706; }
}

.empty-inline {
  color: #9ca3af;
  font-size: 0.9rem;
  padding: 0.5rem 0;
}

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.order-card {
  background: white;
  border-radius: 12px;
  padding: 1rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  display: flex;
  flex-direction: column;
  gap: 0.6rem;

  &.card--today { border-left: 4px solid #d97706; }
}

.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}

.date-chip {
  background: #f3f4f6;
  border-radius: 999px;
  padding: 0.15rem 0.6rem;
  font-size: 0.78rem;
  color: #4b5563;
  white-space: nowrap;
}

.items-list {
  margin: 0;
  padding-left: 1.1rem;
  font-size: 0.85rem;
  color: #4b5563;
  max-height: 120px;
  overflow-y: auto;
}

.btn-receive {
  align-self: flex-start;
  background: #7c3aed;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 0.45rem 0.9rem;
  font-weight: 600;
  cursor: pointer;
  font-size: 0.85rem;

  &:hover { background: #6d28d9; }
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 1rem;
}

.modal {
  background: white;
  border-radius: 14px;
  padding: 1.25rem;
  width: 100%;
  max-width: 640px;
  max-height: 90vh;
  overflow-y: auto;

  h3 { margin: 0 0 1rem; }
}

.check-table-wrap { overflow-x: auto; margin-bottom: 1rem; }

.check-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;

  th, td {
    padding: 0.45rem 0.6rem;
    border-bottom: 1px solid #f3f4f6;
    text-align: left;
  }
  th { background: #f9fafb; }
}

.qty-input { width: 80px; padding: 0.3rem; border: 1px solid #d1d5db; border-radius: 6px; }
.note-input { width: 100%; padding: 0.3rem; border: 1px solid #d1d5db; border-radius: 6px; }

.form-row {
  margin-bottom: 0.75rem;
  label {
    display: block;
    font-size: 0.82rem;
    font-weight: 600;
    color: #4b5563;
    margin-bottom: 0.25rem;
  }
  input, textarea {
    width: 100%;
    padding: 0.5rem 0.7rem;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 0.9rem;
  }
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
  margin-top: 1rem;
}

.btn-cancel {
  background: #f3f4f6;
  border: none;
  border-radius: 8px;
  padding: 0.5rem 1rem;
  cursor: pointer;
}

.btn-confirm {
  background: #059669;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 0.5rem 1rem;
  font-weight: 600;
  cursor: pointer;

  &:disabled { opacity: 0.6; cursor: default; }
  &:hover:not(:disabled) { background: #047857; }
}

.loading-state {
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
  margin: 0 auto 0.75rem;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }
</style>
