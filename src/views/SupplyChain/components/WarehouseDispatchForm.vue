<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import SearchableSelect from '@/components/ui/SearchableSelect.vue'
import type { RawMaterial, Option, WarehouseOutForm, LocationStock } from '@/types/warehouse'

// ─── Color palette (cycled by index) ─────────────────────────────────────────
const PALETTE = [
  { bg: '#ede9fe', text: '#6d28d9', border: '#c4b5fd' },  // purple
  { bg: '#dcfce7', text: '#15803d', border: '#86efac' },  // green
  { bg: '#fef3c7', text: '#b45309', border: '#fcd34d' },  // amber
  { bg: '#e0f2fe', text: '#0369a1', border: '#7dd3fc' },  // sky
  { bg: '#fce7f3', text: '#be185d', border: '#f9a8d4' },  // pink
  { bg: '#fff7ed', text: '#c2410c', border: '#fdba74' },  // orange
  { bg: '#f0fdf4', text: '#166534', border: '#6ee7b7' },  // emerald
]
const getColor = (index: number) => PALETTE[index % PALETTE.length]!

// ─── Name-match scoring ───────────────────────────────────────────────────────
const keywords = (s: string) =>
  s.toLowerCase().split(/[\s\-_,]+/).filter(w => w.length > 2)

const matchScore = (a: string, b: string): number => {
  const wa = keywords(a)
  const wb = keywords(b)
  return wa.filter(w => wb.includes(w)).length
}

const props = defineProps({
  form: { type: Object as () => WarehouseOutForm, required: true },
  materials: { type: Array as () => RawMaterial[], required: true },
  entityOptions: { type: Array as () => Option[], required: true },
  materialOptions: { type: Array as () => Option[], required: true },
  isSubmitting: { type: Boolean, required: true },
  holdProgress: { type: Number, required: true },
  isHolding: { type: Boolean, required: true },
  locationStocks: { type: Array as () => LocationStock[], default: () => [] },
})

const emit = defineEmits(['submit', 'update:form', 'start-hold', 'cancel-hold'])

const showOutModal = ref(false)

const getDisplayUnit = (unit: string) => {
  if (unit === 'g') return 'kg'
  if (unit === 'ml') return 'lt'
  return unit
}

const toBackendQuantity = (inputQty: number, unit: string) =>
  (unit === 'g' || unit === 'ml') ? inputQty * 1000 : inputQty

const toDisplayQuantity = (backendQty: number, unit: string) =>
  (unit === 'g' || unit === 'ml') ? backendQty / 1000 : backendQty

const selectedMaterial = computed(() =>
  props.materials.find((m: RawMaterial) => m._id === props.form.rawMaterial)
)

// Stock of the selected source location (in backend units)
const selectedLocationStock = computed(() => {
  if (!props.form.receptionPoint || !props.locationStocks.length) return null
  return props.locationStocks.find(ls => ls.location === props.form.receptionPoint) ?? null
})

// For display: use location stock if selected, else global material stock
const effectiveStockBackend = computed(() => {
  if (selectedLocationStock.value) return selectedLocationStock.value.stock
  return selectedMaterial.value?.quantity ?? 0
})

const totalValue = computed(() => {
  if (!selectedMaterial.value || !props.form.quantity || props.form.quantity <= 0) return 0
  const isWeight = selectedMaterial.value.unit === 'g' || selectedMaterial.value.unit === 'ml'
  const displayCost = isWeight ? (selectedMaterial.value.cost || 0) * 1000 : (selectedMaterial.value.cost || 0)
  return props.form.quantity * displayCost
})

