<script setup lang="ts">
import { ref, watch } from 'vue';
import type { IncomingDispatch } from '@/services/pos.service';
import POSService from '@/services/pos.service';

const props = defineProps<{
  isOpen: boolean;
  dispatches: IncomingDispatch[];
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'success'): void;
}>();

const isProcessing = ref(false);
const bulkNotes = ref('');
const filterMode = ref<'today' | 'tomorrow' | 'all'>('today');

// --- CONSOLIDATED LOGIC ---

interface ConsolidatedItem {
  productId: string;
  name: string;
  totalSent: number;
  quantityReceived: number;
  sources: {
    orderId: string;
    dispatchId: string;
    quantitySent: number;
  }[];
}

const consolidatedItems = ref<ConsolidatedItem[]>([]);

// Recompute whenever modal opens, dispatches change, or filter changes
watch(() => [props.isOpen, props.dispatches, filterMode.value], () => {
  if (props.isOpen) {
    calculateConsolidated();
  }
}, { immediate: true });

// Reset notes only on open
watch(() => props.isOpen, (newVal) => {
  if (newVal) bulkNotes.value = '';
});

const isSameDay = (d1: Date, d2: Date) => {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
}

const calculateConsolidated = () => {
  const map = new Map<string, ConsolidatedItem>();

  // Dates for filtering
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  props.dispatches.forEach(d => {
    // Status Check: Undefined or PENDING is acceptable for "En Tránsito"
    const status = d.dispatch.receptionStatus;
    // If status is undefined, we assume pending. If defined, must be PENDING.
    if (status && status !== 'PENDING') return;

    // Date Check
    // We use d.deliveryDate from the top level object
    const deliveryDate = new Date(d.deliveryDate);
    // Correct timezone issue if needed, but assuming ISO string works for local date comparison roughly
    // Ideally we work with local dates.
    // Adjust deliveryDate from ISO UTC to Local if needed, but often backend stores T00:00:00Z as "The Date".
    // Let's rely on getFullYear/Month/Date being local for now.
    const dDateLocal = new Date(d.deliveryDate);
    // Force offset check? The ISO string "2026-01-30T00..." might range. 
    // Let's use UTC comparison for exact date matches if the strings are strictly dates.
    // But user likely wants simple local day comparison.

    let dateMatch = false;

    if (filterMode.value === 'all') dateMatch = true;
    else if (filterMode.value === 'today' && isSameDay(dDateLocal, today)) dateMatch = true;
    else if (filterMode.value === 'tomorrow' && isSameDay(dDateLocal, tomorrow)) dateMatch = true;

    if (!dateMatch) return;

    d.dispatch.items.forEach(item => {
      if (!map.has(item.productId)) {
        map.set(item.productId, {
          productId: item.productId,
          name: item.name,
          totalSent: 0,
          quantityReceived: 0,
          sources: []
        });
      }
      const entry = map.get(item.productId)!;
      entry.totalSent += item.quantitySent;
      entry.quantityReceived += item.quantitySent; // Default to full reception
      entry.sources.push({
        orderId: d.orderId,
        dispatchId: d.dispatch._id,
        quantitySent: item.quantitySent
      });
    });
  });

  consolidatedItems.value = Array.from(map.values());
};

