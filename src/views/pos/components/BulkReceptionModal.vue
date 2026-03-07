<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import POSService from '@/services/pos.service';
import HoldConfirmButton from '@/components/ui/HoldConfirmButton.vue';
import SearchableSelect from '@/components/ui/SearchableSelect.vue';
import { parseECTDate, getECTTodayString } from '@/utils/dateUtils';

const props = defineProps<{
  isOpen: boolean;
  dispatches: any[];
  selectedBranch: string;
  branches: string[];
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'success'): void;
  (e: 'open-restock'): void;
  (e: 'change-branch', branch: string): void;
}>();

const isProcessing = ref(false);
const isChangingBranch = ref(false);
const localBranch = ref(props.selectedBranch);

watch(() => props.selectedBranch, (v) => { localBranch.value = v });
watch(localBranch, (v) => {
  if (v !== props.selectedBranch) {
    isChangingBranch.value = true;
    emit('change-branch', v);
  }
});
watch(() => props.dispatches, () => { isChangingBranch.value = false; });

const bulkNotes = ref('');
type BulkFilterMode = 'yesterday' | 'today' | 'tomorrow';
const filterMode = ref<BulkFilterMode>('today');

const isReadOnly = computed(() => filterMode.value === 'yesterday' || filterMode.value === 'tomorrow');

const formatTabDate = (offset: number): string => {
  const todayStr = getECTTodayString();
  const d = new Date(todayStr + 'T12:00:00');
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString('es-EC', { day: 'numeric', month: 'long' });
};

const labelYesterday = computed(() => formatTabDate(-1));
const labelToday     = computed(() => formatTabDate(0));
const labelTomorrow  = computed(() => formatTabDate(1));

// --- Options ---
const statusOptions = [
  { value: 'OK',            label: 'Bien (Todo OK)',        icon: 'fa-solid fa-circle-check' },
  { value: 'MISSING',       label: 'Novedad: Faltante',     icon: 'fa-solid fa-triangle-exclamation' },
  { value: 'DAMAGED',       label: 'Novedad: Dañado',       icon: 'fa-solid fa-circle-xmark' },
  { value: 'BAD_CONDITION', label: 'Mal estado (detallar)', icon: 'fa-solid fa-comment-dots' },
]

const branchOptions = computed(() => props.branches.map(b => ({ value: b, label: b })))

// --- CONSOLIDATED LOGIC ---
interface ConsolidatedItem {
  productId: string;
  name: string;
  totalSent: number;
  quantityReceived: number;
  itemStatus: 'OK' | 'MISSING' | 'DAMAGED' | 'BAD_CONDITION';
  itemNote: string;
  sources: { orderId: string; dispatchId: string; quantitySent: number; }[];
}

const consolidatedItems = ref<ConsolidatedItem[]>([]);

watch(() => [props.isOpen, props.dispatches, filterMode.value], () => {
  if (props.isOpen) calculateConsolidated();
}, { immediate: true });

watch(() => props.isOpen, (newVal) => {
  if (newVal) bulkNotes.value = '';
});

const calculateConsolidated = () => {
  const map = new Map<string, ConsolidatedItem>();

  const todayStr    = getECTTodayString();
  const today       = new Date(todayStr + 'T12:00:00');
  const yesterday   = new Date(today); yesterday.setDate(today.getDate() - 1);
  const tomorrow    = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const getDStr     = (d: Date) => d.toISOString().split('T')[0];
  const yesterdayStr = getDStr(yesterday);
  const tomorrowStr  = getDStr(tomorrow);

  props.dispatches.forEach(d => {
    const status = d.dispatch.receptionStatus;
    if (status && !['PENDING', 'PROBLEM'].includes(status)) return;

    const dDateStr = getDStr(parseECTDate(d.deliveryDate));

    let dateMatch = false;
    if      (filterMode.value === 'yesterday' && dDateStr === yesterdayStr) dateMatch = true;
    else if (filterMode.value === 'today'     && dDateStr === todayStr)     dateMatch = true;
    else if (filterMode.value === 'tomorrow'  && dDateStr === tomorrowStr)  dateMatch = true;
    if (!dateMatch) return;

    d.dispatch.items.forEach((item: any) => {
      if (!map.has(item.productId)) {
        map.set(item.productId, {
          productId: item.productId,
          name: item.name,
          totalSent: 0,
          quantityReceived: 0,
          itemStatus: 'OK',
          itemNote: '',
          sources: []
        });
      }
      const entry = map.get(item.productId)!;
      entry.totalSent        += item.quantitySent;
      entry.quantityReceived += item.quantitySent;
      entry.sources.push({ orderId: d.orderId, dispatchId: d.dispatch._id, quantitySent: item.quantitySent });
    });
  });

  consolidatedItems.value = Array.from(map.values());
};

