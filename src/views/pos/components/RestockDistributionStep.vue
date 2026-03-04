<script setup lang="ts">
import { ref, computed, watch } from 'vue';

export interface DeliveryRound {
  label: string;
}

export interface RoundDistributionItem {
  productName: string;
  unit: string;
  category: string;
  pedidoFinal: number;
  splits: Record<string, number>; // roundLabel → quantity
}

export interface DeliveryRoundResult {
  productName: string;
  unit: string;
  category: string;
  pedidoFinal: number;
  deliveryRounds: Array<{ label: string; quantity: number }>;
}

const props = defineProps({
  items: {
    type: Array as () => Array<{ productName: string; unit: string; category: string; pedidoFinal: number }>,
    required: true,
  },
});

const emit = defineEmits<{
  (e: 'back'): void;
  (e: 'confirm', data: DeliveryRoundResult[]): void;
}>();

// --- Delivery Rounds Management ---
const rounds = ref<DeliveryRound[]>([]);
const newRoundLabel = ref('');

const addRound = () => {
  const label = newRoundLabel.value.trim();
  if (!label) return;
  if (rounds.value.some(r => r.label === label)) return;
  rounds.value.push({ label });
  newRoundLabel.value = '';

  distributionItems.value.forEach(item => {
    if (label in item.splits) return;
    item.splits[label] = 0;
  });
  recalcFirstRound();
};

const removeRound = (idx: number) => {
  const round = rounds.value[idx];
  if (!round) return;
  const label = round.label;
  rounds.value.splice(idx, 1);

  // Remove splits for this round
  distributionItems.value.forEach(item => {
    delete item.splits[label];
  });
  recalcFirstRound();
};

// --- Distribution Data ---
const distributionItems = ref<RoundDistributionItem[]>([]);

const initDistribution = () => {
  distributionItems.value = props.items
    .filter(item => item.pedidoFinal > 0)
    .map(item => ({
      productName: item.productName,
      unit: item.unit,
      category: item.category,
      pedidoFinal: item.pedidoFinal,
      splits: {},
    }));
};

watch(() => props.items, initDistribution, { immediate: true, deep: true });

// When user edits a non-first round, recalculate the first round
const recalcFirstRound = () => {
  if (rounds.value.length === 0) return;
  const firstLabel = rounds.value[0]!.label;

  distributionItems.value.forEach(item => {
    const othersSum = rounds.value
      .slice(1)
      .reduce((sum, r) => sum + (item.splits[r.label] || 0), 0);
    item.splits[firstLabel] = Math.max(0, item.pedidoFinal - othersSum);
  });
};

const updateSplit = (itemIdx: number, roundLabel: string, value: number) => {
  const item = distributionItems.value[itemIdx];
  if (!item) return;

  const clampedValue = Math.max(0, Math.min(value, item.pedidoFinal));
  item.splits[roundLabel] = clampedValue;

  // If this is not the first round, recalc first
  if (rounds.value.length > 0 && roundLabel !== rounds.value[0]!.label) {
    const firstLabel = rounds.value[0]!.label;
    const othersSum = rounds.value
      .filter(r => r.label !== firstLabel)
      .reduce((sum, r) => sum + (item.splits[r.label] || 0), 0);
    item.splits[firstLabel] = Math.max(0, item.pedidoFinal - othersSum);
  }
};

const adjustSplit = (itemIdx: number, roundLabel: string, delta: number) => {
  const item = distributionItems.value[itemIdx];
  if (!item) return;
  const current = item.splits[roundLabel] || 0;
  updateSplit(itemIdx, roundLabel, current + delta);
};

// Validation
const getItemTotal = (item: RoundDistributionItem): number =>
  rounds.value.reduce((sum, r) => sum + (item.splits[r.label] || 0), 0);

const isValid = computed(() => {
  if (rounds.value.length === 0) return false;
  return distributionItems.value.every(item => getItemTotal(item) === item.pedidoFinal);
});

const handleConfirm = () => {
  if (!isValid.value) return;

  const result: DeliveryRoundResult[] = distributionItems.value.map(item => ({
    productName: item.productName,
    unit: item.unit,
    category: item.category,
    pedidoFinal: item.pedidoFinal,
    deliveryRounds: rounds.value
      .filter(r => (item.splits[r.label] || 0) > 0)
      .map(r => ({
        label: r.label,
        quantity: item.splits[r.label] || 0,
      })),
  }));

  emit('confirm', result);
};

