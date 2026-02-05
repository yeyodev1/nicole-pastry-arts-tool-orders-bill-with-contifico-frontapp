<script setup lang="ts">
import { ref, onUnmounted, computed } from 'vue'

const props = defineProps<{
  isOpen: boolean
  personId: string
  personName: string
  riders: { _id?: string; name: string }[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm', payload: { action: 'unassign' | 'reassign', newPersonId?: string }): void
}>()

const reassignAction = ref<'unassign' | 'reassign'>('unassign')
const selectedReplacementId = ref('')

const availableRiders = computed(() => {
  return props.riders.filter(r => r._id !== props.personId)
})

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
    emit('confirm', {
      action: reassignAction.value,
      newPersonId: reassignAction.value === 'reassign' ? selectedReplacementId.value : undefined
    })
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
          <i class="fas fa-user-slash"></i>
        </div>
        <h2>Eliminar Transporte</h2>
        <p class="warning-text">¿Estás seguro de eliminar a <strong>{{ personName }}</strong>?</p>
      </div>

      <div class="danger-box">
        <p>Esta acción eliminará el registro del sistema.</p>
      </div>

      <div class="reassign-options">
        <label>¿Qué hacer con sus pedidos asignados?</label>
        
        <div class="option">
            <input type="radio" id="opt-unassign" value="unassign" v-model="reassignAction">
            <label for="opt-unassign">Desasignar todos (Dejar sin transporte)</label>
        </div>

        <div class="option" :class="{ disabled: availableRiders.length === 0 }">
            <input type="radio" id="opt-reassign" value="reassign" v-model="reassignAction" :disabled="availableRiders.length === 0">
            <label for="opt-reassign">Reasignar a otro transporte</label>
        </div>

        <div v-if="reassignAction === 'reassign'" class="rider-select-wrapper">
            <select v-model="selectedReplacementId">
                <option value="" disabled selected>Seleccione transporte...</option>
                <option v-for="rider in availableRiders" :key="rider._id" :value="rider._id">
                    {{ rider.name }}
                </option>
            </select>
        </div>

        <p v-if="availableRiders.length === 0 && reassignAction === 'unassign'" class="hint">
            No hay otros transportes disponibles para reasignar.
        </p>
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
            :disabled="reassignAction === 'reassign' && !selectedReplacementId"
            :class="{ disabled: reassignAction === 'reassign' && !selectedReplacementId }"
          >
            <div class="progress-bar-danger" :style="{ width: progress + '%' }"></div>
            <span class="label">
              <i class="fas" :class="isSuccessfullyDestroyed ? 'fa-fire' : (progress >= 100 ? 'fa-trash-arrow-up' : 'fa-user-minus')"></i>
              {{ isSuccessfullyDestroyed ? 'ELIMINANDO...' : (isHolding ? 'BORRANDO...' : 'MANTÉN PARA ELIMINAR') }}
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
}

.modal {
  background: white;
  width: 95%;
  max-width: 400px;
  border-radius: 24px;
  padding: 2.5rem 2rem;
  text-align: center;
  box-shadow: 0 30px 70px rgba(0, 0, 0, 0.5);
  border: 1px solid #fecaca;
}

.modal-header {
  margin-bottom: 1.5rem;

  .danger-icon {
    width: 60px;
    height: 60px;
    background: #fef2f2;
    color: #dc2626;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.8rem;
    margin: 0 auto 1.2rem;
  }

  h2 {
    margin: 0;
    color: #991b1b;
    font-size: 1.4rem;
    font-weight: 800;
  }

  .warning-text {
    margin: 0.5rem 0 0;
    color: #64748b;
    font-size: 1rem;
  }
}

.danger-box {
  background: #fff1f2;
  border-radius: 12px;
  padding: 1rem;
  margin-bottom: 2rem;
  text-align: left;
  color: #991b1b;
  font-size: 0.85rem;
  line-height: 1.4;
}

.reassign-options {
  text-align: left;
  margin-bottom: 2rem;

  label {
    display: block;
    font-weight: 700;
    color: $text-dark;
    margin-bottom: 0.75rem;
  }

  .option {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    cursor: pointer;

    input {
      margin: 0;
      cursor: pointer;
    }

    label {
      margin: 0;
      font-weight: 500;
      font-size: 0.95rem;
      cursor: pointer;
    }

    &.disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .rider-select-wrapper {
    margin-top: 0.5rem;
    padding-left: 1.5rem;

    select {
      width: 100%;
      padding: 0.6rem;
      border-radius: 8px;
      border: 1px solid $border-light;
      background: $gray-50;
    }
  }

  .hint {
    font-size: 0.8rem;
    color: $text-light;
    margin-top: 0.5rem;
    font-style: italic;
  }
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.btn-cancel {
  background: $gray-50;
  border: none;
  padding: 1rem;
  border-radius: 14px;
  font-weight: 700;
  cursor: pointer;
  order: 2;
  color: $text-light;
}

.hold-button-wrapper {
  order: 1;
  position: relative;
  height: 60px;
  background: #fee2e2;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid #fecaca;

  .btn-hold-delete {
    width: 100%;
    height: 100%;
    background: transparent;
    border: none;
    position: relative;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #dc2626;
    font-weight: 800;
    z-index: 2;

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
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
  }

  &:active .btn-hold-delete {
    color: white;
  }

  .btn-hold-delete.disabled {
    cursor: not-allowed;
    opacity: 0.7;
  }
}

@keyframes vanish {
  0% {
    transform: scale(1);
    filter: blur(0px);
    opacity: 1;
  }

  100% {
    transform: scale(0.5) translateY(-50px);
    filter: blur(10px);
    opacity: 0;
  }
}
</style>
