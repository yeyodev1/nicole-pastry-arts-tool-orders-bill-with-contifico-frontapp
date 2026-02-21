<script setup lang="ts">
import { ref, computed } from 'vue'
import SearchableSelect from '@/components/ui/SearchableSelect.vue'
import ConfirmationModal from '@/components/ConfirmationModal.vue'
import type { RawMaterial, Option, WarehouseLossFormState } from '@/types/warehouse'

const props = defineProps({
  form: {
    type: Object as () => WarehouseLossFormState,
    required: true
  },
  materials: {
    type: Array as () => RawMaterial[],
    required: true
  },
  materialOptions: {
    type: Array as () => Option[],
    required: true
  },
  isSubmitting: {
    type: Boolean,
    required: true
  }
})

const emit = defineEmits(['submit', 'update:form'])

const showLossModal = ref(false)

const getDisplayUnit = (unit: string) => {
  if (unit === 'g') return 'kg'
  if (unit === 'ml') return 'L'
  return unit
}

const getDisplayQuantity = (quantity: number, unit: string) => {
  if (unit === 'g' || unit === 'ml') return (quantity / 1000).toFixed(2)
  return quantity.toFixed(2)
}

const toBackendQuantity = (inputQty: number, unit: string) => {
  if (unit === 'g' || unit === 'ml') return inputQty * 1000
  return inputQty
}

const selectedMaterial = computed(() => {
  return props.materials.find((m: RawMaterial) => m._id === props.form.rawMaterial)
})

const handleSubmit = () => {
  if (!props.form.rawMaterial || props.form.quantity <= 0) return

  if (selectedMaterial.value) {
    const requestQtyBackend = toBackendQuantity(props.form.quantity, selectedMaterial.value.unit)
    if (selectedMaterial.value.quantity < requestQtyBackend) {
      return emit('submit', 'error_stock')
    }
  }

  showLossModal.value = true
}

const confirmLoss = () => {
  showLossModal.value = false
  emit('submit')
}
</script>

<template>
  <div class="form-tab loss-tab">
    <div class="form-card">
      <h2>Registrar Baja de Inventario</h2>
      <div class="form-row">
        <div class="form-group half">
          <label>Fecha</label>
          <div class="readonly-display">
            <i class="fas fa-calendar-day"></i>
            <span>{{ form.date }}</span>
          </div>
        </div>
        <div class="form-group half">
          <label>Hora</label>
          <div class="readonly-display">
            <i class="fas fa-clock"></i>
            <span>{{ form.time }}</span>
          </div>
        </div>
      </div>

      <div class="form-group">
        <label>Materia Prima</label>
        <SearchableSelect
          :modelValue="form.rawMaterial"
          @update:modelValue="val => emit('update:form', { ...form, rawMaterial: val })"
          :options="materialOptions"
          placeholder="Buscar materia prima..."
        />
      </div>

      <div class="form-group">
        <label>Cantidad a dar de baja ({{ selectedMaterial ? getDisplayUnit(selectedMaterial.unit) : 'Unidad' }})</label>
        <input 
          type="number" 
          :value="form.quantity" 
          @input="e => emit('update:form', { ...form, quantity: Number((e.target as HTMLInputElement).value) })"
          min="0" 
          step="0.01" 
        />
        <span v-if="selectedMaterial && selectedMaterial.quantity < toBackendQuantity(form.quantity, selectedMaterial.unit)" class="error-text">
           Stock insuficiente
        </span>
      </div>

      <div class="form-group">
        <label>Motivo de la Baja</label>
        <select 
          :value="form.reason" 
          @change="e => emit('update:form', { ...form, reason: (e.target as HTMLSelectElement).value })"
        >
          <option value="CADUCIDAD">CADUCIDAD</option>
          <option value="MAL_ESTADO">MAL ESTADO / DAÑADO</option>
          <option value="ROBO_EXTRAVIO">ROBO / EXTRAVÍO</option>
          <option value="ERROR_PESAJE">ERROR DE PESAJE</option>
          <option value="OTRO">OTRO</option>
        </select>
      </div>

      <div class="form-group">
        <label>Responsable</label>
        <input 
          type="text" 
          :value="form.responsible" 
          @input="e => emit('update:form', { ...form, responsible: (e.target as HTMLInputElement).value })"
          placeholder="Quién registra..." 
        />
      </div>

      <div class="form-group">
        <label>Observación Detallada</label>
        <textarea 
          :value="form.observation" 
          @input="e => emit('update:form', { ...form, observation: (e.target as HTMLInputElement).value })"
          rows="3"
        ></textarea>
      </div>

      <div class="actions">
         <button class="btn-primary btn-loss" @click="handleSubmit" :disabled="isSubmitting || !form.rawMaterial || form.quantity <= 0">
           Registrar Baja
         </button>
      </div>
    </div>

    <ConfirmationModal
      :isOpen="showLossModal"
      title="Confirmar Baja"
      message="Confirme el registro de la baja de inventario."
      @close="showLossModal = false"
      @confirm="confirmLoss"
    >
      <template #default> 
         <p>Se registrará una <strong>BAJA (Pérdida)</strong> de:</p>
         <ul class="modal-list">
           <li><strong>Materia Prima:</strong> {{ selectedMaterial?.name }}</li>
           <li><strong>Cantidad:</strong> {{ form.quantity }} {{ selectedMaterial ? getDisplayUnit(selectedMaterial.unit) : '' }}</li>
           <li><strong>Motivo:</strong> {{ form.reason }}</li>
         </ul>
         <p class="text-danger small">Esta acción restará el stock permanentemente.</p>
      </template>
    </ConfirmationModal>
  </div>
</template>

<style lang="scss" scoped>
.form-tab {
  display: flex;
  justify-content: center;
  width: 100%;
}

.form-card {
  background: white;
  padding: 1.25rem;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  width: 100%;
  max-width: 600px;
  border: 1px solid $border-light;

  @media (min-width: 640px) {
    padding: 2rem;
  }

  h2 {
    color: $NICOLE-PURPLE;
    margin: 0 0 1.5rem;
  }
}

.form-row {
  display: flex;
  flex-direction: column;

  @media (min-width: 640px) {
    flex-direction: row;
    gap: 1rem;
  }
}

.form-group {
  margin-bottom: 1.2rem;

  &.half {
    width: 100%;

    @media (min-width: 640px) {
      width: 50%;
    }
  }

  label {
    display: block;
    margin-bottom: 0.4rem;
    font-weight: 500;
  }

  input,
  select,
  textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid $border-light;
    border-radius: 6px;
    font-size: 1rem;
  }
}

.readonly-display {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: $gray-50;
  padding: 0.75rem;
  border-radius: 6px;
}

.actions {
  margin-top: 1.5rem;
  display: flex;
  justify-content: flex-end;
}

.btn-primary {
  background: $NICOLE-PURPLE;
  color: white;
  padding: 0.8rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;

  &.btn-loss {
    background: #ef4444;
  }
}

.modal-list {
  background: $gray-50;
  padding: 1rem;
  border-radius: 8px;
  list-style: none;
  margin: 1rem 0;
  text-align: left;

  li {
    font-size: 0.9rem;
    margin-bottom: 0.3rem;
  }
}

.text-danger {
  color: #ef4444;
  font-size: 0.8rem;
}

.error-text {
  color: $error;
  font-size: 0.75rem;
}
</style>