// Quick presets
const presets = [
  { labels: ['Primera Entrega', 'Segunda Entrega'] },
  { labels: ['Mañana', 'Tarde'] },
  { labels: ['Entrega 1', 'Entrega 2', 'Entrega 3'] },
];

const applyPreset = (preset: { labels: string[] }) => {
  rounds.value = preset.labels.map(label => ({ label }));
  distributionItems.value.forEach(item => {
    item.splits = {};
    preset.labels.forEach((label, idx) => {
      item.splits[label] = idx === 0 ? item.pedidoFinal : 0;
    });
  });
};
</script>

<template>
  <div class="distribution-step">
    <!-- Header -->
    <div class="step-header">
      <button type="button" class="btn-back" @click="emit('back')">
        <i class="fa-solid fa-arrow-left"></i>
        Volver al Pedido
      </button>
      <div class="step-title">
        <i class="fa-solid fa-clock-rotate-left"></i>
        <span>Distribuir Entrega</span>
      </div>
      <div class="step-subtitle">
        Divide las cantidades del pedido en rondas de entrega.
      </div>
    </div>

    <!-- Round Management -->
    <div class="rounds-manager">
      <div class="rounds-header">
        <span class="rounds-title">
          <i class="fa-solid fa-layer-group"></i>
          Rondas de Entrega
        </span>
        <span class="rounds-count" v-if="rounds.length > 0">{{ rounds.length }} rondas</span>
      </div>

      <!-- Quick Presets -->
      <div class="presets-row" v-if="rounds.length === 0">
        <span class="preset-label">Plantillas rápidas:</span>
        <button
          v-for="(preset, idx) in presets"
          :key="idx"
          type="button"
          class="btn-preset"
          @click="applyPreset(preset)"
        >
          {{ preset.labels.join(' + ') }}
        </button>
      </div>

      <!-- Existing Rounds -->
      <div class="rounds-list" v-if="rounds.length > 0">
        <div
          v-for="(round, idx) in rounds"
          :key="round.label"
          class="round-chip"
          :class="{ primary: idx === 0 }"
        >
          <span class="round-number">{{ idx + 1 }}</span>
          <span class="round-label">{{ round.label }}</span>
          <button type="button" class="btn-remove-round" @click="removeRound(idx)">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      </div>

      <!-- Add New Round -->
      <div class="add-round-row">
        <input
          v-model="newRoundLabel"
          type="text"
          class="round-input"
          placeholder="Nombre de la ronda (ej: Mañana, Tarde...)"
          @keyup.enter="addRound"
        />
        <button
          type="button"
          class="btn-add-round"
          :disabled="!newRoundLabel.trim()"
          @click="addRound"
        >
          <i class="fa-solid fa-plus"></i> Agregar
        </button>
      </div>
    </div>

    <!-- Products Distribution Table -->
    <div class="products-list" v-if="rounds.length > 0">
      <div
        v-for="(item, itemIdx) in distributionItems"
        :key="item.productName"
        class="dist-product"
      >
        <div class="product-info">
          <span class="product-name">{{ item.productName }}</span>
          <span class="unit-badge">{{ item.unit }}</span>
          <span class="dest-badge" :class="item.category.toLowerCase()">{{ item.category }}</span>
          <span class="total-badge">Total: {{ item.pedidoFinal }}</span>
        </div>

        <div class="splits-row">
          <div
            v-for="(round, roundIdx) in rounds"
            :key="round.label"
            class="split-box"
            :class="{ primary: roundIdx === 0 }"
          >
            <div class="split-header">
              <span class="split-number">{{ roundIdx + 1 }}</span>
              <span class="split-label">{{ round.label }}</span>
            </div>
            <div class="split-controls">
              <button
                type="button"
                class="btn-adjust down"
                :disabled="(item.splits[round.label] || 0) <= 0"
                @click="adjustSplit(itemIdx, round.label, -1)"
              >
                <i class="fa-solid fa-minus"></i>
              </button>
              <input
                type="number"
                class="split-input"
                :value="item.splits[round.label] || 0"
                min="0"
                :max="item.pedidoFinal"
                @input="updateSplit(itemIdx, round.label, Number(($event.target as HTMLInputElement).value))"
              />
              <button
                type="button"
                class="btn-adjust up"
                :disabled="(item.splits[round.label] || 0) >= item.pedidoFinal"
                @click="adjustSplit(itemIdx, round.label, 1)"
              >
                <i class="fa-solid fa-plus"></i>
              </button>
            </div>
          </div>

          <div
            class="total-indicator"
            :class="{
              valid: getItemTotal(item) === item.pedidoFinal,
              error: getItemTotal(item) !== item.pedidoFinal
            }"
          >
            <span class="total-label">TOTAL</span>
            <span class="total-value">{{ getItemTotal(item) }} / {{ item.pedidoFinal }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="rounds.length === 0 && distributionItems.length > 0" class="empty-rounds">
      <i class="fa-solid fa-clock"></i>
      <p>Agrega rondas de entrega para distribuir las cantidades.</p>
    </div>

    <!-- Actions -->
    <div class="step-actions">
      <button type="button" class="btn-cancel" @click="emit('back')">
        <i class="fa-solid fa-arrow-left"></i> Volver
      </button>
      <button
        type="button"
        class="btn-confirm"
        :disabled="!isValid || distributionItems.length === 0"
        @click="handleConfirm"
      >
        <i class="fa-solid fa-check"></i>
        Confirmar Distribución
      </button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.distribution-step {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.step-header {
  text-align: center;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e2e8f0;
  position: relative;

  .btn-back {
    position: absolute;
    left: 0;
    top: 0;
    background: white;
    border: 1px solid #e2e8f0;
    color: #64748b;
    padding: 0.4rem 0.8rem;
    border-radius: 8px;
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    transition: all 0.2s;

    &:hover {
      color: #1e293b;
      border-color: #94a3b8;
    }
  }

  .step-title {
    font-size: 1.1rem;
    font-weight: 800;
    color: #1e293b;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;

    i {
      color: $NICOLE-PURPLE;
    }
  }

  .step-subtitle {
    font-size: 0.85rem;
    color: #64748b;
    margin-top: 0.25rem;
  }
}

// --- Rounds Manager ---
.rounds-manager {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 1rem;

  .rounds-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .rounds-title {
    font-size: 0.85rem;
    font-weight: 800;
    color: #1e293b;
    display: flex;
    align-items: center;
    gap: 0.4rem;

    i {
      color: $NICOLE-PURPLE;
    }
  }

  .rounds-count {
    font-size: 0.75rem;
    font-weight: 700;
    color: #64748b;
    background: #e2e8f0;
    padding: 2px 8px;
    border-radius: 10px;
  }
}

.presets-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.75rem;

  .preset-label {
    font-size: 0.75rem;
    color: #94a3b8;
    font-weight: 600;
  }

  .btn-preset {
    background: white;
    border: 1.5px dashed #cbd5e1;
    color: #475569;
    padding: 0.35rem 0.75rem;
    border-radius: 8px;
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      border-color: $NICOLE-PURPLE;
      color: $NICOLE-PURPLE;
      background: rgba($NICOLE-PURPLE, 0.03);
    }
  }
}