const handleConfirm = async () => {
  if (consolidatedItems.value.length === 0) return;
  isProcessing.value = true;

  const dispatchUpdates = new Map<string, {
    orderId: string;
    items: { productId: string; quantityReceived: number; itemStatus: string; itemNote?: string }[];
  }>();

  consolidatedItems.value.forEach(cItem => {
    let remaining = cItem.quantityReceived;
    cItem.sources.forEach(source => {
      if (!dispatchUpdates.has(source.dispatchId)) {
        dispatchUpdates.set(source.dispatchId, { orderId: source.orderId, items: [] });
      }
      const update = dispatchUpdates.get(source.dispatchId)!;
      let allocated = 0;
      let status    = cItem.itemStatus as string;

      if (remaining >= source.quantitySent) {
        allocated  = source.quantitySent;
        remaining -= source.quantitySent;
      } else {
        allocated = remaining;
        remaining = 0;
        if (allocated < source.quantitySent && status === 'OK') status = 'MISSING';
      }

      update.items.push({
        productId: cItem.productId,
        quantityReceived: allocated,
        itemStatus: status,
        ...(cItem.itemNote ? { itemNote: cItem.itemNote } : {})
      });
    });
  });

  try {
    await Promise.all(
      Array.from(dispatchUpdates.entries()).map(async ([dispatchId, data]) => {
        await POSService.confirmReception(data.orderId, dispatchId, {
          receivedBy: 'Encargado POS (Masivo)',
          receptionNotes: bulkNotes.value || 'Recepción Masiva General',
          items: data.items
        });
        const orderData = props.dispatches.find(d => d.orderId === data.orderId);
        if (orderData?.branch) {
          try { await POSService.settleInIsland(data.orderId, orderData.branch); }
          catch (e) { console.warn(`Non-blocking settle error for ${data.orderId}:`, e); }
        }
      })
    );
    emit('success');
    emit('close');
  } catch (error) {
    console.error('Bulk reception error:', error);
    emit('success');
    emit('close');
  } finally {
    isProcessing.value = false;
  }
};
</script>

