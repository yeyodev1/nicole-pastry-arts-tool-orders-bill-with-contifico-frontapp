<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import HoldConfirmButton from '@/components/ui/HoldConfirmButton.vue'
import DeleteMaterialModal from '@/views/SupplyChain/components/DeleteMaterialModal.vue'
import SearchableSelect from '@/components/ui/SearchableSelect.vue'
import ProviderCategoryService from '@/services/provider-category.service'

const props = defineProps({
  isOpen: { type: Boolean, required: true },
  materialToEdit: { type: Object, default: null },
  providers: { type: Array as () => any[], required: true },
  categories: { type: Array as () => any[], required: true },
  isSaving: { type: Boolean, default: false },
  defaultProviderId: { type: String, default: '' }
})

const emit = defineEmits(['close', 'save', 'delete', 'category-created'])

const form = ref({
  name: '',
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
  { value: 'g', label: 'Kilogramos (kg)' },
  { value: 'ml', label: 'Litros (lt)' }
]

const calculatedUnitCost = computed(() => {
  if (form.value.presentationPrice > 0 && form.value.presentationQuantity > 0) {
    return form.value.presentationPrice / form.value.presentationQuantity
  }
  return 0
})

// Conversion: backend stores g/ml, user works in kg/lt
const getDisplayQuantity = (quantity: number, unit: string) => {
  if (unit === 'g' || unit === 'ml') return quantity / 1000
  return quantity
}
const getDisplayUnit = (unit: string) => {
  if (unit === 'g') return 'kg'
  if (unit === 'ml') return 'lt'
  return unit
}
const toBackendQuantity = (inputQty: number, unit: string) => {
  if (unit === 'g' || unit === 'ml') return inputQty * 1000
  return inputQty
}

const resetForm = () => {
  form.value = {
    name: '',
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
        code: m.code || '',
        unit: m.unit || 'u',
        quantity: getDisplayQuantity(m.quantity || 0, m.unit),
        minStock: getDisplayQuantity(m.minStock || 0, m.unit),
        maxStock: getDisplayQuantity(m.maxStock || 0, m.unit),
        provider: m.provider?._id || m.provider || '',
        category: m.category || '',
        presentationPrice: m.presentationPrice || 0,
        presentationQuantity: getDisplayQuantity(m.presentationQuantity || 1, m.unit),
        wastePercentage: m.wastePercentage || 0
      }
    } else {
      resetForm()
      if (props.defaultProviderId) {
        form.value.provider = props.defaultProviderId
      }
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

// Format a cost value removing unnecessary trailing zeros (up to 4 decimal places)
const formatCost = (val: number): string => {
  if (!val || val === 0) return '0.00'
  // Use up to 4 decimals but strip trailing zeros
  return parseFloat(val.toFixed(4)).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  })
}

const generateCode = (category: string, name: string) => {
  const catChar = category && category.length > 0 ? category.charAt(0).toUpperCase() : 'X'
  const nameChar = name && name.length > 1 ? name.charAt(1).toLowerCase() : (name && name.length > 0 ? name.charAt(0).toLowerCase() : 'x')
  const randomNum = Math.floor(Math.random() * 900) + 100
  return `${catChar}${nameChar}${randomNum}`
}

const handleSubmit = () => {
  const payload: any = { ...form.value }

  payload.minStock = toBackendQuantity(payload.minStock || 0, payload.unit)
  payload.maxStock = toBackendQuantity(payload.maxStock || 0, payload.unit)
  payload.presentationQuantity = toBackendQuantity(payload.presentationQuantity || 1, payload.unit)

  // Store cost as price per BASE unit ($/g or $/ml), not per display unit ($/kg or $/lt)
  // Warehouse auto-fill uses mat.cost * 1000 to get $/kg, so we must store $/g here
  payload.cost = (payload.unit === 'g' || payload.unit === 'ml')
    ? calculatedUnitCost.value / 1000
    : calculatedUnitCost.value

  if (!payload.code) {
    payload.code = generateCode(payload.category, payload.name)
  }

  if (!payload.provider) delete payload.provider

  emit('save', payload)
}

// Inline category creation
const showNewCatInput = ref(false)
const newCatName = ref('')
const isCreatingCat = ref(false)
const newCatError = ref('')

