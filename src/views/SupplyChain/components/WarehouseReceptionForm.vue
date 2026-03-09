<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import SearchableSelect from '@/components/ui/SearchableSelect.vue'
import type { RawMaterial, Provider, Option, WarehouseInForm, ReceptionItem } from '@/types/warehouse'

const props = defineProps<{
  form: WarehouseInForm
  materials: RawMaterial[]
  providers: Provider[]
  suggestedOrders: any[]
  isSubmitting: boolean
  materialOptions: Option[]
  filteredProviderOptions: Option[]
  receptionPointOptions: Option[]
  providerMismatchIndices: number[]
}>()

const emit = defineEmits<{
  (e: 'update:form', val: WarehouseInForm): void
  (e: 'submit'): void
  (e: 'apply-suggestion', order: any, item: any): void
}>()

const showConfirm = ref(false)
const submitAttempted = ref(false)

const getDisplayUnit = (unit?: string) => {
  if (unit === 'g') return 'kg'
  if (unit === 'ml') return 'lt'
  return unit ?? ''
}

const getMaterialById = (id: string) => props.materials.find(m => m._id === id)

const itemTotal = (item: ReceptionItem) => item.quantity * (item.unitCost || 0)

const grandTotal = computed(() => props.form.items.reduce((s, i) => s + itemTotal(i), 0))

const isValid = computed(() =>
  props.form.invoiceRef.trim() !== '' &&
  props.form.invoiceDueDate !== '' &&
  props.form.items.some(i => i.rawMaterial && i.quantity > 0)
)

const addItem = () =>
  emit('update:form', { ...props.form, items: [...props.form.items, { rawMaterial: '', quantity: 0, unitCost: 0 }] })

const removeItem = (idx: number) =>
  emit('update:form', { ...props.form, items: props.form.items.filter((_, i) => i !== idx) })

const updateItem = (idx: number, patch: Partial<ReceptionItem>) => {
  const items = props.form.items.map((it, i) => i === idx ? { ...it, ...patch } : it)
  emit('update:form', { ...props.form, items })
}

const trySubmit = () => {
  submitAttempted.value = true
  if (!isValid.value) return
  showConfirm.value = true
}

const confirmSubmit = () => {
  showConfirm.value = false
  emit('submit')
}

const fmt = (n: number) => n.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
</script>

