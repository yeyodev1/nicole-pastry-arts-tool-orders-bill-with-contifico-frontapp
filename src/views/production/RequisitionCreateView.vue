<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import RequisitionService from '@/services/requisition.service'
import RawMaterialService from '@/services/raw-material.service'
import { useToast } from '@/composables/useToast'

const { success, error: showError } = useToast()

const AREAS = ['Cocina', 'Producción Finestra', 'Producción Sucree', 'Decoración']
const BRANDS = ['Nicole', 'Sucree', 'Casa Mía', 'La Crème']

const area = ref('Cocina')
const brand = ref('Nicole')
const neededForDate = ref('')
const notes = ref('')

const materialSearch = ref('')
const materials = ref<any[]>([])
const items = ref<{ material: string; name: string; quantity: number; unit: string }[]>([])
const isSaving = ref(false)

// Mis requerimientos recientes
const myRequisitions = ref<any[]>([])

const userName = computed(() => {
  try { return JSON.parse(localStorage.getItem('user_info') || '{}')?.name || '' } catch { return '' }
})

const statusLabel: Record<string, string> = {
  REQUESTED: 'Solicitado',
  PREPARING: 'Preparando',
  DISPATCHED: 'Despachado',
  CONFIRMED: 'Confirmado',
  CANCELLED: 'Cancelado',
}

const searchMaterials = async () => {
  try {
    materials.value = await RawMaterialService.getRawMaterials(materialSearch.value || undefined)
  } catch { /* noop */ }
}

const addItem = (material: any) => {
  if (items.value.some(i => i.material === material._id)) return
  items.value.push({ material: material._id, name: material.name, quantity: 1, unit: material.unit })
}

const removeItem = (idx: number) => items.value.splice(idx, 1)

const fetchMine = async () => {
  try {
    const res = await RequisitionService.getRequisitions({ area: area.value, limit: 20 })
    myRequisitions.value = res.requisitions || []
  } catch { /* noop */ }
}

const submit = async () => {
  if (!items.value.length) {
    showError('Agrega al menos un ítem.')
    return
  }
  isSaving.value = true
  try {
    await RequisitionService.createRequisition({
      area: area.value,
      brand: brand.value,
      neededForDate: neededForDate.value || undefined,
      items: items.value as any,
      notes: notes.value || undefined,
      requestedByName: userName.value,
    } as any)
    success('Requerimiento enviado a bodega')
    items.value = []
    notes.value = ''
    await fetchMine()
  } catch (e: any) {
    showError(e?.message || 'Error enviando requerimiento')
  } finally {
    isSaving.value = false
  }
}

const fmtDate = (d?: string) => d
  ? new Intl.DateTimeFormat('es-EC', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(d))
  : '—'

onMounted(() => {
  searchMaterials()
  fetchMine()
})
</script>

