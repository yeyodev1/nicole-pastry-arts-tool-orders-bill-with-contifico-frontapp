<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import HoldConfirmButton from '@/components/ui/HoldConfirmButton.vue'
import DeleteMaterialModal from '@/views/SupplyChain/components/DeleteMaterialModal.vue'
import SearchableSelect from '@/components/ui/SearchableSelect.vue'

const props = defineProps({
  isOpen: { type: Boolean, required: true },
  materialToEdit: { type: Object, default: null },
  providers: { type: Array as () => any[], required: true },
  categories: { type: Array as () => any[], required: true },
  isSaving: { type: Boolean, default: false }
})

const emit = defineEmits(['close', 'save', 'delete'])

const form = ref({
  name: '',
  item: '',
  code: '',
  unit: 'u',
  quantity: 0,
  minStock: 0,
  maxStock: 0,
  provider: '',
  category: '',
  presentationPrice: 0,
  presentationQuantity: 1,
  wastePercentage: 0
})

const units = [
  { value: 'u', label: 'Unidades (u)' },
  { value: 'g', label: 'Gramos (g)' },
  { value: 'ml', label: 'Mililitros (ml)' }
]

const calculatedUnitCost = computed(() => {
  if (form.value.presentationPrice > 0 && form.value.presentationQuantity > 0) {
    return form.value.presentationPrice / form.value.presentationQuantity
  }
  return 0
})

// Conversion functions now identity as we always use base units
const getDisplayQuantity = (quantity: number, unit: string) => quantity
const getDisplayUnit = (unit: string) => unit
const toBackendQuantity = (inputQty: number, unit: string) => inputQty

const resetForm = () => {
  form.value = {
    name: '',
    item: '',
    code: '',
    unit: 'u',
    quantity: 0,
    minStock: 0,
    maxStock: 0,
    provider: '',
    category: '',
    presentationPrice: 0,
    presentationQuantity: 1,
    wastePercentage: 0
  }
}

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    if (props.materialToEdit) {
      const m = props.materialToEdit
      form.value = {
        name: m.name,
        item: m.item || '',
        code: m.code || '',
        unit: m.unit || 'u',
        quantity: m.quantity || 0, // Keep raw quantity for preservation
        minStock: getDisplayQuantity(m.minStock || 0, m.unit),
        maxStock: getDisplayQuantity(m.maxStock || 0, m.unit),
        provider: m.provider?._id || m.provider || '',
        category: m.category || '',
        presentationPrice: m.presentationPrice || 0,
        presentationQuantity: m.presentationQuantity || 1,
        wastePercentage: m.wastePercentage || 0
      }
    } else {
      resetForm()
    }
  }
}, { immediate: true })

const stockStatus = computed(() => {
  const current = form.value.quantity || 0
  const min = form.value.minStock || 0
  const max = form.value.maxStock || 0

  // Si no hay stock, siempre es urgente (sin importar configuración de límites)
  if (current === 0) return { label: 'URGENTE / INSUFICIENTE', class: 'status-urgent' }

  // Si no se configuraron límites (min y max = 0) pero hay stock, no evaluar
  if (min === 0 && max === 0) return { label: '---', class: '' }

  // Lógica normal cuando hay límites configurados
  if (current < min) return { label: 'URGENTE / INSUFICIENTE', class: 'status-urgent' }
  if (current >= min && current < (min * 1.5)) return { label: 'ESCASO / ALERTA', class: 'status-warning' }
  if (current >= (min * 1.5) && (max === 0 || current <= max)) return { label: 'ÓPTIMO', class: 'status-optimal' }
  if (max > 0 && current > max) return { label: 'SOBRESTOCK', class: 'status-overstock' }

  return { label: '---', class: '' }
})

const generateCode = (category: string, item: string) => {
  const catChar = category && category.length > 0 ? category.charAt(0).toUpperCase() : 'X'
  const itemChar = item && item.length > 1 ? item.charAt(1).toLowerCase() : (item && item.length > 0 ? item.charAt(0).toLowerCase() : 'x')
  const randomNum = Math.floor(Math.random() * 900) + 100
  return `${catChar}${itemChar}${randomNum}`
}