<template>
  <div class="reception-layout">
    <!-- LEFT: Form -->
    <div class="form-panel">
      <div class="form-header">
        <div class="form-icon"><i class="fas fa-box-open"></i></div>
        <div>
          <h2>Registrar Recepción</h2>
          <p>Ingresa los datos del material recibido</p>
        </div>
      </div>

      <!-- Date / time -->
      <div class="date-row">
        <div class="date-chip"><i class="fas fa-calendar-alt"></i> {{ form.date }}</div>
        <div class="date-chip date-chip--time"><i class="fas fa-clock"></i> {{ form.time }}</div>
      </div>

      <!-- Shared fields -->
      <div class="fields-grid">
        <div class="field full">
          <label>Proveedor <span class="optional">(Opcional)</span></label>
          <SearchableSelect
            :modelValue="form.provider"
            @update:modelValue="val => emit('update:form', { ...form, provider: val })"
            :options="filteredProviderOptions"
            placeholder="Buscar proveedor..."
          />
        </div>

        <div class="field half" v-if="receptionPointOptions.length > 0">
          <label>Punto de Recepción</label>
          <SearchableSelect
            :modelValue="form.receptionPoint"
            @update:modelValue="val => emit('update:form', { ...form, receptionPoint: val })"
            :options="receptionPointOptions"
            placeholder="Seleccionar punto de recepción..."
          />
        </div>

        <div class="field half" :class="{ 'field--error': submitAttempted && !form.invoiceRef.trim() }">
          <label>N° Factura <span class="required-badge">Requerido</span></label>
          <input
            type="text"
            :value="form.invoiceRef"
            @input="e => emit('update:form', { ...form, invoiceRef: (e.target as HTMLInputElement).value })"
            placeholder="Ej: FAC-001234"
          />
          <span v-if="submitAttempted && !form.invoiceRef.trim()" class="field-error-msg">
            <i class="fas fa-exclamation-circle"></i> Requerido
          </span>
        </div>

        <div class="field half" :class="{ 'field--error': submitAttempted && !form.invoiceDueDate }">
          <label>Fecha Límite Factura <span class="required-badge">Requerido</span></label>
          <input
            type="date"
            :value="form.invoiceDueDate"
            @input="e => emit('update:form', { ...form, invoiceDueDate: (e.target as HTMLInputElement).value })"
          />
          <span v-if="submitAttempted && !form.invoiceDueDate" class="field-error-msg">
            <i class="fas fa-exclamation-circle"></i> Requerido
          </span>
        </div>

        <div class="field half">
          <label>Responsable</label>
          <input
            type="text"
            :value="form.responsible"
            @input="e => emit('update:form', { ...form, responsible: (e.target as HTMLInputElement).value })"
            placeholder="Nombre del responsable"
          />
        </div>

        <div class="field full">
          <label>Observación <span class="optional">(Opcional)</span></label>
          <textarea
            :value="form.observation"
            @input="e => emit('update:form', { ...form, observation: (e.target as HTMLTextAreaElement).value })"
            placeholder="Notas adicionales..."
            rows="2"
          ></textarea>
        </div>
      </div>

      <!-- Items list -->
      <div class="items-section">
        <div class="items-header">
          <span><i class="fas fa-cubes"></i> Materias Primas</span>
          <button class="btn-add-item" @click="addItem" type="button">
            <i class="fas fa-plus"></i> Agregar
          </button>
        </div>

        <div v-for="(item, idx) in form.items" :key="idx" class="item-row">
          <div class="item-row__number">{{ idx + 1 }}</div>
          <div class="item-row__fields">
            <div class="field full">
              <label>Materia Prima</label>
              <SearchableSelect
                :modelValue="item.rawMaterial"
                @update:modelValue="val => updateItem(idx, { rawMaterial: val })"
                :options="materialOptions"
                placeholder="Buscar materia prima..."
              />
            </div>

            <!-- Provider mismatch alert -->
            <div v-if="providerMismatchIndices.includes(idx)" class="alert-mismatch">
              <i class="fas fa-exclamation-triangle"></i>
              Este material pertenece a un proveedor distinto al seleccionado.
            </div>

            <div class="item-row__amounts">
              <div class="field">
                <label>Cantidad <span class="unit-hint">{{ getMaterialById(item.rawMaterial) ? `(${getDisplayUnit(getMaterialById(item.rawMaterial)?.unit)})` : '' }}</span></label>
                <input
                  type="number"
                  :value="item.quantity"
                  @input="e => updateItem(idx, { quantity: Number((e.target as HTMLInputElement).value) })"
                  min="0" step="0.01" placeholder="0.00"
                />
              </div>
              <div class="field">
                <label>Precio / {{ getMaterialById(item.rawMaterial) ? getDisplayUnit(getMaterialById(item.rawMaterial)?.unit) : 'u' }} <span class="unit-hint">(USD)</span></label>
                <div class="input-with-prefix input-readonly">
                  <span class="prefix">$</span>
                  <input type="number" :value="item.unitCost" readonly tabindex="-1" placeholder="0.0000" />
                  <span class="readonly-badge"><i class="fas fa-lock"></i></span>
                </div>
              </div>
              <div class="field field--total">
                <label>Subtotal</label>
                <div class="subtotal-chip">${{ fmt(itemTotal(item)) }}</div>
              </div>
            </div>
          </div>
          <button
            class="btn-remove-item"
            @click="removeItem(idx)"
            :disabled="form.items.length === 1"
            type="button"
            title="Eliminar fila"
          >
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>

      <button class="btn-submit" @click="trySubmit" :disabled="isSubmitting">
        <i class="fas fa-check"></i>
        {{ isSubmitting ? 'Registrando...' : 'Registrar Entrada' }}
      </button>
    </div>

    <!-- RIGHT: Summary -->
    <div class="summary-panel">
      <div class="summary-panel__header">
        <i class="fas fa-receipt"></i> Resumen de Recepción
      </div>

      <div v-if="form.invoiceRef" class="invoice-badge">
        <i class="fas fa-file-invoice-dollar"></i>
        <div>
          <span class="invoice-ref">{{ form.invoiceRef }}</span>
          <span v-if="form.invoiceDueDate" class="invoice-due">Vence: {{ form.invoiceDueDate }}</span>
        </div>
      </div>

      <div v-if="form.items.some(i => i.rawMaterial)" class="summary-items">
        <div v-for="(item, idx) in form.items.filter(i => i.rawMaterial)" :key="idx" class="summary-item">
          <span class="summary-item__name">{{ getMaterialById(item.rawMaterial)?.name || '—' }}</span>
          <span class="summary-item__qty">{{ item.quantity }} {{ getDisplayUnit(getMaterialById(item.rawMaterial)?.unit) }}</span>
          <span class="summary-item__val">${{ fmt(itemTotal(item)) }}</span>
        </div>
      </div>

      <div v-if="grandTotal > 0" class="summary-total">
        <span>Total Recepción</span>
        <span class="summary-total__amount">${{ fmt(grandTotal) }}</span>
      </div>

      <div v-if="!form.items.some(i => i.rawMaterial)" class="summary-empty">
        <i class="fas fa-box-open"></i>
        <p>Agrega materias primas para ver el resumen</p>
      </div>
    </div>

    <!-- Confirm modal -->
    <Teleport to="body">
      <div v-if="showConfirm" class="modal-overlay" @click.self="showConfirm = false">
        <div class="confirm-modal">
          <h3><i class="fas fa-check-circle"></i> Confirmar Recepción</h3>
          <p>Se registrará una <strong>ENTRADA</strong> con:</p>
          <ul class="confirm-list">
            <li v-if="form.invoiceRef"><strong>Factura:</strong> {{ form.invoiceRef }} — vence {{ form.invoiceDueDate }}</li>
            <li v-if="form.receptionPoint"><strong>Bodega:</strong> {{ form.receptionPoint }}</li>
            <li v-if="form.provider"><strong>Proveedor:</strong> {{ filteredProviderOptions.find(o => o.value === form.provider)?.label ?? form.provider }}</li>
            <li v-for="(item, idx) in form.items.filter(i => i.rawMaterial && i.quantity > 0)" :key="idx">
              <strong>{{ getMaterialById(item.rawMaterial)?.name }}</strong>:
              {{ item.quantity }} {{ getDisplayUnit(getMaterialById(item.rawMaterial)?.unit) }}
              — ${{ fmt(itemTotal(item)) }}
            </li>
            <li><strong>Total:</strong> <span class="modal-highlight">${{ fmt(grandTotal) }}</span></li>
          </ul>
          <div class="confirm-actions">
            <button class="btn-cancel" @click="showConfirm = false">Cancelar</button>
            <button class="btn-confirm" @click="confirmSubmit" :disabled="isSubmitting">
              {{ isSubmitting ? 'Guardando...' : 'Confirmar' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style lang="scss" scoped>
.reception-layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;

  @media (min-width: 900px) {
    grid-template-columns: 1fr 340px;
  }
}

.form-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;

  .form-icon {
    width: 48px; height: 48px;
    background: #d1fae5; color: #059669;
    border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    font-size: 1.3rem; flex-shrink: 0;
  }

  h2 { margin: 0; font-size: 1.3rem; font-weight: 800; color: #1e293b; }
  p  { margin: 0.2rem 0 0; font-size: 0.85rem; color: #64748b; }
}

.date-row {
  display: flex; gap: 0.75rem; margin-bottom: 1.25rem; flex-wrap: wrap;
}

.date-chip {
  display: inline-flex; align-items: center; gap: 0.4rem;
  padding: 0.4rem 0.9rem;
  background: #f1f5f9; border: 1px solid #e2e8f0;
  border-radius: 8px; font-size: 0.9rem; font-weight: 600; color: #475569;

  i { color: $NICOLE-PURPLE; font-size: 0.85rem; }
  &--time i { color: #7c3aed; }
}

.fields-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.field {
  display: flex; flex-direction: column; gap: 0.4rem;

  &.full { grid-column: span 2; }
  &.half { grid-column: span 1; }

  label {
    font-size: 0.78rem; font-weight: 700;
    color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;
  }

  input, textarea {
    padding: 0.75rem 1rem;
    border: 1px solid #e2e8f0; border-radius: 8px;
    font-size: 0.95rem; color: #1e293b;
    transition: border-color 0.2s, box-shadow 0.2s;
    background: white;

    &:focus {
      outline: none; border-color: #059669;
      box-shadow: 0 0 0 3px rgba(5,150,105,0.1);
    }
  }

  textarea { resize: vertical; }

  &--error input, &--error select { border-color: #dc2626; }
}

.optional { font-size: 0.72rem; font-weight: 400; color: #94a3b8; text-transform: none; margin-left: 4px; }

.required-badge {
  font-size: 0.68rem; font-weight: 700; color: #dc2626;
  background: #fef2f2; padding: 0.1rem 0.4rem; border-radius: 4px;
  text-transform: uppercase; margin-left: 4px;
}

.field-error-msg {
  font-size: 0.75rem; color: #dc2626;
  display: flex; align-items: center; gap: 0.3rem;
}

// Items section
.items-section { margin-bottom: 1.5rem; }

.items-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 0.75rem;
  font-size: 0.82rem; font-weight: 700; color: #64748b;
  text-transform: uppercase; letter-spacing: 0.5px;

  i { color: $NICOLE-PURPLE; }
}

.btn-add-item {
  display: inline-flex; align-items: center; gap: 0.4rem;
  padding: 0.4rem 0.85rem;
  background: rgba($NICOLE-PURPLE, 0.08); color: $NICOLE-PURPLE;
  border: 1px dashed rgba($NICOLE-PURPLE, 0.4); border-radius: 8px;
  font-size: 0.82rem; font-weight: 700; cursor: pointer;
  transition: all 0.15s;

  &:hover { background: rgba($NICOLE-PURPLE, 0.14); }
}

.item-row {
  display: flex; align-items: flex-start; gap: 0.75rem;
  background: #f8fafc; border: 1px solid #e2e8f0;
  border-radius: 12px; padding: 1rem;
  margin-bottom: 0.65rem;

  &__number {
    width: 24px; height: 24px; border-radius: 50%;
    background: $NICOLE-PURPLE; color: white;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.75rem; font-weight: 700; flex-shrink: 0; margin-top: 0.2rem;
  }

  &__fields { flex: 1; display: flex; flex-direction: column; gap: 0.75rem; }

  &__amounts {
    display: grid;
    grid-template-columns: 1fr 1fr auto;
    gap: 0.75rem;
    align-items: end;
  }
}

.btn-remove-item {
  background: none; border: none; color: #dc2626;
  padding: 0.3rem; cursor: pointer; border-radius: 6px;
  opacity: 0.5; transition: all 0.15s; flex-shrink: 0; margin-top: 0.2rem;

  &:hover:not(:disabled) { opacity: 1; background: #fee2e2; }
  &:disabled { opacity: 0.2; cursor: not-allowed; }
}

.alert-mismatch {
  background: #fffbeb; border: 1px solid #fde68a;
  border-radius: 8px; padding: 0.5rem 0.75rem;
  font-size: 0.8rem; color: #92400e;
  display: flex; align-items: center; gap: 0.5rem;

  i { color: #d97706; }
}

.input-with-prefix {
  display: flex; align-items: center;
  border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;

  .prefix {
    padding: 0.75rem 0.6rem; background: #f8fafc;
    border-right: 1px solid #e2e8f0; color: #94a3b8;
    font-weight: 700; font-size: 0.9rem;
  }

  input { flex: 1; border: none !important; box-shadow: none !important; padding-left: 0.5rem !important; }

  &.input-readonly {
    background: #f8fafc; border-style: dashed; cursor: not-allowed;
    input { background: #f8fafc; color: #64748b; font-weight: 600; cursor: not-allowed; }
  }

  .readonly-badge { padding: 0 0.6rem; color: #94a3b8; font-size: 0.7rem; }
}

.subtotal-chip {
  padding: 0.75rem 1rem;
  background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px;
  font-size: 0.95rem; font-weight: 700; color: #065f46;
  white-space: nowrap;
}

.field--total label { color: #059669; }

.unit-hint {
  font-size: 0.72rem; font-weight: 400; color: #94a3b8;
  text-transform: none; letter-spacing: 0; margin-left: 2px;
}

.btn-submit {
  width: 100%; padding: 0.9rem; border: none; border-radius: 10px;
  background: #059669; color: white;
  font-size: 1rem; font-weight: 700; cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 0.6rem;
  transition: all 0.2s;

  &:hover:not(:disabled) { background: #047857; }
  &:disabled { opacity: 0.6; cursor: not-allowed; }
}

// Summary panel
.summary-panel {
  background: white; border-radius: 14px;
  border: 1px solid $border-light;
  padding: 1.25rem; height: fit-content;
  position: sticky; top: 1rem;

  &__header {
    font-size: 0.78rem; font-weight: 700; color: #64748b;
    text-transform: uppercase; letter-spacing: 0.5px;
    margin-bottom: 1rem;
    display: flex; align-items: center; gap: 0.5rem;
    i { color: $NICOLE-PURPLE; }
  }
}

.invoice-badge {
  display: flex; align-items: center; gap: 0.6rem;
  background: rgba($NICOLE-PURPLE, 0.06); border: 1px solid rgba($NICOLE-PURPLE, 0.2);
  border-radius: 10px; padding: 0.7rem 0.9rem; margin-bottom: 1rem;
  i { color: $NICOLE-PURPLE; font-size: 1.1rem; }

  .invoice-ref { display: block; font-weight: 700; color: $NICOLE-PURPLE; font-size: 0.9rem; }
  .invoice-due { display: block; font-size: 0.75rem; color: #64748b; margin-top: 0.1rem; }
}

.summary-items { margin-bottom: 0.75rem; }

.summary-item {
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.5rem 0; border-bottom: 1px solid #f1f5f9;
  font-size: 0.85rem;

  &__name { flex: 1; font-weight: 600; color: #1e293b; }
  &__qty  { color: #64748b; white-space: nowrap; }
  &__val  { font-weight: 700; color: #059669; white-space: nowrap; min-width: 70px; text-align: right; }
}

.summary-total {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0.85rem; margin-top: 0.5rem;
  background: #f0fdf4; border-radius: 10px;
  font-size: 0.85rem; font-weight: 700; color: #065f46;

  &__amount { font-size: 1.2rem; font-weight: 800; }
}

.summary-empty {
  display: flex; flex-direction: column; align-items: center;
  padding: 2rem 1rem; color: #94a3b8; text-align: center;
  i { font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.4; }
  p { margin: 0; font-size: 0.85rem; }
}

// Confirm modal
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center;
  z-index: 9999; padding: 1rem;
}

.confirm-modal {
  background: white; border-radius: 16px; padding: 2rem;
  max-width: 480px; width: 100%;
  box-shadow: 0 20px 60px rgba(0,0,0,0.2);

  h3 { margin: 0 0 0.5rem; font-size: 1.1rem; color: #065f46; display: flex; align-items: center; gap: 0.5rem; }
  p  { margin: 0 0 1rem; color: #475569; font-size: 0.9rem; }
}

.confirm-list {
  list-style: none; padding: 0; margin: 0 0 1.5rem;
  display: flex; flex-direction: column; gap: 0.4rem;

  li { font-size: 0.9rem; color: #334155; padding: 0.3rem 0; border-bottom: 1px solid #f1f5f9; }
}

.modal-highlight { color: #059669; font-weight: 800; font-size: 1.05rem; }

.confirm-actions {
  display: flex; gap: 0.75rem; justify-content: flex-end;
}

.btn-cancel {
  padding: 0.6rem 1.25rem; border: 1px solid #e2e8f0; border-radius: 8px;
  background: white; color: #64748b; font-weight: 600; cursor: pointer;
  &:hover { background: #f8fafc; }
}

.btn-confirm {
  padding: 0.6rem 1.5rem; border: none; border-radius: 8px;
  background: #059669; color: white; font-weight: 700; cursor: pointer;
  &:hover:not(:disabled) { background: #047857; }
  &:disabled { opacity: 0.6; cursor: not-allowed; }
}
</style>