<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content">

      <!-- ── Header ── -->
      <div class="modal-header">
        <div class="header-text">
          <h3><i class="fa-solid fa-boxes-stacked"></i> Recepción Masiva</h3>
          <div class="branch-row">
            <span class="branch-label">Recibiendo en:</span>
            <div class="branch-select-wrap">
              <SearchableSelect
                v-model="localBranch"
                :options="branchOptions"
                placeholder="Sucursal..."
                searchPlaceholder="Buscar sucursal..."
              >
                <template #icon><i class="fa-solid fa-store branch-icon"></i></template>
              </SearchableSelect>
            </div>
          </div>
        </div>
        <div class="header-actions">
          <button class="btn-restock-shortcut" @click="emit('open-restock')">
            <i class="fa-solid fa-clipboard-check"></i>
            <span>Hacer Reposición</span>
          </button>
          <button class="btn-close" @click="$emit('close')">
            <i class="fa-solid fa-times"></i>
          </button>
        </div>
      </div>

      <!-- ── Body ── -->
      <div class="modal-body">

        <!-- Loading overlay when switching branch -->
        <div v-if="isChangingBranch" class="branch-loading">
          <div class="branch-spinner"></div>
          <span>Cargando sucursal...</span>
        </div>

        <!-- Filter tabs -->
        <div v-else class="filter-tabs">
          <button :class="{ active: filterMode === 'yesterday' }" @click="filterMode = 'yesterday'">
            <span class="tab-day">Ayer</span>
            <span class="tab-date">{{ labelYesterday }}</span>
            <span class="readonly-badge">Solo lectura</span>
          </button>
          <button :class="{ active: filterMode === 'today' }" @click="filterMode = 'today'">
            <span class="tab-day">Hoy</span>
            <span class="tab-date">{{ labelToday }}</span>
          </button>
          <button :class="{ active: filterMode === 'tomorrow' }" @click="filterMode = 'tomorrow'">
            <span class="tab-day">Mañana</span>
            <span class="tab-date">{{ labelTomorrow }}</span>
            <span class="readonly-badge">Solo lectura</span>
          </button>
        </div>

        <!-- Readonly banner for Ayer / Mañana -->
        <div v-if="!isChangingBranch && isReadOnly" class="readonly-banner">
          <i class="fa-solid fa-eye"></i>
          <div class="readonly-banner-text">
            <span>Estás viendo <strong>{{ filterMode === 'yesterday' ? 'AYER' : 'MAÑANA' }}</strong> ({{ filterMode === 'yesterday' ? labelYesterday : labelTomorrow }}) — solo lectura.</span>
            <span>Para confirmar recepciones ve a <strong>HOY</strong>.</span>
          </div>
          <button class="btn-go-today" @click="filterMode = 'today'">
            <i class="fa-solid fa-calendar-day"></i> Ir a Hoy · {{ labelToday }}
          </button>
        </div>

        <!-- Empty -->
        <div v-if="!isChangingBranch && consolidatedItems.length === 0" class="empty-msg">
          <i class="fa-solid fa-check-circle"></i>
          <p v-if="filterMode === 'today'">No hay ítems para <strong>HOY</strong>.</p>
          <p v-else-if="filterMode === 'yesterday'">No hay ítems para <strong>AYER</strong>.</p>
          <p v-else>No hay ítems para <strong>MAÑANA</strong>.</p>
          <button v-if="filterMode === 'today'" class="btn-restock-empty" @click="emit('open-restock')">
            <i class="fa-solid fa-clipboard-check"></i>
            Hacer Cierre de Producción (Reposición)
          </button>
        </div>

        <!-- Items list -->
        <div v-else-if="!isChangingBranch" class="items-list" :class="{ 'is-readonly': isReadOnly }">
          <div class="list-header">
            <span>Producto</span>
            <span class="col-right">Enviado / Recibido</span>
            <span class="col-status">Estado Físico</span>
          </div>

          <div
            v-for="item in consolidatedItems"
            :key="item.productId"
            class="item-row"
            :class="{
              'has-issue':  item.quantityReceived !== item.totalSent || item.itemStatus !== 'OK',
              'is-bad':     item.itemStatus === 'BAD_CONDITION'
            }"
          >
            <!-- Top: name + qty -->
            <div class="item-main">
              <div class="item-info">
                <span class="item-name">{{ item.name }}</span>
                <div v-if="item.quantityReceived !== item.totalSent" class="diff-badge">
                  <i class="fa-solid fa-triangle-exclamation"></i>
                  <span v-if="item.quantityReceived < item.totalSent">
                    Faltan {{ item.totalSent - item.quantityReceived }}
                  </span>
                  <span v-else>Sobran {{ item.quantityReceived - item.totalSent }}</span>
                </div>
              </div>

              <div class="item-qty-block">
                <div class="sent-count">
                  <span class="sent-label">Env.</span>
                  <strong>{{ item.totalSent }}</strong>
                </div>
                <div class="qty-control">
                  <button tabindex="-1" :disabled="isReadOnly" @click="item.quantityReceived = Math.max(0, item.quantityReceived - 1)">−</button>
                  <input type="number" v-model="item.quantityReceived" min="0" :readonly="isReadOnly" />
                  <button tabindex="-1" :disabled="isReadOnly" @click="item.quantityReceived++">+</button>
                </div>
              </div>
            </div>

            <!-- Bottom: status select + note -->
            <div class="item-status-block">
              <div class="status-select-wrap" :class="item.itemStatus.toLowerCase()">
                <SearchableSelect
                  v-model="item.itemStatus"
                  :options="statusOptions"
                  :disabled="isReadOnly"
                  placeholder="Estado..."
                  searchPlaceholder="Buscar estado..."
                >
                  <template #icon>
                    <i v-if="item.itemStatus === 'OK'"            class="fa-solid fa-circle-check status-icon ok"></i>
                    <i v-else-if="item.itemStatus === 'MISSING'"  class="fa-solid fa-triangle-exclamation status-icon missing"></i>
                    <i v-else-if="item.itemStatus === 'DAMAGED'"  class="fa-solid fa-circle-xmark status-icon damaged"></i>
                    <i v-else                                      class="fa-solid fa-comment-dots status-icon bad"></i>
                  </template>
                </SearchableSelect>
              </div>

              <Transition name="slide-note">
                <div v-if="item.itemStatus === 'BAD_CONDITION'" class="note-field">
                  <i class="fa-solid fa-pen-to-square note-icon"></i>
                  <input
                    v-model="item.itemNote"
                    type="text"
                    placeholder="Ej: llegó mal glaseado, deformado..."
                    class="note-input"
                  />
                </div>
              </Transition>
            </div>
          </div>
        </div>

        <!-- General notes -->
        <div class="notes-section">
          <label><i class="fa-solid fa-comment-dots"></i> Observaciones Generales:</label>
          <input
            type="text"
            v-model="bulkNotes"
            placeholder="Alguna observación general para este lote..."
          />
        </div>

      </div>

      <!-- ── Footer ── -->
      <div class="modal-footer">
        <button class="btn-cancel" @click="$emit('close')">Cancelar</button>
        <div class="hold-btn-container">
          <HoldConfirmButton
            label="Confirmar Recepción Masiva"
            @confirmed="handleConfirm"
            :disabled="isProcessing || isChangingBranch || isReadOnly || consolidatedItems.length === 0"
            color="#7C3AED"
          />
        </div>
      </div>

    </div>
  </div>