const stockAfterDispatch = computed(() => {
  if (!selectedMaterial.value || !props.form.quantity || props.form.quantity <= 0) return null
  const m = selectedMaterial.value
  const backendQty = toBackendQuantity(props.form.quantity, m.unit)
  const remaining = effectiveStockBackend.value - backendQty
  const displayRemaining = parseFloat(toDisplayQuantity(remaining, m.unit).toFixed(2))
  const displayCurrent   = parseFloat(toDisplayQuantity(effectiveStockBackend.value, m.unit).toFixed(2))
  const pct = displayCurrent > 0 ? displayRemaining / displayCurrent : 0
  return {
    remaining: displayRemaining,
    unit: getDisplayUnit(m.unit),
    isNegative: remaining < 0,
    isZero: remaining === 0,
    level: pct <= 0 ? 'empty' : pct < 0.2 ? 'low' : 'ok',
    location: props.form.receptionPoint || null
  }
})

// Preview remaining per location for the selector
const locationAfterDispatch = (ls: { location: string; stock: number }) => {
  if (!selectedMaterial.value || !props.form.quantity || props.form.quantity <= 0) return null
  if (ls.location !== props.form.receptionPoint) return null
  const backendQty = toBackendQuantity(props.form.quantity, selectedMaterial.value.unit)
  const remaining = ls.stock - backendQty
  return parseFloat(toDisplayQuantity(remaining, selectedMaterial.value.unit).toFixed(2))
}

const insufficientStock = computed(() => {
  if (!selectedMaterial.value || !props.form.quantity || props.form.quantity <= 0) return false
  return effectiveStockBackend.value < toBackendQuantity(props.form.quantity, selectedMaterial.value.unit)
})

// Sum of all location stocks (in backend units)
const totalLocationStock = computed(() =>
  props.locationStocks.reduce((sum, ls) => sum + ls.stock, 0)
)

const showRentabilityAlert = computed(() => {
  if (!props.form.expectedSaleValue || props.form.expectedSaleValue <= 0) return false
  return totalValue.value >= props.form.expectedSaleValue
})

// ─── Entity list with colors + search ────────────────────────────────────────
const entitySearch = ref('')

const entityIndexMap = computed(() => {
  const map = new Map<string, number>()
  props.entityOptions.forEach((o, i) => map.set(o.value, i))
  return map
})

const entityColorByValue = (value: string) =>
  getColor(entityIndexMap.value.get(value) ?? 0)

const filteredEntities = computed(() => {
  const q = entitySearch.value.trim().toLowerCase()
  return props.entityOptions.filter(o => !q || o.label.toLowerCase().includes(q))
})

// ─── Location colors (stable by index in original list) ───────────────────────
const locationIndexMap = computed(() => {
  const map = new Map<string, number>()
  props.locationStocks.forEach((ls, i) => map.set(ls.location, i))
  return map
})
const locationColorByName = (name: string) =>
  getColor((locationIndexMap.value.get(name) ?? 0) + 2)

// ─── Recommendation: bodega seleccionada → destino sugerido ──────────────────
// Cuando el usuario elige una bodega de origen, se recomienda el destino que
// más palabras comparte con el nombre de esa bodega.
const recommendedEntity = computed(() => {
  if (!props.form.receptionPoint || !props.entityOptions.length) return null
  let best = { value: '', score: 0 }
  for (const opt of props.entityOptions) {
    const s = matchScore(opt.label, props.form.receptionPoint)
    if (s > best.score) best = { value: opt.value, score: s }
  }
  return best.score > 0 ? best.value : null
})

// Entities sorted: recommended first when a location is selected
const sortedEntities = computed(() => {
  const rec = recommendedEntity.value
  if (!rec) return filteredEntities.value
  return [...filteredEntities.value].sort((a, b) =>
    a.value === rec ? -1 : b.value === rec ? 1 : 0
  )
})

