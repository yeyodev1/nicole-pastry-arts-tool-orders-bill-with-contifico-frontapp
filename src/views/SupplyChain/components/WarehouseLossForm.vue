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
  if (unit === 'ml') return 'lt'
  return unit
}

const toBackendQuantity = (inputQty: number, unit: string) => {
  if (unit === 'g' || unit === 'ml') return inputQty * 1000
  return inputQty
}

const selectedMaterial = computed(() => {
  return props.materials.find((m: RawMaterial) => m._id === props.form.rawMaterial)
})

const insufficientStock = computed(() => {
  if (!selectedMaterial.value || !props.form.quantity || props.form.quantity <= 0) return false
  return selectedMaterial.value.quantity < toBackendQuantity(props.form.quantity, selectedMaterial.value.unit)
})

const reasonLabels: Record<string, { label: string; color: string; icon: string }> = {
  CADUCIDAD:    { label: 'Caducidad',         color: '#d97706', icon: 'fa-calendar-times' },
  MAL_ESTADO:   { label: 'Mal Estado / Dañado', color: '#dc2626', icon: 'fa-times-circle' },
  ROBO_EXTRAVIO:{ label: 'Robo / Extravío',   color: '#7c3aed', icon: 'fa-user-secret' },
  ERROR_PESAJE: { label: 'Error de Pesaje',   color: '#0891b2', icon: 'fa-balance-scale' },
  OTRO:         { label: 'Otro',              color: '#64748b', icon: 'fa-question-circle' },
}

const handleSubmit = () => {
  if (!props.form.rawMaterial || props.form.quantity <= 0) return
  if (insufficientStock.value) return emit('submit', 'error_stock')
  showLossModal.value = true
}

const confirmLoss = () => {
  showLossModal.value = false
  emit('submit')
}
</script>

<template>
  <div class="loss-layout">

    <!-- Left: Form -->
    <div class="form-panel">
      <div class="panel-header panel-header--loss">
        <div class="panel-icon"><i class="fas fa-trash-alt"></i></div>
        <div>
          <h2>Registrar Baja de Inventario</h2>
          <p>Registra pérdidas, daños o mermas del stock</p>
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
          <label>Responsable</label>
          <input
            type="text"
            :value="form.responsible"
            @input="e => emit('update:form', { ...form, responsible: (e.target as HTMLInputElement).value })"
            placeholder="Quién registra..."
          />
        </div>

        <!-- Reason Pills -->
        <div class="field full">
          <label>Motivo de la Baja</label>
          <div class="reason-pills">
            <button
              v-for="(meta, key) in reasonLabels"
              :key="key"
              type="button"
              class="reason-pill"
              :class="{ active: form.reason === key }"
              :style="form.reason === key ? { background: meta.color, borderColor: meta.color, color: 'white' } : {}"
              @click="emit('update:form', { ...form, reason: key })"
            >
              <i :class="'fas ' + meta.icon"></i>
              {{ meta.label }}
            </button>
          </div>
        </div>

        <div class="field full">
          <label>Observación Detallada</label>
          <textarea
            :value="form.observation"
            @input="e => emit('update:form', { ...form, observation: (e.target as HTMLInputElement).value })"
            rows="3" placeholder="Describe el estado del material, circunstancias, etc..."
          ></textarea>
        </div>
      </div>

      <div class="form-actions">
        <button
          class="btn-submit btn-submit--loss"
          @click="handleSubmit"
          :disabled="isSubmitting || !form.rawMaterial || form.quantity <= 0 || insufficientStock"
        >
          <i class="fas fa-trash-alt"></i>
          {{ isSubmitting ? 'Guardando...' : 'Registrar Baja' }}
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

      <!-- Motivo seleccionado -->
      <div v-if="form.reason" class="info-card info-card--reason"
        :style="{ borderColor: reasonLabels[form.reason]?.color, background: reasonLabels[form.reason]?.color + '12' }">
        <div class="info-card__header" :style="{ color: reasonLabels[form.reason]?.color }">
          <i :class="'fas ' + (reasonLabels[form.reason]?.icon || 'fa-tag')"></i>
          <span>Motivo Seleccionado</span>
        </div>
        <div class="info-card__value" style="font-size: 1.1rem; margin-top: 0.25rem;"
          :style="{ color: reasonLabels[form.reason]?.color }">
          {{ reasonLabels[form.reason]?.label }}
        </div>
      </div>

      <!-- Advertencia -->
      <div class="alert-card alert-card--warn">
        <div class="alert-card__icon">⚠️</div>
        <div>
          <strong>Acción Irreversible</strong>
          <p>Esta baja restará el stock permanentemente del inventario.</p>
        </div>
      </div>

      <!-- Empty state -->
      <div v-if="!selectedMaterial" class="summary-empty">
        <i class="fas fa-trash-alt"></i>
        <p>Selecciona una materia prima para continuar</p>
      </div>
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
        <li><strong>Motivo:</strong> {{ reasonLabels[form.reason]?.label || form.reason }}</li>
      </ul>
      <p class="text-danger">Esta acción restará el stock permanentemente.</p>
    </template>
  </ConfirmationModal>
</template>

<style lang="scss" scoped>
.loss-layout {
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

  &--loss .panel-icon { background: #fef3c7; color: #d97706; }
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

  i { color: #d97706; font-size: 0.8rem; }
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

    input, textarea {
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
        border-color: #d97706;
        box-shadow: 0 0 0 3px rgba(217,119,6,0.1);
      }

      &.input-error { border-color: #ef4444; }
    }

    textarea { resize: vertical; min-height: 80px; }
  }
}

.unit-hint {
  font-size: 0.75rem;
  font-weight: 600;
  color: #94a3b8;
  text-transform: none;
  letter-spacing: 0;
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

// ─── Reason Pills ─────────────────────────────────────────────────────────────

.reason-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.reason-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 0.9rem;
  border-radius: 999px;
  border: 1.5px solid #e2e8f0;
  background: #f8fafc;
  color: #475569;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;

  i { font-size: 0.75rem; }

  &:hover:not(.active) {
    border-color: #cbd5e1;
    background: #f1f5f9;
  }
}

// ─── Actions ──────────────────────────────────────────────────────────────────

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

  &--loss {
    background: #d97706;
    color: white;
    &:hover:not(:disabled) { background: #b45309; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(217,119,6,0.3); }
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

  &--stock { .info-card__header { i { color: $NICOLE-PURPLE; } } }
  &--reason { transition: all 0.2s; }
}

.alert-card {
  border-radius: 12px;
  padding: 1rem;
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;

  &--warn {
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

// ─── Modal ────────────────────────────────────────────────────────────────────

.modal-list {
  background: #f8fafc;
  padding: 1rem;
  border-radius: 8px;
  list-style: none;
  margin: 1rem 0;

  li { font-size: 0.88rem; margin-bottom: 0.35rem; color: #374151; }
}

.text-danger {
  color: #dc2626;
  font-size: 0.82rem;
  font-weight: 600;
}
</style>
