<script setup lang="ts">
import type { OrderFormData } from '@/types/order'
import { computed } from 'vue'
import PaymentFields from './PaymentFields.vue'
import CustomDatePicker from '@/components/ui/CustomDatePicker.vue'
import CustomTimeSelect from '@/components/ui/CustomTimeSelect.vue'

const props = defineProps<{
  modelValue: OrderFormData
}>()

const BRANCHES = ['San Marino', 'Mall del Sol', 'Centro de Producción'] as const

const isDelivery = computed(() => props.modelValue.deliveryType === 'delivery')

// --- Date & Time Logic ---

// 1. Min Date = Today
const minDate = computed(() => {
  const now = new Date()
  // Format: YYYY-MM-DD
  return now.toISOString().split('T')[0]
})

// 2. Time Validation & Suggestions
const timeError = computed(() => {
  if (!props.modelValue.deliveryDate || !props.modelValue.deliveryTime) return null

  const selectedDate = props.modelValue.deliveryDate
  const selectedTime = props.modelValue.deliveryTime

  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]

  // Only validate 2-hour window if the selected date is TODAY
  if (selectedDate === todayStr) {
    const parts = selectedTime.split(':')
    const hours = Number(parts[0]) || 0
    const minutes = Number(parts[1]) || 0

    const selectedDateTime = new Date(now)
    selectedDateTime.setHours(hours, minutes, 0, 0)

    const diffInMs = selectedDateTime.getTime() - now.getTime()
    const diffInHours = diffInMs / (1000 * 60 * 60)

    if (diffInHours < 2) {
      return 'El pedido debe hacerse con al menos 2 horas de anticipación.'
    }
  }
  return null
})

const quickTimes = [
  { label: 'Mañana', time: '10:00' },
  { label: 'Mediodía', time: '13:00' },
  { label: 'Tarde', time: '16:00' },
  { label: 'Noche', time: '19:00' }
]

// 3. Time Slots Generator (15 min intervals)
const timeOptions = computed(() => {
  const slots: string[] = []
  const startHour = 7 // 7 AM
  const endHour = 20 // 8 PM

  for (let h = startHour; h <= endHour; h++) {
    for (let m = 0; m < 60; m += 15) {
      const hh = h.toString().padStart(2, '0')
      const mm = m.toString().padStart(2, '0')
      slots.push(`${hh}:${mm}`)
    }
  }
  return slots
})

const selectTime = (time: string) => {
  props.modelValue.deliveryTime = time
}


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
      <div class="form-group full-width">
        <CustomDatePicker
          label="Fecha de Entrega"
          v-model="props.modelValue.deliveryDate"
          :minDate="minDate"
          required
        />
      </div>

      <div class="form-group">
        <CustomTimeSelect
           label="Hora Exacta"
           v-model="props.modelValue.deliveryTime"
           :options="timeOptions"
           required
           hint="Intervalos de 15 minutos."
        />
        
        <!-- Quick Time Suggestions -->
        <div class="quick-times">
          <button 
            v-for="qt in quickTimes" 
            :key="qt.time"
            type="button"
            class="chip-time"
            @click="selectTime(qt.time)"
            :class="{ active: props.modelValue.deliveryTime === qt.time }"
          >
            {{ qt.label }}
          </button>
        </div>

        <small v-if="timeError" class="error-msg">
          <i class="fa-solid fa-triangle-exclamation"></i> {{ timeError }}
        </small>
        <!-- Hint is now inside component, but keeping this validation msg -->
      </div>
      
      <!-- 4. Ubicación (Solo Delivery) -->
      
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
        <PaymentFields 
          v-model="props.modelValue.paymentDetails" 
          :totalToPay="props.modelValue.totalValue"
        />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.card {
  background: white;
  border-radius: 16px; // More rounded
  padding: 2rem;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.04); // Softer, deeper shadow
  border: 1px solid $border-light;
  margin-bottom: 2rem;
  transition: all 0.3s ease;

  &:hover {
    box-shadow: 0 15px 35px rgba(0, 0, 0, 0.06);
  }
}

.section-header {
  border-bottom: 2px solid $gray-50;
  padding-bottom: 1rem;
  margin-bottom: 2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;

  h2 {
    font-family: $font-principal;
    font-size: 1.5rem;
    color: $text-dark;
    margin: 0;
    font-weight: 700;
    letter-spacing: -0.5px;
  }
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem; // More breathing room

  @media(max-width: 768px) {
    grid-template-columns: 1fr;
  }
}

.full-width {
  grid-column: 1 / -1;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  position: relative;

  label {
    font-size: 0.9rem;
    color: $text-dark;
    font-weight: 600;
    margin-left: 2px;
    letter-spacing: 0.3px;

    &.required-label::after {
      content: " *";
      color: $error;
    }
  }

  .hint {
    font-size: 0.8rem;
    color: $warning;
    margin-top: 0.25rem;
  }

  input,
  select,
  textarea {
    padding: 0.85rem 1rem; // Comfy padding
    border: 1px solid $border-light;
    border-radius: 10px; // Smooth corners
    font-size: 0.95rem;
    font-family: $font-secondary;
    background-color: $gray-50;
    transition: all 0.2s ease;
    color: $text-dark;
    width: 100%;
    box-sizing: border-box;

    &::placeholder {
      color: lighten-color($text-light, 10%);
    }

    &:hover {
      background-color: white;
      border-color: darken-color($border-light, 10%);
    }

    &:focus {
      outline: none;
      background-color: white;
      border-color: $NICOLE-PURPLE;
      box-shadow: 0 0 0 4px rgba($NICOLE-PURPLE, 0.1); // Focus ring
    }

    &:disabled {
      background-color: $gray-100;
      cursor: not-allowed;
      opacity: 0.7;
    }
  }

  textarea {
    resize: vertical;
    min-height: 100px;
  }
}

