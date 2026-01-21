<script setup lang="ts">
defineProps<{
  isOpen: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  isDangerous?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm'): void
}>()
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
            class="btn-confirm" 
            :class="{ dangerous: isDangerous }"
            @click="emit('confirm')"
          >
            {{ confirmText || 'Confirmar' }}
          </button>
        </div>
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
