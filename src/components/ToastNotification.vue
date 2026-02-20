<script setup lang="ts">
import { watch } from 'vue'

const props = defineProps<{
  show: boolean
  message: string
  type?: 'success' | 'error' | 'info'
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

// Auto-close logic
watch(() => props.show, (newVal) => {
  if (newVal) {
    setTimeout(() => {
      emit('close')
    }, 3000)
  }
})
</script>

<template>
  <Teleport to="body">
      <transition name="toast-slide">
        <div v-if="show" class="toast-wrapper">
            <div class="toast-notification" :class="type || 'success'">
            <div class="icon-box">
                <i v-if="type === 'error'" class="fa-solid fa-xmark"></i>
                <i v-else-if="type === 'info'" class="fa-solid fa-info"></i>
                <i v-else class="fa-solid fa-check"></i>
            </div>
            <div class="content">
                <span class="message" v-html="message"></span>
            </div>
            <button class="close-btn" @click="$emit('close')">&times;</button>
            </div>
        </div>
      </transition>
  </Teleport>
</template>

<style lang="scss" scoped>
.toast-wrapper {
  position: fixed;
  top: 2rem;
  right: 2rem;
  z-index: 9999;
  pointer-events: none; // Allow clicks through wrapper area
}

.toast-notification {
  pointer-events: auto;
  background: white;
  padding: 0.85rem 1.25rem;
  border-radius: 12px;
  box-shadow:
    0 10px 15px -3px rgba(0, 0, 0, 0.1),
    0 4px 6px -2px rgba(0, 0, 0, 0.05);
  display: flex;
  align-items: center; // Vertically center content
  gap: 1rem;
  min-width: 300px;
  max-width: 400px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.8);

  // Minimalist Icon Box
  .icon-box {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;

    i {
      font-size: 0.9rem;
    }
  }

  .content {
    color: #1e293b;
    font-size: 0.95rem;
    font-weight: 500;
    line-height: 1.4;
    flex: 1; // Make content take up available space
  }

  .close-btn {
    background: none;
    border: none;
    color: #94a3b8;
    font-size: 1.5rem;
    line-height: 1;
    cursor: pointer;
    padding: 0;
    margin-left: -0.5rem; // Adjust slightly
    transition: color 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover {
      color: #475569;
    }
  }

  // Variants
  &.success {
    .icon-box {
      background: #dcfce7;
      color: #16a34a;
    }

    border-left: 4px solid #16a34a;
  }

  &.error {
    .icon-box {
      background: #fee2e2;
      color: #dc2626;
    }

    border-left: 4px solid #dc2626;
  }

  &.info {
    .icon-box {
      background: #e0f2fe;
      color: #0284c7;
    }

    border-left: 4px solid #0284c7;
  }
}

// Elegant Slide Transition
.toast-slide-enter-active,
.toast-slide-leave-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.toast-slide-enter-from {
  opacity: 0;
  transform: translateX(20px) scale(0.95);
}

.toast-slide-leave-to {
  opacity: 0;
  transform: translateY(-20px) scale(0.95);
}
</style>
