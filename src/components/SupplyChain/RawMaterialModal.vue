<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import HoldConfirmButton from '@/components/ui/HoldConfirmButton.vue'

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
  provider: '',
  category: '',
  presentationName: '',
  presentationPrice: 0,
  presentationQuantity: 1,
  incomingQuantity: 0,
  lastInvoice: '',
  lastEntryNumber: '',
  wastePercentage: 0
})

const units = [
  { value: 'g', label: 'Gramos (g/kg)' },
  { value: 'ml', label: 'Mililitros (ml/L)' },
  { value: 'u', label: 'Unidades (u)' }
]

const calculatedUnitCost = computed(() => {
  if (form.value.presentationPrice > 0 && form.value.presentationQuantity > 0) {
    return form.value.presentationPrice / form.value.presentationQuantity
  }
  return 0
})

const getDisplayQuantity = (quantity: number, unit: string) => {
  if (unit === 'g' || unit === 'ml') return quantity / 1000
  return quantity
}

const getDisplayUnit = (unit: string) => {
  if (unit === 'g') return 'kg'
  if (unit === 'ml') return 'L'
  return unit
}

const toBackendQuantity = (inputQty: number, unit: string) => {
  if (unit === 'g' || unit === 'ml') return inputQty * 1000
  return inputQty
}

const resetForm = () => {
  form.value = {
    name: '',
    item: '',
    code: '',
    unit: 'u',
    quantity: 0,
    minStock: 0,
    provider: '',
    category: '',
    presentationName: '',
    presentationPrice: 0,
    presentationQuantity: 1,
    incomingQuantity: 0,
    lastInvoice: '',
    lastEntryNumber: '',
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
        quantity: getDisplayQuantity(m.quantity || 0, m.unit),
        minStock: getDisplayQuantity(m.minStock || 0, m.unit),
        provider: m.provider?._id || m.provider || '',
        category: m.category || '',
        presentationName: m.presentationName || '',
        presentationPrice: m.presentationPrice || 0,
        presentationQuantity: m.presentationQuantity || 1,
        incomingQuantity: 0,
        lastInvoice: m.lastInvoice || '',
        lastEntryNumber: m.lastEntryNumber || '',
        wastePercentage: m.wastePercentage || 0
      }
    } else {
      resetForm()
    }
  }
}, { immediate: true })

const generateCode = (category: string, item: string) => {
  const catChar = category && category.length > 0 ? category.charAt(0).toUpperCase() : 'X'
  const itemChar = item && item.length > 1 ? item.charAt(1).toLowerCase() : (item && item.length > 0 ? item.charAt(0).toLowerCase() : 'x')
  const randomNum = Math.floor(Math.random() * 900) + 100
  return `${catChar}${itemChar}${randomNum}`
}

const handleSubmit = () => {
  const payload: any = { ...form.value }

  if (payload.incomingQuantity > 0) {
    const currentInBase = toBackendQuantity(form.value.quantity, form.value.unit)
    const incomingInBase = payload.incomingQuantity * payload.presentationQuantity
    payload.quantity = currentInBase + incomingInBase
    payload.lastMovementDate = new Date()
  } else {
    payload.quantity = toBackendQuantity(payload.quantity, payload.unit)
  }

  payload.minStock = toBackendQuantity(payload.minStock || 0, payload.unit)
  payload.cost = calculatedUnitCost.value

  if (!payload.code) {
    payload.code = generateCode(payload.category, payload.item || payload.name)
  }

  if (!payload.provider) delete payload.provider
  delete payload.incomingQuantity

  emit('save', payload)
}
</script>

