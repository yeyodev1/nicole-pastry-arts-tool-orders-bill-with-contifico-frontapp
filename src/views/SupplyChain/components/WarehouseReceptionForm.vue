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

const getDisplayUnit = (unit: string) => {
  if (unit === 'g') return 'kg'
  if (unit === 'ml') return 'lt'
  return unit
}

const selectedMaterial = computed(() => {
  return props.materials.find((m: RawMaterial) => m._id === props.form.rawMaterial)
})

const totalValue = computed(() => {
  if (!selectedMaterial.value || !props.form.quantity || props.form.quantity <= 0) return 0
  return props.form.quantity * (props.form.unitCost || 0)
})

const currentStockDisplay = computed(() => {
  if (!selectedMaterial.value) return null
  const m = selectedMaterial.value
  const qty = (m.unit === 'g' || m.unit === 'ml') ? (m.quantity / 1000).toFixed(2) : m.quantity.toFixed(2)
  return { qty, unit: getDisplayUnit(m.unit) }
})

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
  <div class="reception-layout">

    <!-- Left: Form -->
    <div class="form-panel">
      <div class="panel-header panel-header--in">
        <div class="panel-icon"><i class="fas fa-box-open"></i></div>
        <div>
          <h2>Registrar Recepción</h2>
          <p>Ingresa los datos del material recibido</p>
        </div>
      </div>

      <!-- Suggested Orders Banner -->
      <div v-if="suggestionOptions.length > 0" class="suggestion-banner">
        <div class="suggestion-banner__label">
          <i class="fas fa-magic"></i> Pedido en camino — aplicar a formulario
        </div>
        <SearchableSelect
          v-model="selectedSuggestionId"
          :options="suggestionOptions"
          placeholder="Seleccionar pedido sugerido..."
        />
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
          />
        </div>

        <div class="field half" v-if="selectedMaterial">
          <label>Precio de compra / {{ getDisplayUnit(selectedMaterial.unit) }} <span class="unit-hint">(USD)</span></label>
          <div class="input-with-prefix">
            <span class="prefix">$</span>
            <input
              type="number"
              :value="form.unitCost"
              @input="e => emit('update:form', { ...form, unitCost: Number((e.target as HTMLInputElement).value) })"
              min="0" step="0.0001" placeholder="0.0000"
            />
          </div>
        </div>

        <div class="field full">
          <label>Proveedor <span class="optional">(Opcional)</span></label>
          <SearchableSelect
            :modelValue="form.provider"
            @update:modelValue="val => emit('update:form', { ...form, provider: val })"
            :options="filteredProviderOptions"
            placeholder="Buscar proveedor..."
          />
        </div>

        <div class="field full">
          <label>Responsable</label>
          <input
            type="text"
            :value="form.responsible"
            @input="e => emit('update:form', { ...form, responsible: (e.target as HTMLInputElement).value })"
            placeholder="Nombre de quien recibe..."
          />
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
          class="btn-submit btn-submit--in"
          @click="handleSubmit"
          :disabled="isSubmitting || !form.rawMaterial || form.quantity <= 0"
        >
          <i class="fas fa-check"></i>
          {{ isSubmitting ? 'Guardando...' : 'Registrar Entrada' }}
        </button>
      </div>
    </div>

    <!-- Right: Summary -->
    <div class="summary-panel">

      <!-- Stock Actual -->
      <div v-if="selectedMaterial" class="info-card info-card--stock">
        <div class="info-card__header">
          <i class="fas fa-layer-group"></i>
          <span>Stock Actual</span>
        </div>
        <div class="info-card__value">
          {{ currentStockDisplay?.qty }}
          <span class="info-card__unit">{{ currentStockDisplay?.unit }}</span>
        </div>
        <div class="info-card__sub">{{ selectedMaterial.name }}</div>
      </div>

      <!-- Total Recepción -->
      <div v-if="selectedMaterial && form.quantity > 0 && form.unitCost > 0" class="info-card info-card--total-in">
        <div class="info-card__header">
          <i class="fas fa-calculator"></i>
          <span>Total de esta recepción</span>
        </div>
        <div class="info-card__value">
          ${{ totalValue.toFixed(2) }}
        </div>
        <div class="info-card__sub">
          {{ form.quantity }} {{ getDisplayUnit(selectedMaterial.unit) }}
          × ${{ form.unitCost % 1 === 0 ? form.unitCost.toFixed(2) : form.unitCost < 1 ? form.unitCost.toFixed(4) : form.unitCost.toFixed(2) }}/{{ getDisplayUnit(selectedMaterial.unit) }}
        </div>
      </div>

      <!-- Empty state -->
      <div v-if="!selectedMaterial" class="summary-empty">
        <i class="fas fa-box-open"></i>
        <p>Selecciona una materia prima para ver el resumen</p>
      </div>
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
        <li><strong>Costo unitario:</strong> ${{ form.unitCost.toFixed(2) }}/{{ selectedMaterial ? getDisplayUnit(selectedMaterial.unit) : '' }}</li>
        <li><strong>Total:</strong> <span class="modal-highlight">USD ${{ totalValue.toFixed(2) }}</span></li>
        <li><strong>Proveedor:</strong> {{ providers.find((p: Provider) => p._id === form.provider)?.name || 'N/A' }}</li>
      </ul>
    </template>
  </ConfirmationModal>
</template>

<style lang="scss" scoped>
.reception-layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;

  @media (min-width: 900px) {
    grid-template-columns: 1fr 320px;
    align-items: start;
  }
}

// ─── Panels ───────────────────────────────────────────────────────────────────

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

  &--in .panel-icon { background: #dcfce7; color: #059669; }
}

// ─── Suggestion Banner ────────────────────────────────────────────────────────

.suggestion-banner {
  margin: 1.25rem 1.5rem 0;
  background: #f8f5ff;
  border: 1.5px dashed $NICOLE-PURPLE;
  border-radius: 12px;
  padding: 1rem;

  &__label {
    font-size: 0.75rem;
    font-weight: 800;
    color: $NICOLE-PURPLE;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 0.5rem;

    i { margin-right: 0.3rem; }
  }
}

// ─── DateTime ─────────────────────────────────────────────────────────────────

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

  i { color: $NICOLE-PURPLE; font-size: 0.8rem; }
}

// ─── Field Grid ───────────────────────────────────────────────────────────────

.field-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 1rem;
  padding: 1.25rem 1.5rem;

  .field {
    margin-bottom: 1.1rem;

    &.full  { grid-column: span 2; }
    &.half  { grid-column: span 2; @media (min-width: 640px) { grid-column: span 1; } }

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
        border-color: #059669;
        box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.1);
      }
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
    border-color: #059669;
    box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.1);
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

  &--in {
    background: #059669;
    color: white;
    &:hover:not(:disabled) { background: #047857; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(5,150,105,0.3); }
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

  &--stock {
    border-color: #e2e8f0;
    .info-card__header { color: #64748b; i { color: $NICOLE-PURPLE; } }
  }

  &--total-in {
    background: #f0fdf4;
    border-color: #bbf7d0;
    .info-card__header { color: #059669; i { color: #059669; } }
    .info-card__value { color: #047857; }
  }
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

// ─── Modal List ───────────────────────────────────────────────────────────────

.modal-list {
  background: #f8fafc;
  padding: 1rem;
  border-radius: 8px;
  list-style: none;
  margin: 1rem 0;

  li { font-size: 0.88rem; margin-bottom: 0.35rem; color: #374151; }
}

.modal-highlight { color: #059669; font-weight: 700; }
</style>
