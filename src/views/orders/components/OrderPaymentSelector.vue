<script setup lang="ts">
import type { OrderFormData } from '@/types/order'
import PaymentFields from './PaymentFields.vue'
import { ref, watch, type PropType, computed } from 'vue'

const props = defineProps({
  modelValue: {
    type: Object as () => OrderFormData,
    required: true
  },
  branches: {
    type: Array as PropType<readonly string[]>,
    required: true
  }
})

const showDiscountSection = ref(false)
const showCreditSection = ref(false) // Assuming these might exist or should be managed
const showPaymentSection = ref(false)

const toggleDiscountSection = () => {
  showDiscountSection.value = !showDiscountSection.value
}

const emit = defineEmits(['update:modelValue'])

const toggleCredit = () => {
  if (props.modelValue.isCredit) {
    props.modelValue.registerPaymentNow = false
    props.modelValue.settledInIsland = false
  }
}

const togglePayment = () => {
  if (props.modelValue.registerPaymentNow) {
    props.modelValue.isCredit = false
    props.modelValue.settledInIsland = false
  }
}

const toggleSettle = () => {
  if (props.modelValue.settledInIsland) {
    props.modelValue.isCredit = false
    props.modelValue.registerPaymentNow = false
    props.modelValue.isGlobalCourtesy = false // New
    // Default to first branch if not set
    if (!props.modelValue.settledIslandName) {
      props.modelValue.settledIslandName = props.branches[0] || 'San Marino'
    }
  }
}

// Watch for changes in Global Courtesy to trigger side effects
watch(() => props.modelValue.isGlobalCourtesy, (newVal: boolean | undefined) => {
  if (newVal) {
    // If courtesy is activated, disable conflicting options
    props.modelValue.isCredit = false
    props.modelValue.registerPaymentNow = false
    props.modelValue.settledInIsland = false
    props.modelValue.globalDiscountPercentage = 100
  } else {
    // If deactivated, reset percentage if it was exactly 100 (auto-set by courtesy)
    if (props.modelValue.globalDiscountPercentage === 100) {
      props.modelValue.globalDiscountPercentage = 0
    }
  }
})

const amountToPay = computed(() => {
  if (!props.modelValue.totalValue) return 0
  const existingPayments = (props.modelValue.payments || []).reduce((sum, p) => sum + Number(p.monto), 0)
  return Math.max(0, props.modelValue.totalValue - existingPayments)
})
</script>

