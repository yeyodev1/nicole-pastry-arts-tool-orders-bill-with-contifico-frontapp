<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  isOpen: boolean
  isLoading: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm', name: string): void
}>()

const responsibleName = ref('')

const handleConfirm = () => {
  if (!responsibleName.value.trim()) {
    alert('Por favor ingrese el nombre del responsable')
    return
  }
  emit('confirm', responsibleName.value)
}
</script>

<template>
  <Transition name="fade">
    <div v-if="isOpen" class="modal-overlay" @click.self="emit('close')">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Exportar Orden de Producción</h2>
        </div>

        <div class="modal-body">
            <label>Nombre del Responsable:</label>
            <input 
              v-model="responsibleName" 
              type="text" 
              placeholder="Ej: Juan Pérez"
              @keyup.enter="handleConfirm"
              autofocus
            />
        </div>

        <div class="modal-actions">
           <button class="btn-cancel" @click="emit('close')" :disabled="isLoading">Cancelar</button>
           <button class="btn-confirm" @click="handleConfirm" :disabled="isLoading">
              <i v-if="isLoading" class="fas fa-spinner fa-spin"></i>
              {{ isLoading ? 'Exportando...' : 'Exportar' }}
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
  z-index: 9999;
  backdrop-filter: blur(2px);
}

.modal-content {
  background: white;
  padding: 2rem;
  border-radius: 16px;
  width: 90%;
  max-width: 400px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
}

.modal-header h2 {
  margin: 0 0 1.5rem 0;
  color: #2c3e50;
  font-size: 1.25rem;
}

.modal-body {
  margin-bottom: 2rem;

  label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 600;
    color: #34495e;
  }

  input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #bdc3c7;
    border-radius: 8px;
    font-size: 1rem;

    &:focus {
      outline: none;
      border-color: #8e44ad;
      box-shadow: 0 0 0 3px rgba(142, 68, 173, 0.1);
    }
  }
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;

  button {
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: all 0.2s;

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }

  .btn-cancel {
    background: #f1f2f6;
    color: #7f8c8d;

    &:hover:not(:disabled) {
      background: #e1e2e6;
    }
  }

  .btn-confirm {
    background: #8e44ad;
    color: white;
    display: flex;
    align-items: center;
    gap: 0.5rem;

    &:hover:not(:disabled) {
      background: darken(#8e44ad, 10%);
    }
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
