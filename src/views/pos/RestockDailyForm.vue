<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { posRestockService, type DailyFormData, type DetailedLoss } from '@/services/pos-restock.service';
import ConfirmationModal from '@/components/ConfirmationModal.vue';
import RestockLossDetailModal from './components/RestockLossDetailModal.vue';
import { useToast } from '@/composables/useToast';

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
const route = useRoute();
const router = useRouter();
const branch = ref<string>((route.query.branch as string) || 'San Marino');
const isLoading = ref(false);
const isSubmitting = ref(false);
const formData = ref<DailyFormData | null>(null);
const formItems = ref<RestockItemData[]>([]);

const { success, error: showError, info } = useToast();
const showConfirmModal = ref(false);

// Modal for detailed losses
const showLossModal = ref(false);
const activeProductForLoss = ref<RestockItemData | null>(null);

// --- Navigation ---
const goBack = () => {
  router.push({ name: 'pos-shipments' });
};

const hasExistingEntry = ref(false);

// --- Fetch Logic ---
const fetchDailyForm = async () => {
  isLoading.value = true;
  try {
    const data = await posRestockService.getDailyForm(branch.value);
    console.log('Daily Form Data:', data);
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
    showError('Error al cargar el formulario.');
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
      branch: branch.value,
      date: formData.value.formDate,
      submittedBy: 'POS User', // TODO: Get from auth store or context
      items: formItems.value.map(item => ({
        productName: item.productName,
        bajas: item.bajas,
        stockFinal: item.excedente, // Backend logic considers this as 'stockFinal' (surplus)
        detailedLosses: item.detailedLosses
      }))
    };

    await posRestockService.submitDailyEntry(payload);
    success('Reporte enviado correctamente.');
    router.push({ name: 'pos-shipments' });
  } catch (error) {
    console.error('Error submitting form:', error);
    showError('Hubo un error al enviar el reporte.');
  } finally {
    isSubmitting.value = false;
  }
};

onMounted(() => {
  if (branch.value) fetchDailyForm();
});
</script>

<template>
  <div class="restock-page">
    <div class="container">
      <header class="header">
        <button class="btn-back" @click="goBack">
            <i class="fa-solid fa-arrow-left"></i> Volver al POS
        </button>
        <div class="title-group">
            <h1>Cierre de Producción</h1>
            <p v-if="formData">
                Sucursal: <strong>{{ branch }}</strong> <span class="divider">|</span>
                Fecha: <strong>{{ formData.formDate }}</strong>
            </p>
        </div>
      </header>

      <div v-if="isLoading" class="loading">
        <div class="spinner"></div>
        Cargando formulario...
      </div>

      <div v-else-if="!formData || formItems.length === 0" class="empty-state">
        <i class="fa-solid fa-clipboard-question"></i>
        <h3>No hay productos configurados</h3>
        <p>No se encontraron objetivos de stock para <strong>{{ branch }}</strong>.</p>
        <p class="sub-text">Contacta a Administración para configurar los "Objetivos de Stock".</p>
      </div>

      <form v-else @submit.prevent="handleSubmitClick" class="form-grid">
        <!-- Target Goal Banner -->
        <div class="info-banner" v-if="formData">
            <i class="fa-regular fa-calendar-check"></i>
            <span>Calculando pedidos para el objetivo del: <strong>{{ formData.targetDate }}</strong></span>
        </div>

        <div 
          v-for="item in formItems" 
          :key="item.productName" 
          class="product-card"
          :class="{ 'zero-order': calculatePedido(item) === 0 }"
        >
          <div class="product-info">
            <div class="name-unit">
                <h3>{{ item.productName }}</h3>
                <span class="unit">{{ item.unit }}</span>
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

          <div class="inputs-row">
            <div class="input-group">
              <label>Bajas (Desecho)</label>
              <div class="input-wrapper">
                  <input 
                    type="number" 
                    v-model.number="item.bajas" 
                    min="0" 
                    placeholder="0"
                    class="input-field readonly"
                    readonly
                  >
              </div>
            </div>

            <div class="input-group">
              <label>Excedente (En Vitrina)</label>
              <div class="input-wrapper primary">
                  <input 
                    type="number" 
                    v-model.number="item.excedente" 
                    min="0" 
                    placeholder="0"
                    class="input-field primary-input"
                  >
              </div>
            </div>
          </div>

          <!-- Summary of losses if any -->
          <div v-if="item.detailedLosses.length > 0" class="losses-summary">
            <div v-for="(loss, idx) in item.detailedLosses" :key="idx" class="loss-tag">
              <strong>{{ loss.quantity }}</strong>: {{ loss.reason }}
            </div>
          </div>

          <div class="result-row">
            <div class="calc-step">
                <span class="label">Meta</span>
                <span class="value">{{ item.stockObjectiveTomorrow }}</span>
            </div>
            <span class="operator">-</span>
            <div class="calc-step">
                <span class="label">Vitrina</span>
                <span class="value">{{ item.excedente }}</span>
            </div>
            <span class="operator">=</span>
            
            <div class="result-box" :class="{ 'has-order': calculatePedido(item) > 0 }">
                <span class="label">Pedido Sugerido</span>
                <strong class="value">{{ calculatePedido(item) }}</strong>
            </div>
          </div>
        </div>

        <div class="actions">
          <button type="submit" :disabled="isSubmitting" class="btn-submit">
            <i v-if="isSubmitting" class="fa-solid fa-spinner fa-spin"></i>
            {{ isSubmitting ? 'Enviando...' : (hasExistingEntry ? 'Actualizar Reporte de Hoy' : 'Confirmar y Enviar Reporte') }}
          </button>
        </div>
      </form>

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
        message="¿Estás seguro de enviar el reporte? Esto generará los pedidos sugeridos para mañana."
        confirm-text="Enviar Reporte"
        :is-hold-to-confirm="true"
        @close="showConfirmModal = false"
        @confirm="executeSubmission"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
