<script setup lang="ts">
import { ref, onUnmounted } from 'vue'

const props = defineProps<{
  isOpen: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  holdDuration?: number // ms
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm'): void
}>()

const isHolding = ref(false)
const progress = ref(0)
let holdTimer: any = null
let intervalTimer: any = null
const PROCESS_DURATION = props.holdDuration || 2000 // Default 2s

const startHold = () => {
  if (props.isOpen) {
    isHolding.value = true
    progress.value = 0

    const step = 20 // Update every 20ms
    const increment = (step / PROCESS_DURATION) * 100

    intervalTimer = setInterval(() => {
      progress.value += increment
      if (progress.value >= 100) {
        completeHold()
      }
    }, step)
  }
}

const stopHold = () => {
  isHolding.value = false
  progress.value = 0
  clearInterval(intervalTimer)
}

const completeHold = () => {
  stopHold()
  emit('confirm')
}

onUnmounted(() => {
  stopHold()
})
</script>

<template>
  <Transition name="fade">
    <div v-if="isOpen" class="modal-overlay" @click.self="emit('close')">
      <div class="modal-content">
        <div class="modal-header">
          <h3>{{ title }}</h3>
        </div>
        
        <div class="modal-body">
          <p>{{ message }}</p>
        </div>

        <div class="modal-actions">
          <button class="btn-cancel" @click="emit('close')">
            {{ cancelText || 'Cancelar' }}
          </button>
          
          <button 
            class="btn-hold" 
            :class="{ 'is-holding': isHolding }"
            @mousedown="startHold"
            @touchstart.prevent="startHold"
            @mouseup="stopHold"
            @mouseleave="stopHold"
            @touchend="stopHold"
            @touchcancel="stopHold"
          >
            <div class="progress-fill" :style="{ width: `${progress}%` }"></div>
            <span class="btn-text">
              <i class="fas fa-check-circle" v-if="!isHolding"></i>
              {{ isHolding ? 'MANTÉN PRESIONADO...' : (confirmText || 'Confirmar') }}
            </span>
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style lang="scss" scoped>
$color-whatsapp: #25D366;
$color-primary: #8e44ad;
$color-pending: #3498db;
$color-success: #2ecc71;
$color-warning: #f1c40f;
$color-danger: #e74c3c;
$text-dark: #2c3e50;
$text-light: #7f8c8d;
$gray-100: #f1f2f6;
$gray-200: #dfe6e9;

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000; // Higher than standard modals
  backdrop-filter: blur(2px);
}

.modal-content {
  background: white;
  padding: 1.5rem;
  border-radius: 16px;
  width: 90%;
  max-width: 420px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  transform: translateY(0);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  text-align: center;
}

.modal-header h3 {
  margin: 0 0 1rem 0;
  font-size: 1.2rem;
  font-weight: 700;
  color: $text-dark;
}

.modal-body p {
  color: $text-light;
  margin-bottom: 2rem;
  font-size: 0.95rem;
  line-height: 1.5;
}

.modal-actions {
  display: flex;
  justify-content: center;
  gap: 1rem;
}

button {
  padding: 0.8rem 1.5rem;
  border-radius: 10px;
  font-weight: 700;
  cursor: pointer;
  border: none;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.btn-cancel {
  background: $gray-100;
  color: $text-light;

  &:hover {
    background: $gray-200;
  }
}

.btn-hold {
  background: $color-success;
  color: white;
  position: relative;
  overflow: hidden;
  min-width: 180px;
  // Disable user select to prevent text selection during hold
  user-select: none;
  -webkit-user-select: none;

  .progress-fill {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    background: darken($color-success, 15%);
    width: 0%;
    transition: width 0.05s linear; // Smooth linear fill
    z-index: 1;
  }

  .btn-text {
    position: relative;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  &.is-holding {
    transform: scale(0.98);
  }
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