const handleSubmit = () => {
  const payload: any = { ...form.value }

  // We preserve the quantity as is (already in backend unit if editing, 0 if new)
  // But min/max need conversion back to base unit if logic changes (currently identity)
  payload.minStock = toBackendQuantity(payload.minStock || 0, payload.unit)
  payload.maxStock = toBackendQuantity(payload.maxStock || 0, payload.unit)

  // Cost is correctly calculated per base unit
  payload.cost = calculatedUnitCost.value

  if (!payload.code) {
    payload.code = generateCode(payload.category, payload.item || payload.name)
  }

  if (!payload.provider) delete payload.provider

  emit('save', payload)
}

// Delete Logic
const isDeleteModalOpen = ref(false)

const openDeleteModal = () => {
  isDeleteModalOpen.value = true
}

const handleConfirmDelete = () => {
  if (props.materialToEdit) {
    emit('delete', props.materialToEdit._id)
    isDeleteModalOpen.value = false
  }
}

// Options for SearchableSelect
const providerOptions = computed(() => {
  return props.providers.map(p => ({
    value: p._id,
    label: p.name
  }))
})

const categoryOptions = computed(() => {
  return props.categories.map(c => ({
    value: c.name,
    label: c.name
  }))
})
</script>

<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content pro-modal">
      <div class="modal-header">
        <div class="header-info">
          <h2>{{ materialToEdit ? 'Editar Material' : 'Nuevo Material' }}</h2>
          <p v-if="materialToEdit" class="sku-subtitle">SKU: {{ form.code }} | {{ form.item }}</p>
        </div>
        <button class="btn-close" @click="$emit('close')">&times;</button>
      </div>

      <div class="modal-body">
        <div class="section-title">Información Básica</div>
        <div class="form-row">
          <div class="form-group flex-2">
            <label>Nombre Comercial / Marca</label>
            <input v-model="form.name" placeholder="Ej. Chocolate Callebaut 70%" />
          </div>
          <div class="form-group flex-1">
            <label>Descripción / Ítem</label>
            <input v-model="form.item" placeholder="Ej. Chocolate" />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Categoría</label>
            <SearchableSelect
              v-model="form.category"
              :options="categoryOptions"
              placeholder="Buscar categoría..."
            />
          </div>
          <div class="form-group">
            <label>Unidad de Medida</label>
            <select v-model="form.unit">
              <option v-for="u in units" :key="u.value" :value="u.value">{{ u.label }}</option>
            </select>
          </div>
        </div>

        <div class="section-divider"></div>
        <div class="section-title">Control de Inventario</div>
        
        <div class="stock-status-bar" v-if="materialToEdit">
          <div class="status-indicator">
            <span class="label">Estado Actual:</span>
            <span class="badge" :class="stockStatus.class">{{ stockStatus.label }}</span>
          </div>
          <div class="stock-level">
            <span class="current">{{ form.quantity }} {{ form.unit }}</span>
            <span class="label">en stock <span v-if="calculatedUnitCost > 0">(${{ (form.quantity * calculatedUnitCost).toFixed(2) }})</span></span>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Stock Mínimo (Alerta)</label>
            <input type="number" v-model.number="form.minStock" placeholder="0" />
            <span class="input-hint">Punto de re-orden</span>
          </div>
          <div class="form-group">
            <label>Stock Máximo (Límite)</label>
            <input type="number" v-model.number="form.maxStock" placeholder="0" />
            <span class="input-hint">Capacidad o límite deseado</span>
          </div>
        </div>

        <div class="section-divider"></div>
        <div class="section-title">Definición de Costo</div>
        
        <div class="form-group">
          <label>Proveedor Principal</label>
          <SearchableSelect
            v-model="form.provider"
            :options="providerOptions"
            placeholder="Buscar proveedor..."
          />
        </div>

        <div class="form-row highlight">
          <div class="form-group flex-2">
            <label>Unidad de Compra</label>
            <select :value="form.unit" disabled class="disabled-select">
              <option v-for="u in units" :key="u.value" :value="u.value">{{ u.label }}</option>
            </select>
          </div>
          <div class="form-group flex-1">
            <label>Cantidad</label>
            <input type="number" v-model.number="form.presentationQuantity" placeholder="0" min="0" step="any" />
            <span class="input-hint" v-if="form.unit !== 'u'">
              Ingrese la cantidad en {{ form.unit }}
            </span>
          </div>
          <div class="form-group flex-1">
            <label>Costo Total ($)</label>
            <input type="number" v-model.number="form.presentationPrice" step="0.01" placeholder="0.00" />
          </div>
        </div>

        <div class="cost-summary" v-if="calculatedUnitCost > 0">
          <!-- Kg / L Cost (Main Focus) -->
          <div class="summary-item" v-if="form.unit !== 'u'">
            <span class="label">Costo por {{ form.unit === 'g' ? 'Kg' : (form.unit === 'ml' ? 'Litro' : '') }}:</span>
            <span class="value main">${{ (calculatedUnitCost * 1000).toFixed(4) }}</span>
          </div>

          <!-- Base Unit Cost (g / ml / u) -->
          <div class="summary-item" :class="{ sub: form.unit !== 'u' }">
            <span class="label">Costo {{ form.unit === 'u' ? 'por Unidad' : `por ${form.unit}` }}:</span>
             <span class="value" :class="{ main: form.unit === 'u' }">${{ calculatedUnitCost.toFixed(6) }}</span>
          </div>
        </div>
      </div>

      <div class="modal-footer pro-footer">
        <div v-if="materialToEdit" class="delete-section">
          <button class="btn-delete" @click="openDeleteModal">
            <i class="fas fa-trash-alt"></i> ELIMINAR REGISTRO
          </button>
        </div>
        
        <div class="main-actions">
          <button class="btn-cancel" @click="$emit('close')">Cerrar</button>
          <HoldConfirmButton 
            :label="materialToEdit ? 'GUARDAR CAMBIOS' : 'CREAR MATERIAL'"
            :disabled="isSaving || !form.name || !form.item"
            :hold-time="1200"
            @confirmed="handleSubmit"
          />
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <DeleteMaterialModal
      :is-open="isDeleteModalOpen"
      :material-name="materialToEdit?.name || ''"
      @close="isDeleteModalOpen = false"
      @confirm="handleConfirmDelete"
    />
  </div>
