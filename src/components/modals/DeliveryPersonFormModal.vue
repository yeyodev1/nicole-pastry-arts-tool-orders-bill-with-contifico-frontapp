<script setup lang="ts">
import { ref, watch } from 'vue'
import type { DeliveryPerson } from '@/services/delivery.service'

const props = defineProps<{
  isOpen: boolean
  person?: DeliveryPerson
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', person: Partial<DeliveryPerson>): void
}>()

const form = ref<Partial<DeliveryPerson>>({
  name: '',
  identification: '',
  phone: ''
})

const loading = ref(false)

watch(() => props.isOpen, (val) => {
  if (val) {
    if (props.person) {
      form.value = { ...props.person }
    } else {
      form.value = { name: '', identification: '', phone: '' }
    }
  }
})

const submit = async () => {
  if (!form.value.name || !form.value.identification) return
  loading.value = true
  try {
    emit('save', { ...form.value })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <transition name="person-form-modal">
      <div v-if="isOpen" class="modal-overlay" @click.self="emit('close')">
        <div class="modal">
          <header class="modal-header">
            <h2>{{ person ? 'Editar Transporte' : 'Nuevo Transporte' }}</h2>
            <button class="btn-close" @click="emit('close')"><i class="fa-solid fa-xmark"></i></button>
          </header>

          <form @submit.prevent="submit" class="modal-form">
            <div class="form-body">
              <div class="form-group">
                <label class="required">Nombre / Empresa</label>
                <input v-model="form.name" placeholder="Ej: Juan Pérez o Servientrega" required />
              </div>

              <div class="form-group">
                <label class="required">Identificación / RUC</label>
                <input v-model="form.identification" placeholder="09xxxxxxx" required />
              </div>

              <div class="form-group">
                <label>Teléfono (Opcional)</label>
                <input v-model="form.phone" placeholder="099xxxxxxx" />
              </div>
            </div>

            <div class="modal-actions">
              <button type="button" class="btn-secondary" @click="emit('close')">Cancelar</button>
              <button type="submit" class="btn-primary" :disabled="loading">
                {{ person ? 'Guardar Cambios' : 'Registrar' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<style lang="scss" scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(6px);
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;

  @media (min-width: 640px) {
    padding: 1.5rem;
  }
}

.modal {
  background: white;
  width: 100%;
  height: 100dvh; // Mobile: full screen
  max-height: 100dvh;
  border-radius: 0;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;

  @media (min-width: 640px) {
    height: auto;
    max-height: 90vh;
    max-width: 450px;
    border-radius: 20px;
  }
}

/* --- Transición de apertura/cierre --- */
.person-form-modal-enter-active {
  transition: opacity 0.3s ease;

  .modal {
    transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  }
}

.person-form-modal-leave-active {
  transition: opacity 0.2s ease;

  .modal {
    transition: transform 0.2s ease, opacity 0.2s ease;
  }
}

.person-form-modal-enter-from,
.person-form-modal-leave-to {
  opacity: 0;

  .modal {
    transform: translateY(24px) scale(0.96);
    opacity: 0;
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
  padding: 2rem 2rem 1rem;

  h2 {
    margin: 0;
    color: $text-dark;
    font-size: 1.4rem;
    font-weight: 700;
  }

  .btn-close {
    background: transparent;
    border: none;
    font-size: 1.2rem;
    color: $text-light;
    cursor: pointer;
  }
}

.modal-form {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

.form-body {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 1rem 2rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  label {
    font-size: 0.9rem;
    font-weight: 600;
    color: $text-dark;

    &.required::after {
      content: " *";
      color: $error;
    }
  }

  input {
    padding: 0.85rem;
    border: 1px solid $border-light;
    border-radius: 10px;
    background: $gray-50;
    font-size: 1rem;

    &:focus {
      outline: none;
      border-color: $NICOLE-PURPLE;
      background: white;
    }
  }
}

.modal-actions {
  display: flex;
  gap: 1rem;
  flex-shrink: 0;
  padding: 1rem 2rem 2rem;

  button {
    flex: 1;
    padding: 1rem;
    border-radius: 12px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-secondary {
    background: $gray-50;
    border: none;
    color: $text-light;

    &:hover {
      background: $gray-100;
    }
  }

  .btn-primary {
    background: $NICOLE-PURPLE;
    border: none;
    color: white;

    &:hover {
      background: $purple-hover;
    }

    &:disabled {
      opacity: 0.7;
    }
  }
}
</style>