<template>
  <div class="payment-selector">
    <!-- Courtesy Mode Alert -->
    <div v-if="props.modelValue.isGlobalCourtesy" class="info-box courtesy-alert">
      <i class="fa-solid fa-gift"></i>
      <p><strong>Cortesía Global Activa:</strong> El total del pedido es $0.00. No se requiere registro de cobros.</p>
    </div>

    <!-- Payment Options Grid -->
    <div v-if="!props.modelValue.isGlobalCourtesy" class="payment-options-row">
      <!-- Credit Toggle -->
      <div 
        class="payment-toggle credit" 
        :class="{ active: props.modelValue.isCredit }"
        @click="props.modelValue.isCredit = !props.modelValue.isCredit; toggleCredit()"
      >
        <div class="toggle-icon">
          <i class="fa-solid fa-clock-rotate-left"></i>
        </div>
        <div class="toggle-content">
          <span class="toggle-title">Venta a Crédito</span>
          <span class="toggle-desc">Pago pendiente</span>
        </div>
        <input 
          type="checkbox" 
          v-model="props.modelValue.isCredit" 
          @change="toggleCredit"
          @click.stop 
        />
      </div>

      <!-- Payment Toggle -->
      <div 
        class="payment-toggle success" 
        :class="{ active: props.modelValue.registerPaymentNow }"
        @click="props.modelValue.registerPaymentNow = !props.modelValue.registerPaymentNow; togglePayment()"
      >
        <div class="toggle-icon">
          <i class="fa-solid fa-money-bill-transfer"></i>
        </div>
        <div class="toggle-content">
          <span class="toggle-title">Registrar Cobro</span>
          <span class="toggle-desc">Pagar ahora</span>
        </div>
        <input 
          type="checkbox" 
          v-model="props.modelValue.registerPaymentNow" 
          @change="togglePayment" 
          @click.stop
        />
      </div>

      <!-- Settle in Island Toggle -->
      <div 
        class="payment-toggle purple" 
        :class="{ active: props.modelValue.settledInIsland, disabled: props.modelValue.isGlobalCourtesy }"
        @click="!props.modelValue.isGlobalCourtesy && (props.modelValue.settledInIsland = !props.modelValue.settledInIsland); toggleSettle()"
      >
        <div class="toggle-icon">
          <i class="fa-solid fa-store"></i>
        </div>
        <div class="toggle-content">
          <span class="toggle-title">Facturado en Isla</span>
          <span class="toggle-desc">Sucursal física</span>
        </div>
        <input 
          type="checkbox" 
          v-model="props.modelValue.settledInIsland" 
          :disabled="props.modelValue.isGlobalCourtesy"
          @change="toggleSettle"
          @click.stop
        />
      </div>

      <!-- Discount / Courtesy Toggle -->
      <div 
        class="payment-toggle discount" 
        :class="{ active: props.modelValue.isGlobalCourtesy || (props.modelValue.globalDiscountPercentage || 0) > 0 }"
        @click="toggleDiscountSection()"
      >
        <div class="toggle-icon">
          <i class="fa-solid fa-tags"></i>
        </div>
        <div class="toggle-content">
          <span class="toggle-title">Descuento / Cortesía</span>
          <span class="toggle-desc">{{ props.modelValue.isGlobalCourtesy ? 'Cortesía 100%' : 'Ajustar valor' }}</span>
        </div>
        <div class="active-indicator" v-if="props.modelValue.isGlobalCourtesy || (props.modelValue.globalDiscountPercentage || 0) > 0">
           <i class="fas fa-check-circle"></i>
        </div>
      </div>
    </div>

    <!-- Conditional Sections -->
    <div v-if="props.modelValue.settledInIsland" class="island-fields detail-section">
      <div class="form-group full-width">
        <label class="required-label">Seleccionar Isla / Punto de Venta</label>
        <select v-model="props.modelValue.settledIslandName">
          <option v-for="branch in branches" :key="branch" :value="branch">{{ branch }}</option>
        </select>
      </div>
      <div class="info-box island">
        <i class="fa-solid fa-circle-info"></i>
        <p>Este pedido se marcará como pagado localmente en <strong>{{ props.modelValue.settledIslandName }}</strong>.</p>
      </div>
    </div>

    <div v-if="props.modelValue.isCredit" class="credit-fields detail-section">
      <div class="info-box credit">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <p>Se registrará como venta a crédito por <strong>${{ props.modelValue.totalValue?.toFixed(2) }}</strong>. El saldo quedará pendiente.</p>
      </div>
    </div>
    
    <div v-if="props.modelValue.registerPaymentNow && !props.modelValue.isGlobalCourtesy" class="payment-fields-section detail-section">
      <h3>Detalles del Pago</h3>
      <PaymentFields 
        v-model="props.modelValue.paymentDetails" 
        :totalToPay="amountToPay"
      />
    </div>

    <!-- Discount Detail Section -->
    <div v-if="showDiscountSection" class="discount-detail-section detail-section">
      <h3>Ajuste de Descuento</h3>
      
      <div class="discount-controls">
        <label class="courtesy-switch">
          <input 
            type="checkbox" 
            v-model="props.modelValue.isGlobalCourtesy" 
          />
          <span class="slider"></span>
          <span class="switch-label">Modo Cortesía (100% Descuento)</span>
        </label>

        <div class="divider"></div>

        <div class="form-group discount-percent">
          <label>Porcentaje de Descuento Manual</label>
          <div class="input-with-unit">
            <input 
              type="number" 
              v-model.number="props.modelValue.globalDiscountPercentage" 
              min="0" 
              max="100"
              :disabled="props.modelValue.isGlobalCourtesy"
              placeholder="0"
            />
            <span class="unit">%</span>
          </div>
          <p class="hint">Se aplicará globalmente a todos los productos.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.payment-selector {
  margin-top: 2rem;
}

/* Responsive Flex Layout */
.payment-options-row {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.payment-toggle {
  flex: 1 1 280px; // Minimum base width of 280px before wrapping
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem;
  background: white;
  border: 2px solid $border-light;
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  min-width: 0; // Prevent content overflow breaking flex

  &:hover {
    border-color: darken-color($border-light, 10%);
    transform: translateY(-2px);
  }

  &.active {
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05);
  }

  .toggle-icon {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.25rem;
    background: $gray-50;
    color: $text-light;
    transition: all 0.25s;
  }

  .toggle-content {
    display: flex;
    flex-direction: column;
    flex: 1;

    .toggle-title {
      font-weight: 700;
      font-size: 0.95rem;
      color: $text-dark;
      line-height: 1.2;
    }

    .toggle-desc {
      font-size: 0.8rem;
      color: $text-light;
      margin-top: 2px;
    }
  }

  input[type="checkbox"] {
    width: 1.25rem;
    height: 1.25rem;
    cursor: pointer;
    accent-color: $NICOLE-PURPLE;
  }

  /* Variant Styles */
  &.credit.active {
    border-color: #64748b;
    background: #f8fafc;

    .toggle-icon {
      background: #64748b;
      color: white;
    }

    .toggle-title {
      color: #334155;
    }
  }

  &.success.active {
    border-color: $success;
    background: rgba($success, 0.03);

    .toggle-icon {
      background: $success;
      color: white;
    }

    .toggle-title {
      color: darken-color($success, 10%);
    }
  }

  &.purple.active {
    border-color: $NICOLE-PURPLE;
    background: rgba($NICOLE-PURPLE, 0.03);

    .toggle-icon {
      background: $NICOLE-PURPLE;
      color: white;
    }

    .toggle-title {
      color: $NICOLE-PURPLE;
    }
  }

  &.discount.active {
    border-color: #f59e0b;
    background: rgba(#f59e0b, 0.03);

    .toggle-icon {
      background: #f59e0b;
      color: white;
    }

    .toggle-title {
      color: #b45309;
    }
  }

  &.disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background: $gray-50;
    pointer-events: none;
  }

  .active-indicator {
    position: absolute;
    top: 1rem;
    right: 1rem;
    color: #f59e0b;
    font-size: 1.2rem;
  }
}

