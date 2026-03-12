<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import HoldConfirmButton from '@/components/ui/HoldConfirmButton.vue'
import DeleteMaterialModal from '@/views/SupplyChain/components/DeleteMaterialModal.vue'
import SearchableSelect from '@/components/ui/SearchableSelect.vue'
import ProviderCategoryService from '@/services/provider-category.service'
import type { IRawMaterialProvider } from '@/types/raw-material-provider'

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
  category: '',
  providers: [] as IRawMaterialProvider[],
  wastePercentage: 0
})

const units = [
  { value: 'u', label: 'Unidades (u)' },
  { value: 'g', label: 'Kilogramos (kg)' },
  { value: 'ml', label: 'Litros (lt)' }
]

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

const mainProvider = computed(() => {
  return form.value.providers.find(p => p.isMain)
})

const calculatedUnitCost = computed(() => {
  return mainProvider.value ? mainProvider.value.price : 0
})

const resetForm = () => {
  form.value = {
    name: '',
    code: '',
    unit: 'u',
    quantity: 0,
    minStock: 0,
    maxStock: 0,
    category: '',
    providers: [],
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
        category: m.category || '',
        providers: m.providers ? m.providers.map((p: any) => ({
          provider: p.provider?._id || p.provider,
          price: p.price,
          isMain: p.isMain
        })) : [],
        wastePercentage: m.wastePercentage || 0
      }
      
      // Fallback for old materials without providers array
      if (form.value.providers.length === 0 && m.provider) {
        form.value.providers.push({
          provider: m.provider?._id || m.provider,
          price: m.cost || 0,
          isMain: true
        })
      }
    } else {
      resetForm()
      if (props.defaultProviderId) {
        form.value.providers = [{
          provider: props.defaultProviderId,
          price: 0,
          isMain: true
        }]
      }
    }
  }
}, { immediate: true })

const addProvider = () => {
  if (form.value.providers.length < 3) {
    form.value.providers.push({
      provider: '',
      price: 0,
      isMain: form.value.providers.length === 0
    })
  }
}

const removeProvider = (index: number) => {
  const removed = form.value.providers.splice(index, 1)[0]
  if (removed && removed.isMain && form.value.providers.length > 0) {
    const firstProvider = form.value.providers[0]
    if (firstProvider) firstProvider.isMain = true
  }
}

const setMainProvider = (index: number) => {
  form.value.providers.forEach((p, i) => {
    p.isMain = i === index
  })
}

const stockStatus = computed(() => {
  const current = form.value.quantity || 0
  const min = form.value.minStock || 0
  const max = form.value.maxStock || 0

  if (current === 0) return { label: 'URGENTE / INSUFICIENTE', class: 'status-urgent' }
  if (min === 0 && max === 0) return { label: '---', class: '' as any }

  if (current < min) return { label: 'URGENTE / INSUFICIENTE', class: 'status-urgent' }
  if (current >= min && current < (min * 1.5)) return { label: 'ESCASO / ALERTA', class: 'status-warning' }
  if (current >= (min * 1.5) && (max === 0 || current <= max)) return { label: 'ÓPTIMO', class: 'status-optimal' }
  if (max > 0 && current > max) return { label: 'SOBRESTOCK', class: 'status-overstock' }

  return { label: '---', class: '' as any }
})

