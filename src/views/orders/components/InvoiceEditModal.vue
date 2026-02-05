<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import OrderService from '@/services/order.service'

const props = defineProps<{
  isOpen: boolean
  orderId: string
  currentInvoiceData?: {
    ruc: string
    businessName: string
    email: string
    address: string
  }
  invoiceNeeded: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'saved', updatedOrder: any): void
}>()

const isSubmitting = ref(false)
const form = reactive({
  invoiceNeeded: false,
  ruc: '',
  businessName: '',
  email: '',
  address: ''
})

// Initialize form when opened
watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    form.invoiceNeeded = props.invoiceNeeded
    if (props.currentInvoiceData) {
      form.ruc = props.currentInvoiceData.ruc || ''
      form.businessName = props.currentInvoiceData.businessName || ''
      form.email = props.currentInvoiceData.email || ''
      form.address = props.currentInvoiceData.address || ''
    }
  }
})

const validate = () => {
  if (!form.invoiceNeeded) return true

  // RUC/Cedula validation
  const rucClean = form.ruc.trim()
  if (rucClean.length !== 10 && rucClean.length !== 13) {
    alert("El RUC/Cédula debe tener 10 o 13 dígitos.")
    return false
  }

  if (!form.businessName) {
    alert("La Razón Social es obligatoria.")
    return false
  }

  if (!form.email || !form.email.includes('@')) {
    alert("Ingrese un email válido.")
    return false
  }

  return true
}

const save = async () => {
  if (!validate()) return

  isSubmitting.value = true
  try {
    const payload = {
      invoiceNeeded: form.invoiceNeeded,
      invoiceData: form.invoiceNeeded ? {
        ruc: form.ruc.trim(),
        businessName: form.businessName,
        email: form.email,
        address: form.address
      } : undefined
    }

    const response = await OrderService.updateInvoiceData(props.orderId, payload)
    emit('saved', response.order)
    emit('close')
  } catch (e: any) {
    const msg = e.response?.data?.message || e.message
    alert('Error actualizando factura: ' + msg)
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div v-if="isOpen" class="modal-overlay">
    <div class="modal-content">
      <h2>{{ currentInvoiceData ? 'Editar Datos de Facturación' : 'Agregar Datos de Facturación' }}</h2>
      
      <div class="alert-info">
        <i class="fa-solid fa-pen"></i>
        <span>Modificar estos datos actualizará la orden (si la factura aún no se ha procesado).</span>
      </div>

      <div class="form-group checkbox-group">
          <label>
              <input type="checkbox" v-model="form.invoiceNeeded"> Requiere Factura
          </label>
      </div>
      
      <div v-if="form.invoiceNeeded" class="fields-container">
          <div class="form-group">
            <label>RUC / Cédula *</label>
            <input v-model="form.ruc" placeholder="10 o 13 dígitos" />
          </div>
          
          <div class="form-group">
            <label>Razón Social / Nombre *</label>
            <input v-model="form.businessName" />
          </div>
          
          <div class="form-group">
            <label>Email *</label>
            <input v-model="form.email" type="email" />
          </div>
          
          <div class="form-group">
            <label>Dirección</label>
            <input v-model="form.address" />
          </div>
      </div>

      <div class="actions">
        <button class="btn-cancel" @click="emit('close')" :disabled="isSubmitting">Cancelar</button>
        <button class="btn-primary" @click="save" :disabled="isSubmitting">
            {{ isSubmitting ? 'Guardando...' : 'Guardar Cambios' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
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
  padding: 2rem;
  border-radius: 12px;
  width: 90%;
  max-width: 500px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);

  h2 {
    margin-top: 0;
    color: $NICOLE-PURPLE;
    margin-bottom: 1.5rem;
    font-family: $font-principal;
  }
}

.form-group {
  margin-bottom: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;

  label {
    font-weight: 500;
    font-size: 0.9rem;
    color: $text-dark;
  }

  input {
    padding: 0.6rem;
    border: 1px solid $border-light;
    border-radius: 6px;
    font-family: inherit;

    &:focus {
      outline: none;
      border-color: $NICOLE-PURPLE;
    }
  }
}

.checkbox-group {
  flex-direction: row;
  align-items: center;

  label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
  }
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 2rem;

  button {
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: opacity 0.2s;

    &:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }
  }

  .btn-cancel {
    background: $gray-100;
    color: $text-light;

    &:hover:not(:disabled) {
      background: $gray-200;
    }
  }

  .btn-primary {
    background: $NICOLE-PURPLE;
    color: white;

    &:hover:not(:disabled) {
      opacity: 0.9;
    }
  }
}

.alert-info {
  background-color: #fef9c3; // Yellowish for caution
  color: #854d0e;
  padding: 0.75rem;
  border-radius: 6px;
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  border: 1px solid #fde047;
}
</style>
