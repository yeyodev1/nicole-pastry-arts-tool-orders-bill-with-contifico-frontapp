<script setup lang="ts">
import { ref, computed } from 'vue'
import SearchableSelect from '@/components/ui/SearchableSelect.vue'
import type { RawMaterial, Option, WarehouseOutForm } from '@/types/warehouse'

const props = defineProps({
  form: {
    type: Object as () => WarehouseOutForm,
    required: true
  },
  materials: {
    type: Array as () => RawMaterial[],
    required: true
  },
  entityOptions: {
    type: Array as () => Option[],
    required: true
  },
  materialOptions: {
    type: Array as () => Option[],
    required: true
  },
  isSubmitting: {
    type: Boolean,
    required: true
  },
  holdProgress: {
    type: Number,
    required: true
  },
  isHolding: {
    type: Boolean,
    required: true
  }
})

const emit = defineEmits(['submit', 'update:form', 'start-hold', 'cancel-hold'])

const showOutModal = ref(false)

const getDisplayUnit = (unit: string) => {
  if (unit === 'g') return 'kg'
  if (unit === 'ml') return 'lt'
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
  return props.materials.find((m: RawMaterial) => m._id === props.form.rawMaterial)
})

const totalValue = computed(() => {
  if (!selectedMaterial.value || !props.form.quantity || props.form.quantity <= 0) return 0
  const displayCost = getDisplayCost(selectedMaterial.value.cost || 0, selectedMaterial.value.unit)
  return props.form.quantity * displayCost
})

const stockAfterDispatch = computed(() => {
  if (!selectedMaterial.value || !props.form.quantity || props.form.quantity <= 0) return null
  const m = selectedMaterial.value
  const backendQty = toBackendQuantity(props.form.quantity, m.unit)
  const remaining = m.quantity - backendQty
  const displayRemaining = (m.unit === 'g' || m.unit === 'ml') ? (remaining / 1000).toFixed(2) : remaining.toFixed(2)
  return { remaining: parseFloat(displayRemaining), unit: getDisplayUnit(m.unit), isNegative: remaining < 0 }
})

const showRentabilityAlert = computed(() => {
  if (!props.form.expectedSaleValue || props.form.expectedSaleValue <= 0) return false
  return totalValue.value >= props.form.expectedSaleValue
})

const insufficientStock = computed(() => {
  if (!selectedMaterial.value || !props.form.quantity || props.form.quantity <= 0) return false
  return selectedMaterial.value.quantity < toBackendQuantity(props.form.quantity, selectedMaterial.value.unit)
})

const handleSubmit = () => {
  if (!props.form.rawMaterial || props.form.quantity <= 0 || !props.form.entity) return
  if (insufficientStock.value) return emit('submit', 'error_stock')
  showOutModal.value = true
}

const cancelHold = () => {
  showOutModal.value = false
  emit('cancel-hold')
}
</script>

