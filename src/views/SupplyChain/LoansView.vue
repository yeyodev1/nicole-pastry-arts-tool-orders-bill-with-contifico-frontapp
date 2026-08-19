<script setup lang="ts">
import { ref, onMounted } from 'vue'
import WarehouseLoanService, { type WarehouseLoan } from '@/services/warehouse-loan.service'
import WarehouseSettingsService from '@/services/warehouse-settings.service'
import RawMaterialService from '@/services/raw-material.service'
import { useToast } from '@/composables/useToast'

const { success, error: showError } = useToast()

const loans = ref<WarehouseLoan[]>([])
const isLoading = ref(false)
const points = ref<string[]>([])

// Crear préstamo
const showCreate = ref(false)
const fromPoint = ref('')
const toPoint = ref('')
const responsible = ref('')
const notes = ref('')
const materials = ref<any[]>([])
const materialSearch = ref('')
const loanItems = ref<{ material: string; name: string; quantity: number; unit: string }[]>([])
const isSaving = ref(false)

// Devolución
const returning = ref<WarehouseLoan | null>(null)
const returnItems = ref<{ itemId: string; name: string; pending: number; unit: string; quantityReturned: number }[]>([])

const statusLabel: Record<string, string> = {
  LENT: 'Prestado',
  PARTIALLY_RETURNED: 'Devolución parcial',
  RETURNED: 'Devuelto',
  WRITTEN_OFF: 'Deuda asumida',
}

const fetchLoans = async () => {
  isLoading.value = true
  try {
    const res = await WarehouseLoanService.getLoans()
    loans.value = res.loans || []
  } catch {
    showError('Error cargando préstamos')
  } finally {
    isLoading.value = false
  }
}

const fetchPoints = async () => {
  try {
    const settings: any = await WarehouseSettingsService.getSettings()
    const rec = (settings?.receptionPoints || []).filter((p: any) => p.isActive).map((p: any) => p.name)
    points.value = rec
  } catch { /* puntos opcionales */ }
}

const searchMaterials = async () => {
  try {
    materials.value = await RawMaterialService.getRawMaterials(materialSearch.value || undefined)
  } catch { /* noop */ }
}

const addItem = (material: any) => {
  if (loanItems.value.some(i => i.material === material._id)) return
  loanItems.value.push({ material: material._id, name: material.name, quantity: 1, unit: material.unit })
}

const removeItem = (idx: number) => loanItems.value.splice(idx, 1)

const submitLoan = async () => {
  if (!fromPoint.value || !toPoint.value) {
    showError('Selecciona bodega origen y destino.')
    return
  }
  if (fromPoint.value === toPoint.value) {
    showError('Origen y destino no pueden ser la misma bodega.')
    return
  }
  if (!loanItems.value.length) {
    showError('Agrega al menos un ítem.')
    return
  }
  isSaving.value = true
  try {
    await WarehouseLoanService.createLoan({
      fromPoint: fromPoint.value,
      toPoint: toPoint.value,
      items: loanItems.value,
      responsible: responsible.value || undefined,
      notes: notes.value || undefined,
    })
    success('Préstamo registrado y stock trasladado')
    showCreate.value = false
    loanItems.value = []
    notes.value = ''
    await fetchLoans()
  } catch (e: any) {
    showError(e?.message || 'Error registrando préstamo')
  } finally {
    isSaving.value = false
  }
}

const openReturn = (loan: WarehouseLoan) => {
  returning.value = loan
  returnItems.value = loan.items
    .filter((i: any) => i.quantity - i.quantityReturned > 0)
    .map((i: any) => ({
      itemId: i._id,
      name: i.name,
      pending: i.quantity - i.quantityReturned,
      unit: i.unit,
      quantityReturned: i.quantity - i.quantityReturned,
    }))
}

const submitReturn = async () => {
  if (!returning.value) return
  isSaving.value = true
  try {
    await WarehouseLoanService.returnLoan(returning.value._id, {
      items: returnItems.value.map(r => ({ itemId: r.itemId, quantityReturned: r.quantityReturned })),
    })
    success('Devolución registrada')
    returning.value = null
    await fetchLoans()
  } catch (e: any) {
    showError(e?.message || 'Error registrando devolución')
  } finally {
    isSaving.value = false
  }
}

const writeOff = async (loan: WarehouseLoan) => {
  try {
    await WarehouseLoanService.writeOff(loan._id, 'Baja manual desde vista de préstamos')
    success('Préstamo dado de baja (deuda asumida)')
    await fetchLoans()
  } catch (e: any) {
    showError(e?.message || 'Error dando de baja')
  }
}

