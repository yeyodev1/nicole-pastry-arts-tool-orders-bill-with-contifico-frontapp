<script setup lang="ts">
import { ref, onUnmounted } from 'vue'

const props = defineProps({
  duration: {
    type: Number,
    default: 1500
  },
  disabled: {
    type: Boolean,
    default: false
  },
  label: {
    type: String,
    default: 'HOLD TO CONFIRM'
  },
  color: {
    type: String,
    default: '#2ecc71' // Default success color
  }
})

const emit = defineEmits(['trigger'])

const isHolding = ref(false)
const progress = ref(0)
let startTime: number | null = null
let animationFrame: number | null = null

const startHold = (e: Event) => {
  if (props.disabled) return
  // Prevent default to avoid text selection or weird touch behaviors
  if (e.type === 'touchstart') {
    // e.preventDefault() // Might block scrolling if not careful, but for a drilled button usually okay? 
    // Actually, better not preventDefault globally on touchstart unless necessary.
  }

  isHolding.value = true
  startTime = performance.now()
  progress.value = 0

  loop()
}

const endHold = () => {
  if (!isHolding.value) return

  isHolding.value = false
  startTime = null
  progress.value = 0

  if (animationFrame) {
    cancelAnimationFrame(animationFrame)
  }
}

const loop = () => {
  if (!isHolding.value || !startTime) return

  const elapsed = performance.now() - startTime
  const p = Math.min(elapsed / props.duration, 1)
  progress.value = p * 100

  if (p >= 1) {
    emit('trigger')
    endHold()
  } else {
    animationFrame = requestAnimationFrame(loop)
  }
}

onUnmounted(() => {
  if (animationFrame) cancelAnimationFrame(animationFrame)
})
</script>

<template>
  <button 
    class="action-hold-btn"
    :class="{ disabled }"
    :disabled="disabled"
    @mousedown="startHold"
    @mouseup="endHold"
    @mouseleave="endHold"
    @touchstart.passive="startHold"
    @touchend="endHold"
    @touchcancel="endHold"
    @touchmove="endHold"
    @contextmenu.prevent
  >
    <div class="bg-fill" :style="{ width: `${progress}%`, background: color }"></div>
    <span class="label-text">
        <slot>{{ label }}</slot>
    </span>
  </button>
</template>

<style lang="scss" scoped>
.action-hold-btn {
  position: relative;
  overflow: hidden;
  border: none;
  background: #ecf0f1;
  color: #7f8c8d;
  font-weight: 700;
  border-radius: 8px;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  transition: all 0.2s;
  min-height: 40px;
  padding: 0 1rem;
  display: flex;
  align-items: center;
  justify-content: center;

  &.disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .bg-fill {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    width: 0%;
    opacity: 0.3;
    pointer-events: none;
    transition: width 0.1s linear; // Slight smooth, mostly driven by JS frame
  }

  .label-text {
    position: relative;
    z-index: 1;
    text-transform: uppercase;
    font-size: 0.75rem;
    letter-spacing: 0.5px;
  }

  &:active:not(.disabled) {
    transform: scale(0.98);
  }
}
</style>