const handleSubmit = () => {
  if (!props.form.rawMaterial || props.form.quantity <= 0 || !props.form.entity) return
  if (insufficientStock.value) return
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
            @update:modelValue="val => emit('update:form', { ...form, rawMaterial: val, receptionPoint: '' })"
            :options="materialOptions"
            placeholder="Buscar materia prima..."
          />
        </div>

        <!-- Bodega de origen — visible solo cuando hay stock por ubicación -->
        <div v-if="selectedMaterial && locationStocks.length > 0" class="field full">
          <label>Bodega de origen <span class="unit-hint">(selecciona de dónde sale)</span></label>
          <div class="location-list">
            <button
              v-for="ls in locationStocks"
              :key="ls.location"
              type="button"
              :class="['location-item', { selected: form.receptionPoint === ls.location }]"
              :style="form.receptionPoint === ls.location ? {
                background: locationColorByName(ls.location).bg,
                borderColor: locationColorByName(ls.location).border,
              } : {}"
              @click="emit('update:form', { ...form, receptionPoint: ls.location })"
            >
              <div class="location-item__left">
                <span
                  class="location-item__color-dot"
                  :style="{ background: locationColorByName(ls.location).text }"
                ></span>
                <span
                  class="location-item__name"
                  :style="form.receptionPoint === ls.location ? { color: locationColorByName(ls.location).text } : {}"
                >{{ ls.location }}</span>
              </div>
              <div class="location-item__right">
                <template v-if="locationAfterDispatch(ls) !== null">
                  <span class="location-item__current">{{ toDisplayQuantity(ls.stock, selectedMaterial?.unit ?? "").toFixed(2) }}</span>
                  <i class="fas fa-arrow-right location-item__arrow"></i>
                  <span
                    class="location-item__after"
                    :class="{
                      'after--ok':    locationAfterDispatch(ls)! > 0,
                      'after--empty': locationAfterDispatch(ls)! <= 0
                    }"
                  >{{ locationAfterDispatch(ls)!.toFixed(2) }}</span>
                  <span class="location-item__unit">{{ getDisplayUnit(selectedMaterial?.unit ?? "") }}</span>
                </template>
                <template v-else>
                  <div class="location-item__stock">
                    <strong :style="form.receptionPoint === ls.location ? { color: locationColorByName(ls.location).text } : {}">
                      {{ toDisplayQuantity(ls.stock, selectedMaterial?.unit ?? "").toFixed(2) }}
                    </strong>
                    <span>{{ getDisplayUnit(selectedMaterial?.unit ?? "") }}</span>
                  </div>
                </template>
              </div>
            </button>
          </div>
          <span v-if="!form.receptionPoint" class="hint-text">
            <i class="fas fa-info-circle"></i> Selecciona una bodega para validar el stock disponible
          </span>
        </div>

        <div class="field half">
          <label>Cantidad <span class="unit-hint">{{ selectedMaterial ? `(${getDisplayUnit(selectedMaterial?.unit ?? "")})` : '' }}</span></label>
          <input
            type="number"
            :value="form.quantity"
            @input="e => emit('update:form', { ...form, quantity: Number((e.target as HTMLInputElement).value) })"
            min="0" step="0.01" placeholder="0.00"
            :class="{ 'input-error': insufficientStock }"
          />
          <span v-if="insufficientStock" class="error-text">
            <i class="fas fa-exclamation-triangle"></i> Stock insuficiente en esta bodega
          </span>
        </div>


        <div class="field full">
          <label>Destino <span class="unit-hint">(punto de despacho)</span></label>
          <div class="entity-selector">
            <div class="entity-search">
              <i class="fas fa-search entity-search__icon"></i>
              <input
                v-model="entitySearch"
                type="text"
                class="entity-search__input"
                placeholder="Filtrar destino…"
              />
              <button v-if="entitySearch" class="entity-search__clear" @click="entitySearch = ''">
                <i class="fas fa-times"></i>
              </button>
            </div>
            <!-- Banner de recomendación (aparece al seleccionar bodega) -->
            <div v-if="recommendedEntity && form.receptionPoint && !form.entity" class="entity-rec-banner">
              <i class="fas fa-bolt"></i>
              Basado en <strong>{{ form.receptionPoint }}</strong>, te sugerimos el destino marcado abajo
            </div>

            <div class="entity-list">
              <button
                v-for="opt in sortedEntities"
                :key="opt.value"
                type="button"
                :class="['entity-item', { 'entity-item--selected': form.entity === opt.value }]"
                :style="form.entity === opt.value ? {
                  background: entityColorByValue(opt.value).bg,
                  borderColor: entityColorByValue(opt.value).border,
                  color: entityColorByValue(opt.value).text
                } : {}"
                @click="emit('update:form', { ...form, entity: opt.value })"
              >
                <span
                  class="entity-item__dot"
                  :style="{ background: entityColorByValue(opt.value).text }"
                ></span>
                <span class="entity-item__name">{{ opt.label }}</span>
                <span
                  v-if="opt.value === recommendedEntity && !form.entity"
                  class="badge-recommended"
                ><i class="fas fa-bolt"></i> Sugerido</span>
                <i v-if="form.entity === opt.value" class="fas fa-check entity-item__check"></i>
              </button>
              <div v-if="filteredEntities.length === 0" class="entity-empty">
                Sin resultados para "{{ entitySearch }}"
              </div>
            </div>
          </div>
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
          :disabled="isSubmitting || !form.rawMaterial || form.quantity <= 0 || !form.entity || insufficientStock || (locationStocks.length > 0 && !form.receptionPoint)"
        >
          <i class="fas fa-truck-loading"></i>
          Registrar Salida
        </button>
      </div>
    </div>

    <!-- Right: Summary -->
    <div class="summary-panel">

      <!-- Stock por bodega cuando hay múltiples ubicaciones -->
      <div v-if="selectedMaterial && locationStocks.length > 1" class="info-card info-card--locations">
        <div class="info-card__header">
          <i class="fas fa-warehouse"></i>
          <span>Stock por bodega</span>
        </div>
        <div class="location-summary">
          <div
            v-for="ls in locationStocks"
            :key="ls.location"
            class="location-summary__row"
            :class="{ 'is-selected': form.receptionPoint === ls.location }"
          >
            <span class="location-summary__name">{{ ls.location }}</span>
            <span class="location-summary__qty">
              {{ toDisplayQuantity(ls.stock, selectedMaterial?.unit ?? "").toFixed(2) }}
              {{ getDisplayUnit(selectedMaterial?.unit ?? "") }}
            </span>
          </div>
        </div>
      </div>

      <!-- Stock General (suma de todas las bodegas) -->
      <div v-if="selectedMaterial" class="info-card info-card--global">
        <div class="info-card__header">
          <i class="fas fa-layer-group"></i>
          <span>Stock General</span>
        </div>
        <div class="info-card__value">
          {{ toDisplayQuantity(locationStocks.length ? totalLocationStock : (selectedMaterial?.quantity ?? 0), selectedMaterial?.unit ?? "").toFixed(2) }}
          <span class="info-card__unit">{{ getDisplayUnit(selectedMaterial?.unit ?? "") }}</span>
        </div>
        <div class="info-card__sub">{{ selectedMaterial.name }} · todas las bodegas</div>
      </div>

      <!-- Stock de bodega seleccionada -->
      <div v-if="selectedMaterial && form.receptionPoint" class="info-card info-card--stock">
        <div class="info-card__header">
          <i class="fas fa-warehouse"></i>
          <span>{{ form.receptionPoint }}</span>
        </div>
        <div class="info-card__value">
          {{ toDisplayQuantity(effectiveStockBackend, selectedMaterial?.unit ?? "").toFixed(2) }}
          <span class="info-card__unit">{{ getDisplayUnit(selectedMaterial?.unit ?? "") }}</span>
        </div>
        <div class="info-card__sub">disponible en esta bodega</div>
      </div>

      <!-- Valor despacho -->
      <div v-if="selectedMaterial && form.quantity > 0" class="info-card info-card--total-out">
        <div class="info-card__header">
          <i class="fas fa-boxes"></i>
          <span>Valor del despacho</span>
        </div>
        <div class="info-card__value">${{ totalValue.toFixed(2) }}</div>
        <div class="info-card__sub">
          Costo: ${{ ((selectedMaterial.unit === 'g' || selectedMaterial.unit === 'ml') ? (selectedMaterial.cost || 0) * 1000 : (selectedMaterial.cost || 0)).toFixed(4) }} / {{ getDisplayUnit(selectedMaterial?.unit ?? "") }}
        </div>
      </div>

      <!-- Stock después del despacho -->
      <div
        v-if="stockAfterDispatch && !stockAfterDispatch.isNegative"
        :class="['info-card', 'info-card--remaining', `remaining--${stockAfterDispatch.level}`]"
      >
        <div class="info-card__header">
          <i :class="stockAfterDispatch.level === 'empty' ? 'fas fa-box' : stockAfterDispatch.level === 'low' ? 'fas fa-triangle-exclamation' : 'fas fa-arrow-trend-down'"></i>
          <span>Quedará en</span>
        </div>
        <div v-if="stockAfterDispatch.location" class="remaining-location">
          <i class="fas fa-warehouse"></i>
          {{ stockAfterDispatch.location }}
        </div>
        <div class="info-card__value">
          {{ stockAfterDispatch.remaining }}
          <span class="info-card__unit">{{ stockAfterDispatch.unit }}</span>
        </div>
        <div class="info-card__sub">
          <span v-if="stockAfterDispatch.level === 'empty'">Bodega quedará vacía</span>
          <span v-else-if="stockAfterDispatch.level === 'low'">Stock bajo — revisar reposición</span>
          <span v-else>Stock saludable tras el despacho</span>
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
        <li v-if="form.receptionPoint"><strong>Desde bodega:</strong> {{ form.receptionPoint }}</li>
        <li><strong>Cantidad:</strong> {{ form.quantity }} {{ selectedMaterial ? getDisplayUnit(selectedMaterial?.unit ?? "") : '' }}</li>
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

  &--global    { background: #f8fafc; border-color: #e2e8f0; .info-card__header { i { color: #64748b; } } .info-card__value { color: #1e293b; } }
  &--stock     { background: #faf5ff; border-color: #e9d5ff; .info-card__header { i { color: $NICOLE-PURPLE; } color: $NICOLE-PURPLE; } .info-card__value { color: $NICOLE-PURPLE; } }
  &--total-out { background: #fff5f5; border-color: #fecaca; .info-card__value { color: #dc2626; } .info-card__header { color: #dc2626; i { color: #dc2626; } } }
  &--remaining { background: #f0fdf4; border-color: #bbf7d0; .info-card__value { color: #047857; } .info-card__header { i { color: #047857; } } }

  // Remaining levels
  &.remaining--ok    { background: #f0fdf4; border-color: #86efac; .info-card__header { color: #166534; i { color: #16a34a; } } .info-card__value { color: #15803d; } .info-card__sub { color: #166534; } }
  &.remaining--low   { background: #fffbeb; border-color: #fcd34d; .info-card__header { color: #92400e; i { color: #d97706; } } .info-card__value { color: #b45309; } .info-card__sub { color: #92400e; } }
  &.remaining--empty { background: #fff1f2; border-color: #fda4af; .info-card__header { color: #9f1239; i { color: #e11d48; } } .info-card__value { color: #be123c; } .info-card__sub { color: #9f1239; } }
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

// ─── Entity selector ──────────────────────────────────────────────────────────

.entity-selector {
  border: 1.5px solid #e2e8f0;
  border-radius: 10px;
  overflow: hidden;
  background: white;
  transition: border-color 0.2s;

  &:focus-within { border-color: #94a3b8; }
}

.entity-search {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.85rem;
  border-bottom: 1px solid #f1f5f9;
  background: #f8fafc;

  &__icon { color: #94a3b8; font-size: 0.78rem; flex-shrink: 0; }

  &__input {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    font-size: 0.85rem;
    color: #1e293b;
    &::placeholder { color: #94a3b8; }
  }

  &__clear {
    background: none;
    border: none;
    cursor: pointer;
    color: #94a3b8;
    font-size: 0.72rem;
    padding: 0.2rem;
    border-radius: 4px;
    line-height: 1;
    &:hover { color: #475569; }
  }
}

.entity-rec-banner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1rem;
  background: #fefce8;
  border-bottom: 1px solid #fde68a;
  font-size: 0.78rem;
  color: #92400e;
  font-weight: 500;

  i { color: #d97706; font-size: 0.72rem; flex-shrink: 0; }
  strong { font-weight: 700; }
}

.entity-list {
  max-height: 200px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #e2e8f0 transparent;
}

.entity-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.65rem 1rem;
  border: none;
  border-bottom: 1px solid #f8fafc;
  background: white;
  cursor: pointer;
  text-align: left;
  transition: background 0.12s;

  &:last-child { border-bottom: none; }
  &:hover:not(.entity-item--selected) { background: #f8fafc; }

  &--selected { font-weight: 700; }

  &__dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  &__name {
    flex: 1;
    font-size: 0.875rem;
    font-weight: 500;
    color: #334155;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__check {
    font-size: 0.75rem;
    flex-shrink: 0;
  }
}

.entity-empty {
  padding: 1.25rem;
  text-align: center;
  font-size: 0.82rem;
  color: #94a3b8;
}

// ─── Remaining location label ─────────────────────────────────────────────────

.remaining-location {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  margin-bottom: 0.5rem;
  background: rgba(0,0,0,0.06);
  color: inherit;

  i { font-size: 0.7rem; }
}

// ─── Location selector ────────────────────────────────────────────────────────

.location-list {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.location-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1rem;
  background: #f8fafc;
  border: 1.5px solid #e2e8f0;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
  width: 100%;

  &:hover {
    border-color: #dc2626;
    background: #fff5f5;
  }

  &.selected {
    border-color: #dc2626;
    background: #fff5f5;
    box-shadow: 0 0 0 3px rgba(#dc2626, 0.08);
  }

  &__left {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    min-width: 0;

    i {
      color: #94a3b8;
      font-size: 0.85rem;
      flex-shrink: 0;

      .selected & { color: #dc2626; }
    }
  }

  &__color-dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  &__name {
    font-size: 0.875rem;
    font-weight: 600;
    color: #334155;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

.badge-recommended {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: #d97706;
  background: #fef3c7;
  border: 1px solid #fcd34d;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  flex-shrink: 0;
  white-space: nowrap;

  i { font-size: 0.6rem; }
}

  &__right {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    flex-shrink: 0;
  }

  &__current {
    font-size: 0.85rem;
    font-weight: 600;
    color: #94a3b8;
    text-decoration: line-through;
  }

  &__arrow {
    font-size: 0.65rem;
    color: #94a3b8;
  }

  &__after {
    font-size: 1rem;
    font-weight: 800;

    &.after--ok    { color: #15803d; }
    &.after--empty { color: #dc2626; }
  }

  &__unit {
    font-size: 0.75rem;
    font-weight: 600;
    color: #64748b;
  }

  &__stock {
    display: flex;
    align-items: baseline;
    gap: 0.3rem;
    flex-shrink: 0;

    strong {
      font-size: 1.1rem;
      font-weight: 800;
      color: #1e293b;

      .selected & { color: #dc2626; }
    }

    span {
      font-size: 0.75rem;
      font-weight: 600;
      color: #64748b;
    }
  }
}

.hint-text {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  color: #94a3b8;
  font-weight: 500;
  margin-top: 0.4rem;

  i { font-size: 0.7rem; }
}

// ─── Location summary card ────────────────────────────────────────────────────

.info-card--locations {
  background: #f8fafc;
  border-color: #e2e8f0;

  .info-card__header { color: #64748b; i { color: #475569; } }
}

.location-summary {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;

  &__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.4rem 0.6rem;
    border-radius: 6px;
    transition: background 0.12s;

    &.is-selected {
      background: rgba(#dc2626, 0.06);
      border-radius: 6px;
    }
  }

  &__name {
    font-size: 0.8rem;
    font-weight: 600;
    color: #475569;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__qty {
    font-size: 0.8rem;
    font-weight: 700;
    color: #1e293b;
    flex-shrink: 0;

    .is-selected & { color: #dc2626; }
  }
}
</style>
