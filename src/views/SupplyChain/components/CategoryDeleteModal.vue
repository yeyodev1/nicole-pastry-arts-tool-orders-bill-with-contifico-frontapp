<script setup lang="ts">
import { ref, watch, onUnmounted, computed } from 'vue'

const props = defineProps<{
  isOpen: boolean
  categories: { _id: string; name: string }[]
  materials: any[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'delete', payload: { categoryId: string; categoryName: string; targetCategory?: string }): void
}>()

const selectedCategoryId = ref('')
const targetCategory = ref('')

// Initialize or Reset
watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    selectedCategoryId.value = ''
    targetCategory.value = ''
    cancelHold()
    isSuccessfullyDestroyed.value = false
  }
})

// --- Hold Logic (Adapted from OrderDeleteModal) ---
const progress = ref(0)
const isHolding = ref(false)
const isSuccessfullyDestroyed = ref(false)
let animationFrameId: number | null = null
let startTime: number | null = null
const DURATION = 1200 // 1.2 seconds as requested

const selectedCategory = computed(() => props.categories.find(c => c._id === selectedCategoryId.value))

const startHold = () => {
  if (isHolding.value || !selectedCategoryId.value) return
  if (affectedCount.value > 0 && !targetCategory.value) return
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

  setTimeout(() => {
    emit('delete', {
      categoryId: selectedCategoryId.value,
      categoryName: selectedCategory.value?.name ?? '',
      targetCategory: targetCategory.value || undefined
    })
  }, 800)
}

// Helper to count affected items
const affectedCount = computed(() => {
  if (!selectedCategory.value) return 0
  return props.materials.filter(m => m.category === selectedCategory.value!.name).length
})

const canDelete = computed(() => {
  if (!selectedCategoryId.value) return false
  if (affectedCount.value > 0 && !targetCategory.value) return false
  return true
})

const targetOptions = computed(() =>
  props.categories.filter(c => c._id !== selectedCategoryId.value)
)

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
          <i class="fas fa-trash-alt"></i>
        </div>
        <h2>Eliminar Categoría</h2>
        <p class="warning-text">Selecciona una categoría para eliminarla permanentemente.</p>
      </div>

      <div class="modal-body">
        <div class="form-group">
          <label>Categoría a eliminar</label>
          <select v-model="selectedCategoryId" class="styled-select">
            <option value="">-- Seleccionar --</option>
            <option v-for="cat in categories" :key="cat._id" :value="cat._id">{{ cat.name }}</option>
          </select>
        </div>

        <div v-if="selectedCategoryId" class="danger-box">
          <ul>
            <li><i class="fas fa-exclamation-triangle"></i> Se eliminará la categoría <strong>"{{ selectedCategory?.name }}"</strong>.</li>
            <li><i class="fas fa-info-circle"></i> Tiene <strong>{{ affectedCount }}</strong> ítem(s) asignado(s).</li>
            <li><i class="fas fa-undo"></i> Esta acción es irreversible.</li>
          </ul>
        </div>

        <!-- Mandatory reassignment when items exist -->
        <div v-if="affectedCount > 0" class="reassign-block">
          <div class="reassign-alert">
            <i class="fas fa-exclamation-circle"></i>
            <span>Existen ítems asociados. Debe seleccionar una nueva categoría para reasignarlos antes de eliminarla.</span>
          </div>
          <div class="form-group" style="margin-top: 1rem; margin-bottom: 0">
            <label>Reasignar ítems a *</label>
            <select v-model="targetCategory" class="styled-select" :class="{ 'select-required': !targetCategory }">
              <option value="">-- Seleccionar categoría destino --</option>
              <option v-for="cat in targetOptions" :key="cat._id" :value="cat.name">{{ cat.name }}</option>
            </select>
          </div>
        </div>
      </div>

      <div class="actions">
        <button class="btn-cancel" @click="emit('close')">Cancelar</button>

        <div class="hold-button-wrapper danger" :class="{ disabled: !canDelete }">
          <button
            class="btn-hold-delete"
            @mousedown="startHold"
            @mouseleave="cancelHold"
            @mouseup="cancelHold"
            @touchstart.prevent="startHold"
            @touchend.prevent="cancelHold"
            @contextmenu.prevent
            :disabled="!canDelete"
          >
            <div class="progress-bar-danger" :style="{ width: progress + '%' }"></div>
            <span class="label">
              <i class="fas" :class="isSuccessfullyDestroyed ? 'fa-fire' : (progress >= 100 ? 'fa-dumpster-fire' : 'fa-skull-crossbones')"></i>
              {{ isSuccessfullyDestroyed ? 'ELIMINANDO...' : (isHolding ? 'SOLTAR PARA CANCELAR' : 'MANTÉN 1.2s PARA ELIMINAR') }}
            </span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use '@/styles/colorVariables.module' as *;

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(4px);
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.3s ease;
}