</template>

<style lang="scss" scoped>
// ─── Overlay & shell ──────────────────────────────────────────────────────────
.modal-overlay {
  position: fixed;
  inset: 0;
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
  max-width: 820px;
  max-height: 92vh;
  border-radius: 16px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from { transform: translateY(20px); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}

// ─── Header ───────────────────────────────────────────────────────────────────
.modal-header {
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid $border-light;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  flex-shrink: 0;

  .header-text {
    flex: 1;
    min-width: 0;

    h3 {
      margin: 0 0 0.65rem;
      color: $NICOLE-PURPLE;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 1.15rem;
    }
  }
}

.branch-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.branch-label {
  font-size: 0.72rem;
  font-weight: 700;
  color: $text-light;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
}

.branch-select-wrap {
  width: 210px;

  :deep(.select-trigger) {
    padding: 0.38rem 0.8rem;
    border-radius: 20px;
    border: 1.5px solid rgba($NICOLE-PURPLE, 0.3);
    background: rgba($NICOLE-PURPLE, 0.05);

    &:hover:not(.disabled) {
      border-color: $NICOLE-PURPLE;
      background: rgba($NICOLE-PURPLE, 0.08);
    }
    &.open {
      border-color: $NICOLE-PURPLE;
      box-shadow: 0 0 0 3px rgba($NICOLE-PURPLE, 0.1);
    }

    .text        { color: $NICOLE-PURPLE; font-weight: 800; font-size: 0.87rem; }
    .arrow       { color: $NICOLE-PURPLE; }
    .placeholder { color: rgba($NICOLE-PURPLE, 0.5); font-size: 0.87rem; }
  }

  :deep(.dropdown-menu) { z-index: 1400; }
}

.branch-icon { font-size: 0.78rem; color: $NICOLE-PURPLE; }

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
}

.btn-restock-shortcut {
  background: white;
  color: $NICOLE-PURPLE;
  border: 1.2px solid $NICOLE-PURPLE;
  padding: 0.4rem 0.8rem;
  border-radius: 8px;
  font-weight: 700;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;

  &:hover {
    background: rgba($NICOLE-PURPLE, 0.05);
    transform: translateY(-1px);
    box-shadow: 0 4px 10px rgba($NICOLE-PURPLE, 0.1);
  }

  @media (max-width: 480px) { span { display: none; } }
}

.btn-close {
  background: none;
  border: none;
  font-size: 1.2rem;
  color: $text-light;
  cursor: pointer;
  padding: 0.25rem 0.4rem;
  border-radius: 6px;
  transition: color 0.15s;
  &:hover { color: $text-dark; }
}

// ─── Body ─────────────────────────────────────────────────────────────────────
.modal-body {
  padding: 1.25rem 1.5rem;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

// ─── Branch loading ───────────────────────────────────────────────────────────
.branch-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 2.5rem 1rem;
  color: $text-light;
  font-size: 0.9rem;
  font-weight: 600;
}