.radio-group {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;

  .radio-label {
    flex: 1;
    min-width: 140px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
    cursor: pointer;
    padding: 0.75rem 1rem;
    border: 1px solid $border-light;
    border-radius: 10px;
    background: white;
    transition: all 0.2s ease;
    font-weight: 500;
    color: $text-light;
    user-select: none;

    &:hover {
      background: $gray-50;
    }

    &:has(input:checked) {
      background: rgba($NICOLE-PURPLE, 0.05);
      border-color: $NICOLE-PURPLE;
      color: $NICOLE-PURPLE;
      font-weight: 700;
      box-shadow: 0 4px 12px rgba($NICOLE-PURPLE, 0.15);
    }

    input {
      width: auto;
      margin: 0;
      cursor: pointer;
      accent-color: $NICOLE-PURPLE;
    }
  }
}

.delivery-fields {
  background: linear-gradient(to right, #fff5f9, #fff0f7); // Subtle gradient
  padding: 1.5rem;
  border-radius: 12px;
  border: 1px solid rgba($NICOLE-PURPLE, 0.2);
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  margin-top: 0.5rem;

  @media(max-width: 600px) {
    grid-template-columns: 1fr;
  }
}

.invoice-toggle,
.payment-toggle {
  margin: 2rem 0 1rem;
  padding: 1rem;
  background: white;
  border: 1px solid $border-light;
  border-radius: 12px;
  transition: all 0.2s;

  &:hover {
    border-color: $NICOLE-PURPLE;
  }

  label {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    font-weight: 600;
    font-size: 1rem;
    color: $text-dark;
    width: 100%;

    input[type="checkbox"] {
      width: 1.2rem;
      height: 1.2rem;
      accent-color: $NICOLE-PURPLE;
      cursor: pointer;
    }
  }
}

.payment-toggle {
  background: rgba($success, 0.05);
  border-color: rgba($success, 0.3);

  &:hover {
    border-color: $success;
    background: rgba($success, 0.1);
  }

  label {
    color: darken-color($success, 15%);

    input[type="checkbox"] {
      accent-color: $success;
    }
  }
}

.invoice-fields,
.payment-fields-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  animation: slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  padding: 1.5rem;
  background: $gray-50;
  border-radius: 0 0 12px 12px;
  margin-top: -1rem; // Connect with toggle
  margin-bottom: 2rem;
  border: 1px solid $border-light;
  border-top: none;

  @media(max-width: 768px) {
    grid-template-columns: 1fr;
  }

  h3 {
    grid-column: 1 / -1;
    font-size: 1.1rem;
    color: $text-dark;
    margin: 0 0 0.5rem 0;
    font-weight: 700;
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

.input-wrapper {
  position: relative;

  .custom-input {
    width: 100%;
    // Remove browser default appearance where possible
    appearance: none;
    -webkit-appearance: none;
    position: relative;
    z-index: 2;
    background: transparent;

    // For date/time inputs specifically
    &[type="date"],
    &[type="time"] {
      &::-webkit-calendar-picker-indicator {
        position: absolute;
        right: 1rem;
        top: 50%;
        transform: translateY(-50%);
        opacity: 0; // Hide the default icon but keep it clickable
        width: 100%;
        height: 100%;
        cursor: pointer;
        z-index: 3;
      }
    }

    // Custom Select Styles
    &.custom-select {
      cursor: pointer;
      padding-right: 2.5rem; // Space for arrow
    }
  }

  .icon-placeholder {
    position: absolute;
    right: 2.5rem; // Move left of arrow
    top: 50%;
    transform: translateY(-50%);
    color: $text-light;
    z-index: 1;
    pointer-events: none;
    font-size: 1.1rem;
    opacity: 0.7;
  }

  .icon-arrow {
    position: absolute;
    right: 1rem;
    top: 50%;
    transform: translateY(-50%);
    color: $text-light;
    pointer-events: none;
    font-size: 0.8rem;
    z-index: 1;
  }
}

.quick-times {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
  flex-wrap: wrap;

  .chip-time {
    background: white;
    border: 1px solid $border-light;
    border-radius: 20px; // Pill shape
    padding: 0.35rem 0.85rem;
    font-size: 0.85rem;
    color: $text-light;
    cursor: pointer;
    transition: all 0.2s;
    font-weight: 500;
    font-family: $font-secondary;

    &:hover {
      background: $gray-50;
      color: $NICOLE-PURPLE;
      border-color: $NICOLE-PURPLE;
    }

    &.active {
      background: rgba($NICOLE-PURPLE, 0.1);
      color: $NICOLE-PURPLE;
      border-color: $NICOLE-PURPLE;
      font-weight: 700;
    }
  }
}

.error-msg {
  color: $error;
  font-size: 0.8rem;
  margin-top: 0.25rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  animation: fadeIn 0.2s ease;
  font-weight: 600;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}
</style>
