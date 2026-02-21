<script setup lang="ts">
import { useToast } from '@/composables/useToast'
import ToastNotification from './ToastNotification.vue'

const { toasts, remove } = useToast()
</script>

<template>
  <div class="toast-container">
    <TransitionGroup name="toast">
      <ToastNotification
        v-for="toast in toasts"
        :key="toast.id"
        :message="toast.message"
        :type="toast.type"
        @close="remove(toast.id)"
      />
    </TransitionGroup>
  </div>
</template>

<style lang="scss" scoped>
.toast-container {
  position: fixed;
  top: 2rem;
  right: 2rem;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  pointer-events: none;
  align-items: flex-end;
}

/* Toast Transitions */
.toast-enter-active {
  transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.toast-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: absolute; // To allow other items to move up immediately
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100%) scale(0.8);
  filter: blur(4px);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(40px) scale(0.9);
  filter: blur(4px);
}

/* Ensure underlying items slide up smoothly when one is removed */
.toast-move {
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@media (max-width: 768px) {
  .toast-container {
    top: 1rem;
    right: 1rem;
    left: 1rem;
    align-items: center;
  }
}
</style>
