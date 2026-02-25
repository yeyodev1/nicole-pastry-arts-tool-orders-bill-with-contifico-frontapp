<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { posRestockService, type DailyFormData, type DetailedLoss } from '@/services/pos-restock.service';
import RestockLossDetailModal from './RestockLossDetailModal.vue';
import RestockQuickAdd from './RestockQuickAdd.vue';
import ConfirmationModal from '@/components/ConfirmationModal.vue';
import SearchableSelect from '@/components/ui/SearchableSelect.vue';

const props = defineProps({
  isOpen: { type: Boolean, required: true },
  branch: { type: String, required: true }
});

const emit = defineEmits(['close', 'success', 'notify']);

const router = useRouter();

// --- Branch switching ---
const BRANCHES = ['San Marino', 'Mall del Sol', 'Centro de Producción'];
const localBranch = ref(props.branch);
const branchOptions = computed(() => BRANCHES.map(b => ({ value: b, label: b })));

const goToManagement = () => {
  closeModal();
  router.push({ name: 'pos-restock-management', query: { branch: localBranch.value } });
};

// --- Interfaces ---
interface RestockItemData {
  productName: string;
  unit: string;
  isGeneral: boolean;
  requiresMinimum: boolean;
  category: 'Producción' | 'Bodega';
  stockObjectiveTomorrow: number;
  stockObjectiveToday: number;
  bajas: number;
  excedente: number;
  detailedLosses: DetailedLoss[];
  pedidoOverride: number | null;
}

// --- State ---
const isLoading = ref(false);
const isSubmitting = ref(false);
const formData = ref<DailyFormData | null>(null);
const formItems = ref<RestockItemData[]>([]);

// Modal for detailed losses
const showLossModal = ref(false);
const activeProductForLoss = ref<RestockItemData | null>(null);

// Modal for confirmation
const showConfirmModal = ref(false);

const hasExistingEntry = ref(false);

// --- Fetch Logic ---
const fetchDailyForm = async () => {
  isLoading.value = true;
  formData.value = null;
  formItems.value = [];
  hasExistingEntry.value = false;
  try {
    const data = await posRestockService.getDailyForm(localBranch.value);
    console.log('Daily Form Data (Modal):', data);
    formData.value = data;

    if (formData.value?.items && formData.value.items.length > 0) {
      const today = formData.value.formDate;

      formItems.value = formData.value.items.map(item => {
        const isToday = item.lastEntry && item.lastEntry.date === today;
        if (isToday) hasExistingEntry.value = true;

        return {
          productName: item.productName,
          unit: item.unit,
          isGeneral: item.isGeneral || false,
          requiresMinimum: item.requiresMinimum || false,
          category: item.category || 'Producción',
          stockObjectiveTomorrow: item.stockObjectiveTomorrow,
          stockObjectiveToday: item.stockObjectiveToday,
          bajas: (isToday && item.lastEntry) ? item.lastEntry.bajas : 0,
          excedente: (isToday && item.lastEntry) ? item.lastEntry.stockFinal : 0,
          detailedLosses: (isToday && item.lastEntry) ? (item.lastEntry.detailedLosses || []) : [],
          pedidoOverride: null,
        };
      });
    } else {
      console.warn('No items found for this branch.');
    }
  } catch (error) {
    console.error('Error fetching daily form:', error);
  } finally {
    isLoading.value = false;
  }
};

// --- Logic: Pedido = Objective - Excedente (>= 0) ---
const calculatePedido = (item: RestockItemData): number => {
  const pedido = item.stockObjectiveTomorrow - item.excedente;
  return Math.max(0, pedido);
};

const getFinalPedido = (item: RestockItemData): number => {
  return item.pedidoOverride !== null && item.pedidoOverride >= 0
    ? item.pedidoOverride
    : calculatePedido(item);
};

// Items whose manual override exceeds the stock objective
const overriddenItems = computed(() =>
  formItems.value.filter(
    item => !item.isGeneral && item.pedidoOverride !== null && item.pedidoOverride > item.stockObjectiveTomorrow
  )
);
const hasExcessiveOverride = computed(() => overriddenItems.value.length > 0);

