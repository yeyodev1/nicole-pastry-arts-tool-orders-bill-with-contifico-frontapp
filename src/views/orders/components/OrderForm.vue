<script setup lang="ts">
import type { OrderFormData } from '@/types/order'
import { computed } from 'vue'
import PaymentFields from './PaymentFields.vue'

const props = defineProps<{
  modelValue: OrderFormData
}>()

// We assume direct mutation of the reactive object passed as prop is expected in this codebase based on previous files,
// or we rely on the fact that objects are passed by reference.
// However, the best practice is to emit updates. Since previous implementation used v-model="modelValue.field", it implies modelValue IS reactive from parent.

const BRANCHES = ['San Marino', 'Mall del Sol', 'Centro de Producción'] as const

// Derived state to help with the "6 Options" logic
// The user selects "Branch" and "Retiro/Delivery".
// We can present this as 2 Dropdowns or 6 Radio buttons if requested strictly "Classify in one of 6".
// For UI cleanliness, 2 Dropdowns (Branch + Type) creates the 6 combinations.
// Let's ensure the user picks both.

const isDelivery = computed(() => props.modelValue.deliveryType === 'delivery')

</script>

<template>
  <div class="card">
    <div class="section-header">
      <h2>Datos del Pedido</h2>
    </div>

    <div class="form-grid">
      <!-- 1. Clasificación del Pedido (6 Opciones) -->
      <div class="form-group full-width">
        <label class="required-label">Sucursal de Origen / Retiro</label>
        <div class="radio-group">
          <label v-for="branch in BRANCHES" :key="branch" class="radio-label">
            <input type="radio" v-model="props.modelValue.branch" :value="branch" />
            {{ branch }}
          </label>
        </div>
      </div>

      <div class="form-group">
        <label class="required-label">Tipo de Entrega</label>
        <select v-model="props.modelValue.deliveryType">
          <option value="pickup">Retiro en Local</option>
          <option value="delivery">Delivery</option>
        </select>
      </div>

      <!-- 2. Fecha y Hora Exacta -->
      <div class="form-group">
        <label class="required-label">Fecha de Entrega</label>
        <input type="date" v-model="props.modelValue.deliveryDate" required />
      </div>

      <div class="form-group">
        <label class="required-label">Hora Exacta (Entrega/Retiro)</label>
        <input type="time" v-model="props.modelValue.deliveryTime" required />
        <small class="hint">No usar hora actual. Preguntar al cliente.</small>
      </div>
      
      <!-- 4. Ubicación (Solo Delivery) -->
      <div v-if="isDelivery" class="delivery-fields full-width">
         <div class="form-group">
            <label class="required-label">Dirección Escrita</label>
            <input v-model="props.modelValue.deliveryAddress" placeholder="Ciudadela, Calle, Villa..." />
         </div>
         <div class="form-group">
            <label class="required-label">Link Google Maps (Obligatorio)</label>
            <input v-model="props.modelValue.googleMapsLink" placeholder="https://maps.app.goo.gl/..." />
         </div>
      </div>

      <!-- 3. Datos Cliente -->
      <div class="form-group">
        <label class="required-label">Nombre Cliente</label>
        <input v-model="props.modelValue.customerName" required />
      </div>

      <div class="form-group">
        <label class="required-label">Celular</label>
        <input v-model="props.modelValue.customerPhone" required />
      </div>
      
      <div class="form-group">
        <label>Responsable</label>
        <select v-model="props.modelValue.responsible">
          <option value="Web">Web</option>
          <option value="Hillary">Hillary</option>
          <option value="E">E</option>
          <option value="Ivin">Ivin</option>
        </select>
      </div>
    </div>

    <div class="form-group" style="margin-top: 1rem;">
      <label>Notas Especiales (Comentarios)</label>
      <textarea v-model="props.modelValue.comments" rows="3" placeholder="Detalles adicionales del pedido..."></textarea>
    </div>


    <div class="invoice-toggle">
      <label>
        <input type="checkbox" v-model="props.modelValue.invoiceNeeded" />
        Requiere Factura
      </label>
    </div>

    <div v-if="props.modelValue.invoiceNeeded" class="invoice-fields">
      <h3>Datos de Facturación</h3>
      <div class="form-group">
        <label class="required-label">RUC / Cédula</label>
        <input v-model="props.modelValue.invoiceData.ruc" />
      </div>
      <div class="form-group">
        <label>Razón Social / Nombre</label>
        <input v-model="props.modelValue.invoiceData.businessName" />
      </div>
      <div class="form-group">
        <label>Email</label>
        <input v-model="props.modelValue.invoiceData.email" type="email" />
      </div>
      <div class="form-group">
        <label>Dirección</label>
        <input v-model="props.modelValue.invoiceData.address" />
      </div>
    </div>

    <!-- Payment at Creation Section -->
    <div class="payment-toggle">
        <label>
            <input type="checkbox" v-model="props.modelValue.registerPaymentNow" />
             Registrar Cobro Ahora
        </label>
    </div>
    
    <div v-if="props.modelValue.registerPaymentNow" class="payment-fields-section">
        <h3>Datos del Cobro</h3>
        <PaymentFields v-model="props.modelValue.paymentDetails" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  border: 1px solid $border-light;
  margin-bottom: 1.5rem;

  h2 {
    font-family: $font-principal;
    font-size: 1.25rem;
    color: $NICOLE-SECONDARY;
    margin-top: 0;
    margin-bottom: 0;
  }
}

