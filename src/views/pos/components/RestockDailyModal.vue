<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue';
import { posRestockService, type DailyFormData, type DetailedLoss } from '@/services/pos-restock.service';
import RestockLossDetailModal from './RestockLossDetailModal.vue';
import ConfirmationModal from '@/components/ConfirmationModal.vue';

const props = defineProps({
  isOpen: { type: Boolean, required: true },
  branch: { type: String, required: true }
});

const emit = defineEmits(['close', 'success', 'notify']);

// --- Interfaces ---
interface RestockItemData {
  productName: string;
  unit: string;
  stockObjectiveTomorrow: number;
  stockObjectiveToday: number;
  bajas: number;
  excedente: number;
  detailedLosses: DetailedLoss[];
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
  try {
    const data = await posRestockService.getDailyForm(props.branch);
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
          stockObjectiveTomorrow: item.stockObjectiveTomorrow,
          stockObjectiveToday: item.stockObjectiveToday,
          bajas: (isToday && item.lastEntry) ? item.lastEntry.bajas : 0,
          excedente: (isToday && item.lastEntry) ? item.lastEntry.stockFinal : 0,
          detailedLosses: (isToday && item.lastEntry) ? (item.lastEntry.detailedLosses || []) : []
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
      branch: props.branch,
      date: formData.value.formDate,
      submittedBy: 'POS User', // TODO: Get from auth store
      items: formItems.value.map(item => ({
        productName: item.productName,
        bajas: item.bajas,
        stockFinal: item.excedente,
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

// --- Modal Control ---
const closeModal = () => {
  emit('close');
};

// Refresh when opening
watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    fetchDailyForm();
  }
});
</script>

<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="closeModal">
    <div class="modal-content">
      <header class="modal-header">
        <h2 class="title">
            <i class="fa-solid fa-clipboard-check"></i> Cierre de Producción: {{ branch }}
        </h2>
        <button class="close-btn" @click="closeModal">&times;</button>
      </header>

      <div class="modal-body">
        <div v-if="isLoading" class="loading">
            <div class="spinner"></div>
            Cargando formulario...
        </div>

        <div v-else-if="!formData || formItems.length === 0" class="empty-state">
            <i class="fa-solid fa-clipboard-question"></i>
            <h3>No hay productos configurados</h3>
            <p>No se encontraron objetivos de stock para <strong>{{ branch }}</strong>.</p>
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
                <div 
                v-for="item in formItems" 
                :key="item.productName" 
                class="product-item"
                :class="{ 'zero-order': calculatePedido(item) === 0 }"
                >
                    <div class="product-header">
                        <div class="header-left">
                          <span class="product-name">{{ item.productName }}</span>
                          <span class="unit-badge">{{ item.unit }}</span>
                        </div>
                        
                        <button 
                          type="button" 
                          class="btn-report-loss" 
                          :class="{ 'has-losses': item.detailedLosses.length > 0 }"
                          @click="openLossModal(item)"
                        >
                          <i class="fa-solid fa-triangle-exclamation"></i>
                          <span>{{ item.detailedLosses.length > 0 ? `Bajas: ${item.bajas}` : 'Reportar Bajas' }}</span>
                        </button>
                    </div>

                    <div class="inputs-grid">
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
                         <div class="arrow">➔</div>
                        <div class="result-col" :class="{ 'has-order': calculatePedido(item) > 0 }">
                            <span class="label">Pedir</span>
                            <span class="value">{{ calculatePedido(item) }}</span>
                        </div>
                    </div>

                    <!-- Summary of losses if any -->
                    <div v-if="item.detailedLosses.length > 0" class="losses-summary">
                      <div v-for="(loss, idx) in item.detailedLosses" :key="idx" class="loss-tag">
                        <strong>{{ loss.quantity }}</strong>: {{ loss.reason }}
                      </div>
                    </div>
                </div>
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

    <!-- Confirmation Modal -->,
    <ConfirmationModal
      :is-open="showConfirmModal"
      title="Confirmar Reporte"
      message="¿Estás seguro de enviar el reporte? Esto generará los pedidos sugeridos para mañana."
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

  .title {
    margin: 0;
    font-size: 1.2rem;
    color: #1e293b;
    display: flex;
    gap: 0.5rem;
    align-items: center;
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

.input-mini.readonly {
  background: #f1f5f9;
  border-color: #e2e8f0;
  color: #94a3b8;
  cursor: default;
}

.inputs-grid {
  display: grid;
  grid-template-columns: 1fr 1fr auto auto auto;
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
