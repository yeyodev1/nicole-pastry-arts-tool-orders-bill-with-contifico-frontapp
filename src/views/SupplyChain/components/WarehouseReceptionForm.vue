<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import SearchableSelect from '@/components/ui/SearchableSelect.vue'
import ConfirmationModal from '@/components/ConfirmationModal.vue'
import type { RawMaterial, Provider, Option, WarehouseInForm } from '@/types/warehouse'

const props = defineProps({
  form: {
    type: Object as () => WarehouseInForm,
    required: true
  },
  materials: {
    type: Array as () => RawMaterial[],
    required: true
  },
  providers: {
    type: Array as () => Provider[],
    required: true
  },
  suggestedOrders: {
    type: Array as () => any[],
    required: true
  },
  isSubmitting: {
    type: Boolean,
    required: true
  },
  materialOptions: {
    type: Array as () => Option[],
    required: true
  },
  filteredProviderOptions: {
    type: Array as () => Option[],
    required: true
  }
})

const emit = defineEmits(['submit', 'apply-suggestion', 'update:form'])

const showInModal = ref(false)

// Utils
const getDisplayUnit = (unit: string) => {
  if (unit === 'g') return 'kg'
  if (unit === 'ml') return 'L'
  return unit
}

const selectedMaterial = computed(() => {
  return props.materials.find((m: RawMaterial) => m._id === props.form.rawMaterial)
})

const totalValue = computed(() => {
  if (!selectedMaterial.value || !props.form.quantity || props.form.quantity <= 0) return 0
  return props.form.quantity * (props.form.unitCost || 0)
})

// Suggestion options for the redesigned selector
const suggestionOptions = computed<Option[]>(() => {
  const options: Option[] = []
  props.suggestedOrders.forEach((order: any) => {
    order.items.forEach((item: any, idx: number) => {
      options.push({
        value: `${order._id}-${idx}`,
        label: `${item.name} (${item.quantity} ${getDisplayUnit(item.unit)})`,
        subtitle: `Proveedor: ${order.provider?.name || 'N/A'} - Orden #${order._id.slice(-4)}`,
        rawOrder: order,
        rawItem: item
      })
    })
  })
  return options
})

const selectedSuggestionId = ref('')

watch(selectedSuggestionId, (newId) => {
  if (newId) {
    const opt = suggestionOptions.value.find(o => o.value === newId)
    if (opt) {
      emit('apply-suggestion', opt.rawOrder, opt.rawItem)
      // Reset after applying
      setTimeout(() => { selectedSuggestionId.value = '' }, 100)
    }
  }
})

const handleSubmit = () => {
  if (!props.form.rawMaterial || props.form.quantity <= 0) return
  showInModal.value = true
}

const confirmIn = () => {
  showInModal.value = false
  emit('submit')
}
</script>

<template>
  <div class="form-tab in-tab">
    <div class="form-card">
      <div class="form-header-with-action">
        <h2>Registrar Recepción</h2>
        
        <!-- Redesigned Suggestion Selector -->
        <div v-if="suggestionOptions.length > 0" class="mini-suggestions">
          <label class="mini-label"><i class="fas fa-magic"></i> ¿Marcar pedido en camino?</label>
          <SearchableSelect
            v-model="selectedSuggestionId"
            :options="suggestionOptions"
            placeholder="Seleccionar pedido..."
            class="suggestion-select"
          />
        </div>
      </div>

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
        <label>Cantidad ({{ selectedMaterial ? getDisplayUnit(selectedMaterial.unit) : 'Unidad' }})</label>
        <input 
          type="number" 
          :value="form.quantity" 
          @input="e => emit('update:form', { ...form, quantity: Number((e.target as HTMLInputElement).value) })"
          min="0" 
          step="0.01" 
        />
      </div>

      <div v-if="selectedMaterial" class="form-group">
        <label>
          Costo por {{ getDisplayUnit(selectedMaterial.unit) }}
          <span class="label-optional">(USD / {{ getDisplayUnit(selectedMaterial.unit) }})</span>
        </label>
        <div class="input-prefix-wrapper">
          <span class="input-prefix">USD</span>
          <input
            type="number"
            :value="form.unitCost"
            @input="e => emit('update:form', { ...form, unitCost: Number((e.target as HTMLInputElement).value) })"
            min="0"
            step="0.0001"
            placeholder="0.0000"
          />
        </div>
      </div>

      <div v-if="selectedMaterial && form.quantity > 0 && form.unitCost > 0" class="value-calculator value-calculator--in">
        <div class="value-calculator__header">
          <i class="fas fa-calculator"></i>
          <span>Valor total de esta recepción</span>
        </div>
        <div class="value-calculator__amount">USD ${{ totalValue.toFixed(2) }}</div>
        <p class="value-calculator__hint">
          {{ form.quantity }} {{ getDisplayUnit(selectedMaterial.unit) }} × ${{ form.unitCost.toFixed(4) }}
        </p>
      </div>

      <div class="form-group">
        <label>Proveedor (Opcional)</label>
        <SearchableSelect
          :modelValue="form.provider"
          @update:modelValue="val => emit('update:form', { ...form, provider: val })"
          :options="filteredProviderOptions"
          placeholder="Buscar proveedor..."
        />
      </div>

      <div class="form-group">
        <label>Responsable</label>
        <input 
          type="text" 
          :value="form.responsible" 
          @input="e => emit('update:form', { ...form, responsible: (e.target as HTMLInputElement).value })"
          placeholder="Nombre completo..." 
        />
      </div>

      <div class="form-group">
        <label>Observación</label>
        <textarea 
          :value="form.observation" 
          @input="e => emit('update:form', { ...form, observation: (e.target as HTMLInputElement).value })"
          rows="2"
        ></textarea>
      </div>

      <div class="actions">
         <button class="btn-primary" @click="handleSubmit" :disabled="isSubmitting || !form.rawMaterial || form.quantity <= 0">
           {{ isSubmitting ? 'Guardando...' : 'Registrar Entrada' }}
         </button>
      </div>
    </div>

    <ConfirmationModal
      :isOpen="showInModal"
      title="Confirmar Recepción"
      message="Confirme los datos de la recepción de materia prima."
      @close="showInModal = false"
      @confirm="confirmIn"
    >
      <template #default> 
         <p>Se registrará una <strong>ENTRADA</strong> de:</p>
         <ul class="modal-list">
           <li><strong>Materia Prima:</strong> {{ selectedMaterial?.name }}</li>
           <li><strong>Cantidad:</strong> {{ form.quantity }} {{ selectedMaterial ? getDisplayUnit(selectedMaterial.unit) : '' }}</li>
           <li><strong>Total recepción:</strong> <span class="modal-value">USD ${{ totalValue.toFixed(2) }}</span></li>
           <li><strong>Proveedor:</strong> {{providers.find((p: Provider) => p._id === form.provider)?.name || 'N/A'}}</li>
         </ul>
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
    margin-top: 0;
    color: $NICOLE-PURPLE;
    margin-bottom: 1.5rem;
  }
}