<template>
  <div class="req-create-view">
    <div class="rc-header">
      <h1><i class="fas fa-clipboard-list"></i> Pedir a Bodega</h1>
      <p>Solicita materia prima e insumos. Bodega recibe una alerta y despacha.</p>
    </div>

    <div class="rc-grid">
      <!-- Formulario -->
      <div class="panel">
        <div class="form-grid">
          <div class="form-row">
            <label>Área</label>
            <select v-model="area" @change="fetchMine">
              <option v-for="a in AREAS" :key="a" :value="a">{{ a }}</option>
            </select>
          </div>
          <div class="form-row">
            <label>Marca (a quién se carga el gasto)</label>
            <select v-model="brand">
              <option v-for="b in BRANDS" :key="b" :value="b">{{ b }}</option>
            </select>
          </div>
          <div class="form-row">
            <label>Lo necesito para</label>
            <input type="date" v-model="neededForDate" />
          </div>
        </div>

        <div class="form-row">
          <label>Buscar ítem</label>
          <div class="search-row">
            <input type="text" v-model="materialSearch" placeholder="Ej. harina, vasos, leche..." @keyup.enter="searchMaterials" />
            <button class="btn-secondary" @click="searchMaterials">Buscar</button>
          </div>
          <div class="material-results" v-if="materials.length">
            <button
              v-for="mat in materials.slice(0, 10)"
              :key="mat._id"
              class="material-chip"
              @click="addItem(mat)"
            >
              + {{ mat.name }}
            </button>
          </div>
        </div>

        <div v-if="items.length" class="table-wrap">
          <table class="items-table">
            <thead><tr><th>Ítem</th><th>Cantidad</th><th></th></tr></thead>
            <tbody>
              <tr v-for="(item, idx) in items" :key="item.material">
                <td>{{ item.name }} ({{ item.unit }})</td>
                <td><input type="number" min="0.01" step="any" v-model.number="item.quantity" class="qty-input" /></td>
                <td><button class="btn-remove" @click="removeItem(idx)"><i class="fas fa-times"></i></button></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="form-row">
          <label>Notas para bodega</label>
          <textarea v-model="notes" rows="2" placeholder="Ej. es urgente para el pedido de mañana"></textarea>
        </div>

        <button class="btn-primary" :disabled="isSaving || !items.length" @click="submit">
          <i class="fas fa-paper-plane"></i> {{ isSaving ? 'Enviando...' : 'Enviar requerimiento' }}
        </button>
      </div>

      <!-- Mis requerimientos -->
      <div class="panel">
        <h2>Requerimientos de {{ area }}</h2>
        <div v-if="myRequisitions.length === 0" class="empty-inline">Sin requerimientos recientes.</div>
        <div v-for="req in myRequisitions" :key="req._id" class="mini-card">
          <div class="mini-head">
            <span class="badge" :class="`badge--${req.status.toLowerCase()}`">{{ statusLabel[req.status] }}</span>
            <span class="mini-date">{{ fmtDate(req.createdAt) }}</span>
          </div>
          <ul>
            <li v-for="item in req.items" :key="item._id">
              {{ item.quantity }} {{ item.unit }} — {{ item.name }}
            </li>
          </ul>
          <div v-if="req.status === 'DISPATCHED'" class="mini-note">
            Despachado — confirma la recepción con bodega.
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.req-create-view {
  padding: 1.5rem;
  max-width: 1100px;
  margin: 0 auto;
}

.rc-header {
  margin-bottom: 1.25rem;
  h1 {
    font-size: 1.4rem;
    margin: 0 0 0.25rem;
    i { color: #7c3aed; margin-right: 0.5rem; }
  }
  p { color: #6b7280; margin: 0; font-size: 0.9rem; }
}

.rc-grid {
  display: grid;
  grid-template-columns: 3fr 2fr;
  gap: 1.25rem;

  @media (max-width: 900px) { grid-template-columns: 1fr; }
}

.panel {
  background: white;
  border-radius: 12px;
  padding: 1.25rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);

  h2 { font-size: 1.05rem; margin: 0 0 0.75rem; }
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 0.75rem;

  @media (max-width: 700px) { grid-template-columns: 1fr; }
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

.table-wrap { overflow-x: auto; margin-bottom: 0.75rem; }

.items-table {
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

.btn-remove { background: none; border: none; color: #b91c1c; cursor: pointer; }

.btn-primary {
  background: #7c3aed;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 0.55rem 1.1rem;
  font-weight: 600;
  cursor: pointer;

  &:hover:not(:disabled) { background: #6d28d9; }
  &:disabled { opacity: 0.6; cursor: default; }
}

.btn-secondary {
  background: #ede9fe;
  color: #6d28d9;
  border: none;
  border-radius: 8px;
  padding: 0.45rem 0.9rem;
  font-weight: 600;
  cursor: pointer;
}

.empty-inline { color: #9ca3af; font-size: 0.88rem; }

.mini-card {
  border: 1px solid #f3f4f6;
  border-radius: 10px;
  padding: 0.7rem 0.85rem;
  margin-bottom: 0.6rem;

  ul {
    margin: 0.4rem 0 0;
    padding-left: 1.1rem;
    font-size: 0.82rem;
    color: #4b5563;
  }
}

.mini-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.mini-date { font-size: 0.75rem; color: #9ca3af; }

.mini-note { font-size: 0.78rem; color: #6d28d9; margin-top: 0.4rem; }

.badge {
  padding: 0.15rem 0.55rem;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 700;

  &.badge--requested { background: #fef3c7; color: #b45309; }
  &.badge--preparing { background: #dbeafe; color: #1d4ed8; }
  &.badge--dispatched { background: #ede9fe; color: #6d28d9; }
  &.badge--confirmed { background: #d1fae5; color: #047857; }
  &.badge--cancelled { background: #e5e7eb; color: #4b5563; }
}
</style>