const confirmMessage = computed(() => {
  if (!hasExcessiveOverride.value) {
    return '¿Confirmas el envío del reporte? Se generarán los pedidos para mañana según las cantidades indicadas.';
  }
  return '';
});

const confirmMessageHtml = computed(() => {
  if (!hasExcessiveOverride.value) return undefined;

  const items = overriddenItems.value.map(i => `
    <li style="display:flex;justify-content:space-between;align-items:center;padding:0.45rem 0.75rem;background:white;border:1px solid #fecdd3;border-radius:8px;margin-bottom:6px;">
      <span style="font-weight:700;color:#1e293b;font-size:0.88rem;">${i.productName}</span>
      <span style="display:flex;align-items:center;gap:5px;">
        <span style="color:#94a3b8;font-size:0.78rem;">mín: ${i.stockObjectiveTomorrow}</span>
        <span style="color:#cbd5e1;">→</span>
        <span style="font-weight:900;color:#be123c;font-size:1rem;">${i.pedidoOverride}</span>
        <span style="background:#be123c;color:white;font-size:0.68rem;font-weight:800;padding:1px 7px;border-radius:10px;">+${i.pedidoOverride! - i.stockObjectiveTomorrow}</span>
      </span>
    </li>
  `).join('');

  return `
    <div style="margin:-0.1rem 0 0.25rem;">
      <div style="display:flex;align-items:center;gap:0.5rem;background:#fff1f2;border:1px solid #fda4af;border-left:4px solid #be123c;border-radius:8px;padding:0.6rem 0.9rem;margin-bottom:0.85rem;color:#be123c;font-weight:700;font-size:0.88rem;">
        <i class="fa-solid fa-circle-exclamation" style="font-size:1rem;"></i>
        Pedidos fuera del stock mínimo diario
      </div>
      <ul style="list-style:none;padding:0;margin:0 0 0.85rem 0;">${items}</ul>
      <p style="font-size:0.78rem;color:#94a3b8;margin:0;line-height:1.5;border-top:1px solid #f1f5f9;padding-top:0.65rem;">
        <i class="fa-solid fa-hand" style="color:#be123c;margin-right:4px;"></i>
        Mantén presionado el botón de confirmación para aceptar estos pedidos.
      </p>
    </div>
  `;
});

// --- Detailed Losses Logic ---
const openLossModal = (item: RestockItemData) => {
  activeProductForLoss.value = item;
  showLossModal.value = true;
};

const handleSaveLosses = (losses: DetailedLoss[]) => {
  if (activeProductForLoss.value) {
    activeProductForLoss.value.detailedLosses = losses;
    // Update the total 'bajas' count based on the sum of detailed losses
    activeProductForLoss.value.bajas = losses.reduce((sum, l) => sum + l.quantity, 0);
  }
  showLossModal.value = false;
  activeProductForLoss.value = null;
};

// --- Submit Logic ---
const handleSubmitClick = () => {
  if (!formData.value) return;
  showConfirmModal.value = true;
};

const executeSubmission = async () => {
  showConfirmModal.value = false;
  if (!formData.value) return;

  isSubmitting.value = true;
  try {
    const payload = {
      branch: localBranch.value,
      date: formData.value.formDate,
      submittedBy: 'POS User',
      items: formItems.value.map(item => ({
        productName: item.productName,
        unit: item.unit,
        isGeneral: item.isGeneral,
        category: item.category,
        bajas: item.bajas,
        stockFinal: item.excedente,
        pedidoFinal: getFinalPedido(item),
        detailedLosses: item.detailedLosses
      }))
    };

    await posRestockService.submitDailyEntry(payload);
    emit('notify', { message: 'Cierre de producción enviado correctamente', type: 'success' });
    emit('success');
    closeModal();
  } catch (error) {
    console.error('Error submitting form:', error);
    emit('notify', { message: 'Hubo un error al enviar el reporte.', type: 'error' });
  } finally {
    isSubmitting.value = false;
  }
};