const fmtDate = (d?: string) => d
  ? new Intl.DateTimeFormat('es-EC', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d))
  : '—'

onMounted(() => {
  fetchLoans()
  fetchPoints()
  searchMaterials()
})
</script>

<template>
  <div class="loans-view">
    <div class="loans-header">
      <div>
        <h1><i class="fas fa-exchange-alt"></i> Préstamos entre Bodegas</h1>
        <p>Traspasos Nicole ↔ Sucree ↔ otras bodegas — se devuelve en la misma unidad</p>
      </div>
      <button class="btn-primary" @click="showCreate = true">
        <i class="fas fa-plus"></i> Nuevo préstamo
      </button>
    </div>

    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <p>Cargando...</p>
    </div>

    <div v-else-if="loans.length === 0" class="empty-state">
      <i class="fas fa-exchange-alt"></i>
      <p>No hay préstamos registrados</p>
    </div>

    <div v-else class="loan-cards">
      <div v-for="loan in loans" :key="loan._id" class="loan-card" :class="`card--${loan.status.toLowerCase()}`">
        <div class="card-head">
          <strong>{{ loan.fromPoint }} → {{ loan.toPoint }}</strong>
          <span class="badge" :class="`badge--${loan.status.toLowerCase()}`">{{ statusLabel[loan.status] }}</span>
        </div>
        <div class="meta">
          <span><i class="fas fa-calendar"></i> {{ fmtDate(loan.createdAt) }}</span>
          <span v-if="loan.responsible"><i class="fas fa-user"></i> {{ loan.responsible }}</span>
        </div>
        <ul class="items-list">
          <li v-for="item in loan.items" :key="item._id">
            {{ item.quantity }} {{ item.unit }} — {{ item.name }}
            <em v-if="item.quantityReturned > 0" class="returned">(devuelto: {{ item.quantityReturned }})</em>
          </li>
        </ul>
        <p v-if="loan.notes" class="loan-notes">{{ loan.notes }}</p>
        <div class="card-actions" v-if="['LENT', 'PARTIALLY_RETURNED'].includes(loan.status)">
          <button class="btn-confirm" @click="openReturn(loan)">Registrar devolución</button>
          <button class="btn-danger" @click="writeOff(loan)">No se devuelve (deuda)</button>
        </div>
      </div>
    </div>

    <!-- Modal crear -->
    <div v-if="showCreate" class="modal-overlay" @click.self="showCreate = false">
      <div class="modal">
        <h3>Nuevo préstamo entre bodegas</h3>
        <div class="form-grid">
          <div class="form-row">
            <label>Bodega origen *</label>
            <select v-model="fromPoint">
              <option value="" disabled>Selecciona...</option>
              <option v-for="p in points" :key="p" :value="p">{{ p }}</option>
            </select>
          </div>
          <div class="form-row">
            <label>Bodega destino *</label>
            <select v-model="toPoint">
              <option value="" disabled>Selecciona...</option>
              <option v-for="p in points" :key="p" :value="p">{{ p }}</option>
            </select>
          </div>
        </div>

        <div class="form-row">
          <label>Buscar materia prima</label>
          <div class="search-row">
            <input type="text" v-model="materialSearch" placeholder="Ej. leche" @keyup.enter="searchMaterials" />
            <button class="btn-secondary" @click="searchMaterials">Buscar</button>
          </div>
          <div class="material-results" v-if="materials.length">
            <button
              v-for="mat in materials.slice(0, 8)"
              :key="mat._id"
              class="material-chip"
              @click="addItem(mat)"
            >
              + {{ mat.name }}
            </button>
          </div>
        </div>

        <div v-if="loanItems.length" class="check-table-wrap">
          <table class="check-table">
            <thead><tr><th>Ítem</th><th>Cantidad</th><th></th></tr></thead>
            <tbody>
              <tr v-for="(item, idx) in loanItems" :key="item.material">
                <td>{{ item.name }} ({{ item.unit }})</td>
                <td><input type="number" min="0.01" step="any" v-model.number="item.quantity" class="qty-input" /></td>
                <td><button class="btn-remove" @click="removeItem(idx)"><i class="fas fa-times"></i></button></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="form-row">
          <label>Responsable</label>
          <input type="text" v-model="responsible" placeholder="Quién gestiona el préstamo" />
        </div>
        <div class="form-row">
          <label>Notas</label>
          <textarea v-model="notes" rows="2"></textarea>
        </div>

        <div class="modal-actions">
          <button class="btn-cancel" @click="showCreate = false">Cancelar</button>
          <button class="btn-primary" :disabled="isSaving" @click="submitLoan">
            {{ isSaving ? 'Guardando...' : 'Registrar préstamo' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Modal devolución -->
    <div v-if="returning" class="modal-overlay" @click.self="returning = null">
      <div class="modal modal--small">
        <h3>Devolución — {{ returning.toPoint }} → {{ returning.fromPoint }}</h3>
        <div class="check-table-wrap">
          <table class="check-table">
            <thead><tr><th>Ítem</th><th>Pendiente</th><th>Devolver</th></tr></thead>
            <tbody>
              <tr v-for="r in returnItems" :key="r.itemId">
                <td>{{ r.name }}</td>
                <td>{{ r.pending }} {{ r.unit }}</td>
                <td><input type="number" min="0" :max="r.pending" step="any" v-model.number="r.quantityReturned" class="qty-input" /></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="modal-actions">
          <button class="btn-cancel" @click="returning = null">Cancelar</button>
          <button class="btn-confirm" :disabled="isSaving" @click="submitReturn">
            {{ isSaving ? 'Guardando...' : 'Registrar devolución' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.loans-view {
  padding: 1.5rem;
  max-width: 1100px;
  margin: 0 auto;
}

.loans-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1.25rem;

  h1 {
    font-size: 1.4rem;
    margin: 0 0 0.25rem;
    i { color: #7c3aed; margin-right: 0.5rem; }
  }
  p { color: #6b7280; margin: 0; font-size: 0.9rem; }
}

.loan-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1rem;
}

.loan-card {
  background: white;
  border-radius: 12px;
  padding: 1rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  display: flex;
  flex-direction: column;
  gap: 0.6rem;

  &.card--lent { border-left: 4px solid #d97706; }
  &.card--partially_returned { border-left: 4px solid #2563eb; }
  &.card--returned { border-left: 4px solid #059669; }
  &.card--written_off { border-left: 4px solid #9ca3af; opacity: 0.8; }
}

.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}

.badge {
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  white-space: nowrap;

  &.badge--lent { background: #fef3c7; color: #b45309; }
  &.badge--partially_returned { background: #dbeafe; color: #1d4ed8; }
  &.badge--returned { background: #d1fae5; color: #047857; }
  &.badge--written_off { background: #e5e7eb; color: #4b5563; }
}

.meta {
  display: flex;
  gap: 0.9rem;
  flex-wrap: wrap;
  font-size: 0.78rem;
  color: #6b7280;
  i { margin-right: 0.25rem; }
}

.items-list {
  margin: 0;
  padding-left: 1.1rem;
  font-size: 0.85rem;
  color: #374151;

  .returned { color: #047857; font-style: normal; font-size: 0.78rem; }
}

.loan-notes { margin: 0; font-size: 0.82rem; color: #6b7280; }

.card-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.btn-primary, .btn-secondary, .btn-danger, .btn-confirm {
  border: none;
  border-radius: 8px;
  padding: 0.45rem 0.9rem;
  font-weight: 600;
  cursor: pointer;
  font-size: 0.85rem;
}
.btn-primary { background: #7c3aed; color: white; &:hover { background: #6d28d9; } &:disabled { opacity: 0.6; } }
.btn-secondary { background: #ede9fe; color: #6d28d9; }
.btn-danger { background: #fee2e2; color: #b91c1c; }
.btn-confirm { background: #059669; color: white; &:hover { background: #047857; } &:disabled { opacity: 0.6; } }

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
  max-width: 620px;
  max-height: 90vh;
  overflow-y: auto;

  h3 { margin: 0 0 1rem; }
  &.modal--small { max-width: 480px; }
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.form-row {
  margin-bottom: 0.75rem;
  label {
    display: block;
    font-size: 0.82rem;
    font-weight: 600;
    color: #4b5563;
    margin-bottom: 0.25rem;
  }
  input, textarea, select {
    width: 100%;
    padding: 0.5rem 0.7rem;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 0.9rem;
    background: white;
  }
}

.search-row {
  display: flex;
  gap: 0.5rem;
  input { flex: 1; }
}

.material-results {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
  margin-top: 0.5rem;
}

.material-chip {
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  padding: 0.25rem 0.7rem;
  font-size: 0.8rem;
  cursor: pointer;

  &:hover { background: #ede9fe; border-color: #c4b5fd; }
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

.qty-input { width: 100px; padding: 0.3rem; border: 1px solid #d1d5db; border-radius: 6px; }

.btn-remove {
  background: none;
  border: none;
  color: #b91c1c;
  cursor: pointer;
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
