<script setup lang="ts">
const props = defineProps<{
  isOpen: boolean
  message: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'send'): void
}>()
</script>

<template>
  <div v-if="isOpen" class="modal-overlay">
    <div class="modal">
      <h2>Resumen de Pedido</h2>
      <p>El resumen ha sido copiado al portapapeles. Puedes enviarlo directamente:</p>
      <textarea readonly :value="message" rows="10"></textarea>
      <div class="modal-actions">
        <button @click="emit('close')" class="btn-secondary">Cerrar</button>
        <button @click="emit('send')" class="btn-whatsapp">Enviar WhatsApp</button>
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
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal {
  background: white;
  width: 90%;
  max-width: 500px;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2);

  h2 {
    color: $success;
    margin-top: 0;
  }

  textarea {
    width: 100%;
    margin: 1rem 0;
    padding: 1rem;
    border: 1px solid $border-light;
    border-radius: 8px;
    background: $gray-50;
    font-family: monospace;
    resize: none;
  }

  .modal-actions {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;

    button {
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      border: none;
    }

    .btn-secondary {
      background: $gray-200;
      color: $text-dark;

      &:hover {
        background: $gray-300;
      }
    }

    .btn-whatsapp {
      background: #25D366;
      color: white;

      &:hover {
        background: #128C7E;
      }
    }
  }
}
</style>