<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content pro-modal">
      <div class="modal-header">
        <div class="header-info">
          <h2>{{ materialToEdit ? 'Detalle y Gestión de Stock' : 'Nuevo Ingreso de Material' }}</h2>
          <p v-if="materialToEdit" class="sku-subtitle">SKU: {{ form.code }} | {{ form.item }}</p>
        </div>
        <button class="btn-close" @click="$emit('close')">&times;</button>
      </div>

      <div class="modal-body">
        <div class="section-title">Información del Producto</div>
        <div class="form-row">
          <div class="form-group flex-2">
            <label>Nombre Específico / Marca</label>
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
            <select v-model="form.category">
              <option value="">Sin Categoría</option>
              <option v-for="cat in categories" :key="cat._id" :value="cat.name">{{ cat.name }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>Unidad Base</label>
            <select v-model="form.unit" :disabled="!!materialToEdit">
              <option v-for="u in units" :key="u.value" :value="u.value">{{ u.label }}</option>
            </select>
          </div>
        </div>

        <div class="section-divider"></div>
        <div class="section-title">Datos del Proveedor y Compra</div>
        
        <div class="form-group">
          <label>Proveedor Asociado</label>
          <select v-model="form.provider">
            <option value="">-- Seleccionar Proveedor --</option>
            <option v-for="p in providers" :key="p._id" :value="p._id">{{ p.name }}</option>
          </select>
        </div>

        <div class="form-row highlight">
          <div class="form-group flex-2">
            <label>Presentación del Proveedor</label>
            <input v-model="form.presentationName" placeholder="Ej. Saco 25kg, Galón 4L" />
          </div>
          <div class="form-group flex-1">
            <label>Cant. en {{ form.unit }}</label>
            <input type="number" v-model.number="form.presentationQuantity" />
          </div>
          <div class="form-group flex-1">
            <label>Precio Compra ($)</label>
            <input type="number" v-model.number="form.presentationPrice" step="0.01" />
          </div>
        </div>

        <div class="cost-summary" v-if="calculatedUnitCost > 0">
          <span class="label">Costo por {{ getDisplayUnit(form.unit) }}:</span>
          <span class="value">${{ (calculatedUnitCost * (form.unit === 'u' ? 1 : 1000)).toFixed(4) }}</span>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>No. Factura</label>
            <input v-model="form.lastInvoice" placeholder="001-001..." />
          </div>
          <div class="form-group">
            <label>No. de Ingreso</label>
            <input v-model="form.lastEntryNumber" placeholder="Ej. ENT-123" />
          </div>
        </div>

        <div class="section-divider"></div>
        <div class="section-title highlight-title">Gestión de Stock</div>
        <div class="stock-action-box">
           <div class="stock-current">
              <label>Inventario Actual</label>
              <div class="value">{{ form.quantity }} {{ getDisplayUnit(form.unit) }}</div>
           </div>
           <div class="stock-incoming">
              <label>CUANTO LLEGARÍA (Presentaciones)</label>
              <input type="number" v-model.number="form.incomingQuantity" class="entry-field" />
           </div>
           <div class="stock-total">
              <label>Existencia Final</label>
              <div class="value total">{{ (Number(form.quantity) + (Number(form.incomingQuantity) * (form.unit === 'u' ? form.presentationQuantity : form.presentationQuantity / 1000))).toFixed(2) }} {{ getDisplayUnit(form.unit) }}</div>
           </div>
        </div>
      </div>

      <div class="modal-footer pro-footer">
        <HoldConfirmButton 
          v-if="materialToEdit"
          label="ELIMINAR REGISTRO"
          color="#ef4444"
          class="btn-delete"
          @confirmed="$emit('delete', materialToEdit._id)"
        />
        <div class="main-actions">
          <button class="btn-cancel" @click="$emit('close')">Cerrar</button>
          <HoldConfirmButton 
            :label="materialToEdit ? 'GUARDAR CAMBIOS' : 'CONFIRMAR INGRESO'"
            :disabled="isSaving || !form.name || !form.item"
            :hold-time="1200"
            @confirmed="handleSubmit"
          />
        </div>
      </div>
    </div>
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
  justify-content: flex-end; // Right align
  align-items: center;
  gap: 0.5rem;
  margin-top: -0.5rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;

  @media (min-width: 640px) {
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .label {
    font-weight: 800;
    color: #94a3b8;
    font-size: 0.8rem;

    @media (min-width: 640px) {
      font-size: 0.9rem;
    }
  }

  .value {
    font-weight: 900;
    color: #0f172a;
    font-size: 1.1rem;
    font-family: 'JetBrains Mono', monospace;

    @media (min-width: 640px) {
      font-size: 1.25rem;
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

  .btn-delete {
    width: 100%;
    border-radius: 18px;
    height: 52px;
    font-weight: 900;
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