<template>
  <div class="dispatch-layout">

    <!-- Left: Form -->
    <div class="form-panel">
      <div class="panel-header panel-header--out">
        <div class="panel-icon"><i class="fas fa-truck-loading"></i></div>
        <div>
          <h2>Registrar Despacho</h2>
          <p>Registra la salida de materia prima a destino</p>
        </div>
      </div>

      <div class="datetime-row">
        <div class="datetime-chip">
          <i class="fas fa-calendar-day"></i>
          <span>{{ form.date }}</span>
        </div>
        <div class="datetime-chip">
          <i class="fas fa-clock"></i>
          <span>{{ form.time }}</span>
        </div>
      </div>

      <div class="field-grid">
        <div class="field full">
          <label>Materia Prima</label>
          <SearchableSelect
            :modelValue="form.rawMaterial"
            @update:modelValue="val => emit('update:form', { ...form, rawMaterial: val })"
            :options="materialOptions"
            placeholder="Buscar materia prima..."
          />
        </div>

        <div class="field half">
          <label>Cantidad <span class="unit-hint">{{ selectedMaterial ? `(${getDisplayUnit(selectedMaterial.unit)})` : '' }}</span></label>
          <input
            type="number"
            :value="form.quantity"
            @input="e => emit('update:form', { ...form, quantity: Number((e.target as HTMLInputElement).value) })"
            min="0" step="0.01" placeholder="0.00"
            :class="{ 'input-error': insufficientStock }"
          />
          <span v-if="insufficientStock" class="error-text">
            <i class="fas fa-exclamation-triangle"></i> Stock insuficiente
          </span>
        </div>

        <div class="field half">
          <label>Venta esperada <span class="optional">(Opcional)</span></label>
          <div class="input-with-prefix">
            <span class="prefix">$</span>
            <input
              type="number"
              :value="form.expectedSaleValue"
              @input="e => emit('update:form', { ...form, expectedSaleValue: Number((e.target as HTMLInputElement).value) })"
              min="0" step="0.01" placeholder="0.00"
            />
          </div>
        </div>

        <div class="field full">
          <label>Destino (Entidad)</label>
          <SearchableSelect
            :modelValue="form.entity"
            @update:modelValue="val => emit('update:form', { ...form, entity: val })"
            :options="entityOptions"
            placeholder="Buscar destino..."
          />
        </div>

        <div class="field full">
          <label>Recibido por</label>
          <input
            type="text"
            :value="form.responsible"
            @input="e => emit('update:form', { ...form, responsible: (e.target as HTMLInputElement).value })"
            placeholder="Nombre de quien recibe..."
          />
          <div class="name-tags">
            <span v-for="name in ['Bryan', 'Danny', 'Saraí']" :key="name" class="name-tag"
              @click="emit('update:form', { ...form, responsible: name })">
              {{ name }}
            </span>
          </div>
        </div>

        <div class="field full">
          <label>Observación <span class="optional">(Opcional)</span></label>
          <textarea
            :value="form.observation"
            @input="e => emit('update:form', { ...form, observation: (e.target as HTMLInputElement).value })"
            rows="2" placeholder="Notas adicionales..."
          ></textarea>
        </div>
      </div>

      <div class="form-actions">
        <button
          class="btn-submit btn-submit--out"
          @click="handleSubmit"
          :disabled="isSubmitting || !form.rawMaterial || form.quantity <= 0 || !form.entity || insufficientStock"
        >
          <i class="fas fa-truck-loading"></i>
          Registrar Salida
        </button>
      </div>
    </div>

    <!-- Right: Summary -->
    <div class="summary-panel">

      <!-- Stock actual -->
      <div v-if="selectedMaterial" class="info-card info-card--stock">
        <div class="info-card__header">
          <i class="fas fa-layer-group"></i>
          <span>Stock Actual</span>
        </div>
        <div class="info-card__value">
          {{ selectedMaterial.unit === 'g' || selectedMaterial.unit === 'ml'
              ? (selectedMaterial.quantity / 1000).toFixed(2)
              : selectedMaterial.quantity.toFixed(2) }}
          <span class="info-card__unit">{{ getDisplayUnit(selectedMaterial.unit) }}</span>
        </div>
        <div class="info-card__sub">{{ selectedMaterial.name }}</div>
      </div>

      <!-- Valor despacho -->
      <div v-if="selectedMaterial && form.quantity > 0" class="info-card info-card--total-out">
        <div class="info-card__header">
          <i class="fas fa-boxes"></i>
          <span>Valor del despacho</span>
        </div>
        <div class="info-card__value">${{ totalValue.toFixed(2) }}</div>
        <div class="info-card__sub">
          Costo: ${{ getDisplayCost(selectedMaterial.cost || 0, selectedMaterial.unit).toFixed(4) }} / {{ getDisplayUnit(selectedMaterial.unit) }}
        </div>
      </div>

      <!-- Stock después del despacho -->
      <div v-if="stockAfterDispatch && !stockAfterDispatch.isNegative" class="info-card info-card--remaining">
        <div class="info-card__header">
          <i class="fas fa-arrow-down"></i>
          <span>Quedará en bodega</span>
        </div>
        <div class="info-card__value">
          {{ stockAfterDispatch.remaining }}
          <span class="info-card__unit">{{ stockAfterDispatch.unit }}</span>
        </div>
      </div>

      <!-- Alerta rentabilidad -->
      <div v-if="showRentabilityAlert" class="alert-card alert-card--rent">
        <div class="alert-card__icon">⚠️</div>
        <div>
          <strong>Alerta de Rentabilidad</strong>
          <p>El costo supera o iguala la venta esperada.</p>
        </div>
      </div>

      <!-- Empty state -->
      <div v-if="!selectedMaterial" class="summary-empty">
        <i class="fas fa-truck-loading"></i>
        <p>Selecciona una materia prima para ver el resumen</p>
      </div>
    </div>
  </div>

  <!-- Confirmation Modal -->
  <div v-if="showOutModal" class="modal-overlay">
    <div class="modal-box">
      <div class="modal-header modal-header--out">
        <i class="fas fa-truck-loading"></i>
        <h3>Confirmar Despacho</h3>
      </div>
      <ul class="modal-list">
        <li><strong>Material:</strong> {{ selectedMaterial?.name }}</li>
        <li><strong>Cantidad:</strong> {{ form.quantity }} {{ selectedMaterial ? getDisplayUnit(selectedMaterial.unit) : '' }}</li>
        <li><strong>Destino:</strong> {{ form.entity }}</li>
        <li><strong>Valor:</strong> <span class="modal-highlight-out">${{ totalValue.toFixed(2) }}</span></li>
      </ul>
      <div class="hold-area">
        <button
          class="hold-btn"
          @mousedown="emit('start-hold')"
          @mouseleave="emit('cancel-hold')"
          @mouseup="emit('cancel-hold')"
          @touchstart.prevent="emit('start-hold')"
          @touchend.prevent="emit('cancel-hold')"
        >
          <span class="hold-btn__text">Mantén para confirmar</span>
          <div class="hold-btn__progress" :style="{ width: holdProgress + '%' }"></div>
        </button>
        <button class="btn-cancel-hold" @click="cancelHold">Cancelar</button>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.dispatch-layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;

  @media (min-width: 900px) {
    grid-template-columns: 1fr 300px;
    align-items: start;
  }
}