.discount-controls {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1.25rem;
  background: white;
  border-radius: 12px;
  border: 1px solid $border-light;

  .courtesy-switch {
    display: flex;
    align-items: center;
    gap: 1rem;
    cursor: pointer;
    user-select: none;

    input {
      display: none;
    }

    .slider {
      width: 44px;
      height: 24px;
      background: #e2e8f0;
      border-radius: 20px;
      position: relative;
      transition: all 0.3s;

      &::before {
        content: '';
        position: absolute;
        width: 18px;
        height: 18px;
        background: white;
        border-radius: 50%;
        top: 3px;
        left: 3px;
        transition: all 0.3s;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }
    }

    input:checked+.slider {
      background: $success;

      &::before {
        transform: translateX(20px);
      }
    }

    .switch-label {
      font-weight: 700;
      color: $text-dark;
      font-size: 1rem;
    }
  }

  .divider {
    height: 1px;
    background: linear-gradient(to right, $border-light, transparent);
  }

  .discount-percent {
    label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 600;
      color: $text-light;
      font-size: 0.9rem;
    }

    .input-with-unit {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      width: 120px;
      position: relative;

      input {
        width: 100%;
        padding: 0.75rem 2rem 0.75rem 1rem;
        border: 2px solid $border-light;
        border-radius: 10px;
        font-weight: 700;
        color: $NICOLE-PURPLE;
        font-size: 1.1rem;
        transition: all 0.2s;

        &:focus {
          border-color: $NICOLE-PURPLE;
          background: white;
        }

        &:disabled {
          background: #f8fafc;
          color: #94a3b8;
          border-color: #e2e8f0;
        }
      }

      .unit {
        position: absolute;
        right: 1rem;
        font-weight: 800;
        color: $text-light;
      }
    }

    .hint {
      margin-top: 0.5rem;
      font-size: 0.85rem;
      color: #7c3aed;
      font-weight: 500;
    }
  }
}

.detail-section {
  background: $gray-50;
  border-radius: 16px;
  padding: 1.5rem;
  border: 1px solid $border-light;
  margin-top: 1rem;
  animation: slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1);

  h3 {
    margin: 0 0 1.25rem 0;
    font-size: 1.1rem;
    font-weight: 700;
    color: $text-dark;
  }
}

/* Specific Grid for inner fields */
.payment-fields-section {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.25rem;

  @media (min-width: 768px) {
    grid-template-columns: repeat(2, 1fr);
  }

  h3 {
    grid-column: 1 / -1;
  }
}

.info-box {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  border-radius: 12px;
  font-size: 0.9rem;
  border: 1px solid transparent;

  i {
    font-size: 1.1rem;
  }

  p {
    margin: 0;
    line-height: 1.4;
  }

  &.island {
    background: rgba($NICOLE-PURPLE, 0.03);
    border-color: rgba($NICOLE-PURPLE, 0.1);
    color: $NICOLE-PURPLE;
  }

  &.credit {
    background: #fef2f2;
    border-color: #fee2e2;
    color: #991b1b;

    i {
      color: #dc2626;
    }
  }

  &.courtesy-alert {
    background: rgba($success, 0.05);
    border-color: rgba($success, 0.2);
    color: darken-color($success, 10%);
    margin-bottom: 1.5rem;

    i {
      color: $success;
      font-size: 1.4rem;
    }
  }
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;

  label {
    font-weight: 600;
    font-size: 0.9rem;

    &.required-label::after {
      content: " *";
      color: $error;
    }
  }

  select {
    padding: 0.75rem 1rem;
    border: 1px solid $border-light;
    border-radius: 10px;
    background: white;
    font-size: 0.95rem;
    outline: none;

    &:focus {
      border-color: $NICOLE-PURPLE;
    }
  }
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
