<script setup lang="ts">
import { ref } from 'vue'
import type { OrderFormData } from '@/types/order'
import OrderForm from './OrderForm.vue'

const props = defineProps<{
  isOpen: boolean
  modelValue: OrderFormData
  isSubmitting?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'update:modelValue', value: OrderFormData): void
  (e: 'proceed'): void
}>()

</script>

<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <div class="header-left">
           <i class="fa-solid fa-clipboard-check"></i>
           <h2>Finalizar Pedido</h2>
        </div>
        <button class="btn-close" @click="emit('close')" title="Cerrar">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      
      <div class="modal-body">
        <OrderForm 
          :model-value="modelValue" 
          @update:model-value="emit('update:modelValue', $event)" 
        />
      </div>

      <div class="modal-footer">
        <button class="btn-cancel" @click="emit('close')">Volver</button>
        <button class="btn-proceed" @click="emit('proceed')" :disabled="isSubmitting">
          {{ isSubmitting ? 'Procesando...' : 'Revisar y Confirmar' }}
          <i class="fa-solid fa-arrow-right"></i>
        </button>
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
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  z-index: 1000;
  display: flex;
  justify-content: flex-end; // Drawer style? Or centered? User said Modal. Let's do Centered large modal or Drawer. 
  // "Modal/Drawer" was mentioned. A Drawer/Sidebar from right might be better for a long form.
  // Let's do a Slide-over from right (Drawer) style for "Minimalist" feel.

  // Actually, let's stick to a large centered modal to be safe, or drawer. 
  // Drawer is better for forms.
  align-items: stretch;
}

.modal-content {
  background: #f8fafc;
  width: 100%;
  max-width: 600px;
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  box-shadow: -5px 0 30px rgba(0, 0, 0, 0.1);
  animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.modal-header {
  padding: 1.5rem;
  background: white;
  border-bottom: 1px solid $border-light;
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: sticky;
  top: 0;
  z-index: 10;

  h2 {
    margin: 0;
    font-size: 1.5rem;
    color: $NICOLE-PURPLE;
    font-family: $font-principal;
  }

  .btn-close {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: $text-light;
    cursor: pointer;
    transition: color 0.2s;

    &:hover {
      color: $text-dark;
    }
  }
}

.modal-body {
  flex: 1;
  padding: 1.5rem;
  overflow-y: auto;
}

.modal-footer {
  padding: 1.5rem 2rem;
  background: white;
  border-top: 1px solid $border-light;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.02); // Subtle shadow for footer

  .btn-cancel {
    background: white;
    border: 2px solid $border-light; // Thicker border
    color: $text-light;
    font-weight: 700;
    padding: 0.8rem 1.75rem;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 1rem;

    &:hover {
      border-color: $gray-300;
      color: $text-dark;
      background: $gray-50;
    }
  }

  .btn-proceed {
    background: $NICOLE-PURPLE;
    color: white;
    border: none;
    padding: 1rem 2.5rem; // Wider
    border-radius: 10px;
    font-weight: 700;
    font-size: 1.1rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    transition: all 0.2s;
    box-shadow: 0 4px 12px rgba($NICOLE-PURPLE, 0.25);

    i {
      transition: transform 0.2s;
    }

    &:hover:not(:disabled) {
      background: lighten-color($NICOLE-PURPLE, 5%);
      transform: translateY(-2px);
      box-shadow: 0 8px 15px rgba($NICOLE-PURPLE, 0.35);

      i {
        transform: translateX(3px);
      }
    }

    &:disabled {
      background: $gray-400;
      cursor: not-allowed;
      box-shadow: none;
    }
  }
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
  }

  to {
    transform: translateX(0);
  }
}

// Media query for mobile
@media (max-width: 768px) {
  .modal-content {
    max-width: 100%;
  }
}
</style>