.form-panel {
  background: white;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem;
  border-bottom: 1px solid #f1f5f9;

  .panel-icon {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.1rem;
    flex-shrink: 0;
  }

  h2 { margin: 0; font-size: 1.1rem; font-weight: 800; color: #1e293b; }
  p  { margin: 0.2rem 0 0; font-size: 0.82rem; color: #64748b; font-weight: 500; }

  &--out .panel-icon { background: #fee2e2; color: #dc2626; }
}

.datetime-row {
  display: flex;
  gap: 0.75rem;
  padding: 1rem 1.5rem 0;
}

.datetime-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 0.5rem 0.85rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: #475569;

  i { color: #dc2626; font-size: 0.8rem; }
}

.field-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 1rem;
  padding: 1.25rem 1.5rem;

  .field {
    margin-bottom: 1.1rem;

    &.full { grid-column: span 2; }
    &.half { grid-column: span 2; @media (min-width: 640px) { grid-column: span 1; } }

    label {
      display: block;
      font-size: 0.82rem;
      font-weight: 700;
      color: #475569;
      margin-bottom: 0.4rem;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    input, textarea, select {
      width: 100%;
      padding: 0.7rem 0.9rem;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      font-size: 0.92rem;
      color: #1e293b;
      background: white;
      transition: border-color 0.2s, box-shadow 0.2s;
      box-sizing: border-box;

      &:focus {
        outline: none;
        border-color: #dc2626;
        box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.1);
      }

      &.input-error { border-color: #ef4444; }
    }

    textarea { resize: vertical; min-height: 72px; }
  }
}

.unit-hint {
  font-size: 0.75rem;
  font-weight: 600;
  color: #94a3b8;
  text-transform: none;
  letter-spacing: 0;
}

.optional {
  font-size: 0.72rem;
  font-weight: 500;
  color: #94a3b8;
  text-transform: none;
  letter-spacing: 0;
}

.input-with-prefix {
  display: flex;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
  transition: border-color 0.2s, box-shadow 0.2s;

  &:focus-within {
    border-color: #dc2626;
    box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.1);
  }

  .prefix {
    padding: 0.7rem 0.75rem;
    background: #f8fafc;
    border-right: 1px solid #e2e8f0;
    color: #64748b;
    font-weight: 700;
    font-size: 0.9rem;
  }

  input {
    flex: 1;
    border: none !important;
    box-shadow: none !important;
    padding-left: 0.5rem !important;
  }
}

.error-text {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  color: #dc2626;
  font-size: 0.75rem;
  font-weight: 600;
  margin-top: 0.3rem;

  i { font-size: 0.7rem; }
}

.name-tags {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 0.5rem;
}

.name-tag {
  font-size: 0.75rem;
  font-weight: 700;
  color: $NICOLE-PURPLE;
  background: rgba($NICOLE-PURPLE, 0.08);
  padding: 0.25rem 0.7rem;
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.15s;

  &:hover { background: $NICOLE-PURPLE; color: white; }
}

.form-actions {
  padding: 0 1.5rem 1.5rem;
  display: flex;
  justify-content: flex-end;
}

.btn-submit {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.8rem 1.75rem;
  border: none;
  border-radius: 10px;
  font-weight: 800;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;

  &--out {
    background: #dc2626;
    color: white;
    &:hover:not(:disabled) { background: #b91c1c; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(220,38,38,0.3); }
  }

  &:disabled { opacity: 0.6; cursor: not-allowed; }
}

// ─── Summary Panel ────────────────────────────────────────────────────────────

.summary-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.info-card {
  background: white;
  border-radius: 14px;
  border: 1px solid #e2e8f0;
  padding: 1.25rem;

  &__header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.72rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #94a3b8;
    margin-bottom: 0.75rem;

    i { font-size: 0.85rem; }
  }

  &__value {
    font-size: 2rem;
    font-weight: 900;
    color: #1e293b;
    line-height: 1;
  }

  &__unit {
    font-size: 1rem;
    font-weight: 600;
    color: #64748b;
    margin-left: 0.25rem;
  }

  &__sub {
    font-size: 0.78rem;
    color: #94a3b8;
    font-weight: 500;
    margin-top: 0.4rem;
  }

  &--stock     { .info-card__header { i { color: $NICOLE-PURPLE; } } }
  &--total-out { background: #fff5f5; border-color: #fecaca; .info-card__value { color: #dc2626; } .info-card__header { color: #dc2626; i { color: #dc2626; } } }
  &--remaining { background: #f0fdf4; border-color: #bbf7d0; .info-card__value { color: #047857; } .info-card__header { i { color: #047857; } } }
}

.alert-card {
  border-radius: 12px;
  padding: 1rem;
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;

  &--rent {
    background: #fff7ed;
    border: 1px solid #fdba74;

    strong { color: #c2410c; font-size: 0.85rem; display: block; }
    p { margin: 0.2rem 0 0; font-size: 0.78rem; color: #9a3412; }
  }

  &__icon { font-size: 1.25rem; flex-shrink: 0; }
}

.summary-empty {
  background: white;
  border-radius: 14px;
  border: 1px dashed #e2e8f0;
  padding: 2.5rem 1.5rem;
  text-align: center;
  color: #94a3b8;

  i { font-size: 2rem; opacity: 0.4; display: block; margin-bottom: 0.75rem; }
  p { margin: 0; font-size: 0.85rem; font-weight: 500; }
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
  padding: 1rem;
}

.modal-box {
  background: white;
  border-radius: 16px;
  padding: 2rem;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 20px 40px rgba(0,0,0,0.15);
}

.modal-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.25rem;

  i { font-size: 1.25rem; }
  h3 { margin: 0; font-size: 1.1rem; font-weight: 800; color: #1e293b; }

  &--out { i { color: #dc2626; } }
}

.modal-list {
  background: #f8fafc;
  padding: 1rem;
  border-radius: 10px;
  list-style: none;
  margin: 0 0 1.5rem;

  li { font-size: 0.88rem; margin-bottom: 0.35rem; color: #374151; }
}

.modal-highlight-out { color: #dc2626; font-weight: 700; }

.hold-area {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.hold-btn {
  position: relative;
  width: 100%;
  padding: 1rem;
  background: #dc2626;
  color: white;
  border: none;
  border-radius: 10px;
  font-weight: 800;
  font-size: 0.9rem;
  cursor: pointer;
  overflow: hidden;
  user-select: none;

  &__text {
    position: relative;
    z-index: 2;
  }

  &__progress {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    background: rgba(0,0,0,0.2);
    z-index: 1;
    transition: width 0.05s linear;
  }
}

.btn-cancel-hold {
  width: 100%;
  padding: 0.75rem;
  background: transparent;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  color: #64748b;
  font-weight: 600;
  cursor: pointer;
  font-size: 0.88rem;
  transition: all 0.2s;

  &:hover { background: #f8fafc; }
}
</style>