</template>

<style lang="scss" scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.4);
  backdrop-filter: blur(8px);
  display: flex;
  justify-content: center;
  align-items: end; // Mobile: aligned to bottom
  z-index: 2000;
  padding: 0; // Mobile: full width

  @media (min-width: 640px) {
    align-items: center;
    padding: 1rem;
  }
}

.pro-modal {
  background: white;
  width: 100%;
  max-width: 700px;
  max-height: 90vh;
  border-radius: 28px 28px 0 0; // Mobile top rounded
  padding: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 -25px 50px -12px rgba(0, 0, 0, 0.15);
  animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);

  @media (min-width: 640px) {
    border-radius: 36px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15);
    animation: modalIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }
}

@keyframes slideUp {
  from {
    transform: translateY(100%);
  }

  to {
    transform: translateY(0);
  }
}

@keyframes modalIn {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.modal-header {
  padding: 1.5rem;
  background: white;
  border-bottom: 1px solid #f1f5f9;
  display: flex;
  justify-content: space-between;
  align-items: flex-start; // Better alignment for multiline titles
  position: sticky;
  top: 0;
  z-index: 10;

  @media (min-width: 640px) {
    padding: 2rem 2.5rem;
    align-items: center;
  }

  .header-info {
    flex: 1;
    padding-right: 1rem;
  }

  h2 {
    font-size: 1.25rem;
    font-weight: 900;
    color: #1e293b;
    margin: 0;
    letter-spacing: -0.02em;
    line-height: 1.2;

    @media (min-width: 640px) {
      font-size: 1.75rem;
    }
  }

  .sku-subtitle {
    font-size: 0.8rem;
    font-weight: 800;
    color: $NICOLE-PURPLE;
    margin: 0.25rem 0 0;
    text-transform: uppercase;

    @media (min-width: 640px) {
      font-size: 0.9rem;
      margin-top: 0.5rem;
    }
  }

  .btn-close {
    background: #f1f5f9;
    border: none;
    width: 36px;
    height: 36px;
    border-radius: 12px;
    color: #64748b;
    cursor: pointer;
    font-size: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    flex-shrink: 0;

    @media (min-width: 640px) {
      width: 44px;
      height: 44px;
      border-radius: 14px;
    }

    &:active {
      transform: scale(0.95);
    }

    @media(hover: hover) {
      &:hover {
        background: #fee2e2;
        color: #ef4444;
      }
    }
  }
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
  background: white;

  @media (min-width: 640px) {
    padding: 2rem 2.5rem;
  }
}

.section-title {
  font-size: 0.75rem;
  font-weight: 900;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 1rem;

  @media (min-width: 640px) {
    font-size: 0.8rem;
    margin-bottom: 1.25rem;
  }
}

.section-divider {
  height: 2px;
  background: #f8fafc;
  margin: 2rem -1.5rem; // Expand to full width mobile

  @media (min-width: 640px) {
    margin: 2rem -2.5rem;
  }
}

.stock-status-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f8fafc;
  padding: 1rem;
  border-radius: 16px;
  margin-bottom: 1.5rem;
  border: 1px solid #f1f5f9;

  .status-indicator {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;

    .label {
      font-size: 0.7rem;
      font-weight: 700;
      color: #94a3b8;
      text-transform: uppercase;
    }

    .badge {
      font-size: 0.85rem;
      font-weight: 900;
      padding: 0.35rem 0.75rem;
      border-radius: 8px;
      text-transform: uppercase;
      display: inline-block;

      &.status-urgent {
        background: #fee2e2;
        color: #ef4444;
      }

      &.status-warning {
        background: #ffedd5;
        color: #f97316;
      }

      &.status-optimal {
        background: #dcfce7;
        color: #16a34a;
      }

      &.status-overstock {
        background: #dbeafe;
        color: #2563eb;
      }
    }
  }

  .stock-level {
    text-align: right;

    .current {
      display: block;
      font-size: 1.25rem;
      font-weight: 900;
      color: #1e293b;
    }

    .label {
      font-size: 0.75rem;
      color: #64748b;
    }
  }
}

