<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import PaymentFields from './PaymentFields.vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true
  },
  orderId: {
    type: String,
    required: true
  },
  defaultAmount: {
    type: Number,
    default: 0
  }
})

const emit = defineEmits(['close', 'submit'])

const isSubmitting = ref(false)

const formData = reactive({
  forma_cobro: 'TRA', // Default: Transferencia (most common)
  monto: props.defaultAmount,
  fecha: new Date().toISOString().split('T')[0], // YYYY-MM-DD
  numero_comprobante: '', // For Cheque/Transferencia
  cuenta_bancaria_id: '',
  numero_tarjeta: '', // For TC
  tipo_ping: 'D' // Datafast/Medianet
})

const submitPayment = async () => {
  if (props.defaultAmount > 0 && formData.monto <= 0) {
    alert("El monto debe ser mayor a 0")
    return
  }

  if (!formData.fecha) {
    alert("Fecha es obligatoria");
    return;
  }

  // Format date to DD/MM/YYYY for Contífico
  const [year, month, day] = formData.fecha.split('-')
  const formattedDate = `${day}/${month}/${year}`

  const payload: any = {
    forma_cobro: formData.forma_cobro,
    monto: formData.monto.toFixed(2),
    fecha: formattedDate
  }

  if (formData.forma_cobro === 'TC') {
    payload.tipo_ping = formData.tipo_ping
    payload.lote = formData.numero_comprobante // Map comprobante to lote/reference for TC
    if (formData.numero_tarjeta) {
      payload.numero_tarjeta = formData.numero_tarjeta
    }
  }

  if (formData.forma_cobro === 'CQ') {
    payload.numero_cheque = formData.numero_comprobante
  }

  if (formData.forma_cobro === 'TRA') {
    if (!formData.cuenta_bancaria_id) {
      alert("Debe seleccionar una cuenta bancaria para la transferencia.")
      return
    }
    payload.numero_comprobante = formData.numero_comprobante
    payload.cuenta_bancaria_id = formData.cuenta_bancaria_id
  }

  emit('submit', payload)
}
</script>

<template>
  <div v-if="isOpen" class="modal-overlay">
    <div class="modal-content">
      <div class="modal-header">
        <h3>Registrar Cobro</h3>
        <button @click="$emit('close')" class="close-btn">&times;</button>
      </div>

      <div class="modal-body">
        <PaymentFields v-model="formData" :is-loading="isSubmitting" />
      </div>

      <div class="modal-footer">
        <button @click="$emit('close')" class="btn-cancel">Cancelar</button>
        <button @click="submitPayment" class="btn-confirm" :disabled="isSubmitting">
          {{ isSubmitting ? 'Registrando...' : 'Registrar' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  width: 90%;
  max-width: 400px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;

  h3 {
    margin: 0;
    color: $NICOLE-SECONDARY;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: $text-light;
  }
}

.form-group {
  margin-bottom: 1rem;

  label {
    display: block;
    margin-bottom: 0.5rem;
    font-size: 0.9rem;
    font-weight: 500;
  }

  input,
  select {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid $border-light;
    border-radius: 6px;
    font-size: 1rem;

    &:focus {
      outline: none;
      border-color: $NICOLE-PURPLE;
    }
  }
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 2rem;

  button {
    padding: 0.5rem 1rem;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.2s;
  }

  .btn-cancel {
    background: $gray-100;
    color: $text-dark;

    &:hover {
      background: $gray-200;
    }
  }

  .btn-confirm {
    background: $NICOLE-PURPLE;
    color: white;

    &:hover {
      background: darken($NICOLE-PURPLE, 10%);
    }

    &:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }
  }
}

.hint {
  display: block;
  font-size: 0.8rem;
  color: $text-light;
  margin-top: 0.25rem;
}
</style>