.branch-spinner {
  width: 22px;
  height: 22px;
  border: 3px solid $border-light;
  border-top-color: $NICOLE-PURPLE;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

// ─── Readonly banner ──────────────────────────────────────────────────────────
.readonly-banner {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: #f8fafc;
  border: 1px solid $border-light;
  border-left: 4px solid $text-light;
  border-radius: 8px;
  padding: 0.7rem 1rem;
  font-size: 0.83rem;
  color: $text-light;

  > i { flex-shrink: 0; font-size: 0.95rem; }

  .readonly-banner-text {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    line-height: 1.4;
  }

  .btn-go-today {
    flex-shrink: 0;
    background: $NICOLE-PURPLE;
    color: white;
    border: none;
    border-radius: 7px;
    padding: 0.45rem 0.85rem;
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    white-space: nowrap;
    transition: all 0.15s;

    &:hover {
      background: darken(#7C3AED, 5%);
      transform: translateY(-1px);
    }
  }
}

// ─── Filter tabs ──────────────────────────────────────────────────────────────
.filter-tabs {
  display: flex;
  flex-wrap: wrap;
  background: #F1F5F9;
  padding: 5px;
  border-radius: 10px;
  gap: 0.3rem;
  flex-shrink: 0;

  button {
    flex: 1 1 auto;
    border: none;
    background: transparent;
    padding: 0.48rem 0.75rem;
    border-radius: 7px;
    font-weight: 700;
    color: $text-light;
    cursor: pointer;
    font-size: 0.82rem;
    transition: all 0.18s;
    white-space: nowrap;

    &:hover { background: rgba(0, 0, 0, 0.03); }
    &.active {
      background: white;
      color: $NICOLE-PURPLE;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    }
  }

  button {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
  }

  .tab-day {
    font-size: 0.82rem;
    font-weight: 700;
    line-height: 1.2;
  }

  .tab-date {
    font-size: 0.68rem;
    font-weight: 500;
    opacity: 0.7;
    line-height: 1.1;
  }

  .readonly-badge {
    display: inline-block;
    font-size: 0.58rem;
    font-weight: 700;
    background: $gray-200;
    color: $text-light;
    padding: 1px 5px;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    margin-top: 1px;
  }
}

.items-list.is-readonly {
  opacity: 0.75;
  pointer-events: none;

  .qty-control button { cursor: not-allowed; }
  .qty-control input  { background: $gray-50; color: $text-light; cursor: default; }
}

// ─── Items list ───────────────────────────────────────────────────────────────
.items-list {
  border: 1px solid $border-light;
  border-radius: 12px;
  overflow: hidden;
}

.list-header {
  display: grid;
  grid-template-columns: 1fr auto 240px;
  gap: 1rem;
  align-items: center;
  padding: 0.6rem 1rem;
  background: $gray-50;
  border-bottom: 1px solid $border-light;

  span {
    font-size: 0.72rem;
    font-weight: 700;
    color: $text-light;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .col-right  { text-align: center; }
  .col-status { text-align: left; }

  @media (max-width: 600px) { display: none; }
}

.item-row {
  padding: 0.9rem 1rem;
  border-bottom: 1px solid $border-light;
  transition: background 0.15s;

  &:last-child { border-bottom: none; }
  &:hover      { background: #fafafa; }
  &.has-issue  { background: #fff9db; &:hover { background: #fff5cc; } }
  &.is-bad     { background: #fff1f2; &:hover { background: #ffe4e6; } }
}

.item-main {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 1rem;
  align-items: center;
  margin-bottom: 0.65rem;

  @media (max-width: 500px) {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }
}

.item-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.item-name {
  font-weight: 700;
  font-size: 0.95rem;
  color: #1e293b;
  line-height: 1.3;
}

.diff-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.7rem;
  font-weight: 800;
  color: #b45309;
  background: #fef3c7;
  border: 1px solid #fde68a;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  width: fit-content;
}

.item-qty-block {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  flex-shrink: 0;
}

.sent-count {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 34px;

  .sent-label {
    font-size: 0.6rem;
    font-weight: 700;
    text-transform: uppercase;
    color: $text-light;
    letter-spacing: 0.04em;
  }

  strong {
    font-size: 1.1rem;
    font-weight: 900;
    color: #1e293b;
    line-height: 1;
  }
}

.qty-control {
  display: flex;
  align-items: center;
  gap: 0.3rem;

  button {
    width: 30px;
    height: 30px;
    border: 1px solid $border-light;
    background: white;
    border-radius: 7px;
    cursor: pointer;
    font-size: 1rem;
    font-weight: 700;
    color: #475569;
    line-height: 1;
    transition: background 0.15s;
    &:hover { background: $gray-100; }
  }

  input {
    width: 52px;
    text-align: center;
    border: 1.5px solid $border-light;
    border-radius: 7px;
    padding: 0.3rem;
    font-weight: 800;
    font-size: 0.95rem;
    color: $NICOLE-PURPLE;
    &:focus { outline: none; border-color: $NICOLE-PURPLE; }
  }
}

// ─── Status block ─────────────────────────────────────────────────────────────
.item-status-block {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.status-select-wrap {
  :deep(.select-trigger) {
    padding: 0.42rem 0.75rem;
    border-radius: 8px;
    border-width: 1.5px;
    font-size: 0.88rem;
  }

  &.ok :deep(.select-trigger) {
    border-color: rgba($success, 0.35);
    background: rgba($success, 0.05);
    .text { color: darken($success, 5%); font-weight: 700; }
  }
  &.missing :deep(.select-trigger) {
    border-color: rgba($warning, 0.45);
    background: rgba($warning, 0.07);
    .text { color: darken($warning, 12%); font-weight: 700; }
  }
  &.damaged :deep(.select-trigger) {
    border-color: rgba($error, 0.35);
    background: rgba($error, 0.05);
    .text { color: $error; font-weight: 700; }
  }
  &.bad_condition :deep(.select-trigger) {
    border-color: rgba(#e11d48, 0.4);
    background: rgba(#e11d48, 0.06);
    .text { color: #be123c; font-weight: 700; }
  }

  :deep(.dropdown-menu) { z-index: 1400; }
}

.status-icon {
  font-size: 0.85rem;
  &.ok      { color: $success; }
  &.missing { color: $warning; }
  &.damaged { color: $error; }
  &.bad     { color: #be123c; }
}

// ─── Note field ───────────────────────────────────────────────────────────────
.note-field {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: #fff1f2;
  border: 1.5px solid rgba(#e11d48, 0.25);
  border-radius: 8px;
}

.note-icon {
  font-size: 0.8rem;
  color: #be123c;
  flex-shrink: 0;
}

.note-input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 0.88rem;
  color: #1e293b;
  font-family: inherit;
  &::placeholder { color: #fca5a5; }
  &:focus { outline: none; }
}

.slide-note-enter-active,
.slide-note-leave-active { transition: all 0.2s ease; overflow: hidden; }
.slide-note-enter-from,
.slide-note-leave-to { opacity: 0; max-height: 0; }
.slide-note-enter-to,
.slide-note-leave-from { opacity: 1; max-height: 60px; }

// ─── General notes ────────────────────────────────────────────────────────────
.notes-section {
  label {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: #475569;
    margin-bottom: 0.5rem;
  }

  input {
    width: 100%;
    padding: 0.7rem 0.9rem;
    border: 1px solid $border-light;
    border-radius: 8px;
    font-family: inherit;
    font-size: 0.9rem;
    box-sizing: border-box;
    &:focus { outline: none; border-color: $NICOLE-PURPLE; }
  }
}

// ─── Footer ───────────────────────────────────────────────────────────────────
.modal-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid $border-light;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 1rem;
  background: $gray-50;
  border-bottom-left-radius: 16px;
  border-bottom-right-radius: 16px;
  flex-shrink: 0;

  .btn-cancel {
    padding: 0.65rem 1.4rem;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    font-size: 0.9rem;
    background: white;
    border: 1px solid $border-light;
    color: $text-light;
    &:hover { background: $gray-100; color: $text-dark; }
  }
}

.hold-btn-container {
  flex: 1;
  max-width: 320px;
}

// ─── Empty state ──────────────────────────────────────────────────────────────
.empty-msg {
  text-align: center;
  padding: 3rem 1rem;
  color: $text-light;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;

  i { font-size: 3rem; color: $success; }
  p { font-size: 1.05rem; margin: 0; }

  .btn-restock-empty {
    background: white;
    color: $NICOLE-PURPLE;
    border: 2px solid $NICOLE-PURPLE;
    padding: 0.9rem 1.75rem;
    border-radius: 12px;
    font-weight: 800;
    font-size: 0.95rem;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: $NICOLE-PURPLE;
      color: white;
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba($NICOLE-PURPLE, 0.2);
    }

    i { font-size: 1.1rem; color: inherit; }
  }
}
</style>
