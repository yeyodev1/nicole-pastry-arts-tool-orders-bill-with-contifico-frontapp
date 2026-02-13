<script setup lang="ts">
import { computed } from 'vue'
import HoldConfirmButton from '@/components/ui/HoldConfirmButton.vue'

const props = defineProps({
  isOpen: { type: Boolean, required: true },
  order: { type: Object, default: () => ({}) }
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm', orderId: string): void
}>()

const needsWarning = computed(() => {
  return props.order && props.order.posStatus !== 'RECEIVED'
})

const handleConfirm = () => {
  if (props.order && props.order._id) {
    emit('confirm', props.order._id)
  }
}
</script>

<template>
  <Transition name="fade">
    <div v-if="isOpen" class="modal-overlay" @click.self="emit('close')">
      <div class="modal-content">
        <div class="modal-header">
          <h3><i class="fa-solid fa-hand-holding-heart"></i> Confirmar Entrega</h3>
          <button class="close-btn" @click="emit('close')">&times;</button>
        </div>

        <div class="modal-body">
          <div class="order-summary">
            <div class="order-id">Orden #{{ order.orderNumber }}</div>
            <div class="customer-name">{{ order.customerName }}</div>
          </div>

          <div v-if="needsWarning" class="warning-box">
            <i class="fa-solid fa-triangle-exclamation"></i>
            <div class="warning-text">
              <strong>ATENCIÓN:</strong> Esta orden aún no ha sido marcada como <strong>RECIBIDA</strong> en sucursal. 
              Confirmar la entrega saltará el paso de recepción física.
            </div>
          </div>

          <div class="delivery-details">
            <div class="detail-row">
              <span>Monto Total:</span>
              <span class="val">${{ order.totalValue?.toFixed(2) }}</span>
            </div>
            <div class="detail-row">
              <span>Método de Pago:</span>
              <span class="val">{{ order.paymentMethod }}</span>
            </div>
          </div>

          <p class="instruction">Mantenga presionado el botón para finalizar la entrega:</p>
          
          <div class="action-wrapper">
             <HoldConfirmButton 
                label="Confirmar Entrega al Cliente"
                @confirmed="handleConfirm"
                color="#22C55E"
             />
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-cancel" @click="emit('close')">Cancelar</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style lang="scss" scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1100;
  backdrop-filter: blur(4px);
}

.modal-content {
  background: white;
  border-radius: 20px;
  width: 90%;
  max-width: 450px;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  animation: modalScale 0.3s ease-out;
}

@keyframes modalScale {
  from {
    transform: scale(0.9);
    opacity: 0;
  }

  to {
    transform: scale(1);
    opacity: 1;
  }
}

.modal-header {
  padding: 1.5rem;
  background: #F8FAFC;
  border-bottom: 1px solid #E2E8F0;
  display: flex;
  justify-content: space-between;
  align-items: center;

  h3 {
    margin: 0;
    color: $NICOLE-PURPLE;
    font-size: 1.25rem;
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: #94A3B8;

    &:hover {
      color: $error;
    }
  }
}

.modal-body {
  padding: 1.5rem;
  text-align: center;
}

.order-summary {
  margin-bottom: 1.5rem;

  .order-id {
    font-size: 1.5rem;
    font-weight: 800;
    color: $NICOLE-PURPLE;
    margin-bottom: 0.2rem;
  }

  .customer-name {
    font-size: 1rem;
    color: #475569;
    font-weight: 600;
  }
}

.warning-box {
  background: #FFFBEB;
  border: 1px solid #FDE68A;
  padding: 1rem;
  border-radius: 12px;
  display: flex;
  gap: 0.8rem;
  text-align: left;
  margin-bottom: 1.5rem;
  color: #92400E;
  font-size: 0.9rem;
  line-height: 1.4;

  i {
    font-size: 1.2rem;
    margin-top: 0.2rem;
  }
}

.delivery-details {
  background: #F1F5F9;
  padding: 1rem;
  border-radius: 12px;
  margin-bottom: 1.5rem;

  .detail-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.4rem;
    font-size: 0.95rem;
    color: #64748B;

    &:last-child {
      margin-bottom: 0;
    }

    .val {
      font-weight: 700;
      color: #1E293B;
    }
  }
}

.instruction {
  font-size: 0.85rem;
  color: #94A3B8;
  margin-bottom: 1rem;
  font-weight: 600;
}

.action-wrapper {
  margin-top: 1rem;
}

.modal-footer {
  padding: 1rem 1.5rem;
  background: #F8FAFC;
  border-top: 1px solid #E2E8F0;
  text-align: center;

  .btn-cancel {
    background: transparent;
    border: none;
    color: #64748B;
    font-weight: 600;
    cursor: pointer;

    &:hover {
      color: $text-dark;
      text-decoration: underline;
    }
  }
}
</style>