.rounds-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.75rem;

  .round-chip {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    background: white;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    padding: 0.4rem 0.6rem;
    font-size: 0.82rem;
    font-weight: 700;
    color: #475569;
    transition: all 0.2s;

    &.primary {
      border-color: $NICOLE-PURPLE;
      background: rgba($NICOLE-PURPLE, 0.03);
      color: $NICOLE-PURPLE;
    }

    .round-number {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #e2e8f0;
      color: #64748b;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.65rem;
      font-weight: 900;
    }

    &.primary .round-number {
      background: $NICOLE-PURPLE;
      color: white;
    }

    .btn-remove-round {
      background: none;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      padding: 2px;
      font-size: 0.75rem;
      transition: color 0.15s;

      &:hover {
        color: #ef4444;
      }
    }
  }
}

.add-round-row {
  display: flex;
  gap: 0.5rem;

  .round-input {
    flex: 1;
    padding: 0.5rem 0.75rem;
    border: 1.5px solid #e2e8f0;
    border-radius: 8px;
    font-size: 0.85rem;
    color: #1e293b;
    outline: none;
    transition: border-color 0.2s;

    &:focus {
      border-color: $NICOLE-PURPLE;
      box-shadow: 0 0 0 3px rgba($NICOLE-PURPLE, 0.08);
    }

    &::placeholder {
      color: #cbd5e1;
    }
  }

  .btn-add-round {
    background: $NICOLE-PURPLE;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    font-size: 0.82rem;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    white-space: nowrap;
    transition: all 0.2s;

    &:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba($NICOLE-PURPLE, 0.2);
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  }
}