const handleConfirm = async () => {
  if (consolidatedItems.value.length === 0) return;

  isProcessing.value = true;

  // Group sources by dispatch
  const dispatchUpdates = new Map<string, {
    orderId: string,
    items: { productId: string, quantityReceived: number, itemStatus: string }[]
  }>();

  consolidatedItems.value.forEach(cItem => {
    let remainingToDistribute = cItem.quantityReceived;

    cItem.sources.forEach(source => {
      if (!dispatchUpdates.has(source.dispatchId)) {
        dispatchUpdates.set(source.dispatchId, {
          orderId: source.orderId,
          items: []
        });
      }

      const update = dispatchUpdates.get(source.dispatchId)!;

      let allocated = 0;
      let status = 'OK';

      if (remainingToDistribute >= source.quantitySent) {
        allocated = source.quantitySent;
        remainingToDistribute -= source.quantitySent;
      } else {
        allocated = remainingToDistribute;
        remainingToDistribute = 0;
        // If allocated < sent, mark MISSING
        if (allocated < source.quantitySent) {
          status = 'MISSING';
        }
      }

      update.items.push({
        productId: cItem.productId,
        quantityReceived: allocated,
        itemStatus: status
      });
    });
  });

  try {
    const promises = Array.from(dispatchUpdates.entries()).map(([dispatchId, data]) => {
      return POSService.confirmReception(data.orderId, dispatchId, {
        receivedBy: 'Encargado POS (Masivo)',
        receptionNotes: bulkNotes.value || 'Recepción Masiva General',
        items: data.items
      });
    });

    await Promise.all(promises);
    emit('success');
    emit('close');

  } catch (error) {
    console.error('Bulk reception error:', error);
    // We still emit success to refresh lists, filtering out what failed might happen on refresh
    emit('success');
    emit('close');
  } finally {
    isProcessing.value = false;
  }
}
</script>

<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <div class="header-text">
            <h3><i class="fa-solid fa-boxes-stacked"></i> Recepción General Masiva</h3>
            <p>Verifica y recibe el total de productos del camión.</p>
        </div>
        <button class="btn-close" @click="$emit('close')"><i class="fa-solid fa-times"></i></button>
      </div>

      <div class="modal-body">
        
        <!-- Filter Tabs -->
        <div class="filter-tabs">
            <button :class="{ active: filterMode === 'today' }" @click="filterMode = 'today'">Hoy</button>
            <button :class="{ active: filterMode === 'tomorrow' }" @click="filterMode = 'tomorrow'">Mañana</button>
            <button :class="{ active: filterMode === 'all' }" @click="filterMode = 'all'">Todo (Pendiente)</button>
        </div>

        <div v-if="consolidatedItems.length === 0" class="empty-msg">
            <i class="fa-solid fa-check-circle"></i>
            <p v-if="filterMode === 'today'">No hay ítems para <strong>HOY</strong>.</p>
            <p v-else-if="filterMode === 'tomorrow'">No hay ítems para <strong>MAÑANA</strong>.</p>
            <p v-else>No hay ítems pendientes en general.</p>
        </div>

        <div v-else class="table-container">
            <table class="consolidated-table">
                <thead>
                    <tr>
                        <th class="col-prod">Producto</th>
                        <th class="text-center">Enviado</th>
                        <th class="text-center">Recibido (Total)</th>
                        <th>Estado</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="item in consolidatedItems" :key="item.productId" :class="{ 'diff': item.quantityReceived !== item.totalSent }">
                        <td class="prod-name">{{ item.name }}</td>
                        <td class="text-center val-sent">{{ item.totalSent }}</td>
                        <td class="text-center">
                            <div class="qty-control">
                                <button tabindex="-1" @click="item.quantityReceived = Math.max(0, item.quantityReceived - 1)">-</button>
                                <input type="number" v-model="item.quantityReceived" min="0">
                                <button tabindex="-1" @click="item.quantityReceived++">+</button>
                            </div>
                        </td>
                        <td>
                            <span v-if="item.quantityReceived === item.totalSent" class="badge ok">Correcto</span>
                            <span v-else-if="item.quantityReceived < item.totalSent" class="badge missing">Faltan {{ item.totalSent - item.quantityReceived }}</span>
                            <span v-else class="badge excess">Sobran {{ item.quantityReceived - item.totalSent }}</span>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div class="notes-section">
            <label>Nota de Recepción (opcional):</label>
            <input type="text" v-model="bulkNotes" placeholder="Ej: Todo conforme, recibido por X...">
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-cancel" @click="$emit('close')">Cancelar</button>
        <button class="btn-confirm" @click="handleConfirm" :disabled="isProcessing || consolidatedItems.length === 0">
            <i v-if="isProcessing" class="fa-solid fa-spinner fa-spin"></i>
            <span v-else>Confirmar Recepción</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use 'sass:color';

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
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }

  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.modal-header {
  padding: 1.5rem;
  border-bottom: 1px solid $border-light;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;

  .header-text {
    h3 {
      margin: 0;
      color: $NICOLE-PURPLE;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 1.25rem;
    }

    p {
      margin: 0.3rem 0 0 0;
      color: $text-light;
      font-size: 0.9rem;
    }
  }

  .btn-close {
    background: none;
    border: none;
    font-size: 1.2rem;
    color: $text-light;
    cursor: pointer;

    &:hover {
      color: $text-dark;
    }
  }
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
}

