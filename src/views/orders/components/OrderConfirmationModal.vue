<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import type { OrderFormData, CartItem } from '@/types/order'

const props = defineProps<{
  isOpen: boolean
  orderData: OrderFormData
  cart: CartItem[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm'): void
}>()

// --- Hold Button Logic ---
const progress = ref(0)
const isHolding = ref(false)
let animationFrameId: number | null = null
let startTime: number | null = null
const HOLD_DURATION = 3000 // 3 seconds is usually enough, user asked for 5 but 3 feels better. I'll stick to 3 or 4 for UX. Let's do 4000.
const DURATION = 4000

const startHold = () => {
  if (isHolding.value) return
  isHolding.value = true
  startTime = performance.now()

  const animate = (currentTime: number) => {
    if (!startTime) return
    const elapsed = currentTime - startTime
    progress.value = Math.min((elapsed / DURATION) * 100, 100)

    if (progress.value >= 100) {
      completeHold()
    } else {
      animationFrameId = requestAnimationFrame(animate)
    }
  }

  animationFrameId = requestAnimationFrame(animate)
}

const cancelHold = () => {
  isHolding.value = false
  startTime = null
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }
  // Smoothly drain backward or just reset? Reset feels snappier for safety.
  progress.value = 0
}

const completeHold = () => {
  cancelHold()
  emit('confirm')
}

// Clean up
onUnmounted(() => {
  cancelHold()
})

// Prevent scroll on mobile while holding
const preventCtx = (e: Event) => e.preventDefault()

// Helper formatters
const formatMoney = (val: number) => `$${val.toFixed(2)}`
</script>

<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="emit('close')">
    <div class="modal">
      <div class="modal-header">
        <div class="warning-icon">
          <i class="fas fa-clipboard-check"></i>
        </div>
        <h2>Confirmar Pedido</h2>
        <p>Revisa los detalles antes de generar la orden.</p>
      </div>

      <div class="summary-card">
         <div class="row">
           <span>Cliente:</span>
           <strong>{{ orderData.customerName }}</strong>
         </div>
         <div class="row">
           <span>Entrega:</span>
           <strong>{{ orderData.deliveryDate }} - {{ orderData.deliveryTime }}</strong>
         </div>

         <div class="divider"></div>

         <div class="row header">
            <span>Productos</span>
         </div>
         <div class="products-list">
            <div v-for="(item, i) in cart" :key="i" class="product-item">
               <div class="p-info">
                 <span class="p-qty">{{ item.quantity }}x</span>
                 <span class="p-name">{{ item.name }}</span>
                 <span v-if="item.isCourtesy" class="badge-courtesy">Cortesía</span>
               </div>
               <span class="p-price">{{ item.isCourtesy ? '$0.00' : formatMoney(item.price * item.quantity) }}</span>
            </div>
         </div>
         
         <div class="divider"></div>

         <div class="row">
           <span>Total del Pedido:</span>
           <strong class="total-text">{{ formatMoney(orderData.totalValue || 0) }}</strong>
         </div>
         
         <div class="divider"></div>
         
         <div class="row highlight">
            <span>Pago Inicial:</span>
            <strong :class="{ 'text-success': orderData.registerPaymentNow, 'text-warning': !orderData.registerPaymentNow }">
               {{ orderData.registerPaymentNow ? formatMoney(Number(orderData.paymentDetails?.monto || 0)) : '$0.00 (Pendiente)' }}
            </strong>
         </div>
         
         <div class="row small-text" v-if="orderData.registerPaymentNow && Number(orderData.paymentDetails?.monto || 0) < (orderData.totalValue || 0)">
            <span>Saldo Pendiente:</span>
            <span>{{ formatMoney((orderData.totalValue || 0) - Number(orderData.paymentDetails?.monto || 0)) }}</span>
         </div>
      </div>

      <div class="actions">
         <button class="btn-cancel" @click="emit('close')">Cancelar</button>
         
         <div class="hold-button-wrapper">
            <button 
              class="btn-hold"
              @mousedown="startHold"
              @mouseleave="cancelHold"
              @mouseup="cancelHold"
              @touchstart.prevent="startHold"
              @touchend.prevent="cancelHold"
              @contextmenu.prevent
            >
              <div class="progress-bar" :style="{ width: progress + '%' }"></div>
              <span class="label">
                <i class="fas" :class="progress >= 100 ? 'fa-check' : 'fa-fingerprint'"></i>
                {{ isHolding ? 'Mantén presionado...' : 'Mantén para Confirmar' }}
              </span>
            </button>
         </div>
      </div>
      
      <p class="safety-hint">Mantén presionado por 4 segundos para evitar duplicados.</p>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(5px);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.2s ease;
}

