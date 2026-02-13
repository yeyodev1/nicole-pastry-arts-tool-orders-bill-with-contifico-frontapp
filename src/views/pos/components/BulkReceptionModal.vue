<script setup lang="ts">
import { ref, watch } from 'vue';
import type { POSOrder } from '@/services/pos.service';
import POSService from '@/services/pos.service';
import HoldConfirmButton from '@/components/ui/HoldConfirmButton.vue';
import { parseECTDate, getECTTodayString } from '@/utils/dateUtils';

const props = defineProps<{
  isOpen: boolean;
  dispatches: any[];
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'success'): void;
}>();

const isProcessing = ref(false);
const bulkNotes = ref('');
type BulkFilterMode = 'yesterday' | 'today' | 'tomorrow' | 'today_tomorrow' | 'all';
const filterMode = ref<BulkFilterMode>('today');

// --- CONSOLIDATED LOGIC ---

interface ConsolidatedItem {
  productId: string;
  name: string;
  totalSent: number;
  quantityReceived: number;
  itemStatus: 'OK' | 'MISSING' | 'DAMAGED';
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

const calculateConsolidated = () => {
  const map = new Map<string, ConsolidatedItem>();

  // Dates for filtering (Standardized EC Time)
  const todayStr = getECTTodayString(); // YYYY-MM-DD
  const today = new Date(todayStr + 'T12:00:00'); // Use noon to avoid any edge shifts

  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);

  const getDStr = (d: Date) => d.toISOString().split('T')[0];

  const yesterdayStr = getDStr(yesterday);
  const tomorrowStr = getDStr(tomorrow);

