<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from '@/composables/useToast'

const props = defineProps<{
  isOpen: boolean
  message: string
  orderId?: string | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'send'): void
}>()

const router = useRouter()
const { success } = useToast()

const handleCopy = async () => {
  try {
    await navigator.clipboard.writeText(props.message)
    success('Mensaje copiado al portapapeles')
  } catch (err) {
    console.error('Failed to copy text: ', err)
  }
}

const goToOrderDetails = () => {
  if (props.orderId) {
    router.push(`/orders/${props.orderId}`)
  }
}

const handleSend = () => {
  emit('send')
}
</script>

<template>
  <Teleport to="body">
    <transition name="modal-bounce">
      <div v-if="isOpen" class="modal-overlay" @click.self="emit('close')">
        <div class="modal whatsapp-theme">
          
          <!-- WA Header -->
          <div class="wa-header">
            <div class="wa-profile">
                <div class="wa-avatar">
                  <i class="fa-brands fa-whatsapp"></i>
                </div>
                <div class="wa-info">
                  <h3>Pedido Creado con Éxito</h3>
                  <span>Listo para enviar</span>
                </div>
            </div>
            <button @click="emit('close')" class="close-btn" title="Cerrar">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <!-- WA Body -->
          <div class="wa-body">
            <div class="success-banner">
                <i class="fa-solid fa-circle-check"></i>
                <p>¡El pedido #{{ orderId?.slice(-6) || 'Nuevo' }} se ha guardado correctamente!</p>
            </div>

            <div class="date-divider">
                <span>Mensaje Generado</span>
            </div>
            
            <div class="message-bubble sent">
                <pre>{{ message }}</pre>
                <div class="msg-meta">
                  <span>{{ new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}</span>
                  <i class="fa-solid fa-check-double"></i>
                </div>
            </div>
          </div>

          <!-- WA Footer Actions -->
          <div class="wa-footer">
              <button @click="handleSend" class="btn-send-wa">
                Enviar por WhatsApp <i class="fa-brands fa-whatsapp"></i>
              </button>
              
              <button v-if="orderId" class="btn-view-order" @click="goToOrderDetails">
                <i class="fa-solid fa-eye"></i> Ver Pedido
              </button>

              <button class="btn-copy-order" @click="handleCopy">
                <i class="fa-regular fa-copy"></i> Copiar Texto
              </button>
              
              <button @click="emit('close')" class="btn-secondary">
                Cerrar y Crear Otro
              </button>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<style lang="scss" scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal.whatsapp-theme {
  background: #E5DDD5;
  width: 95%;
  max-width: 480px;
  border-radius: 20px;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: auto;
  max-height: 85vh;
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* Header */
.wa-header {
  background: #008069;
  color: white;
  padding: 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  z-index: 10;

  .wa-profile {
    display: flex;
    align-items: center;
    gap: 0.8rem;

    .wa-avatar {
      width: 42px;
      height: 42px;
      background: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #008069;
      font-size: 1.5rem;
    }

    .wa-info {
      display: flex;
      flex-direction: column;

      h3 {
        margin: 0;
        font-size: 1.05rem;
        font-weight: 600;
      }

      span {
        font-size: 0.8rem;
        opacity: 0.85;
      }
    }
  }

  .close-btn {
    background: none;
    border: none;
    color: white;
    font-size: 1.4rem;
    cursor: pointer;
    padding: 0.5rem;

    &:hover {
      opacity: 0.8;
    }
  }
}

/* Body */
.wa-body {
  flex: 1;
  padding: 1rem;
  overflow-y: auto;
  position: relative;
  background-image: url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png');
  background-blend-mode: overlay;
  background-color: #E5DDD5;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 3px;
  }

  .success-banner {
    background: #dcf8c6;
    border: 1px solid #c8e6c9;
    color: #2e7d32;
    padding: 0.75rem;
    border-radius: 8px;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);

    i {
      font-size: 1.25rem;
    }

    p {
      margin: 0;
      font-weight: 600;
      font-size: 0.95rem;
    }
  }

  .date-divider {
    text-align: center;
    margin-bottom: 1rem;

    span {
      background: #e1f5fe;
      color: #0277bd;
      padding: 0.3rem 0.8rem;
      border-radius: 8px;
      font-size: 0.75rem;
      font-weight: 600;
      box-shadow: 0 1px 1px rgba(0, 0, 0, 0.1);
      text-transform: uppercase;
    }
  }

  .message-bubble {
    background: white;
    padding: 0.8rem 1rem;
    border-radius: 8px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    max-width: 95%;
    margin: 0 auto 1.5rem auto;
    position: relative;
    font-size: 0.9rem;
    color: #111;
    line-height: 1.5;

    &.sent {
      border-top-left-radius: 0; // Look like a received message actually for preview
      // Or if we want it to look like user is sending:
      // background: #dcf8c6; margin-left: auto; border-top-right-radius: 0;
      // Let's keep white as "Draft"
    }

    pre {
      white-space: pre-wrap;
      font-family: inherit;
      margin: 0;
      padding-bottom: 0.5rem;
    }

    .msg-meta {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 0.3rem;
      font-size: 0.7rem;
      color: rgba(0, 0, 0, 0.45);

      i {
        color: #34B7F1;
      }
    }
  }

  .action-buttons {
    display: flex;
    gap: 0.5rem;
    justify-content: center;
    margin-top: 1rem;
    flex-wrap: wrap;

    button {
      padding: 0.6rem 1rem;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      font-size: 0.9rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      transition: all 0.2s;
      border: 1px solid transparent;

      &.btn-copy {
        background: white;
        border-color: #ddd;
        color: #555;

        &:hover {
          background: #f5f5f5;
          color: #333;
        }
      }

      &.btn-details {
        background: white;
        border-color: #ddd;
        color: $NICOLE-PURPLE;

        &:hover {
          background: #fdf2f8;
          border-color: $NICOLE-PURPLE;
        }
      }
    }
  }
}