const formatCost = (val: number): string => {
  if (!val || val === 0) return '0.00'
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

  if (!payload.code) {
    payload.code = generateCode(payload.category, payload.name)
  }

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
const openDeleteModal = () => { isDeleteModalOpen.value = true }
const handleConfirmDelete = () => {
  if (props.materialToEdit) {
    emit('delete', props.materialToEdit._id)
    isDeleteModalOpen.value = false
  }
}

// Options for SearchableSelect
const providerOptions = computed(() => {
  return props.providers.map(p => ({ value: p._id, label: p.name }))
})

const categoryOptions = computed(() => {
  return props.categories.map(c => ({ value: c.name, label: c.name }))
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
            <!-- SECTION 1: Información Básica -->
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
                <select v-model="form.unit" :disabled="!!materialToEdit">
                  <option v-for="u in units" :key="u.value" :value="u.value">{{ u.label }}</option>
                </select>
              </div>
            </div>

            <div class="section-divider"></div>

            <!-- SECTION 2: Control de Stock -->
            <div class="section-title">Control de Stock</div>
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

            <!-- SECTION 3: Gestión de Proveedores -->
            <div class="section-title-row">
              <div class="section-title">Lista de Proveedores (Máx. 3)</div>
              <button 
                v-if="form.providers.length < 3" 
                @click="addProvider" 
                class="btn-add-provider"
                type="button"
              >
                <i class="fas fa-plus"></i> Añadir
              </button>
            </div>

            <div class="providers-list">
              <div v-if="form.providers.length === 0" class="empty-providers">
                No hay proveedores asociados. Añada uno para definir el costo.
              </div>
              <div v-for="(p, index) in form.providers" :key="index" class="provider-row">
                <div class="p-main-check">
                  <input 
                    type="radio" 
                    :checked="p.isMain" 
                    @change="setMainProvider(index)" 
                    name="main_provider"
                    :id="'main_' + index" 
                  />
                  <label :for="'main_' + index" title="Marcar como principal">
                    <i class="fas fa-star" :class="{ 'active': p.isMain }"></i>
                  </label>
                </div>
                <div class="p-select">
                  <SearchableSelect
                    v-model="p.provider"
                    :options="providerOptions"
                    placeholder="Proveedor..."
                  />
                </div>
                <div class="p-price">
                  <div class="price-input-wrapper">
                    <span class="currency">$</span>
                    <input type="number" v-model.number="p.price" step="0.0001" placeholder="0.00" />
                    <span class="unit">/{{ getDisplayUnit(form.unit) }}</span>
                  </div>
                </div>
                <div class="p-actions">
                  <button @click="removeProvider(index)" class="btn-remove-p" type="button">
                    <i class="fas fa-trash-alt"></i>
                  </button>
                </div>
              </div>
            </div>

            <div class="section-divider"></div>

            <!-- SECTION 4: Análisis de Costos -->
            <div class="section-title">Resumen de Costos</div>
            <div v-if="calculatedUnitCost > 0" class="cost-summary">
              <div class="cost-result">
                <span class="cost-label">Costo Actual ({{ mainProvider?.isMain ? 'Principal' : 'Referencia' }})</span>
                <span class="cost-value">${{ formatCost(calculatedUnitCost) }}<span class="cost-unit">/{{ getDisplayUnit(form.unit) }}</span></span>
              </div>
              <div class="cost-total-hint">
                <i class="fas fa-info-circle"></i>
                Este costo se utilizará para cálculos de inventario y despacho.
              </div>
            </div>
            <div v-else class="cost-summary cost-summary--empty">
              <div class="empty-message">
                <i class="fas fa-calculator"></i>
                <div class="text">
                  <strong>Configuración pendiente</strong>
                  <span>Asigna un proveedor principal con su precio para calcular el costo actual.</span>
                </div>
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
            <div v-if="materialToEdit" class="delete-section">
              <button class="btn-delete" @click="openDeleteModal">
                <i class="fas fa-trash"></i> Eliminar Material
              </button>
            </div>
          </div>
        </div>

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
  align-items: end;
  z-index: 2000;
  padding: 0;
  @media (min-width: 640px) { align-items: center; padding: 1rem; }
}

.pro-modal {
  background: white;
  width: 100%;
  max-width: 750px;
  max-height: 95vh;
  border-radius: 28px 28px 0 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 -25px 50px -12px rgba(0, 0, 0, 0.15);
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  @media (min-width: 640px) { border-radius: 36px; }
}

.modal-header {
  padding: 1.5rem;
  background: white;
  border-bottom: 1px solid #f1f5f9;
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: sticky;
  top: 0;
  z-index: 10;
  @media (min-width: 640px) { padding: 2rem 2.5rem; }

  h2 { font-size: 1.25rem; font-weight: 900; color: #1e293b; margin: 0; letter-spacing: -0.02em; @media (min-width: 640px) { font-size: 1.75rem; } }
  .sku-subtitle { font-size: 0.8rem; font-weight: 800; color: $NICOLE-PURPLE; margin-top: 0.25rem; text-transform: uppercase; }
  .btn-close { background: #f1f5f9; border: none; width: 36px; height: 36px; border-radius: 12px; color: #64748b; cursor: pointer; font-size: 1.5rem; }
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
  background: white;
  @media (min-width: 640px) { padding: 2rem 2.5rem; }
}

.section-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.section-title {
  font-size: 0.75rem;
  font-weight: 900;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  @media (min-width: 640px) { font-size: 0.8rem; }
}

.section-divider { height: 2px; background: #f8fafc; margin: 2rem -1.5rem; @media (min-width: 640px) { margin: 2rem -2.5rem; } }

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  label { font-size: 0.75rem; font-weight: 800; color: #64748b; text-transform: uppercase; }
  input, select { padding: 0.9rem; border: 2px solid #f1f5f9; border-radius: 14px; font-size: 1rem; font-weight: 600; background: #f8fafc; &:focus { outline: none; border-color: $NICOLE-PURPLE; } }
}

.form-row { display: flex; flex-direction: column; gap: 1.25rem; @media (min-width: 640px) { flex-direction: row; gap: 1.5rem; } .form-group { flex: 1; } }

.stock-status-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f8fafc;
  padding: 1.25rem;
  border-radius: 20px;
  margin-bottom: 1.5rem;
  border: 1px solid #f1f5f9;
  .badge { padding: 0.4rem 0.8rem; border-radius: 8px; font-weight: 900; font-size: 0.85rem; &.status-urgent { background: #fee2e2; color: #ef4444; } &.status-warning { background: #ffedd5; color: #f97316; } &.status-optimal { background: #dcfce7; color: #16a34a; } &.status-overstock { background: #dbeafe; color: #2563eb; } }
  .stock-level { text-align: right; .current { display: block; font-size: 1.5rem; font-weight: 900; color: #1e293b; } .label { font-size: 0.8rem; color: #64748b; } }
}

.providers-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 1rem;
}

.provider-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: #f8fafc;
  padding: 0.75rem 1rem;
  border-radius: 18px;
  border: 1px solid #f1f5f9;
  transition: all 0.2s;
  &:hover { border-color: #e2e8f0; background: white; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
  .p-main-check { input { display: none; } label { cursor: pointer; font-size: 1.25rem; color: #cbd5e1; transition: all 0.2s; i.active { color: #f59e0b; } } }
  .p-select { flex: 2; min-width: 0; }
  .p-price { flex: 1.5; }
  .price-input-wrapper {
    display: flex;
    align-items: center;
    background: white;
    border: 2px solid #f1f5f9;
    border-radius: 12px;
    padding: 0 0.75rem;
    &:focus-within { border-color: $NICOLE-PURPLE; }
    .currency { color: #94a3b8; font-weight: 700; margin-right: 0.4rem; }
    input { border: none; padding: 0.6rem 0; width: 100%; font-weight: 700; background: transparent; &:focus { outline: none; } }
    .unit { font-size: 0.75rem; color: #94a3b8; font-weight: 600; margin-left: 0.4rem; }
  }
  .btn-remove-p { background: #fee2e2; border: none; width: 36px; height: 36px; border-radius: 10px; color: #ef4444; cursor: pointer; transition: all 0.2s; &:hover { background: #ef4444; color: white; } }
}

.btn-add-provider {
  background: $NICOLE-PURPLE;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 12px;
  font-weight: 800;
  font-size: 0.8rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.cost-summary {
  background: #f5f3ff;
  border: 2px dashed rgba($NICOLE-PURPLE, 0.2);
  padding: 1.5rem;
  border-radius: 24px;
  .cost-value { font-size: 2rem; font-weight: 950; color: $NICOLE-PURPLE; }
  .cost-total-hint { font-size: 0.85rem; font-weight: 600; color: #64748b; margin-top: 0.5rem; }

  &--empty {
    background: #f8fafc;
    border-color: #e2e8f0;
    
    .empty-message {
      display: flex;
      align-items: center;
      gap: 1.25rem;
      color: #94a3b8;

      i {
        font-size: 2rem;
        opacity: 0.5;
      }

      .text {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;

        strong {
          color: #64748b;
          font-size: 0.95rem;
        }

        span {
          font-size: 0.85rem;
          line-height: 1.4;
        }
      }
    }
  }
}

.empty-providers {
  padding: 2rem;
  text-align: center;
  background: #f8fafc;
  border: 2px dashed #e2e8f0;
  border-radius: 20px;
  color: #94a3b8;
  font-size: 0.9rem;
  font-weight: 600;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;

  &::before {
    content: '\f0d1';
    font-family: 'Font Awesome 5 Free';
    font-weight: 900;
    font-size: 1.5rem;
    opacity: 0.5;
  }
}

.modal-footer {
  padding: 1.5rem;
  border-top: 1px solid #f1f5f9;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  .main-actions {
    display: flex;
    flex-direction: column-reverse;
    gap: 0.75rem;
    width: 100%;
    @media (min-width: 640px) { flex-direction: row; gap: 1rem; }
    .btn-cancel { width: 100%; height: 52px; background: white; border: 2px solid #f1f5f9; border-radius: 18px; font-weight: 800; color: #64748b; cursor: pointer; @media (min-width: 640px) { flex: 0 0 120px; } }
    .hold-confirm-btn { flex: 1; height: 56px; border-radius: 18px; }
  }
  .btn-delete { width: 100%; padding: 1rem; border-radius: 16px; border: 1px solid #fee2e2; background: #fff1f2; color: #ef4444; font-weight: 900; cursor: pointer; margin-top: 0.5rem; }
}

.category-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 0.75rem 0;

  .chip {
    padding: 0.4rem 0.9rem;
    border-radius: 99px;
    border: 2px solid #f1f5f9;
    background: white;
    font-size: 0.8rem;
    font-weight: 700;
    color: #64748b;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      border-color: #e2e8f0;
      color: #334155;
    }

    &--active {
      border-color: $NICOLE-PURPLE;
      background: rgba($NICOLE-PURPLE, 0.05);
      color: $NICOLE-PURPLE;
    }
  }
}

.new-cat-row {
  margin-top: 0.5rem;
}

.btn-add-cat-inline {
  background: transparent;
  border: 2px dashed #e2e8f0;
  color: #94a3b8;
  padding: 0.5rem 1rem;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s;

  &:hover {
    border-color: $NICOLE-PURPLE;
    color: $NICOLE-PURPLE;
    background: rgba($NICOLE-PURPLE, 0.02);
  }
}

.new-cat-form {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
  animation: slideDown 0.2s ease-out;

  .new-cat-input {
    flex: 1;
    padding: 0.6rem 0.9rem;
    border: 2px solid $NICOLE-PURPLE;
    border-radius: 10px;
    font-size: 0.9rem;
    font-weight: 600;
    background: white;

    &:focus { outline: none; }
  }

  .btn-cat-confirm {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: $NICOLE-PURPLE;
    color: white;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;

    &:disabled { opacity: 0.5; cursor: not-allowed; }
  }

  .btn-cat-cancel {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: #f1f5f9;
    color: #64748b;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .cat-error {
    position: absolute;
    bottom: -1.25rem;
    left: 0;
    font-size: 0.7rem;
    color: #ef4444;
    font-weight: 600;
  }
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-5px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