.form-header-with-action {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 2rem;

  @media (min-width: 640px) {
    flex-direction: row;
    justify-content: space-between;
    align-items: flex-start;
  }

  h2 {
    margin-bottom: 0 !important;
  }
}

.mini-suggestions {
  background: #f8fafc;
  border: 1px dashed $NICOLE-PURPLE;
  padding: 0.75rem;
  border-radius: 10px;
  width: 100%;

  @media (min-width: 640px) {
    width: 280px;
  }

  .mini-label {
    display: block;
    font-size: 0.75rem;
    font-weight: 700;
    color: $NICOLE-PURPLE;
    margin-bottom: 0.4rem;
    text-transform: uppercase;
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
  textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid $border-light;
    border-radius: 6px;
    font-size: 1rem;

    &:focus {
      outline: none;
      border-color: $NICOLE-PURPLE;
      box-shadow: 0 0 0 2px rgba($NICOLE-PURPLE, 0.1);
    }
  }
}

.readonly-display {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background-color: $gray-50;
  border: 1px solid $border-light;
  border-radius: 6px;
  padding: 0.75rem;
  font-weight: 500;

  i {
    color: $NICOLE-PURPLE;
    opacity: 0.7;
  }
}

.input-prefix-wrapper {
  display: flex;
  align-items: center;
  border: 1px solid $border-light;
  border-radius: 6px;
  overflow: hidden;

  &:focus-within {
    border-color: $NICOLE-PURPLE;
    box-shadow: 0 0 0 2px rgba($NICOLE-PURPLE, 0.1);
  }

  input {
    border: none !important;
    padding-left: 0.5rem !important;
  }
}

.input-prefix {
  padding: 0.75rem 0.6rem;
  background: $gray-50;
  color: $text-light;
  font-weight: 600;
  border-right: 1px solid $border-light;
}

.value-calculator {
  border-radius: 10px;
  padding: 1rem;
  margin-bottom: 1.2rem;
  border: 1px solid #86efac;
  background: #f0fdf4;

  &__header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    font-weight: 700;
    color: $text-light;
    margin-bottom: 0.4rem;
  }

  &__amount {
    font-size: 1.5rem;
    font-weight: 800;
    color: #15803d;
  }

  &__hint {
    font-size: 0.75rem;
    color: $text-light;
    margin: 0;
  }
}

.actions {
  margin-top: 1.5rem;
  display: flex;
  justify-content: flex-end;
}

.btn-primary {
  background: $NICOLE-PURPLE;
  color: white;
  border: none;
  padding: 0.8rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
}

.modal-list {
  background: $gray-50;
  padding: 1rem;
  border-radius: 8px;
  list-style: none;
  margin: 1rem 0;
}

.modal-value {
  color: #1d4ed8;
  font-weight: 700;
}

.label-optional {
  font-size: 0.7rem;
  color: $text-light;
}
</style>
