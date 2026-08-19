<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import HoldConfirmButton from '@/components/ui/HoldConfirmButton.vue'
import DeleteMaterialModal from '@/views/SupplyChain/components/DeleteMaterialModal.vue'
import MaterialBasicInfoSection from './raw-material/MaterialBasicInfoSection.vue'
import MaterialStockSection from './raw-material/MaterialStockSection.vue'
import MaterialProvidersSection from './raw-material/MaterialProvidersSection.vue'
import MaterialCostSummary from './raw-material/MaterialCostSummary.vue'
import MaterialContificoSection from './raw-material/MaterialContificoSection.vue'
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

const displayUnit = computed(() => getDisplayUnit(form.value.unit))

const mainProvider = computed(() => form.value.providers.find(p => p.isMain))
const calculatedUnitCost = computed(() => (mainProvider.value ? mainProvider.value.price : 0))

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
    // Snapshot para detectar cambios sin guardar
    initialSnapshot.value = JSON.stringify(form.value)
    showCloseConfirm.value = false
  }
}, { immediate: true })

// --- Cierre con confirmación si hay cambios sin guardar ---
const initialSnapshot = ref('')
const showCloseConfirm = ref(false)

const isDirty = computed(() => JSON.stringify(form.value) !== initialSnapshot.value)

const requestClose = () => {
  if (isDirty.value) {
    showCloseConfirm.value = true
  } else {
    emit('close')
  }
}

const confirmClose = () => {
  showCloseConfirm.value = false
  emit('close')
}

const stockStatus = computed(() => {
  const current = form.value.quantity || 0
  const min = form.value.minStock || 0
  const max = form.value.maxStock || 0

  if (current === 0) return { label: 'URGENTE / INSUFICIENTE', class: 'status-urgent' }
  if (min === 0 && max === 0) return { label: '---', class: '' }

  if (current < min) return { label: 'URGENTE / INSUFICIENTE', class: 'status-urgent' }
  if (current >= min && current < (min * 1.5)) return { label: 'ESCASO / ALERTA', class: 'status-warning' }
  if (current >= (min * 1.5) && (max === 0 || current <= max)) return { label: 'ÓPTIMO', class: 'status-optimal' }
  if (max > 0 && current > max) return { label: 'SOBRESTOCK', class: 'status-overstock' }

  return { label: '---', class: '' }
})

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

// Delete Logic
const isDeleteModalOpen = ref(false)
const openDeleteModal = () => { isDeleteModalOpen.value = true }
const handleConfirmDelete = () => {
  if (props.materialToEdit) {
    emit('delete', props.materialToEdit._id)
    isDeleteModalOpen.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <transition name="modal-bounce">
      <div v-if="isOpen" class="modal-overlay" @click.self="requestClose">
        <div class="modal-content pro-modal">
          <div class="modal-header">
            <div class="header-info">
              <h2>
                <i class="fas" :class="materialToEdit ? 'fa-pen-to-square fa-edit' : 'fa-plus-circle'"></i>
                {{ materialToEdit ? 'Editar Material' : 'Nuevo Material' }}
              </h2>
              <p v-if="materialToEdit" class="sku-subtitle">
                SKU: {{ form.code }}
                <span v-if="materialToEdit.fromContifico" class="header-ctf-badge">
                  <i class="fas fa-link"></i> Contífico
                </span>
              </p>
            </div>
            <button class="btn-close" @click="requestClose">&times;</button>
          </div>

          <!-- Confirmación amigable de cierre con cambios sin guardar -->
          <transition name="confirm-fade">
            <div v-if="showCloseConfirm" class="close-confirm-overlay" @click.self="showCloseConfirm = false">
              <div class="close-confirm-card">
                <div class="confirm-icon"><i class="fas fa-hand-paper"></i></div>
                <h3>¿Cerrar sin guardar?</h3>
                <p>Hiciste cambios que aún no se guardan. Si cierras ahora, se perderán.</p>
                <div class="confirm-actions">
                  <button type="button" class="btn-keep-editing" @click="showCloseConfirm = false">
                    Seguir editando
                  </button>
                  <button type="button" class="btn-discard" @click="confirmClose">
                    Cerrar sin guardar
                  </button>
                </div>
              </div>
            </div>
          </transition>

          <div class="modal-body">
            <MaterialBasicInfoSection
              :form="form"
              :categories="categories"
              :units="units"
              :is-editing="!!materialToEdit"
              @category-created="$emit('category-created', $event)"
            />

            <div class="section-divider"></div>

            <MaterialStockSection
              :key="`stock-${materialToEdit?._id || 'new'}`"
              :form="form"
              :material-to-edit="materialToEdit"
              :display-unit="displayUnit"
              :stock-status="stockStatus"
              :unit-cost="calculatedUnitCost"
            />

            <div class="section-divider"></div>

            <MaterialProvidersSection
              :form="form"
              :providers="providers"
              :display-unit="displayUnit"
            />

            <div class="section-divider"></div>

            <MaterialCostSummary
              :unit-cost="calculatedUnitCost"
              :display-unit="displayUnit"
              :is-main="!!mainProvider?.isMain"
            />

            <template v-if="materialToEdit">
              <div class="section-divider"></div>
              <MaterialContificoSection
                :key="`ctf-${materialToEdit._id}`"
                :material="materialToEdit"
              />
            </template>
          </div>

          <div class="modal-footer pro-footer">
            <div class="main-actions">
              <button class="btn-cancel" @click="requestClose">Cerrar</button>
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
/* --- Transición de apertura/cierre del modal --- */
.modal-bounce-enter-active {
  transition: opacity 0.25s ease;

  .modal-content {
    transition: transform 0.35s cubic-bezier(0.34, 1.4, 0.64, 1), opacity 0.25s ease;
  }
}

.modal-bounce-leave-active {
  transition: opacity 0.2s ease;

  .modal-content {
    transition: transform 0.2s ease, opacity 0.2s ease;
  }
}

.modal-bounce-enter-from,
.modal-bounce-leave-to {
  opacity: 0;

  .modal-content {
    transform: translateY(48px) scale(0.96);
    opacity: 0;
  }
}

/* --- Confirmación amigable de cierre --- */
.confirm-fade-enter-active,
.confirm-fade-leave-active {
  transition: opacity 0.2s ease;

  .close-confirm-card { transition: transform 0.25s cubic-bezier(0.34, 1.4, 0.64, 1); }
}

.confirm-fade-enter-from,
.confirm-fade-leave-to {
  opacity: 0;

  .close-confirm-card { transform: scale(0.92); }
}

.close-confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2100;
  padding: 1.5rem;
}

.close-confirm-card {
  background: white;
  border-radius: 16px;
  padding: 1.75rem;
  max-width: 380px;
  width: 100%;
  text-align: center;
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.25);

  .confirm-icon {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: #fef3c7;
    color: #d97706;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.4rem;
    margin: 0 auto 0.9rem;
  }

  h3 {
    margin: 0 0 0.4rem;
    font-size: 1.1rem;
    color: #1e293b;
  }

  p {
    margin: 0 0 1.25rem;
    font-size: 0.88rem;
    color: #64748b;
    line-height: 1.5;
  }
}