// Using colors from IncomingShipmentsView for consistency
$primary-color: #d32f2f;
$secondary-color: #333;
$bg-light: #f8fafc;
$border-color: #e2e8f0;

.restock-page {
  min-height: 100vh;
  background-color: $bg-light;
  padding: 1rem;
  font-family: 'Inter', sans-serif; // Assuming font
}

.container {
  max-width: 600px;
  margin: 0 auto;
  padding-bottom: 3rem;
}

.header {
  margin-bottom: 1.5rem;

  .btn-back {
    background: none;
    border: none;
    color: #64748b;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0;
    margin-bottom: 1rem;
    font-size: 0.9rem;

    &:hover {
      color: #333;
    }
  }

  .title-group {
    h1 {
      font-size: 1.5rem;
      margin: 0 0 0.5rem 0;
      color: #1e293b;
    }

    p {
      margin: 0;
      color: #64748b;
      font-size: 0.95rem;

      strong {
        color: #333;
      }

      .divider {
        margin: 0 0.5rem;
        color: #ccc;
      }
    }
  }
}

.loading {
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
  text-align: center;
  padding: 3rem 1rem;
  color: #64748b;

  i {
    font-size: 3rem;
    margin-bottom: 1rem;
    color: #cbd5e1;
  }

  h3 {
    color: #334155;
    margin: 0 0 0.5rem 0;
  }

  p {
    margin: 0;
  }

  .sub-text {
    font-size: 0.85rem;
    margin-top: 0.5rem;
    color: #94a3b8;
  }
}

.form-grid {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.info-banner {
  background: #e0f2fe;
  color: #0369a1;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  border: 1px solid #bae6fd;
}

.product-card {
  background: white;
  border: 1px solid $border-color;
  border-radius: 12px;
  padding: 1.25rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.03);
  transition: transform 0.2s;

  &.zero-order {
    opacity: 0.85;
    border-color: #f1f5f9;

    .result-box {
      background: #f1f5f9;
      color: #94a3b8;
    }
  }
}

.product-info {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;

  .name-unit {
    h3 {
      margin: 0 0 0.25rem 0;
      font-size: 1.1rem;
      color: #1e293b;
    }

    .unit {
      background: #f1f5f9;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.75rem;
      color: #64748b;
      text-transform: uppercase;
      font-weight: 600;
    }
  }

  .goal-pill {
    font-size: 0.8rem;
    color: #0f172a;
    background: #f8fafc;
    padding: 4px 8px;
    border-radius: 6px;
    border: 1px solid #e2e8f0;
  }
}

.btn-report-loss {
  background: white;
  border: 1px solid #fee2e2;
  color: #ef4444;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s;

  i {
    font-size: 0.9rem;
  }

  &:hover {
    background: #fef2f2;
    border-color: #ef4444;
    transform: translateY(-1px);
  }

  &.has-losses {
    background: #ef4444;
    color: white;
    border-color: #ef4444;
    box-shadow: 0 4px 10px rgba(239, 68, 68, 0.2);
  }
}

.losses-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
  padding-top: 0.5rem;
  border-top: 1px dashed #eee;

  .loss-tag {
    background: #fff5f5;
    color: #c53030;
    font-size: 0.75rem;
    padding: 2px 8px;
    border-radius: 4px;
    border: 1px solid #fed7d7;

    strong {
      color: #822727;
    }
  }
}

.inputs-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1rem;
}

.input-group {
  display: flex;
  flex-direction: column;

  label {
    font-size: 0.8rem;
    margin-bottom: 6px;
    color: #64748b;
    font-weight: 500;
  }

  .input-wrapper {
    position: relative;

    &.primary input {
      border-color: #cbd5e1;
      background: #fff;
      font-weight: 600;
      color: #0f172a;
    }
  }

  .input-field {
    width: 100%;
    padding: 10px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    font-size: 1.1rem;
    text-align: center;
    transition: all 0.2s;

    &.readonly {
      background: #f8fafc;
      border-color: #e2e8f0;
      color: #64748b;
      cursor: not-allowed;
      border-style: dashed;
    }
  }
}

.result-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #f8fafc;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  border: 1px dashed #cbd5e1;

  .calc-step {
    display: flex;
    flex-direction: column;
    align-items: center;

    .label {
      font-size: 0.65rem;
      color: #94a3b8;
      text-transform: uppercase;
      font-weight: 700;
    }

    .value {
      font-size: 0.9rem;
      font-weight: 600;
      color: #64748b;
    }
  }

  .operator {
    color: #cbd5e1;
    font-weight: bold;
  }

  .result-box {
    background: #e2e8f0;
    padding: 6px 12px;
    border-radius: 6px;
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 80px;

    .label {
      font-size: 0.65rem;
      color: #64748b;
      text-transform: uppercase;
      font-weight: 700;
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
}

.actions {
  margin-top: 1rem;
  position: sticky;
  bottom: 1rem;
  z-index: 10;

  .btn-submit {
    width: 100%;
    padding: 14px;
    background: linear-gradient(135deg, $primary-color, darken($primary-color, 10%));
    color: white;
    border: none;
    border-radius: 12px;
    font-size: 1.1rem;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 4px 6px rgba($primary-color, 0.25);
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.5rem;
    transition: transform 0.1s;

    &:active {
      transform: scale(0.98);
    }

    &:disabled {
      background: #94a3b8;
      box-shadow: none;
      cursor: not-allowed;
    }
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
</style>