const handleCreateCategory = async () => {
  if (!newCatName.value.trim()) return
  isCreatingCat.value = true
  newCatError.value = ''
  try {
    const created = await ProviderCategoryService.createCategory(newCatName.value.trim())
    form.value.category = created.name
    emit('category-created', created)
    newCatName.value = ''
    showNewCatInput.value = false
  } catch (err: any) {
    newCatError.value = err.response?.data?.message || 'Error al crear categoría'
  } finally {
    isCreatingCat.value = false
  }
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
  <Teleport to="body">
    <transition name="modal-bounce">
      <div v-if="isOpen" class="modal-overlay" @click.self="$emit('close')">
        <div class="modal-content pro-modal">
          <div class="modal-header">
            <div class="header-info">
              <h2>{{ materialToEdit ? 'Editar Material' : 'Nuevo Material' }}</h2>
              <p v-if="materialToEdit" class="sku-subtitle">SKU: {{ form.code }}</p>
            </div>
            <button class="btn-close" @click="$emit('close')">&times;</button>
          </div>

          <div class="modal-body">
            <div class="section-title">Información Básica</div>
            <div class="form-group" style="margin-bottom: 1.25rem">
              <label>Nombre Comercial / Marca</label>
              <input v-model="form.name" placeholder="Ej. Chocolate Callebaut 70%" />
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Categoría</label>
                <SearchableSelect
                  v-model="form.category"
                  :options="categoryOptions"
                  placeholder="Buscar o seleccionar categoría..."
                />
                <!-- Suggested category chips -->
                <div class="category-chips" v-if="categories.length > 0">
                  <button
                    v-for="cat in categories"
                    :key="cat._id || cat.name"
                    type="button"
                    class="chip"
                    :class="{ 'chip--active': form.category === cat.name }"
                    @click="form.category = cat.name"
                  >
                    {{ cat.name }}
                  </button>
                </div>

                <!-- Inline new category -->
                <div class="new-cat-row" v-if="!showNewCatInput">
                  <button type="button" class="btn-add-cat-inline" @click="showNewCatInput = true">
                    <i class="fas fa-plus"></i> Nueva categoría
                  </button>
                </div>
                <div v-else class="new-cat-form">
                  <input
                    v-model="newCatName"
                    placeholder="Nombre de la categoría..."
                    class="new-cat-input"
                    @keyup.enter="handleCreateCategory"
                    @keyup.escape="showNewCatInput = false; newCatName = ''"
                    autofocus
                  />
                  <button type="button" class="btn-cat-confirm" @click="handleCreateCategory" :disabled="!newCatName.trim() || isCreatingCat">
                    <i class="fas fa-check"></i>
                  </button>
                  <button type="button" class="btn-cat-cancel" @click="showNewCatInput = false; newCatName = ''; newCatError = ''">
                    <i class="fas fa-times"></i>
                  </button>
                  <span v-if="newCatError" class="cat-error">{{ newCatError }}</span>
                </div>
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
                <span class="current">{{ form.quantity }} {{ getDisplayUnit(form.unit) }}</span>
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
                  Ingrese la cantidad en {{ getDisplayUnit(form.unit) }}
                </span>
              </div>
              <div class="form-group flex-1">
                <label>Costo Total ($)</label>
                <input type="number" v-model.number="form.presentationPrice" step="0.01" placeholder="0.00" />
              </div>
            </div>

            <div class="cost-summary" v-if="calculatedUnitCost > 0">
              <div class="cost-result">
                <span class="cost-label">Costo por {{ getDisplayUnit(form.unit) }}</span>
                <span class="cost-value">${{ formatCost(calculatedUnitCost) }}<span class="cost-unit">/{{ getDisplayUnit(form.unit) }}</span></span>
              </div>
              <div class="cost-total-hint" v-if="form.unit !== 'u'">
                <i class="fas fa-info-circle"></i>
                {{ form.presentationQuantity }} {{ getDisplayUnit(form.unit) }} &times; ${{ formatCost(calculatedUnitCost) }} = <strong>${{ formatCost(form.presentationPrice) }} total</strong>
              </div>
            </div>
          </div>

          <div class="modal-footer pro-footer">
            <div class="main-actions">
              <button class="btn-cancel" @click="$emit('close')">Cerrar</button>
              <HoldConfirmButton 
                :label="materialToEdit ? 'GUARDAR CAMBIOS' : 'CREAR MATERIAL'"
                :disabled="isSaving || !form.name"
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
    </transition>
  </Teleport>
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
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);

  @media (min-width: 640px) {
    border-radius: 36px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15);
  }
}

