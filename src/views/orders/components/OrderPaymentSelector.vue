<script setup lang="ts">
import type { OrderFormData } from '@/types/order'
import PaymentFields from './PaymentFields.vue'

const props = defineProps<{
  modelValue: OrderFormData
  branches: readonly string[]
}>()

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
    // Default to first branch if not set
    if (!props.modelValue.settledIslandName) {
      props.modelValue.settledIslandName = props.branches[0] || 'San Marino'
    }
  }
}
</script>

<template>
  <div class="payment-selector">
    <!-- Payment Options Grid -->
    <div class="payment-options-row">
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
        :class="{ active: props.modelValue.settledInIsland }"
        @click="props.modelValue.settledInIsland = !props.modelValue.settledInIsland; toggleSettle()"
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
          @change="toggleSettle"
          @click.stop
        />
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
    
    <div v-if="props.modelValue.registerPaymentNow" class="payment-fields-section detail-section">
      <h3>Detalles del Pago</h3>
      <PaymentFields 
        v-model="props.modelValue.paymentDetails" 
        :totalToPay="props.modelValue.totalValue"
      />
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
