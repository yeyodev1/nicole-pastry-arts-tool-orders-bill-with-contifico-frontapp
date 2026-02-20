<script setup lang="ts">
import { ref, onUnmounted } from 'vue';

const props = defineProps<{
  isOpen: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  isDangerous?: boolean
  isHoldToConfirm?: boolean // New option
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
const DURATION = 1200 // 1.2s as requested

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

onUnmounted(() => {
  cancelHold()
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

        <div class="modal-actions" :class="{ 'hold-layout': isHoldToConfirm }">
          <button class="btn-cancel" @click="emit('close')">
            {{ cancelText || 'Cancelar' }}
          </button>
          
          <template v-if="isHoldToConfirm">
            <div class="hold-button-wrapper">
              <button 
                class="btn-confirm btn-hold"
                :class="{ dangerous: isDangerous }"
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
                  {{ isHolding ? 'Soltar para cancelar' : (confirmText || 'Mantén para Confirmar') }}
                </span>
              </button>
            </div>
          </template>

          <button 
            v-else
            class="btn-confirm" 
            :class="{ dangerous: isDangerous }"
            @click="emit('confirm')"
          >
            {{ confirmText || 'Confirmar' }}
          </button>
        </div>
        
        <p v-if="isHoldToConfirm" class="safety-hint">Mantén presionado para confirmar.</p>
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
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
}

.modal-content {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  width: 90%;
  max-width: 400px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  transform: translateY(0);
  transition: all 0.3s ease;
}

.modal-header {
  margin-bottom: 1rem;

  h3 {
    margin: 0;
    font-size: 1.25rem;
    color: $text-dark;
    font-family: $font-principal;
  }
}

.modal-body {
  margin-bottom: 1.5rem;

  p {
    margin: 0;
    color: $text-light;
    line-height: 1.5;
    font-size: 0.95rem;
  }
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;

  &.hold-layout {
    flex-direction: column;
    gap: 0.75rem;
    margin-top: 1rem;

    .btn-cancel {
      order: 2;
      width: 100%;
    }
  }
}

.hold-button-wrapper {
  order: 1;
  position: relative;
  width: 100%;
  height: 48px;
  background: $gray-100;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid $gray-200;
  cursor: pointer;
  user-select: none;

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
    font-size: 0.95rem;
    z-index: 2;
    overflow: hidden;
    outline: none;
    box-shadow: none;

    .progress-bar {
      position: absolute;
      top: 0;
      left: 0;
      bottom: 0;
      background: $success;
      width: 0%;
      z-index: -1;
      transition: width 0.1s linear;
    }

    &.dangerous .progress-bar {
      background: $error;
    }

    .label {
      position: relative;
      z-index: 2;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      transition: color 0.1s;
    }

    &:active {
      color: white;
    }
  }
}

.safety-hint {
  font-size: 0.75rem;
  color: #94a3b8;
  margin-top: 1rem;
  text-align: center;
  font-family: italics;
}

button {
  padding: 0.6rem 1.2rem;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.9rem;
  font-family: $font-secondary;
}

.btn-cancel {
  background: $gray-100;
  color: $text-light;
  border: none;

  &:hover {
    background: $gray-200;
    color: $text-dark;
  }
}

.btn-confirm {
  background: $success;
  color: white;
  border: none;
  box-shadow: 0 2px 5px rgba($success, 0.3);

  &:hover {
    background: darken($success, 5%);
  }

  &.dangerous {
    background: $error;
    box-shadow: 0 2px 5px rgba($error, 0.3);

    &:hover {
      background: darken($error, 5%);
    }
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

.fade-enter-from .modal-content,
.fade-leave-to .modal-content {
  transform: translateY(20px);
}
</style>
