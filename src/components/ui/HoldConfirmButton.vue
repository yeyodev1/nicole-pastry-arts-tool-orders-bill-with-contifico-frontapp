<script setup lang="ts">
import { ref, onUnmounted } from 'vue'

const props = defineProps({
  label: { type: String, default: 'Mantener para Confirmar' },
  holdTime: { type: Number, default: 1200 }, // in ms
  color: { type: String, default: '#7C3AED' }, // NICOLE-PURPLE
  disabled: { type: Boolean, default: false }
})

const emit = defineEmits<{
  (e: 'confirmed'): void
}>()

const progress = ref(0)
const isHolding = ref(false)
let timer: any = null
let animationFrame: any = null
let startTime: number = 0

const startHold = () => {
  if (props.disabled) return
  isHolding.value = true
  progress.value = 0
  startTime = Date.now()

  const updateProgress = () => {
    const elapsed = Date.now() - startTime
    progress.value = Math.min((elapsed / props.holdTime) * 100, 100)

    if (elapsed < props.holdTime) {
      animationFrame = requestAnimationFrame(updateProgress)
    } else {
      progress.value = 100
      complete()
    }
  }

  animationFrame = requestAnimationFrame(updateProgress)
}

const cancelHold = () => {
  isHolding.value = false
  progress.value = 0
  if (animationFrame) cancelAnimationFrame(animationFrame)
  if (timer) clearTimeout(timer)
}

const complete = () => {
  isHolding.value = false
  emit('confirmed')
  // brief delay before resetting progress to show 100%
  setTimeout(() => {
    progress.value = 0
  }, 300)
}

onUnmounted(() => {
  if (animationFrame) cancelAnimationFrame(animationFrame)
  if (timer) clearTimeout(timer)
})
</script>

<template>
  <button 
    class="hold-confirm-btn"
    :class="{ 'holding': isHolding, 'disabled': disabled }"
    @mousedown="startHold"
    @mouseup="cancelHold"
    @mouseleave="cancelHold"
    @touchstart.prevent="startHold"
    @touchend.prevent="cancelHold"
    :disabled="disabled"
  >
    <div class="progress-bar" :style="{ width: progress + '%', backgroundColor: color }"></div>
    <div class="content">
      <slot>
        <i class="fa-solid fa-clock-rotate-left" v-if="isHolding"></i>
        <span>{{ label }}</span>
      </slot>
    </div>
  </button>
</template>

<style lang="scss" scoped>
.hold-confirm-btn {
  position: relative;
  width: 100%;
  padding: 0.85rem;
  border: none;
  border-radius: 10px;
  background: #F1F5F9;
  color: #475569;
  font-weight: 700;
  font-size: 0.95rem;
  cursor: pointer;
  overflow: hidden;
  transition: all 0.2s;
  display: flex;
  justify-content: center;
  align-items: center;
  user-select: none;
  -webkit-tap-highlight-color: transparent;

  &.holding {
    transform: scale(0.98);
    color: white;
    background: #E2E8F0;
  }

  &.disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .progress-bar {
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    width: 0;
    transition: width 0.05s linear;
    z-index: 1;
  }

  .content {
    position: relative;
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    pointer-events: none;
  }
}
</style>