.modal {
  background: white;
  width: 95%; // Responsive width
  max-width: 450px;
  border-radius: 24px;
  padding: 2rem;
  text-align: center;
  box-shadow: 0 30px 70px rgba(0, 0, 0, 0.5);
  border: 2px solid #fee2e2;
  transition: transform 0.05s linear;
}

.modal-header {
  margin-bottom: 1.5rem;

  .danger-icon {
    width: 60px;
    height: 60px;
    background: #fef2f2;
    color: $error;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.8rem;
    margin: 0 auto 1rem;
    border: 2px solid #fecaca;
    animation: pulse 2s infinite;
  }

  h2 {
    margin: 0;
    color: #991b1b;
    font-size: 1.5rem;
    font-weight: 800;
  }

  .warning-text {
    color: $text-light;
    font-size: 0.95rem;
    margin-top: 0.5rem;
  }
}

.form-group {
  text-align: left;
  margin-bottom: 1.5rem;

  label {
    font-weight: 600;
    margin-bottom: 0.5rem;
    display: block;
    color: $text-dark;
  }
}

.styled-select {
  width: 100%;
  padding: 0.8rem;
  border: 1px solid $border-light;
  border-radius: 8px;
  font-size: 1rem;

  &.select-required {
    border-color: #fca5a5;
    background: #fef2f2;
  }
}

.reassign-block {
  background: #fff7ed;
  border: 1.5px solid #fed7aa;
  border-radius: 12px;
  padding: 1rem;
  margin-bottom: 1.5rem;

  .reassign-alert {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    font-size: 0.85rem;
    color: #9a3412;
    font-weight: 600;

    i { color: #ea580c; flex-shrink: 0; margin-top: 2px; }
  }
}

.danger-box {
  background: #fff1f2;
  border: 1px dashed #fecaca;
  border-radius: 12px;
  padding: 1rem;
  margin-bottom: 2rem;
  text-align: left;

  ul {
    list-style: none;
    padding: 0;
    margin: 0;

    li {
      color: #991b1b;
      font-size: 0.85rem;
      margin-bottom: 0.5rem;
      display: flex;
      gap: 0.5rem;
      align-items: flex-start;

      i {
        margin-top: 2px;
      }
    }
  }
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.btn-cancel {
  background: $gray-100;
  border: none;
  color: $text-dark;
  padding: 0.8rem;
  border-radius: 12px;
  font-weight: 600;
  cursor: pointer;
  order: 2;

  &:hover {
    background: $gray-200;
  }
}

.hold-button-wrapper {
  order: 1;
  position: relative;
  width: 100%;
  height: 56px;
  background: #fee2e2;
  border-radius: 12px;
  overflow: hidden;
  border: 2px solid #fecaca;
  cursor: pointer;
  user-select: none;

  &.disabled {
    opacity: 0.5;
    cursor: not-allowed;
    filter: grayscale(1);
  }

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
    color: $error;
    font-weight: 800;
    font-size: 1rem;
    z-index: 2;
    overflow: hidden;
    outline: none;

    .progress-bar-danger {
      position: absolute;
      top: 0;
      left: 0;
      bottom: 0;
      background: $error;
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
}

@keyframes pulse {
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba($error, 0.4);
  }

  70% {
    transform: scale(1.05);
    box-shadow: 0 0 0 10px rgba($error, 0);
  }

  100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba($error, 0);
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
    transform: scale(1);
    filter: blur(0);
    opacity: 1;
  }

  100% {
    transform: scale(0.2) translateY(-50px);
    filter: blur(10px);
    opacity: 0;
  }
}
</style>