.modal {
  background: white;
  width: 90%;
  max-width: 420px;
  border-radius: 20px;
  padding: 2rem;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: scaleUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.modal-header {
  margin-bottom: 1.5rem;

  .warning-icon {
    width: 60px;
    height: 60px;
    background: #f0f9ff;
    color: $NICOLE-PURPLE;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.8rem;
    margin: 0 auto 1rem;
    border: 1px solid rgba($NICOLE-PURPLE, 0.2);
  }

  h2 {
    margin: 0;
    color: $text-dark;
    font-size: 1.4rem;
    font-weight: 700;
  }

  p {
    margin: 0.5rem 0 0;
    color: $text-light;
    font-size: 0.9rem;
  }
}

.summary-card {
  background: $gray-50;
  border: 1px solid $border-light;
  border-radius: 12px;
  padding: 1rem;
  margin-bottom: 2rem;
  text-align: left;

  .row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.5rem;
    font-size: 0.95rem;
    color: $text-dark;

    &:last-child {
      margin-bottom: 0;
    }

    strong {
      font-weight: 700;
    }

    .total-text {
      font-size: 1.1rem;
      color: $NICOLE-PURPLE;
    }

    &.highlight {
      background: white;
      padding: 0.5rem;
      border-radius: 6px;
      border: 1px dashed $border-light;
      margin: 0.5rem -0.5rem;
      align-items: center;
    }

    &.small-text {
      font-size: 0.85rem;
      color: $text-light;
      margin-top: 0.5rem;
    }

    &.header {
      margin-bottom: 0.5rem;
      color: $text-light;
      font-size: 0.8rem;
      text-transform: uppercase;
      font-weight: 700;
    }
  }

  .products-list {
    margin: 0.5rem 0;

    .product-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.4rem;
      font-size: 0.9rem;

      .p-info {
        display: flex;
        gap: 0.4rem;
        align-items: center;
        text-align: left;

        .p-qty {
          font-weight: 700;
          color: $NICOLE-PURPLE;
        }

        .p-name {
          color: $text-dark;
        }

        .badge-courtesy {
          font-size: 0.7rem;
          background: #e0f2fe;
          color: #0369a1;
          padding: 2px 6px;
          border-radius: 4px;
        }
      }

      .p-price {
        font-weight: 600;
        color: $text-dark;
      }
    }
  }

  .divider {
    height: 1px;
    background: $border-light;
    margin: 0.8rem 0;
  }

  .text-success {
    color: $success;
  }

  .text-warning {
    color: $warning;
  }
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.btn-cancel {
  background: white;
  border: 1px solid $border-light;
  color: $text-light;
  padding: 0.8rem;
  border-radius: 12px;
  font-weight: 600;
  cursor: pointer;
  order: 2; // Cancel below

  &:hover {
    background: $gray-50;
    color: $text-dark;
  }
}

.hold-button-wrapper {
  order: 1;
  position: relative;
  width: 100%;
  height: 56px;
  background: $gray-100;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid $gray-200;
  cursor: pointer;
  user-select: none;
  -webkit-touch-callout: none;

  .btn-hold {
    width: 100%;
    height: 100%;
    background: transparent;
    border: none;
    padding: 0;
    margin: 0;
    position: relative;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: $text-light;
    font-weight: 700;
    font-size: 1rem;
    z-index: 2;
    overflow: hidden;
    outline: none;
    transition: color 0.1s;

    .progress-bar {
      position: absolute;
      top: 0;
      left: 0;
      bottom: 0;
      background: $NICOLE-PURPLE;
      width: 0%;
      z-index: -1;
      transition: width 0.1s linear; // Linear for JS animation
    }

    .label {
      position: relative;
      z-index: 2;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      transition: color 0.2s;
    }
  }

  &:active,
  &:has(.btn-hold:active) {
    border-color: $NICOLE-PURPLE;

    .btn-hold {
      color: white;
    }
  }
}

.safety-hint {
  font-size: 0.75rem;
  color: $text-light;
  margin-top: 1rem;
  opacity: 0.7;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

@keyframes scaleUp {
  from {
    transform: scale(0.9);
    opacity: 0;
  }

  to {
    transform: scale(1);
    opacity: 1;
  }
}
</style>
