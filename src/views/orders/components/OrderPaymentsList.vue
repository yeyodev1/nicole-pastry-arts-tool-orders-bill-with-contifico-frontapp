<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  payments: any[],
  totalPaid: number,
  outstandingBalance: number
}>()

const emit = defineEmits(['open-modal'])

</script>

<template>
  <section class="card payments-card">
     <div class="card-header-row">
       <h2>Pagos Registrados</h2>
       <button v-if="outstandingBalance > 0.05" @click="emit('open-modal')" class="btn-xs btn-primary">
         <i class="fas fa-plus"></i> Registrar Cobro
       </button>
     </div>

     <div v-if="payments && payments.length > 0" class="payments-list">
       <div class="payment-header">
         <span>Fecha</span>
         <span>Método</span>
         <span>Referencia</span>
         <span class="text-right">Monto</span>
       </div>
       
       <div v-for="(pay, idx) in payments" :key="idx" class="payment-row">
         <div class="pay-date">
           <i class="far fa-calendar-alt"></i>
           {{ new Date(pay.fecha).toLocaleDateString('es-EC') }}
         </div>
         
         <div class="pay-method">
           <span class="method-badge" :class="pay.forma_cobro">
              {{ pay.forma_cobro === 'TRA' ? 'Transferencia' :
                pay.forma_cobro === 'EF' ? 'Efectivo' :
                  pay.forma_cobro === 'TC' ? 'Tarjeta' :
                    pay.forma_cobro === 'CQ' ? 'Cheque' : pay.forma_cobro }}
           </span>
         </div>
         
         <div class="pay-ref">
           <span v-if="pay.numero_comprobante || pay.reference" class="ref-code">
             {{ pay.numero_comprobante || pay.reference }}
           </span>
           <span v-else class="text-muted">-</span>
         </div>
         
         <div class="pay-amount text-right">
           ${{ pay.monto.toFixed(2) }}
         </div>
       </div>

       <div class="payment-summary">
          <div class="summary-row">
            <span class="label">Total Pagado:</span>
            <span class="value success">${{ totalPaid.toFixed(2) }}</span>
          </div>
          <div v-if="outstandingBalance > 0.05" class="summary-row pending">
            <span class="label">Pendiente:</span>
            <span class="value danger">${{ outstandingBalance.toFixed(2) }}</span>
          </div>
       </div>
     </div>
     <div v-else class="empty-state">
       <p>No hay pagos registrados aún.</p>
     </div>
  </section>
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
      background: darken-color($NICOLE-PURPLE, 5%);
    }
  }
}

.payments-list {
  display: flex;
  flex-direction: column;
  border: 1px solid $border-light;
  border-radius: 8px;
  overflow: hidden;
}

.payment-header {
  display: none;
}

.payment-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.5rem;
  padding: 1rem;
  border-bottom: 1px solid $border-light;
  background: white;

  &:last-child {
    border-bottom: none;
  }

  .pay-date {
    font-size: 0.85rem;
    color: $text-light;
    grid-column: 1;
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .pay-method {
    grid-column: 1;
    margin-top: 0.2rem;
  }

  .pay-ref {
    grid-column: 1;
    font-size: 0.8rem;
    color: $text-light;
    margin-top: 0.2rem;
  }

  .pay-amount {
    grid-column: 2;
    grid-row: 1 / span 3;
    text-align: right;
    font-weight: 700;
    font-size: 1.1rem;
    color: $text-dark;
    align-self: center;
  }
}

.method-badge {
  display: inline-block;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 700;
  background: $gray-100;

  &.TRA {
    background: #e0f2fe;
    color: #0284c7;
  }

  &.EF {
    background: #dcfce7;
    color: #166534;
  }

  &.TC {
    background: #fef9c3;
    color: #854d0e;
  }

  &.CQ {
    background: #fae8ff;
    color: #86198f;
  }
}

.payment-summary {
  background: $gray-50;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  border-top: 1px solid $border-light;

  .summary-row {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .label {
      font-size: 0.9rem;
      color: $text-light;
    }

    .value {
      font-size: 1.1rem;
      font-weight: 700;
    }

    .success {
      color: $NICOLE-PURPLE;
    }

    .danger {
      color: #dc2626;
    }
  }
}

.empty-state {
  text-align: center;
  padding: 1.5rem;
  color: $text-light;
  font-style: italic;
  background: $gray-50;
  border-radius: 8px;
  font-size: 0.9rem;
}

@media (min-width: 768px) {
  .payment-header {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 120px;
    padding: 0.75rem 1rem;
    background: $gray-50;
    font-weight: 700;
    color: $text-light;
    font-size: 0.8rem;
    text-transform: uppercase;
    border-bottom: 1px solid $border-light;
  }

  .payment-row {
    grid-template-columns: 1fr 1fr 1fr 120px;
    padding: 1rem;

    .pay-date,
    .pay-method,
    .pay-ref,
    .pay-amount {
      grid-column: auto;
      grid-row: auto;
      margin-top: 0;
      display: block;
    }

    .pay-amount {
      align-self: center;
    }
  }

  .payment-summary {
    align-items: flex-end;

    .summary-row {
      max-width: 300px;
    }
  }
}
</style>