// Premium Modal Transition
.modal-bounce-enter-active {
  transition: opacity 0.4s ease-out;

  .pro-modal {
    transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
}

.modal-bounce-leave-active {
  transition: opacity 0.3s ease-in;

  .pro-modal {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
}

.modal-bounce-enter-from {
  opacity: 0;

  .pro-modal {
    transform: translateY(100%);

    @media (min-width: 640px) {
      transform: translateY(30px) scale(0.9);
      opacity: 0;
    }
  }
}

.modal-bounce-leave-to {
  opacity: 0;

  .pro-modal {
    transform: translateY(100%);

    @media (min-width: 640px) {
      transform: translateY(20px) scale(0.95);
      opacity: 0;
    }
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

.category-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.6rem;

  .chip {
    padding: 0.35rem 0.85rem;
    border-radius: 999px;
    border: 2px solid #e2e8f0;
    background: #f8fafc;
    color: #64748b;
    font-size: 0.75rem;
    font-weight: 800;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;

    &:active {
      transform: scale(0.96);
    }

    @media(hover: hover) {
      &:hover {
        border-color: $NICOLE-PURPLE;
        color: $NICOLE-PURPLE;
        background: rgba($NICOLE-PURPLE, 0.06);
      }
    }

    &--active {
      border-color: $NICOLE-PURPLE;
      background: rgba($NICOLE-PURPLE, 0.1);
      color: $NICOLE-PURPLE;
    }
  }
}

.new-cat-row {
  margin-top: 0.5rem;
}

.btn-add-cat-inline {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: none;
  border: 1.5px dashed #cbd5e1;
  border-radius: 99px;
  padding: 0.3rem 0.85rem;
  font-size: 0.78rem;
  font-weight: 700;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: $NICOLE-PURPLE;
    color: $NICOLE-PURPLE;
  }
}

.new-cat-form {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.6rem;
}

.new-cat-input {
  flex: 1;
  min-width: 140px;
  padding: 0.45rem 0.75rem;
  border: 2px solid $NICOLE-PURPLE;
  border-radius: 10px;
  font-size: 0.85rem;
  font-weight: 600;
  outline: none;
  background: white;
}

.btn-cat-confirm {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: $NICOLE-PURPLE;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  flex-shrink: 0;
  transition: opacity 0.2s;

  &:disabled { opacity: 0.4; cursor: not-allowed; }
}

.btn-cat-cancel {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background: white;
  color: #94a3b8;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  flex-shrink: 0;
  transition: all 0.2s;

  &:hover { background: #fee2e2; color: #ef4444; border-color: #fecaca; }
}

.cat-error {
  width: 100%;
  font-size: 0.78rem;
  font-weight: 600;
  color: #ef4444;
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
  margin-top: 0;
  margin-bottom: 1.5rem;
  background: #f8f5ff;
  padding: 1rem 1.25rem;
  border-radius: 16px;
  border: 1.5px solid rgba($NICOLE-PURPLE, 0.15);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  @media (min-width: 640px) {
    margin-bottom: 2rem;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}

.cost-result {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;

  .cost-label {
    font-size: 0.75rem;
    font-weight: 800;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    white-space: nowrap;
  }

  .cost-value {
    font-size: 1.5rem;
    font-weight: 900;
    color: $NICOLE-PURPLE;
    font-family: 'JetBrains Mono', monospace;
    letter-spacing: -0.02em;

    @media (min-width: 640px) {
      font-size: 1.75rem;
    }

    .cost-unit {
      font-size: 0.85rem;
      font-weight: 700;
      color: #94a3b8;
      margin-left: 0.1rem;
      font-family: inherit;
    }
  }
}

.cost-total-hint {
  font-size: 0.78rem;
  font-weight: 600;
  color: #64748b;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;

  i {
    color: $NICOLE-PURPLE;
    opacity: 0.6;
    font-size: 0.72rem;
  }

  strong {
    color: $NICOLE-PURPLE;
    font-weight: 800;
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
