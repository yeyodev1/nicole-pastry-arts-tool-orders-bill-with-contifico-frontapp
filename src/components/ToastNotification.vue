<script setup lang="ts">
import { ref, watch } from 'vue'

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
    }, 2500) // Close after 2.5s
  }
})
</script>

<template>
  <transition name="toast-fade">
    <div v-if="show" class="toast-notification" :class="type || 'success'">
      <i v-if="type === 'error'" class="fa-solid fa-circle-exclamation"></i>
      <i v-else class="fa-solid fa-circle-check"></i>
      <span>{{ message }}</span>
    </div>
  </transition>
</template>

<style lang="scss" scoped>
.toast-notification {
  /* Position handling moved to container */
  background: white;
  padding: 1rem 1.5rem;
  border-radius: 8px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
  display: flex;
  align-items: center;
  gap: 0.75rem;
  border-left: 4px solid;
  font-weight: 500;
  color: $text-dark;
  width: auto;
  min-width: 300px;
  max-width: 100%;
  font-weight: 500;
  color: $text-dark;

  &.success {
    border-left-color: $success;

    i {
      color: $success;
    }
  }

  &.error {
    border-left-color: $error;

    i {
      color: $error;
    }
  }

  &.info {
    border-left-color: $NICOLE-PURPLE;

    i {
      color: $NICOLE-PURPLE;
    }
  }
}

// Transitions
.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: all 0.3s ease;
}

.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
  transform: translateY(20px);
}
</style>