// --- Products Distribution ---
.products-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.dist-product {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 0.8rem;
  background: white;
  transition: box-shadow 0.2s;

  &:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  }
}

.product-info {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.6rem;

  .product-name {
    font-weight: 700;
    color: #1e293b;
    font-size: 0.95rem;
  }

  .unit-badge {
    background: #f1f5f9;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.7rem;
    color: #64748b;
    font-weight: 600;
    text-transform: uppercase;
  }

  .dest-badge {
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;

    &.producción {
      background: #fef3c7;
      color: #92400e;
    }

    &.bodega {
      background: #e0f2fe;
      color: #075985;
    }
  }

  .total-badge {
    margin-left: auto;
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    color: #16a34a;
    padding: 2px 8px;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 800;
  }
}

.splits-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.split-box {
  flex: 1;
  min-width: 130px;
  background: #f8fafc;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  padding: 0.5rem;
  text-align: center;
  transition: border-color 0.2s;

  &.primary {
    border-color: $NICOLE-PURPLE;
    background: rgba($NICOLE-PURPLE, 0.03);
  }

  .split-header {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.3rem;
    margin-bottom: 0.3rem;
  }

  .split-number {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #e2e8f0;
    color: #64748b;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 0.6rem;
    font-weight: 900;
  }

  &.primary .split-number {
    background: $NICOLE-PURPLE;
    color: white;
  }

  .split-label {
    font-size: 0.7rem;
    font-weight: 800;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.split-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;

  .btn-adjust {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: 1px solid #e2e8f0;
    background: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
    font-size: 0.7rem;
    color: #64748b;

    &.up {
      color: #16a34a;
      border-color: #dcfce7;

      &:hover:not(:disabled) {
        background: #f0fdf4;
        border-color: #bbf7d0;
      }
    }

    &.down {
      color: #ef4444;
      border-color: #fee2e2;

      &:hover:not(:disabled) {
        background: #fef2f2;
        border-color: #fecaca;
      }
    }

    &:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }
  }

  .split-input {
    width: 50px;
    padding: 0.3rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    text-align: center;
    font-size: 1rem;
    font-weight: 800;
    color: $NICOLE-PURPLE;
    outline: none;
    transition: border-color 0.2s;
    -moz-appearance: textfield;
    appearance: textfield;

    &::-webkit-inner-spin-button,
    &::-webkit-outer-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }

    &:focus {
      border-color: $NICOLE-PURPLE;
      box-shadow: 0 0 0 3px rgba($NICOLE-PURPLE, 0.1);
    }
  }
}

.total-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.4rem 0.6rem;
  border-radius: 8px;
  min-width: 70px;

  &.valid {
    background: #f0fdf4;
    border: 1px solid #bbf7d0;

    .total-value {
      color: #16a34a;
    }
  }

  &.error {
    background: #fef2f2;
    border: 1px solid #fecaca;

    .total-value {
      color: #ef4444;
    }
  }

  .total-label {
    font-size: 0.6rem;
    font-weight: 800;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .total-value {
    font-size: 0.95rem;
    font-weight: 900;
  }
}

.empty-rounds {
  text-align: center;
  padding: 2rem;
  color: #94a3b8;

  i {
    font-size: 2.5rem;
    margin-bottom: 0.75rem;
    display: block;
    color: #cbd5e1;
  }

  p {
    margin: 0;
    font-size: 0.9rem;
  }
}

.step-actions {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #e2e8f0;

  .btn-cancel {
    padding: 0.75rem 1.2rem;
    border: 1px solid #e2e8f0;
    background: white;
    color: #64748b;
    border-radius: 8px;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    transition: all 0.2s;

    &:hover {
      background: #f8fafc;
      color: #1e293b;
    }
  }

  .btn-confirm {
    padding: 0.75rem 1.5rem;
    border: none;
    background: $NICOLE-PURPLE;
    color: white;
    border-radius: 8px;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: all 0.2s;
    box-shadow: 0 4px 12px rgba($NICOLE-PURPLE, 0.2);

    &:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba($NICOLE-PURPLE, 0.3);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }
  }
}
</style>
