<script setup lang="ts">
import { computed } from 'vue'
import { useToast } from '@/composables/useToast'

const props = defineProps<{
  invoiceStatus: string,
  invoiceNeeded: boolean,
  invoiceData: any,
  generatedInvoice?: any
}>()

const emit = defineEmits(['open-invoice-modal', 'open-payment-modal', 'generate-invoice', 'view-invoice'])
const { error: showError } = useToast()

const isInvoiceDataComplete = computed(() => {
  const d = props.invoiceData || {}
  return d.ruc?.trim() && d.businessName?.trim() && d.email?.trim() && d.address?.trim()
})

const handleGenerateClick = () => {
  if (!isInvoiceDataComplete.value) {
    showError('Faltan datos de facturación (RUC, Razón Social, Email o Dirección). Por favor, edítalos primero.')
    return
  }
  emit('generate-invoice')
}
</script>

<template>
  <div class="card invoice-card">
     <div class="card-header-row">
       <h2>Datos Facturación</h2>
       <div style="display: flex; gap: 0.5rem;" class="actions">
         <button v-if="invoiceStatus === 'PROCESSED'" @click="$emit('view-invoice')" class="btn-xs">Ver Factura</button>
         <button v-if="invoiceStatus === 'PROCESSED'" @click="$emit('open-payment-modal')" class="btn-xs btn-primary">Cobrar</button>
         <button 
          v-if="invoiceNeeded && invoiceStatus !== 'PROCESSED'" 
          @click="handleGenerateClick" 
          class="btn-xs btn-primary"
          :class="{ 'btn-disabled': !isInvoiceDataComplete }"
         >
          Generar
         </button>
         <button v-if="invoiceStatus !== 'PROCESSED'" @click="$emit('open-invoice-modal')" class="btn-xs">Editar</button>
       </div>
     </div>
     
     <div v-if="invoiceNeeded">
         <div class="field">
           <label>Razón Social</label>
           <p>{{ invoiceData.businessName }}</p>
         </div>
         <div class="field">
           <label>RUC/CI</label>
           <p>{{ invoiceData.ruc }}</p>
         </div>
         <div class="field">
           <label>Email</label>
           <p>{{ invoiceData.email }}</p>
         </div>
         <div class="field">
           <label>Dirección</label>
           <p>{{ invoiceData.address }}</p>
         </div>
     </div>
     <div v-else class="empty-invoice">
         <p>No requiere factura.</p>
     </div>
  </div>
</template>

<style lang="scss" scoped>
.card {
  background: white;
  border-radius: 12px;
  border: 1px solid $border-light;
  padding: 1.25rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.01);
  width: 100%;
  box-sizing: border-box;
}

.card-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  margin-bottom: 1rem;

  h2 {
    margin: 0;
    font-size: 1.1rem;
    color: $text-dark;
    font-weight: 700;
  }
}

.field {
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px dashed $gray-100;

  &:last-child {
    border-bottom: none;
    margin-bottom: 0;
    padding-bottom: 0;
  }

  label {
    display: block;
    font-size: 0.75rem;
    color: $text-light;
    font-weight: 700;
    text-transform: uppercase;
    margin-bottom: 0.25rem;
  }

  p {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 500;
    color: $text-dark;
    line-height: 1.4;
  }
}

.btn-xs {
  padding: 0.35rem 0.75rem;
  font-size: 0.8rem;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid $border-light;
  background: white;
  color: $NICOLE-PURPLE;
  transition: all 0.2s;

  &.btn-primary {
    background: $NICOLE-PURPLE;
    color: white;
    border-color: $NICOLE-PURPLE;

    &:hover {
      background: darken($NICOLE-PURPLE, 5%);
    }
  }

  &.btn-disabled {
    opacity: 0.6;
    cursor: not-allowed;
    background: $gray-300;
    border-color: $gray-300;

    &:hover {
      background: $gray-300;
    }
  }
}

.empty-invoice {
  text-align: center;
  padding: 1.5rem;
  color: $text-light;
  font-style: italic;
  background: $gray-50;
  border-radius: 8px;
  font-size: 0.9rem;
}
</style>