.highlight-title {
  color: $NICOLE-PURPLE;
}

.form-row {
  display: flex;
  flex-direction: column; // Mobile: Stack
  gap: 1.25rem;
  margin-bottom: 1.25rem;

  @media (min-width: 640px) {
    flex-direction: row;
    gap: 1.5rem;
    margin-bottom: 1.5rem;
  }

  &.highlight {
    background: #f8fafc;
    padding: 1.25rem;
    border-radius: 20px;
    border: 2px dashed #e2e8f0;

    @media (min-width: 640px) {
      padding: 1.5rem;
    }
  }

  .flex-2 {
    flex: 2;
  }

  .flex-1 {
    flex: 1;
  }
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 1;

  label {
    font-size: 0.75rem;
    font-weight: 800;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.05em;

    @media (min-width: 640px) {
      font-size: 0.85rem;
    }
  }

  input,
  select {
    padding: 0.9rem;
    border: 2px solid #f1f5f9;
    border-radius: 14px;
    font-size: 1rem;
    font-weight: 600;
    background: #f8fafc;
    transition: all 0.2s;
    width: 100%;
    appearance: none; // Remove system styles

    @media (min-width: 640px) {
      padding: 1rem;
    }

    &:focus {
      outline: none;
      border-color: $NICOLE-PURPLE;
      background: white;
      box-shadow: 0 0 0 4px rgba($NICOLE-PURPLE, 0.1);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }
}

.cost-summary {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.5rem;
  margin-top: 0;
  margin-bottom: 1.5rem;
  background: #f8fafc;
  padding: 1rem;
  border-radius: 16px;
  border: 1px solid #f1f5f9;

  @media (min-width: 640px) {
    margin-bottom: 2rem;
  }

  .summary-item {
    display: flex;
    align-items: center;
    gap: 1rem;

    &.sub {
      opacity: 0.6;

      .label {
        font-size: 0.75rem;
        font-weight: 700;
      }

      .value {
        font-size: 0.9rem;
      }
    }
  }

  .label {
    font-weight: 800;
    color: #94a3b8;
    font-size: 0.8rem;
    text-transform: uppercase;

    @media (min-width: 640px) {
      font-size: 0.85rem;
    }
  }

  .value {
    font-weight: 900;
    color: #0f172a;
    font-family: 'JetBrains Mono', monospace;

    &.main {
      font-size: 1.25rem;
      color: $NICOLE-PURPLE;

      @media (min-width: 640px) {
        font-size: 1.5rem;
      }
    }
  }
}

.stock-action-box {
  display: grid;
  grid-template-columns: 1fr; // Mobile: 1 column
  gap: 1.5rem;
  padding: 1.5rem;
  background: #fafafa;
  border-radius: 24px;
  border: 2px solid #f1f5f9;

  @media (min-width: 640px) {
    grid-template-columns: repeat(3, 1fr);
    padding: 2rem;
  }

  .stock-current,
  .stock-incoming,
  .stock-total {
    text-align: center;
    background: white; // Mobile card look
    padding: 1rem;
    border-radius: 16px;
    border: 1px solid #f1f5f9;

    @media (min-width: 640px) {
      background: transparent;
      padding: 0;
      border: none;
    }

    label {
      display: block;
      font-size: 0.7rem;
      font-weight: 900;
      color: #94a3b8;
      text-transform: uppercase;
      margin-bottom: 0.5rem;

      @media (min-width: 640px) {
        margin-bottom: 0.75rem;
      }
    }

    .value {
      font-size: 1.25rem;
      font-weight: 900;
      color: #475569;

      @media (min-width: 640px) {
        font-size: 1.5rem;
      }
    }

    .total {
      color: $NICOLE-PURPLE;
      font-size: 1.5rem;

      @media (min-width: 640px) {
        font-size: 1.75rem;
      }
    }

    .entry-field {
      width: 100%;
      text-align: center;
      font-size: 1.5rem;
      font-weight: 900;
      color: #0f172a;
      background: white;
      border: 3px solid $NICOLE-PURPLE;
      padding: 0.75rem;
      border-radius: 16px;
      appearance: none; // Remove spinner

      &:focus {
        box-shadow: 0 0 0 5px rgba($NICOLE-PURPLE, 0.15);
        outline: none;
      }
    }
  }
}

.pro-footer {
  padding: 1.5rem;
  background: #fff; // Sticky footer often looks better white on mobile
  border-top: 1px solid #f1f5f9;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  position: sticky;
  bottom: 0;
  z-index: 10;

  // Safe area for iPhone home bar
  padding-bottom: calc(1.5rem + env(safe-area-inset-bottom));

  @media (min-width: 640px) {
    padding: 2rem 2.5rem;
  }

  .delete-section {
    width: 100%;

    .btn-delete {
      width: 100%;
      height: 52px;
      border-radius: 18px;
      background: #fee2e2;
      color: #ef4444;
      font-weight: 900;
      border: 1px solid #fca5a5;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      transition: all 0.2s;

      &:active {
        transform: scale(0.98);
      }

      @media(hover: hover) {
        &:hover {
          background: #fecaca;
        }
      }
    }
  }

  .main-actions {
    display: flex;
    flex-direction: column-reverse; // Mobile: Cancel on bottom
    gap: 0.75rem;
    width: 100%;

    @media (min-width: 640px) {
      flex-direction: row;
      gap: 1rem;
    }

    .btn-cancel {
      width: 100%;
      height: 52px;
      background: white;
      border: 2px solid #f1f5f9;
      border-radius: 18px;
      font-weight: 800;
      color: #64748b;
      cursor: pointer;

      @media (min-width: 640px) {
        flex: 0 0 120px;
      }

      &:active {
        transform: scale(0.98);
      }
    }

    .hold-confirm-btn {
      flex: 1;
      height: 56px;
      border-radius: 18px;
    }
  }
}
</style>
