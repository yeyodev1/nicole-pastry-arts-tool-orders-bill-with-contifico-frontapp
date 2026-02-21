<script setup lang="ts">
import { ref, computed } from 'vue'
import SearchableSelect from '@/components/ui/SearchableSelect.vue'

const props = defineProps({
  form: { type: Object, required: true },
  materials: { type: Array, required: true },
  entityOptions: { type: Array, required: true },
  materialOptions: { type: Array, required: true },
  isSubmitting: { type: Boolean, required: true },
  holdProgress: { type: Number, required: true },
  isHolding: { type: Boolean, required: true }
})

const emit = defineEmits(['submit', 'update:form', 'start-hold', 'cancel-hold'])

const showOutModal = ref(false)

// Utils
const getDisplayUnit = (unit: string) => {
  if (unit === 'g') return 'kg'
  if (unit === 'ml') return 'L'
  return unit
}

const getDisplayCost = (cost: number, unit: string): number => {
  if (unit === 'g' || unit === 'ml') return cost * 1000
  return cost
}

const toBackendQuantity = (inputQty: number, unit: string) => {
  if (unit === 'g' || unit === 'ml') return inputQty * 1000
  return inputQty
}

const selectedMaterial = computed(() => {
  return props.materials.find((m: any) => m._id === props.form.rawMaterial)
})

const totalValue = computed(() => {
  if (!selectedMaterial.value || !props.form.quantity || props.form.quantity <= 0) return 0
  const displayCost = getDisplayCost(selectedMaterial.value.cost || 0, selectedMaterial.value.unit)
  return props.form.quantity * displayCost
})

const showRentabilityAlert = computed(() => {
  if (!props.form.expectedSaleValue || props.form.expectedSaleValue <= 0) return false
  return totalValue.value >= props.form.expectedSaleValue
})

const handleSubmit = () => {
  if (!props.form.rawMaterial || props.form.quantity <= 0 || !props.form.entity) return

  // Validation
  if (selectedMaterial.value) {
    const requestQtyBackend = toBackendQuantity(props.form.quantity, selectedMaterial.value.unit)
    if (selectedMaterial.value.quantity < requestQtyBackend) {
      return emit('submit', 'error_stock')
    }
  }

  showOutModal.value = true
}

const cancelHold = () => {
  showOutModal.value = false
  emit('cancel-hold')
}
</script>

<template>
  <div class="form-tab out-tab">
    <div class="form-card">
      <h2>Registrar Despacho</h2>
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
        <span v-if="selectedMaterial && selectedMaterial.quantity < toBackendQuantity(form.quantity, selectedMaterial.unit)" class="error-text">
           Stock insuficiente
        </span>
      </div>

      <div v-if="selectedMaterial && form.quantity > 0" class="value-calculator value-calculator--out">
        <div class="value-calculator__header">
          <i class="fas fa-boxes"></i>
          <span>Valor del despacho</span>
        </div>
        <div class="value-calculator__amount">USD ${{ totalValue.toFixed(2) }}</div>
        <p class="value-calculator__hint">
          Costo catálogo: ${{ getDisplayCost(selectedMaterial.cost || 0, selectedMaterial.unit).toFixed(4) }} / {{ getDisplayUnit(selectedMaterial.unit) }}
        </p>
      </div>

      <div class="form-group">
        <label>Venta esperada <span class="label-optional">(Opcional)</span></label>
        <div class="input-prefix-wrapper">
          <span class="input-prefix">$</span>
          <input 
            type="number" 
            :value="form.expectedSaleValue" 
            @input="e => emit('update:form', { ...form, expectedSaleValue: Number((e.target as HTMLInputElement).value) })"
            min="0" 
            step="0.01" 
          />
        </div>
      </div>

      <div v-if="showRentabilityAlert" class="rentability-alert">
        <div class="rentability-alert__icon">⚠️</div>
        <div class="rentability-alert__body">
          <strong>ALERTA DE RENTABILIDAD</strong>
          <p>El costo supera o iguala la venta esperada proyectada.</p>
        </div>
      </div>

      <div class="form-group">
        <label>Destino (Entidad)</label>
        <SearchableSelect
          :modelValue="form.entity"
          @update:modelValue="val => emit('update:form', { ...form, entity: val })"
          :options="entityOptions"
          placeholder="Buscar destino..."
        />
      </div>

      <div class="form-group">
        <label>Recibido por</label>
        <input 
          type="text" 
          :value="form.responsible" 
          @input="e => emit('update:form', { ...form, responsible: (e.target as HTMLInputElement).value })"
          placeholder="Nombre..." 
        />
        <div class="suggested-tags">
           <span v-for="name in ['Bryan', 'Danny', 'Saraí']" :key="name" class="tag" @click="emit('update:form', { ...form, responsible: name })">
             {{ name }}
           </span>
        </div>
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
         <button class="btn-primary" @click="handleSubmit" :disabled="isSubmitting || !form.rawMaterial || form.quantity <= 0 || !form.entity">
           Registrar Salida
         </button>
      </div>
    </div>

    <!-- Custom Modal for Out (Touch/Hold) -->
    <div v-if="showOutModal" class="modal-overlay">
      <div class="modal-content">
        <h3>Confirmar Despacho</h3>
        <p>Confirmar registro de <strong>SALIDA</strong>:</p>
         <ul class="modal-list">
           <li><strong>Material:</strong> {{ selectedMaterial?.name }}</li>
           <li><strong>Cantidad:</strong> {{ form.quantity }} {{ selectedMaterial ? getDisplayUnit(selectedMaterial.unit) : '' }}</li>
           <li><strong>Destino:</strong> {{ form.entity }}</li>
         </ul>
        
        <div class="hold-button-container">
          <button 
            class="hold-btn" 
            @mousedown="emit('start-hold')" 
            @mouseleave="emit('cancel-hold')" 
            @mouseup="emit('cancel-hold')"
            @touchstart.prevent="emit('start-hold')"
            @touchend.prevent="emit('cancel-hold')"
          >
            <span class="btn-text">Mantén para confirmar</span>
            <div class="progress-bar" :style="{ width: holdProgress + '%' }"></div>
          </button>
          <button class="btn-cancel" @click="cancelHold">Cancelar</button>
        </div>
      </div>
    </div>
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
  textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid $border-light;
    border-radius: 6px;
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

