<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true
  },
  isLoading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'confirm'])

const selectedIsland = ref('San Marino')

const ISLANDS = ['San Marino', 'Mall del Sol', 'Centro de Producción']

const handleConfirm = () => {
  if (!selectedIsland.value) return
  emit('confirm', selectedIsland.value)
}
</script>

<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h3>Facturado en Isla</h3>
        <button @click="$emit('close')" class="close-btn" :disabled="isLoading">&times;</button>
      </div>

      <div class="modal-body">
        <p class="instruction">Selecciona la isla donde se realizó la facturación física de este pedido:</p>
        
        <div class="islands-list">
          <label 
            v-for="island in ISLANDS" 
            :key="island" 
            class="island-option" 
            :class="{ active: selectedIsland === island }"
          >
            <input 
              type="radio" 
              v-model="selectedIsland" 
              :value="island" 
              :disabled="isLoading"
            />
            <span>{{ island }}</span>
          </label>
        </div>

        <div class="warning-box">
          <i class="fa-solid fa-circle-info"></i>
          <span>Esto marcará el pedido como pagado solo en este sistema. No afecta a Contífico.</span>
        </div>
      </div>

      <div class="modal-footer">
        <button @click="$emit('close')" class="btn-cancel" :disabled="isLoading">Cancelar</button>
        <button 
          @click="handleConfirm" 
          class="btn-confirm" 
          :disabled="!selectedIsland || isLoading"
        >
          <i v-if="isLoading" class="fas fa-spinner fa-spin"></i>
          {{ isLoading ? 'Procesando...' : 'Confirmar Registro' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
}

.modal-content {
  background: white;
  padding: 1.75rem;
  border-radius: 24px;
  width: 90%;
  max-width: 400px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
  animation: modalAppear 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes modalAppear {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(10px);
  }

  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;

  h3 {
    margin: 0;
    font-size: 1.4rem;
    color: $NICOLE-SECONDARY;
    font-weight: 700;
    font-family: $font-principal;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.75rem;
    cursor: pointer;
    color: $text-light;
    line-height: 1;

    &:hover {
      color: $text-dark;
    }
  }
}

.instruction {
  margin-bottom: 1.5rem;
  color: $text-light;
  font-size: 0.95rem;
  line-height: 1.5;
}

.islands-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.island-option {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.15rem;
  border: 2px solid $border-light;
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 700;
  color: $text-dark;

  &:hover {
    border-color: rgba($NICOLE-PURPLE, 0.3);
    background: rgba($NICOLE-PURPLE, 0.02);
  }

  &.active {
    border-color: $NICOLE-PURPLE;
    background: rgba($NICOLE-PURPLE, 0.04);
    color: $NICOLE-PURPLE;
    box-shadow: 0 4px 12px rgba($NICOLE-PURPLE, 0.1);
  }

  input {
    width: 1.25rem;
    height: 1.25rem;
    accent-color: $NICOLE-PURPLE;
  }
}

.warning-box {
  display: flex;
  gap: 0.75rem;
  padding: 1rem;
  background: #f8fafc;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  color: #64748b;
  font-size: 0.85rem;
  line-height: 1.4;

  i {
    color: #94a3b8;
    font-size: 1rem;
    margin-top: 2px;
  }
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 2.25rem;

  button {
    padding: 0.85rem 1.75rem;
    border-radius: 14px;
    border: none;
    cursor: pointer;
    font-weight: 700;
    font-size: 0.95rem;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .btn-cancel {
    background: $gray-100;
    color: $text-light;

    &:hover {
      background: $gray-200;
      color: $text-dark;
    }
  }

  .btn-confirm {
    background: $NICOLE-PURPLE;
    color: white;
    box-shadow: 0 4px 12px rgba($NICOLE-PURPLE, 0.25);

    &:hover {
      background: darken-color($NICOLE-PURPLE, 10%);
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba($NICOLE-PURPLE, 0.3);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }
  }
}
</style>