.section-header {
  border-bottom: 1px solid $border-light;
  padding-bottom: 0.5rem;
  margin-bottom: 1rem;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;

  @media(max-width: 600px) {
    grid-template-columns: 1fr;
  }
}

.full-width {
  grid-column: 1 / -1;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;

  label {
    font-size: 0.85rem;
    color: $text-light;
    font-weight: 500;

    &.required-label::after {
      content: " *";
      color: red;
    }
  }

  .hint {
    font-size: 0.75rem;
    color: #e67e22; // Warning color
  }

  input,
  select {
    padding: 0.5rem;
    border: 1px solid $border-light;
    border-radius: 6px;

    &:focus {
      outline: none;
      border-color: $NICOLE-PURPLE;
    }
  }
}

.radio-group {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;

  .radio-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    padding: 0.5rem;
    border: 1px solid $border-light;
    border-radius: 6px;
    background: $gray-50;

    &:has(input:checked) {
      background: rgba($NICOLE-PURPLE, 0.1);
      border-color: $NICOLE-PURPLE;
      color: $NICOLE-PURPLE;
      font-weight: bold;
    }
  }
}

.delivery-fields {
  background-color: #fdf2f8; // Light pinkish for emphasis
  padding: 1rem;
  border-radius: 8px;
  border: 1px dashed $NICOLE-PURPLE;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;

  @media(max-width: 600px) {
    grid-template-columns: 1fr;
  }
}

.invoice-toggle {
  margin: 1.5rem 0 1rem;
  padding: 0.5rem;
  background: $gray-50;
  border-radius: 6px;

  label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-weight: 500;
    color: $text-dark;
  }
}

.invoice-fields {
  display: grid;
  gap: 1rem;
  animation: fadeIn 0.3s ease;
  border-top: 1px dashed $border-light;
  padding-top: 1rem;

  h3 {
    font-size: 1rem;
    color: $text-dark;
    margin: 0.5rem 0 0;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.payment-toggle {
  margin: 1.5rem 0 1rem;
  padding: 0.5rem;
  background: rgba($success, 0.1);
  border: 1px solid $success;
  border-radius: 6px;

  label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-weight: 500;
    color: darken($success, 10%);
  }
}

.payment-fields-section {
  display: grid;
  gap: 1rem;
  animation: fadeIn 0.3s ease;
  border-top: 1px dashed $border-light;
  padding-top: 1rem;

  h3 {
    font-size: 1rem;
    color: $text-dark;
    margin: 0.5rem 0 0;
  }
}
</style>