.confirm-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  .btn-keep-editing {
    background: #7c3aed;
    color: white;
    border: none;
    border-radius: 10px;
    padding: 0.7rem;
    font-weight: 700;
    cursor: pointer;
    font-size: 0.9rem;

    &:hover { background: #6d28d9; }
  }

  .btn-discard {
    background: transparent;
    color: #b91c1c;
    border: none;
    border-radius: 10px;
    padding: 0.6rem;
    font-weight: 600;
    cursor: pointer;
    font-size: 0.85rem;

    &:hover { background: #fef2f2; }
  }
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(6px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
  padding: 0;
  @media (min-width: 640px) { padding: 1.5rem; }
}

.pro-modal {
  background: white;
  width: 100%;
  height: 100dvh;
  max-height: 100dvh;
  border-radius: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 -25px 50px -12px rgba(0, 0, 0, 0.15);
  @media (min-width: 640px) {
    height: auto;
    max-height: 90vh;
    max-width: 750px;
    border-radius: 36px;
  }
}

.modal-header {
  padding: 1.5rem;
  background: white;
  border-bottom: 1px solid #f1f5f9;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 10;
  @media (min-width: 640px) { padding: 2rem 2.5rem; }

  h2 {
    font-size: 1.25rem;
    font-weight: 900;
    color: #1e293b;
    margin: 0;
    letter-spacing: -0.02em;
    display: flex;
    align-items: center;
    gap: 0.6rem;

    i { color: $NICOLE-PURPLE; font-size: 1.1rem; }

    @media (min-width: 640px) { font-size: 1.75rem; }
  }

  .sku-subtitle {
    font-size: 0.8rem;
    font-weight: 800;
    color: $NICOLE-PURPLE;
    margin-top: 0.25rem;
    text-transform: uppercase;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .header-ctf-badge {
    background: #ede9fe;
    color: #6d28d9;
    border-radius: 999px;
    padding: 0.1rem 0.55rem;
    font-size: 0.65rem;
    font-weight: 800;
    text-transform: none;

    i { font-size: 0.58rem; margin-right: 0.2rem; }
  }

  .btn-close { background: #f1f5f9; border: none; width: 36px; height: 36px; border-radius: 12px; color: #64748b; cursor: pointer; font-size: 1.5rem; }
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  flex: 1 1 auto;
  min-height: 0;
  background: white;
  @media (min-width: 640px) { padding: 2rem 2.5rem; }
}

.section-divider { height: 2px; background: #f8fafc; margin: 2rem -1.5rem; @media (min-width: 640px) { margin: 2rem -2.5rem; } }

.modal-footer {
  padding: 1.5rem;
  border-top: 1px solid #f1f5f9;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
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
</style>
