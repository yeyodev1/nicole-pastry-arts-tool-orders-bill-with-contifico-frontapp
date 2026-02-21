<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
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
  pedidoOverride: number | null;
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
          detailedLosses: (isToday && item.lastEntry) ? (item.lastEntry.detailedLosses || []) : [],
          pedidoOverride: null,
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

// Final pedido: override if user set one, otherwise use suggestion
const getFinalPedido = (item: RestockItemData): number => {
  return item.pedidoOverride !== null && item.pedidoOverride >= 0
    ? item.pedidoOverride
    : calculatePedido(item);
};

// Items whose manual override exceeds the stock objective
const overriddenItems = computed(() =>
  formItems.value.filter(
    item => item.pedidoOverride !== null && item.pedidoOverride > item.stockObjectiveTomorrow
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
      branch: branch.value,
      date: formData.value.formDate,
      submittedBy: 'POS User',
      items: formItems.value.map(item => ({
        productName: item.productName,
        bajas: item.bajas,
        stockFinal: item.excedente,
        pedidoFinal: getFinalPedido(item),
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
        <div class="header-top">
          <button class="btn-back" @click="goBack">
              <i class="fa-solid fa-arrow-left"></i> Volver al POS
          </button>
          <button
            class="btn-config"
            @click="router.push({ name: 'pos-restock-management', query: { branch } })"
            title="Configurar objetivos de stock mínimos"
          >
            <i class="fa-solid fa-sliders"></i>
            <span>Configurar Objetivos</span>
          </button>
        </div>
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
            
            <div class="suggested-box">
                <span class="label">Sugerido</span>
                <span class="value">{{ calculatePedido(item) }}</span>
            </div>

            <div class="override-group">
              <label class="label">Pedido Final</label>
              <input
                type="number"
                class="override-input"
                :class="{ 'is-overridden': item.pedidoOverride !== null }"
                :placeholder="String(calculatePedido(item))"
                :value="item.pedidoOverride !== null ? item.pedidoOverride : ''"
                min="0"
                @input="item.pedidoOverride = ($event.target as HTMLInputElement).value === '' ? null : Number(($event.target as HTMLInputElement).value)"
              />
              <button
                v-if="item.pedidoOverride !== null"
                type="button"
                class="btn-reset-override"
                @click="item.pedidoOverride = null"
                title="Restablecer a sugerido"
              >
                <i class="fa-solid fa-rotate-left"></i>
              </button>
            </div>

            <!-- Inline excess alert -->
            <div
              v-if="item.pedidoOverride !== null && item.pedidoOverride > item.stockObjectiveTomorrow"
              class="excess-inline-alert"
            >
              <i class="fa-solid fa-triangle-exclamation"></i>
              <span>
                Pedido <strong>supera el mínimo</strong> en
                <strong class="delta">+{{ item.pedidoOverride - item.stockObjectiveTomorrow }}</strong> unidades
              </span>
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
        :message="confirmMessage"
        :message-html="confirmMessageHtml"
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
}

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

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
  font-size: 0.9rem;

  &:hover {
    color: #333;
  }
}

.btn-config {
  background: #f8fafc;
  border: 1.5px solid #e2e8f0;
  color: #475569;
  font-weight: 700;
  font-size: 0.82rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.9rem;
  border-radius: 8px;
  transition: all 0.2s;

  i {
    font-size: 0.85rem;
  }

  &:hover {
    background: #e2e8f0;
    border-color: #94a3b8;
    color: #1e293b;
    transform: translateY(-1px);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
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
  align-items: flex-end;
  justify-content: space-between;
  gap: 0.5rem;
  background: #f8fafc;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  border: 1px dashed #cbd5e1;
  flex-wrap: wrap;

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
    padding-bottom: 4px;
  }

  .suggested-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    background: #e2e8f0;
    padding: 6px 12px;
    border-radius: 6px;
    min-width: 60px;

    .label {
      font-size: 0.6rem;
      color: #64748b;
      text-transform: uppercase;
      font-weight: 700;
      margin-bottom: 2px;
    }

    .value {
      font-size: 1.1rem;
      font-weight: 700;
      color: #475569;
    }
  }
}

.override-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  position: relative;

  .label {
    font-size: 0.65rem;
    color: #0369a1;
    text-transform: uppercase;
    font-weight: 800;
    letter-spacing: 0.5px;
  }

  .override-input {
    width: 80px;
    padding: 6px 10px;
    border: 2px dashed #cbd5e1;
    border-radius: 8px;
    font-size: 1.1rem;
    font-weight: 700;
    text-align: center;
    color: #475569;
    background: white;
    transition: all 0.2s;
    outline: none;

    &:focus {
      border-color: #0369a1;
      border-style: solid;
      color: #0369a1;
    }

    &.is-overridden {
      border-color: #0369a1;
      border-style: solid;
      color: #0369a1;
      background: #e0f2fe;
    }
  }

  .btn-reset-override {
    position: absolute;
    right: -24px;
    bottom: 6px;
    background: none;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    font-size: 0.85rem;
    padding: 0;
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