// --- Quick Add Logic ---
const handleQuickAdd = (newProduct: any) => {
  // Check if already in list
  const exists = formItems.value.some(i => i.productName === newProduct.productName);
  if (exists) {
    emit('notify', { message: 'El producto ya está en el reporte.', type: 'warning' });
    return;
  }

  const newItem: RestockItemData = {
    productName: newProduct.productName,
    unit: newProduct.unit,
    isGeneral: newProduct.isGeneral,
    requiresMinimum: newProduct.requiresMinimum || false,
    category: newProduct.category || 'Producción',
    stockObjectiveTomorrow: 0,
    stockObjectiveToday: 0,
    bajas: 0,
    excedente: 0,
    detailedLosses: [],
    pedidoOverride: null
  };

  formItems.value.unshift(newItem);
  emit('notify', { message: `"${newProduct.productName}" agregado al reporte.`, type: 'success' });

  // UX Improvement: Auto-focus the quantity field of the new item
  // We wait for DOM update then look for the first input with a class related to quantity
  setTimeout(() => {
    const container = document.querySelector('.products-container');
    if (container) {
      const firstInput = container.querySelector('input:not([readonly])') as HTMLInputElement;
      if (firstInput) firstInput.focus();
    }
  }, 100);
};

// --- Modal Control ---
const closeModal = () => {
  emit('close');
};

// Refresh when opening
watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    localBranch.value = props.branch;
    fetchDailyForm();
  }
});

// Re-fetch on branch change
watch(localBranch, () => {
  if (props.isOpen) fetchDailyForm();
});
</script>