/* Footer */
.wa-footer {
  background: #f0f0f0;
  padding: 1rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  border-top: 1px solid #ddd;

  .btn-send-wa {
    width: 100%;
    padding: 0.9rem;
    background: #008069;
    color: white;
    border: none;
    border-radius: 25px;
    font-weight: 700;
    font-size: 1.05rem;
    cursor: pointer;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
    transition: transform 0.1s, background 0.2s;

    &:hover {
      background: #006c59;
    }

    &:active {
      transform: scale(0.98);
    }
  }

  .btn-view-order {
    width: 100%;
    padding: 0.9rem;
    background: white; // Or slightly grey
    color: $NICOLE-PURPLE;
    border: 2px solid $NICOLE-PURPLE;
    border-radius: 25px;
    font-weight: 700;
    font-size: 1.05rem;
    cursor: pointer;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1); // bit softer
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
    transition: transform 0.1s, background 0.2s, color 0.2s;

    &:hover {
      background: rgba($NICOLE-PURPLE, 0.05);
    }

    &:active {
      transform: scale(0.98);
    }

    i {
      font-size: 1rem;
    }
  }

  .btn-copy-order {
    width: 100%;
    padding: 0.9rem;
    background: white;
    color: #555;
    border: 2px solid #ddd;
    border-radius: 25px;
    font-weight: 700;
    font-size: 1.05rem;
    cursor: pointer;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
    transition: all 0.2s;

    &:hover {
      background: #f5f5f5;
      border-color: #ccc;
      color: #333;
    }

    &:active {
      transform: scale(0.98);
    }

    i {
      font-size: 1rem;
    }
  }

  .btn-secondary {
    background: transparent;
    border: none;
    color: #666;
    font-weight: 600;
    cursor: pointer;
    padding: 0.5rem;
    font-size: 0.95rem;

    &:hover {
      color: #333;
      text-decoration: underline;
    }
  }
}

// Premium Modal Transition
.modal-bounce-enter-active {
  transition: all 0.4s ease-out;

  .modal.whatsapp-theme {
    transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
}

.modal-bounce-leave-active {
  transition: all 0.3s ease-in;

  .modal.whatsapp-theme {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
}

.modal-bounce-enter-from {
  opacity: 0;
  backdrop-filter: blur(0);

  .modal.whatsapp-theme {
    transform: translateY(30px) scale(0.9);
    opacity: 0;
  }
}

.modal-bounce-leave-to {
  opacity: 0;
  backdrop-filter: blur(0);

  .modal.whatsapp-theme {
    transform: translateY(20px) scale(0.95);
    opacity: 0;
  }
}
</style>
