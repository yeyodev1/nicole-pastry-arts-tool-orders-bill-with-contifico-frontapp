<script setup lang="ts">
import { ref, onUnmounted, computed } from 'vue'

defineProps<{
  isOpen: boolean
  providerName: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm'): void
}>()

// --- Hold Logic ---
const progress = ref(0)
const isHolding = ref(false)
const isSuccessfullyDestroyed = ref(false)
let animationFrameId: number | null = null
let startTime: number | null = null
const DURATION = 2000 // 2 seconds for destruction

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
  isSuccessfullyDestroyed.value = true

  // Wait for the vanish animation to complete before emitting
  setTimeout(() => {
    emit('confirm')
    // Reset state after emit just in case
    setTimeout(() => {
      isSuccessfullyDestroyed.value = false
    }, 500)
  }, 800)
}

// Visual Disintegration Styles
const disintegrationStyles = computed(() => {
  if (isSuccessfullyDestroyed.value) {
    return {
      animation: 'vanish 0.8s forwards cubic-bezier(0.55, 0.055, 0.675, 0.19)'
    }
  }

  if (!isHolding.value) return {}

  const intensity = progress.value / 100
  return {
    transform: `translate(${(Math.random() - 0.5) * 4 * intensity}px, ${(Math.random() - 0.5) * 4 * intensity}px) scale(${1 - 0.05 * intensity})`,
    filter: `blur(${intensity * 2}px) grayscale(${intensity})`,
    opacity: 1 - intensity * 0.3
  }
})

onUnmounted(() => {
  cancelHold()
})
</script>

<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="emit('close')">
    <div class="modal danger-modal" :style="disintegrationStyles">
      <div class="modal-header">
        <div class="danger-icon">
          <i class="fas fa-radiation"></i>
        </div>
        <h2>Zona de Peligro</h2>
        <p class="warning-text">Estás a punto de eliminar al proveedor <strong>{{ providerName }}</strong>.</p>
      </div>

      <div class="danger-box">
        <ul>
            <li><i class="fas fa-exclamation-triangle"></i> Se eliminará del registro.</li>
            <li><i class="fas fa-exclamation-triangle"></i> No se podrá recuperar.</li>
            <li><i class="fas fa-exclamation-triangle"></i> Verifica que no tenga items asociados.</li>
        </ul>
      </div>

      <div class="actions">
        <button class="btn-cancel" @click="emit('close')">Cancelar</button>

        <div class="hold-button-wrapper danger">
          <button 
            class="btn-hold-delete"
            @mousedown="startHold"
            @mouseleave="cancelHold"
            @mouseup="cancelHold"
            @touchstart.prevent="startHold"
            @touchend.prevent="cancelHold"
            @contextmenu.prevent
          >
            <div class="progress-bar-danger" :style="{ width: progress + '%' }"></div>
            <span class="label">
              <i class="fas" :class="isSuccessfullyDestroyed ? 'fa-fire' : (progress >= 100 ? 'fa-dumpster-fire' : 'fa-skull-crossbones')"></i>
              {{ isSuccessfullyDestroyed ? 'ELIMINANDO...' : (isHolding ? 'DESINTEGRANDO...' : 'MANTÉN PARA ELIMINAR') }}
            </span>
          </button>
        </div>
      </div>
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
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(8px);
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.3s ease;
}

.modal {
  background: white;
  width: 95%;
  max-width: 400px;
  border-radius: 24px;
  padding: 2.5rem 2rem;
  text-align: center;
  box-shadow: 0 30px 70px rgba(0, 0, 0, 0.5);
  border: 2px solid #fee2e2;
  transition: transform 0.05s linear;
}

.modal-header {
  margin-bottom: 1.5rem;

  .danger-icon {
    width: 70px;
    height: 70px;
    background: #fef2f2;
    color: #dc2626;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2.2rem;
    margin: 0 auto 1.2rem;
    border: 2px solid #fecaca;
    animation: pulse 2s infinite;
  }

  h2 {
    margin: 0;
    color: #991b1b;
    font-size: 1.6rem;
    font-weight: 800;
    letter-spacing: -0.5px;
  }

  .warning-text {
    margin: 1rem 0 0;
    color: #4b5563;
    font-size: 1rem;
    line-height: 1.4;

    strong {
      color: #111827;
    }
  }
}

.danger-box {
  background: #fff1f2;
  border: 1px dashed #fecaca;
  border-radius: 12px;
  padding: 1.2rem;
  margin-bottom: 2rem;
  text-align: left;

  ul {
    list-style: none;
    padding: 0;
    margin: 0;

    li {
      color: #991b1b;
      font-size: 0.85rem;
      margin-bottom: 0.6rem;
      display: flex;
      gap: 0.6rem;
      align-items: flex-start;

      &:last-child {
        margin-bottom: 0;
      }

      i {
        margin-top: 3px;
        font-size: 0.9rem;
      }
    }
  }
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
}

.btn-cancel {
  background: #f3f4f6;
  border: none;
  color: #374151;
  padding: 1rem;
  border-radius: 14px;
  font-weight: 700;
  cursor: pointer;
  order: 2;
  transition: all 0.2s;

  &:hover {
    background: #e5e7eb;
    color: #111827;
  }
}

.hold-button-wrapper {
  order: 1;
  position: relative;
  width: 100%;
  height: 64px;
  background: #fee2e2;
  border-radius: 16px;
  overflow: hidden;
  border: 2px solid #fecaca;
  cursor: pointer;
  user-select: none;

  .btn-hold-delete {
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
    color: #dc2626;
    font-weight: 800;
    font-size: 1.1rem;
    z-index: 2;
    overflow: hidden;
    outline: none;

    .progress-bar-danger {
      position: absolute;
      top: 0;
      left: 0;
      bottom: 0;
      background: #dc2626;
      width: 0%;
      z-index: -1;
      transition: width 0.1s linear;
    }

    .label {
      position: relative;
      z-index: 2;
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
  }

  &:active,
  &:has(.btn-hold-delete:active) {
    .btn-hold-delete {
      color: white;
    }
  }
}

@keyframes pulse {
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.4);
  }

  70% {
    transform: scale(1.05);
    box-shadow: 0 0 0 10px rgba(220, 38, 38, 0);
  }

  100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(220, 38, 38, 0);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

@keyframes vanish {
  0% {
    transform: scale(1) rotate(0deg);
    filter: blur(2px) grayscale(1);
    opacity: 0.7;
  }

  20% {
    transform: scale(1.05) rotate(2deg);
    filter: blur(4px) grayscale(1) brightness(1.5);
  }

  100% {
    transform: scale(0.2) rotate(-15deg) translateY(-100px);
    filter: blur(20px) grayscale(1) brightness(10);
    opacity: 0;
  }
}
</style>