<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="closeModal">
    <div class="modal-content">
      <header class="modal-header">
        <div class="title-wrap">
          <span class="title-text">
            <i class="fa-solid fa-clipboard-check"></i> Cierre de Producción
          </span>
          <div class="branch-select-wrap">
            <SearchableSelect
              v-model="localBranch"
              :options="branchOptions"
              placeholder="Sucursal..."
            />
          </div>
        </div>
        <div class="header-actions">
          <button class="btn-manage" @click="goToManagement" title="Gestionar stocks mínimos diarios">
            <i class="fa-solid fa-sliders"></i>
            <span>Gestionar Stocks</span>
          </button>
          <button class="close-btn" @click="closeModal">&times;</button>
        </div>
      </header>

      <div class="modal-body">
        <div v-if="isLoading" class="loading">
            <div class="spinner"></div>
            Cargando formulario...
        </div>

        <div v-else-if="!formData || formItems.length === 0" class="empty-state">
            <i class="fa-solid fa-clipboard-question"></i>
            <h3>No hay productos configurados</h3>
            <p>No se encontraron objetivos de stock para <strong>{{ localBranch }}</strong>.</p>
            <p class="sub-text">Contacta a Administración para configurar los "Objetivos de Stock".</p>
            <router-link :to="{ name: 'pos-restock-management' }" class="btn-config" @click="closeModal">
                <i class="fa-solid fa-gear"></i> Configurar Objetivos
            </router-link>
        </div>

        <form v-else @submit.prevent="handleSubmitClick" class="form-grid">
            <div class="info-banner" v-if="formData">
                <i class="fa-regular fa-calendar-check"></i>
                <span>Calculando pedidos para el objetivo del: <strong>{{ formData.targetDate }}</strong></span>
            </div>

            <div class="products-container">
                <!-- Quick Add Component -->
                <RestockQuickAdd 
                  :branch="localBranch"
                  @add="handleQuickAdd"
                  @close="closeModal"
                />

                <div 
                v-for="item in formItems" 
                :key="item.productName" 
                class="product-item"
                :class="{
                  'zero-order': !item.isGeneral && calculatePedido(item) === 0,
                  'is-general-item': item.isGeneral,
                  'has-min-stock': item.requiresMinimum
                }"
                >
                    <div class="product-header">
                        <div class="header-left">
                          <span class="product-name">{{ item.productName }}</span>
                          <span class="unit-badge">{{ item.unit }}</span>
                          <span v-if="item.isGeneral" class="general-badge">SUMINISTRO</span>
                          <span v-if="item.requiresMinimum" class="min-stock-badge">STOCK MIN</span>
                          <span class="dest-badge" :class="item.category.toLowerCase()">{{ item.category }}</span>
                        </div>
                        
                        <button 
                          v-if="!item.isGeneral || item.requiresMinimum"
                          type="button" 
                          class="btn-report-loss" 
                          :class="{ 'has-losses': item.detailedLosses.length > 0 }"
                          @click="openLossModal(item)"
                        >
                          <i class="fa-solid fa-triangle-exclamation"></i>
                          <span>{{ item.detailedLosses.length > 0 ? `Bajas: ${item.bajas}` : 'Reportar Bajas' }}</span>
                        </button>
                    </div>

                    <!-- Simplified input for General Items (Only if NOT requiresMinimum) -->
                    <div v-if="item.isGeneral && !item.requiresMinimum" class="general-inputs-wrap">
                        <div class="input-col">
                            <label>Cantidad a Pedir</label>
                            <div class="override-wrap">
                                <input 
                                    type="number" 
                                    v-model.number="item.pedidoOverride" 
                                    min="0" 
                                    class="input-mini primary"
                                    placeholder="0"
                                >
                            </div>
                        </div>
                        <div class="general-info">
                            <i class="fa-solid fa-info-circle"></i>
                            <span>Este item se pedirá directamente a <strong>{{ item.category.toLowerCase() }}</strong>.</span>
                        </div>
                    </div>

                    <!-- Standard inputs for Regular Products OR Supplies with Minimum Stock -->
                    <div v-else class="inputs-grid">
                        <div class="input-col">
                            <label>Bajas Totales</label>
                            <input 
                                type="number" 
                                v-model.number="item.bajas" 
                                min="0" 
                                class="input-mini readonly"
                                placeholder="0"
                                readonly
                            >
                        </div>
                        <div class="input-col">
                            <label>Excedente (Físico hoy)</label>
                            <input 
                                type="number" 
                                v-model.number="item.excedente" 
                                min="0" 
                                class="input-mini primary"
                                placeholder="0"
                            >
                        </div>
                        <div class="calc-col">
                            <span class="label">Meta Mañana</span>
                            <span class="value">{{ item.stockObjectiveTomorrow }}</span>
                        </div>
                         <div class="arrow">➤</div>
                        <div class="result-col" :class="{ 'has-order': calculatePedido(item) > 0 }">
                            <span class="label">Sugerido</span>
                            <span class="value">{{ calculatePedido(item) }}</span>
                        </div>
                        <div class="override-col">
                          <label class="label">Pedido Final</label>
                          <div class="override-wrap">
                            <input
                              type="number"
                              class="input-mini override"
                              :class="{ 'is-overridden': item.pedidoOverride !== null }"
                              :placeholder="String(calculatePedido(item))"
                              :value="item.pedidoOverride !== null ? item.pedidoOverride : ''"
                              min="0"
                              @input="item.pedidoOverride = ($event.target as HTMLInputElement).value === '' ? null : Number(($event.target as HTMLInputElement).value)"
                            />
                            <button
                              v-if="item.pedidoOverride !== null"
                              type="button"
                              class="btn-reset"
                              @click="item.pedidoOverride = null"
                              title="Restablecer"
                            ><i class="fa-solid fa-rotate-left"></i></button>
                          </div>
                        </div>
                    </div>

                    <!-- Inline excess alert -->
                    <div
                      v-if="!item.isGeneral && item.pedidoOverride !== null && item.pedidoOverride > item.stockObjectiveTomorrow"
                      class="excess-inline-alert"
                    >
                      <i class="fa-solid fa-triangle-exclamation"></i>
                      <span>
                        Pedido <strong>supera el mínimo</strong> en
                        <strong class="delta">+{{ item.pedidoOverride - item.stockObjectiveTomorrow }}</strong> unidades
                      </span>
                    </div>

                    <!-- Summary of losses if any -->
                    <div v-if="item.detailedLosses.length > 0" class="losses-summary">
                      <div v-for="(loss, idx) in item.detailedLosses" :key="idx" class="loss-tag">
                        <strong>{{ loss.quantity }}</strong>: {{ loss.reason }}
                      </div>
                    </div>
                </div>
            </div>

            <!-- Excess orders summary banner -->
            <div v-if="hasExcessiveOverride" class="excess-summary-banner">
              <div class="banner-head">
                <i class="fa-solid fa-circle-exclamation"></i>
                <strong>Pedidos que superan el stock mínimo diario</strong>
              </div>
              <ul class="banner-list">
                <li v-for="item in overriddenItems" :key="item.productName">
                  <span class="pname">{{ item.productName }}</span>
                  <span class="pdetail">
                    Mínimo: <strong>{{ item.stockObjectiveTomorrow }}</strong>
                    &nbsp;→&nbsp;
                    Pedido: <strong class="qty-over">{{ item.pedidoOverride }}</strong>
                    <span class="delta-badge">+{{ item.pedidoOverride! - item.stockObjectiveTomorrow }}</span>
                  </span>
                </li>
              </ul>
              <p class="banner-note">
                <i class="fa-solid fa-hand"></i>
                Deberás mantener presionado el botón de confirmación para aceptar estos pedidos.
              </p>
            </div>

            <div class="modal-actions">
                <button type="button" class="btn-cancel" @click="closeModal">Cancelar</button>
                <button type="submit" :disabled="isSubmitting" class="btn-submit">
                    {{ isSubmitting ? 'Enviando...' : (hasExistingEntry ? 'Actualizar Reporte de Hoy' : 'Confirmar Reporte') }}
                </button>
            </div>
        </form>
      </div>
    </div>

    <!-- Detailed Loss Modal -->
    <RestockLossDetailModal 
      v-if="showLossModal && activeProductForLoss"
      :is-open="showLossModal"
      :product-name="activeProductForLoss.productName"
      :initial-losses="activeProductForLoss.detailedLosses"
      :stock-objective-today="activeProductForLoss.stockObjectiveToday"
      :excedente="activeProductForLoss.excedente"
      @close="showLossModal = false"
      @save="handleSaveLosses"
    />

    <ConfirmationModal
      :is-open="showConfirmModal"
      title="Confirmar Reporte"
      :message="confirmMessage"
      :message-html="confirmMessageHtml"
      confirm-text="Enviar Reporte"
      :is-hold-to-confirm="true"
      @close="showConfirmModal = false"
      @confirm="executeSubmission"
    />


  </div>
