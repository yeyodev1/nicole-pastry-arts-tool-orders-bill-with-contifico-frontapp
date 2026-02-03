<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'

const props = defineProps<{
  modelValue: any
  isLoading?: boolean
  totalToPay?: number // Passed from parent
  isEditMode?: boolean // If true, allows editing regardless of logic? Or used for list view?
}>()

const emit = defineEmits(['update:modelValue'])

// Payment Methods
const paymentMethods = [
  { value: 'TRA', label: 'Transferencia' },
  { value: 'TC', label: 'Tarjeta' },
  { value: 'CR', label: 'Crédito' }
]

const localData = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const isAbono = ref(false)

// Logic: If NOT abono, force monto = totalToPay
watch([() => isAbono.value, () => props.totalToPay], ([newIsAbono, newTotal]) => {
  if (!newIsAbono && newTotal !== undefined) {
    localData.value.monto = Number(newTotal.toFixed(2))
  }
}, { immediate: true })

const isTransfer = computed(() => localData.value.forma_cobro === 'TRA')
const isCreditCard = computed(() => localData.value.forma_cobro === 'TC')
const isCreditLine = computed(() => localData.value.forma_cobro === 'CR')

const referenceLabel = computed(() => {
  if (localData.value.forma_cobro === 'TRA') return 'Número de Transferencia'
  if (localData.value.forma_cobro === 'TC') return 'Número de Lote / Autorización'
  return 'Comprobante / Lote'
})
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
        v-if="isTransfer"
        label="Banco de Destino"
        v-model="localData.cuenta_bancaria_id"
        placeholder="Ej: Banco Pichincha"
        :disabled="isLoading"
        hint="Escriba el nombre del banco."
    />

    <div class="abono-section">
       <label class="toggle-label">
         <input type="checkbox" v-model="isAbono" :disabled="isLoading">
         <span>¿Es un Abono Parcial?</span>
       </label>
       <small v-if="!isAbono" class="hint-text">Se registrará el cobro por el valor total: ${{ (totalToPay || 0).toFixed(2) }}</small>
    </div>

    <!-- Amount -->
    <BaseInput
        label="Monto ($)"
        type="number"
        step="0.01"
        v-model.number="localData.monto"
        :disabled="isLoading || (!isAbono && !isEditMode)" 
        :max="totalToPay || undefined"
    />

    <!-- Date -->
    <BaseInput
        label="Fecha"
        type="date"
        v-model="localData.fecha"
        :disabled="isLoading"
    />

    <!-- Conditional: Transfer/TC Reference -->
    <BaseInput
        v-if="isTransfer || isCreditCard"
        :label="referenceLabel"
        v-model="localData.numero_comprobante"
        :placeholder="localData.forma_cobro === 'TRA' ? 'Ej: 987654' : 'Ej: 123456'"
        :disabled="isLoading"
    />

    <div v-if="isCreditLine" class="credit-warning">
       <i class="fa-solid fa-triangle-exclamation"></i>
       <span>Recordar que este saldo queda pendiente por cobrar.</span>
    </div>

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
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 90%;
  box-sizing: border-box;
}

.abono-section {
  background: lighten-color($NICOLE-PURPLE, 55%); // Very light purple
  padding: 1rem;
  border-radius: 8px;
  border: 1px dashed rgba($NICOLE-PURPLE, 0.3);
  margin-bottom: 0.5rem;

  .toggle-label {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-weight: 600;
    color: $NICOLE-PURPLE;
    cursor: pointer;
    margin-bottom: 0.25rem;

    input {
      width: 1.1rem;
      height: 1.1rem;
      accent-color: $NICOLE-PURPLE;
    }
  }

  .hint-text {
    display: block;
    color: $text-light;
    font-size: 0.85rem;
    margin-left: 1.85rem;
  }
}

.credit-warning {
  background: #fff7ed;
  color: #c2410c;
  padding: 0.75rem;
  border-radius: 8px;
  border: 1px solid #ffedd5;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  font-weight: 600;

  i {
    font-size: 1rem;
  }
}
</style>