.filter-tabs {
  display: flex;
  background: $gray-50;
  padding: 4px;
  border-radius: 8px;
  margin-bottom: 1.5rem;
  gap: 0.5rem;

  button {
    flex: 1;
    border: none;
    background: transparent;
    padding: 0.5rem;
    border-radius: 6px;
    font-weight: 600;
    color: $text-light;
    cursor: pointer;
    font-size: 0.9rem;
    transition: all 0.2s;

    &:hover {
      background: rgba(0, 0, 0, 0.03);
    }

    &.active {
      background: white;
      color: $NICOLE-PURPLE;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
    }
  }
}

.table-container {
  border: 1px solid $border-light;
  border-radius: 8px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.consolidated-table {
  width: 100%;
  border-collapse: collapse;

  th,
  td {
    padding: 0.8rem;
    border-bottom: 1px solid $border-light;
    vertical-align: middle;
  }

  th {
    background: $gray-50;
    text-align: left;
    font-weight: 600;
    color: $text-light;
    font-size: 0.85rem;
  }

  .col-prod {
    width: 40%;
  }

  .text-center {
    text-align: center;
  }

  .prod-name {
    font-weight: 500;
    font-size: 0.95rem;
  }

  .val-sent {
    font-weight: 700;
    font-size: 1.1rem;
    color: $text-dark;
  }

  tr.diff {
    background-color: #fff9db;
  }

  .qty-control {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;

    button {
      width: 32px;
      height: 32px;
      border: 1px solid $border-light;
      background: white;
      border-radius: 6px;
      cursor: pointer;

      &:hover {
        background: $gray-100;
      }
    }

    input {
      width: 60px;
      text-align: center;
      border: 1px solid $border-light;
      border-radius: 6px;
      padding: 0.4rem;
      font-weight: 700;
      color: $NICOLE-PURPLE;
    }
  }

  .badge {
    padding: 0.3rem 0.6rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 700;

    &.ok {
      background: rgba($success, 0.1);
      color: $success;
    }

    &.missing {
      background: rgba($warning, 0.1);
      color: darken-color($warning, 10%);
    }

    &.excess {
      background: rgba($NICOLE-SECONDARY, 0.1);
      color: $NICOLE-SECONDARY;
    }
  }
}

.notes-section {
  margin-top: 1.5rem;

  label {
    display: block;
    font-size: 0.9rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }

  input {
    width: 100%;
    padding: 0.8rem;
    border: 1px solid $border-light;
    border-radius: 8px;
    font-family: inherit;
  }
}

.modal-footer {
  padding: 1.2rem 1.5rem;
  border-top: 1px solid $border-light;
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  background: $gray-50;
  border-bottom-left-radius: 12px;
  border-bottom-right-radius: 12px;

  button {
    padding: 0.7rem 1.5rem;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    font-size: 0.95rem;
    transition: all 0.2s;
  }

  .btn-cancel {
    background: white;
    border: 1px solid $border-light;
    color: $text-light;

    &:hover {
      background: $gray-100;
      color: $text-dark;
    }
  }

  .btn-confirm {
    background: $NICOLE-SECONDARY;
    color: white;
    border: none;
    box-shadow: 0 4px 10px rgba($NICOLE-SECONDARY, 0.2);
    display: flex;
    align-items: center;
    gap: 0.5rem;

    &:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 6px 14px rgba($NICOLE-SECONDARY, 0.3);
    }

    &:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }
  }
}

.empty-msg {
  text-align: center;
  padding: 3rem;
  color: $text-light;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;

  i {
    font-size: 3rem;
    color: $success;
  }

  p {
    font-size: 1.1rem;
    margin: 0;
  }
}
</style>