</template>

<style lang="scss" scoped>
$primary-color: #d32f2f;
$bg-overlay: rgba(0, 0, 0, 0.5);

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: $bg-overlay;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
}

.modal-content {
  background: white;
  border-radius: 12px;
  width: 95%;
  max-width: 700px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  animation: slideUp 0.3s ease-out;
}

.modal-header {
  padding: 1.2rem;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f8fafc;
  border-radius: 12px 12px 0 0;
  gap: 1rem;

  .title-wrap {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    min-width: 0;
  }

  .title-text {
    font-size: 0.75rem;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .branch-select-wrap {
    width: 200px;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-shrink: 0;
  }

  .btn-manage {
    background: white;
    border: 1.5px solid #e2e8f0;
    color: #475569;
    font-size: 0.8rem;
    font-weight: 700;
    padding: 0.4rem 0.8rem;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    transition: all 0.2s;
    white-space: nowrap;

    i {
      font-size: 0.8rem;
    }

    &:hover {
      background: #f1f5f9;
      border-color: #94a3b8;
      color: #1e293b;
      transform: translateY(-1px);
    }
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 2rem;
    line-height: 1;
    color: #94a3b8;
    cursor: pointer;

    &:hover {
      color: #ef4444;
    }
  }
}


.modal-body {
  padding: 1.2rem;
  overflow-y: auto;
  flex: 1;
}

.loading,
.empty-state {
  text-align: center;
  padding: 2rem;
  color: #64748b;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;

  .spinner {
    border: 3px solid #f3f3f3;
    border-top: 3px solid $primary-color;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    animation: spin 1s linear infinite;
  }
}

.empty-state {
  i {
    font-size: 3rem;
    color: #cbd5e1;
  }

  h3 {
    margin: 0;
    color: #334155;
  }

  p {
    margin: 0;
  }

  .sub-text {
    font-size: 0.85rem;
    margin-top: 0.5rem;
    color: #94a3b8;
  }

  .btn-config {
    margin-top: 1rem;
    background: $primary-color;
    color: white;
    text-decoration: none;
    padding: 8px 16px;
    border-radius: 6px;
    font-weight: 600;
    display: flex;
    gap: 0.5rem;
    align-items: center;

    &:hover {
      background: darken($primary-color, 10%);
    }
  }
}

.info-banner {
  background: #e0f2fe;
  color: #0369a1;
  padding: 0.75rem;
  border-radius: 8px;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  border: 1px solid #bae6fd;
  margin-bottom: 1rem;
}

.products-container {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.product-item {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 0.8rem;
  background: white;

  &.zero-order {
    background: #f8fafc;
    border-color: #f1f5f9;

    .result-col {
      background: #e2e8f0;
      color: #64748b;
    }
  }
}

.product-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;

  .header-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .product-name {
    font-weight: 700;
    color: #1e293b;
    font-size: 1rem;
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

  .btn-report-loss {
    background: white;
    border: 1px solid #fee2e2;
    color: #ef4444;
    padding: 0.4rem 0.75rem;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    transition: all 0.2s;

    i {
      font-size: 0.9rem;
    }

    &:hover {
      background: #fef2f2;
      border-color: #fecaca;
    }

    &.has-losses {
      background: #ef4444;
      color: white;
      border-color: #ef4444;
      box-shadow: 0 2px 5px rgba(239, 68, 68, 0.2);
    }
  }
}

.losses-summary {
  margin-top: 1rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding-top: 0.75rem;
  border-top: 1px dashed #e2e8f0;

  .loss-tag {
    background: #fef2f2;
    color: #991b1b;
    padding: 0.25rem 0.6rem;
    border-radius: 4px;
    font-size: 0.75rem;
    border: 1px solid #fee2e2;

    strong {
      color: #ef4444;
    }
  }
}

.is-general-item {
  border-left: 6px solid #6366F1;
  background: #F8FAFF;
}

.general-badge {
  font-size: 0.65rem;
  font-weight: 800;
  background: #EEF2FF;
  color: #6366F1;
  padding: 2px 6px;
  border-radius: 4px;
  letter-spacing: 0.5px;
}

.min-stock-badge {
  font-size: 0.65rem;
  font-weight: 800;
  background: #F0FDF4;
  color: #16A34A;
  padding: 2px 6px;
  border-radius: 4px;
  letter-spacing: 0.5px;
  border: 1px solid #BBF7D0;
}

.dest-badge {
  font-size: 0.65rem;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 4px;
  letter-spacing: 0.5px;
  text-transform: uppercase;

  &.producción {
    background: rgba(#A855F7, 0.1);
    color: #A855F7;
  }

  &.bodega {
    background: rgba(#16a34a, 0.1);
    color: #16a34a;
  }
}

.general-inputs-wrap {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 0.5rem 0;

  .input-col {
    width: 140px;
  }
}

.general-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: #64748B;
  background: white;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px dashed #E2E8F0;

  i {
    color: #6366F1;
  }
}

.input-mini.readonly {
  background: #f1f5f9;
  border-color: #e2e8f0;
  color: #94a3b8;
  cursor: default;
}

.inputs-grid {
  display: grid;
  grid-template-columns: 1fr 1fr auto auto auto auto;
  gap: 0.8rem;
  align-items: end;
}

.input-col {
  display: flex;
  flex-direction: column;

  label {
    font-size: 0.7rem;
    margin-bottom: 4px;
    color: #64748b;
    font-weight: 600;
  }

  .input-mini {
    width: 100%;
    padding: 6px;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    text-align: center;
    font-weight: 600;
    font-size: 1rem;

    &.primary {
      border-color: #94a3b8;
      color: #0f172a;
      background: white;

      &:focus {
        border-color: $primary-color;
        box-shadow: 0 0 0 2px rgba($primary-color, 0.1);
      }
    }
  }
}

.calc-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 0.5rem;

  .label {
    font-size: 0.65rem;
    color: #94a3b8;
    font-weight: 700;
    text-transform: uppercase;
    margin-bottom: 4px;
  }

  .value {
    font-size: 1rem;
    font-weight: 600;
    color: #64748b;
    padding: 6px 0;
  }
}

.arrow {
  color: #cbd5e1;
  font-size: 1.2rem;
  padding-bottom: 6px;
}

.result-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #e2e8f0;
  border-radius: 6px;
  padding: 4px 10px;
  min-width: 60px;

  .label {
    font-size: 0.65rem;
    color: #64748b;
    font-weight: 700;
    text-transform: uppercase;
    margin-bottom: 2px;
  }

  .value {
    font-size: 1.2rem;
    font-weight: 800;
    color: #475569;
  }

  &.has-order {
    background: #dcfce7;

    .label {
      color: #15803d;
    }

    .value {
      color: #16a34a;
    }
  }
}

.override-col {
  display: flex;
  flex-direction: column;
  gap: 4px;

  .label {
    font-size: 0.65rem;
    color: #0369a1;
    font-weight: 800;
    text-transform: uppercase;
    margin-bottom: 4px;
    letter-spacing: 0.5px;
  }

  .override-wrap {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .input-mini.override {
    width: 70px;
    border: 2px dashed #cbd5e1;
    color: #475569;
    background: white;
    transition: all 0.2s;

    &:focus {
      outline: none;
      border-color: #0369a1;
      border-style: solid;
      color: #0369a1;
    }

    &.is-overridden {
      border-style: solid;
      border-color: #0369a1;
      color: #0369a1;
      background: #e0f2fe;
      font-weight: 800;
    }
  }

  .btn-reset {
    background: none;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    font-size: 0.75rem;
    padding: 2px 4px;
    transition: color 0.15s;

    &:hover {
      color: #475569;
    }
  }
}

.excess-inline-alert {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-left: 4px solid #f97316;
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
  font-size: 0.82rem;
  color: #9a3412;
  margin-top: 0.6rem;

  i {
    color: #f97316;
    flex-shrink: 0;
  }

  .delta {
    color: #ea580c;
    font-size: 1rem;
  }
}

.excess-summary-banner {
  background: #fff1f2;
  border: 2px solid #fda4af;
  border-radius: 10px;
  padding: 1rem 1.1rem;
  margin-bottom: 1rem;
  animation: fadeIn 0.3s ease;

  .banner-head {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
    color: #be123c;
    margin-bottom: 0.75rem;

    i {
      font-size: 1rem;
    }
  }

  .banner-list {
    list-style: none;
    padding: 0;
    margin: 0 0 0.75rem 0;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;

    li {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.25rem;
      background: white;
      border: 1px solid #fecdd3;
      border-radius: 6px;
      padding: 0.4rem 0.7rem;
      font-size: 0.83rem;
    }

    .pname {
      font-weight: 700;
      color: #1e293b;
    }

    .pdetail {
      color: #64748b;
      font-size: 0.8rem;
    }

    .qty-over {
      color: #be123c;
    }

    .delta-badge {
      display: inline-block;
      background: #be123c;
      color: white;
      font-size: 0.7rem;
      font-weight: 800;
      padding: 1px 6px;
      border-radius: 10px;
      margin-left: 4px;
    }
  }

  .banner-note {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.78rem;
    color: #9f1239;
    font-weight: 600;
    margin: 0;

    i {
      color: #e11d48;
    }
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.modal-actions {
  margin-top: 1.5rem;
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #f1f5f9;

  button {
    padding: 10px 20px;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    font-size: 0.95rem;
  }

  .btn-cancel {
    background: white;
    border: 1px solid #cbd5e1;
    color: #475569;

    &:hover {
      background: #f8fafc;
    }
  }

  .btn-submit {
    background: $primary-color;
    border: none;
    color: white;

    &:hover {
      background: darken($primary-color, 5%);
    }

    &:disabled {
      background: #94a3b8;
      cursor: not-allowed;
    }
  }
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

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

@media (max-width: 600px) {
  .inputs-grid {
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
  }

  .calc-col,
  .arrow,
  .result-col {
    grid-column: span 2;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    border-top: 1px dashed #e2e8f0;
    padding-top: 0.5rem;
    margin-top: 0.5rem;
  }

  .arrow {
    display: none;
  }

  .result-col {
    background: transparent;
    border: 1px solid #e2e8f0;
    padding: 0.5rem;

    &.has-order {
      background: #f0fdf4;
      border-color: #bbf7d0;
    }

    flex-direction: row;
    justify-content: space-between;

    .value {
      font-size: 1.1rem;
    }
  }
}
</style>