  props.dispatches.forEach(d => {
    // Status Check
    const status = d.dispatch.receptionStatus;
    if (status && status !== 'PENDING') return;

    // Standardized date parsing for EC
    const dDateObj = parseECTDate(d.deliveryDate);
    const dDateStr = getDStr(dDateObj);

    let dateMatch = false;

    if (filterMode.value === 'all') dateMatch = true;
    else if (filterMode.value === 'yesterday' && dDateStr === yesterdayStr) dateMatch = true;
    else if (filterMode.value === 'today' && dDateStr === todayStr) dateMatch = true;
    else if (filterMode.value === 'tomorrow' && dDateStr === tomorrowStr) dateMatch = true;
    else if (filterMode.value === 'today_tomorrow' && (dDateStr === todayStr || dDateStr === tomorrowStr)) dateMatch = true;

    if (!dateMatch) return;

    d.dispatch.items.forEach((item: any) => {
      if (!map.has(item.productId)) {
        map.set(item.productId, {
          productId: item.productId,
          name: item.name,
          totalSent: 0,
          quantityReceived: 0,
          itemStatus: 'OK',
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
      let status = cItem.itemStatus; // Use the consolidated status

      if (remainingToDistribute >= source.quantitySent) {
        allocated = source.quantitySent;
        remainingToDistribute -= source.quantitySent;
      } else {
        allocated = remainingToDistribute;
        remainingToDistribute = 0;
        // Even if we distribute quantity, if the user marked it MISSING elsewhere, we should follow?
        // But here we set itemStatus per product row.
        if (allocated < source.quantitySent && status === 'OK') {
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
            <button :class="{ active: filterMode === 'yesterday' }" @click="filterMode = 'yesterday'">Ayer</button>
            <button :class="{ active: filterMode === 'today' }" @click="filterMode = 'today'">Hoy</button>
            <button :class="{ active: filterMode === 'tomorrow' }" @click="filterMode = 'tomorrow'">Mañana</button>
            <button :class="{ active: filterMode === 'today_tomorrow' }" @click="filterMode = 'today_tomorrow'">Hoy y Mañana</button>
            <button :class="{ active: filterMode === 'all' }" @click="filterMode = 'all'">Todo</button>
        </div>

        <div v-if="consolidatedItems.length === 0" class="empty-msg">
            <i class="fa-solid fa-check-circle"></i>
            <p v-if="filterMode === 'today'">No hay ítems para <strong>HOY</strong>.</p>
            <p v-else-if="filterMode === 'yesterday'">No hay ítems para <strong>AYER</strong>.</p>
            <p v-else-if="filterMode === 'tomorrow'">No hay ítems para <strong>MAÑANA</strong>.</p>
            <p v-else-if="filterMode === 'today_tomorrow'">No hay ítems para <strong>HOY Y MAÑANA</strong>.</p>
            <p v-else>No hay ítems pendientes en general.</p>
        </div>

        <div v-else class="table-container">
            <table class="consolidated-table">
                <thead>
                    <tr>
                        <th class="col-prod">Producto</th>
                        <th class="text-center">Enviado</th>
                        <th class="text-center">Recibido</th>
                        <th>Estado Físico</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="item in consolidatedItems" :key="item.productId" :class="{ 'diff': item.quantityReceived !== item.totalSent || item.itemStatus !== 'OK' }">
                        <td class="prod-name">
                            {{ item.name }}
                            <div v-if="item.quantityReceived !== item.totalSent" class="diff-indicator">
                                <span v-if="item.quantityReceived < item.totalSent">Faltan {{ item.totalSent - item.quantityReceived }}</span>
                                <span v-else>Sobran {{ item.quantityReceived - item.totalSent }}</span>
                            </div>
                        </td>
                        <td class="text-center val-sent">{{ item.totalSent }}</td>
                        <td class="text-center">
                            <div class="qty-control">
                                <button tabindex="-1" @click="item.quantityReceived = Math.max(0, item.quantityReceived - 1)">-</button>
                                <input type="number" v-model="item.quantityReceived" min="0">
                                <button tabindex="-1" @click="item.quantityReceived++">+</button>
                            </div>
                        </td>
                        <td>
                            <select v-model="item.itemStatus" :class="item.itemStatus">
                                <option value="OK">Bien (Todo OK)</option>
                                <option value="MISSING">Novedad: Faltante</option>
                                <option value="DAMAGED">Novedad: Dañado</option>
                            </select>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div class="notes-section">
            <label><i class="fa-solid fa-comment-dots"></i> Observaciones Generales:</label>
            <input type="text" v-model="bulkNotes" placeholder="Alguna observación general para este lote...">
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-cancel" @click="$emit('close')">Cancelar</button>
        <div class="hold-btn-container">
            <HoldConfirmButton 
                label="Confirmar Recepción Masiva"
                @confirmed="handleConfirm"
                :disabled="isProcessing || consolidatedItems.length === 0"
                color="#7C3AED"
            />
        </div>
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
  z-index: 1200;
  backdrop-filter: blur(4px);
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
  flex-wrap: wrap;
  background: #F1F5F9;
  padding: 6px;
  border-radius: 10px;
  margin-bottom: 1.5rem;
  gap: 0.4rem;

  button {
    flex: 1 1 auto;
    border: none;
    background: transparent;
    padding: 0.6rem 1rem;
    border-radius: 8px;
    font-weight: 700;
    color: $text-light;
    cursor: pointer;
    font-size: 0.85rem;
    transition: all 0.2s;
    min-width: fit-content;

    &:hover {
      background: rgba(0, 0, 0, 0.03);
    }

    &.active {
      background: white;
      color: $NICOLE-PURPLE;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
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

.diff-indicator {
  font-size: 0.75rem;
  font-weight: 800;
  margin-top: 0.2rem;
  color: $warning;
}

select {
  padding: 0.5rem;
  border-radius: 6px;
  border: 1px solid #E2E8F0;
  font-size: 0.85rem;
  font-weight: 600;
  width: 100%;

  &.OK {
    color: $success;
  }

  &.MISSING {
    color: $warning;
    border-color: $warning;
  }

  &.DAMAGED {
    color: $error;
    border-color: $error;
  }
}

.notes-section {
  margin-top: 1.5rem;

  label {
    display: block;
    font-size: 0.9rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
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
  align-items: center;
  gap: 1rem;
  background: $gray-50;
  border-bottom-left-radius: 12px;
  border-bottom-right-radius: 12px;

  button.btn-cancel {
    padding: 0.7rem 1.5rem;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    font-size: 0.95rem;
    background: white;
    border: 1px solid $border-light;
    color: $text-light;

    &:hover {
      background: $gray-100;
      color: $text-dark;
    }
  }
}

.hold-btn-container {
  flex: 1;
  max-width: 320px;
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
