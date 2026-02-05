<script setup lang="ts">
import { ref, onUnmounted } from 'vue'

const props = defineProps<{
  isOpen: boolean
  invoiceData: {
    businessName: string
    ruc: string
    address: string
    email: string
  }
  totalValue: number
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
const DURATION = 2000 // 2 seconds as requested

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

const formatMoney = (val: number) => `$${val.toFixed(2)}`
</script>

<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="emit('close')">
    <div class="modal">
      <div class="modal-header">
        <div class="warning-icon">
          <i class="fas fa-file-invoice-dollar"></i>
        </div>
        <h2>Generar Factura</h2>
        <p>Confirmas generar legalmente esta factura electrónica en Contífico?</p>
      </div>

      <div class="summary-card">
         <div class="row">
           <span>Razón Social:</span>
           <strong>{{ invoiceData.businessName }}</strong>
         </div>
         <div class="row">
           <span>RUC/CI:</span>
           <strong>{{ invoiceData.ruc }}</strong>
         </div>
         <div class="row">
           <span>Email:</span>
           <strong>{{ invoiceData.email }}</strong>
         </div>
         
         <div class="divider"></div>

         <div class="row total-row">
           <span>Monto Total:</span>
           <strong class="total-text">{{ formatMoney(totalValue) }}</strong>
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
                {{ isHolding ? 'Mantén presionado...' : 'Mantén 2s para Facturar' }}
              </span>
            </button>
         </div>
      </div>
      
      <p class="safety-hint">Esta acción es irreversible y se reportará al SRI.</p>
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
  max-width: 400px;
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
    background: #ecfdf5; // Green-ish
    color: #10b981;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.8rem;
    margin: 0 auto 1rem;
    border: 1px solid rgba(16, 185, 129, 0.2);
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
  padding: 1.25rem;
  margin-bottom: 2rem;
  text-align: left;

  .row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.5rem;
    font-size: 0.95rem;
    color: $text-dark;
    word-break: break-all; // Safety for long emails

    &:last-child {
      margin-bottom: 0;
    }

    strong {
      font-weight: 600;
      text-align: right;
      max-width: 60%;
    }
  }

  .divider {
    height: 1px;
    background: $border-light;
    margin: 1rem 0;
  }

  .total-row {
    align-items: center;

    .total-text {
      font-size: 1.2rem;
      font-weight: 800;
      color: $NICOLE-PURPLE;
      font-family: $font-principal;
    }
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
  order: 2;

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
      transition: width 0.1s linear;
    }

    .label {
      position: relative;
      z-index: 2;
      display: flex;
      align-items: center;
      gap: 0.5rem;
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
  color: $warning;
  margin-top: 1rem;
  opacity: 0.9;
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
