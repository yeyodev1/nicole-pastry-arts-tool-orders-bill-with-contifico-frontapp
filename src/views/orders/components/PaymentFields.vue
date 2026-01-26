<script setup lang="ts">
import { computed } from 'vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'

const props = defineProps<{
  modelValue: any
  isLoading?: boolean
}>()

const emit = defineEmits(['update:modelValue'])

// Payment Methods
const paymentMethods = [
  { value: 'TRA', label: 'Transferencia' },
  { value: 'EF', label: 'Efectivo' },
  { value: 'TC', label: 'Tarjeta de Crédito' },
  { value: 'CQ', label: 'Cheque' }
]

const localData = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const isTransferOrCheque = computed(() => ['TRA', 'CQ'].includes(localData.value.forma_cobro))
const IsTransfer = computed(() => localData.value.forma_cobro === 'TRA')
const isCreditCard = computed(() => localData.value.forma_cobro === 'TC')
</script>

<template>
  <div class="payment-fields">
    <!-- Payment Method -->
    <BaseSelect 
        label="Forma de Cobro"
        v-model="localData.forma_cobro"
        :options="paymentMethods"
        :disabled="isLoading"
    />

    <!-- Bank Account Input (Manual Text) -->
    <BaseInput
        v-if="IsTransfer"
        label="Banco de Destino"
        v-model="localData.cuenta_bancaria_id"
        placeholder="Ej: Banco Pichincha"
        :disabled="isLoading"
        hint="Escriba el nombre del banco."
    />

    <!-- Amount -->
    <BaseInput
        label="Monto ($)"
        type="number"
        step="0.01"
        v-model.number="localData.monto"
        :disabled="isLoading"
    />

    <!-- Date -->
    <BaseInput
        label="Fecha"
        type="date"
        v-model="localData.fecha"
        :disabled="isLoading"
    />

    <!-- Conditional: Transfer/Cheque/TC Reference -->
    <BaseInput
        v-if="isTransferOrCheque || isCreditCard"
        :label="localData.forma_cobro === 'CQ' ? 'Número Cheque' : 'Comprobante / Lote'"
        v-model="localData.numero_comprobante"
        placeholder="Ej: 123456"
        :disabled="isLoading"
    />

    <!-- Conditional: Credit Card -->
    <template v-if="isCreditCard">
      <BaseInput
          label="Número de Tarjeta (Últimos 4)"
          v-model="localData.numero_tarjeta"
          placeholder="Ej: 4242"
          maxlength="4"
          :disabled="isLoading"
      />
      
      <BaseSelect
          label="Procesador"
          v-model="localData.tipo_ping"
          :options="[
            { value: 'D', label: 'Datafast' },
            { value: 'M', label: 'Medianet' }
          ]"
          :disabled="isLoading"
      />
    </template>
  </div>
</template>

<!-- Styles removed as they are now handled by Base Components -->
<style scoped lang="scss">
.payment-fields {
  padding-top: 0.5rem;
}
</style>