.input-prefix-wrapper {
  display: flex;
  border: 1px solid $border-light;
  border-radius: 6px;
  overflow: hidden;

  input {
    border: none !important;
    flex: 1;
    padding: 0.75rem;
  }
}

.input-prefix {
  padding: 0.75rem;
  background: $gray-50;
  border-right: 1px solid $border-light;
  color: $text-light;
  font-weight: 600;
}

.value-calculator {
  border-radius: 10px;
  padding: 1rem;
  margin-bottom: 1.2rem;
  border: 1px solid #93c5fd;
  background: #eff6ff;

  &__amount {
    font-size: 1.5rem;
    font-weight: 800;
    color: #1d4ed8;
  }

  &__header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    color: $text-light;
    font-weight: 700;
    margin-bottom: 0.4rem;
  }

  &__hint {
    font-size: 0.75rem;
    color: $text-light;
    margin: 0;
  }
}

.rentability-alert {
  display: flex;
  gap: 1rem;
  background: #fff7ed;
  border: 1px solid #fb923c;
  border-radius: 10px;
  padding: 1rem;
  margin-bottom: 1.2rem;

  &__icon {
    font-size: 1.5rem;
  }

  &__body {
    font-size: 0.85rem;
    color: #7c2d12;

    strong {
      color: #c2410c;
    }

    p {
      margin: 0.2rem 0 0;
    }
  }
}

.suggested-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;

  .tag {
    font-size: 0.75rem;
    font-weight: 700;
    color: $NICOLE-PURPLE;
    background: rgba($NICOLE-PURPLE, 0.08);
    padding: 0.3rem 0.8rem;
    border-radius: 999px;
    cursor: pointer;
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
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
}

.modal-content {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  max-width: 400px;
  text-align: center;
}

.hold-button-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 1.5rem;
}

.hold-btn {
  position: relative;
  background: $error;
  color: white;
  border: none;
  padding: 1rem;
  border-radius: 8px;
  font-weight: 600;
  overflow: hidden;

  .btn-text {
    position: relative;
    z-index: 2;
  }

  .progress-bar {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    background: rgba(0, 0, 0, 0.2);
    z-index: 1;
    transition: width 0.05s linear;
  }
}

.btn-cancel {
  background: transparent;
  border: 1px solid $border-light;
  padding: 0.8rem;
  border-radius: 8px;
  color: $text-light;
}

.error-text {
  color: $error;
  font-size: 0.75rem;
}

.modal-list {
  list-style: none;
  padding: 0;
  background: $gray-50;
  border-radius: 8px;
  padding: 1rem;
  margin: 1rem 0;
  text-align: left;

  li {
    font-size: 0.9rem;
    margin-bottom: 0.3rem;
  }
}
</style>
