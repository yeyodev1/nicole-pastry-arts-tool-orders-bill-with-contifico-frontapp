<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const props = defineProps<{
  isOpen: boolean
  dispatch: any
  orderId: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm', payload: any): void
}>()

const receivedBy = ref('')
const receptionNotes = ref('')
const itemsState = ref<any[]>([])

// Initialize items state when dispatch changes or modal opens
watch(() => props.dispatch, (newVal) => {
  if (newVal && newVal.items) {
    itemsState.value = newVal.items.map((item: any) => ({
      productId: item.productId,
      name: item.name,
      quantitySent: item.quantitySent,
      quantityReceived: item.quantityReceived ?? item.quantitySent, // Default to sent amount
      itemStatus: item.itemStatus ?? 'OK'
    }))

    // Reset other fields
    receptionNotes.value = newVal.receptionNotes || ''
    receivedBy.value = newVal.receivedBy || '' // Could pre-fill with logged user name via store
  }
}, { immediate: true })

const handleSubmit = () => {
  emit('confirm', {
    orderId: props.orderId,
    dispatchId: props.dispatch._id,
    data: {
      receivedBy: receivedBy.value || 'Encargado de Tienda',
      receptionNotes: receptionNotes.value,
      items: itemsState.value.map(i => ({
        productId: i.productId,
        quantityReceived: Number(i.quantityReceived),
        itemStatus: i.itemStatus
      }))
    }
  })
}
</script>

<template>
  <Transition name="fade">
    <div v-if="isOpen" class="modal-overlay" @click.self="emit('close')">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Confirmar Recepción</h3>
          <button class="close-btn" @click="emit('close')">&times;</button>
        </div>

        <div class="modal-body">
          <div class="info-row">
            <div class="info-group">
                <label><i class="fa-solid fa-location-dot"></i> Destino</label>
                <span>{{ dispatch.destination }}</span>
            </div>
            <div class="info-group">
                <label><i class="fa-solid fa-calendar"></i> Enviado el</label>
                <span>{{ new Date(dispatch.reportedAt).toLocaleString() }}</span>
            </div>
          </div>

          <div class="items-list">
            <div class="list-header">
                <h3><i class="fa-solid fa-clipboard-list"></i> Lista de Productos</h3>
                <p>Verifique las cantidades recibidas físicamente.</p>
            </div>
            
            <div class="items-table-header">
                <span class="col-prod">Producto</span>
                <span class="col-sent text-center">Enviado</span>
                <span class="col-recv text-center">Recibido</span>
                <span class="col-status">Estado</span>
            </div>

            <div v-for="item in itemsState" :key="item.productId" class="item-row" :class="{ 'has-issue': item.itemStatus !== 'OK' || item.quantityReceived !== item.quantitySent }">
                <div class="col-prod name">
                    {{ item.name }}
                </div>
                <div class="col-sent qty-display">
                    {{ item.quantitySent }}
                </div>
                <div class="col-recv">
                    <input 
                        type="number" 
                        v-model="item.quantityReceived" 
                        min="0" 
                        class="qty-input"
                        :class="{ 'diff': item.quantityReceived !== item.quantitySent }"
                    >
                </div>
                <div class="col-status">
                    <select v-model="item.itemStatus" :class="item.itemStatus">
                        <option value="OK">OK</option>
                        <option value="MISSING">Faltante</option>
                        <option value="DAMAGED">Dañado</option>
                    </select>
                </div>
            </div>
          </div>

          <div class="form-section">
            <div class="form-group">
                <label><i class="fa-solid fa-user-pen"></i> Recibido Por</label>
                <input type="text" v-model="receivedBy" placeholder="Tu nombre" class="input-lg">
            </div>

            <div class="form-group">
                <label><i class="fa-solid fa-comment-dots"></i> Observaciones</label>
                <textarea v-model="receptionNotes" placeholder="Alguna novedad general con el envío..."></textarea>
            </div>
          </div>
        </div>

        <div class="modal-actions">
          <button class="btn-cancel" @click="emit('close')">Cancelar</button>
          <button class="btn-confirm" @click="handleSubmit">
            <i class="fa-solid fa-check"></i> Confirmar Recepción
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
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal-content {
  background: white;
  padding: 0;
  border-radius: 16px;
  width: 95%;
  max-width: 650px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid $border-light;
  background: #fafbfc;

  h3 {
    margin: 0;
    color: $NICOLE-PURPLE;
    font-family: $font-principal;
    font-size: 1.4rem;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.8rem;
    cursor: pointer;
    color: $text-light;
    line-height: 1;

    &:hover {
      color: $error;
    }
  }
}

.modal-body {
  padding: 1.5rem;
}

.info-row {
  display: flex;
  gap: 2rem;
  margin-bottom: 2rem;
  padding: 1rem;
  background: $gray-50;
  border-radius: 8px;
  border: 1px solid $border-light;

  .info-group {
    display: flex;
    flex-direction: column;

    label {
      font-size: 0.8rem;
      color: $text-light;
      margin-bottom: 0.3rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    span {
      font-weight: 600;
      color: $text-dark;
      font-size: 1rem;
    }
  }
}

.items-list {
  margin-bottom: 2rem;

  .list-header {
    margin-bottom: 1rem;

    h3 {
      font-size: 1.1rem;
      margin: 0 0 0.3rem 0;
      color: $NICOLE-SECONDARY;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    p {
      margin: 0;
      font-size: 0.9rem;
      color: $text-light;
    }
  }

  .items-table-header {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr 1.5fr;
    font-size: 0.85rem;
    font-weight: 600;
    color: $text-light;
    padding: 0.5rem 1rem;
    background: $gray-50;
    border-radius: 8px 8px 0 0;
    border: 1px solid $border-light;
    border-bottom: none;
  }

  .text-center {
    text-align: center;
  }

  .item-row {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr 1.5fr;
    align-items: center;
    padding: 0.8rem 1rem;
    border: 1px solid $border-light;
    border-top: none;
    background: white;
    transition: background 0.2s;

    &:last-child {
      border-radius: 0 0 8px 8px;
    }

    &.has-issue {
      background: rgba($warning, 0.05);
    }

    .name {
      font-weight: 500;
      color: $text-dark;
    }

    .qty-display {
      font-weight: 600;
      color: $text-light;
      text-align: center;
      font-size: 1.1rem;
    }

    .qty-input {
      width: 100%;
      padding: 0.5rem;
      border: 1px solid $border-light;
      border-radius: 6px;
      text-align: center;
      font-size: 1rem;
      font-weight: 600;
      color: $NICOLE-PURPLE;

      &:focus {
        border-color: $NICOLE-PURPLE;
        outline: none;
        box-shadow: 0 0 0 2px rgba($NICOLE-PURPLE, 0.1);
      }

      &.diff {
        color: $warning;
        border-color: $warning;
      }
    }

    select {
      width: 100%;
      padding: 0.5rem;
      border: 1px solid $border-light;
      border-radius: 6px;
      font-size: 0.9rem;
      cursor: pointer;

      &.MISSING {
        color: $warning;
        font-weight: 700;
        border-color: $warning;
      }

      &.DAMAGED {
        color: $error;
        font-weight: 700;
        border-color: $error;
      }

      &.OK {
        color: $success;
      }
    }
  }
}

.form-section {
  background: $gray-50;
  padding: 1.5rem;
  border-radius: 12px;
}

.form-group {
  margin-bottom: 1.2rem;
  display: flex;
  flex-direction: column;

  &:last-child {
    margin-bottom: 0;
  }

  label {
    font-size: 0.9rem;
    margin-bottom: 0.5rem;
    color: $text-dark;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  input,
  textarea {
    padding: 0.8rem;
    border: 1px solid $border-light;
    border-radius: 8px;
    font-family: inherit;
    font-size: 0.95rem;
    transition: all 0.2s;

    &:focus {
      outline: none;
      border-color: $NICOLE-PURPLE;
      box-shadow: 0 0 0 3px rgba($NICOLE-PURPLE, 0.1);
    }
  }

  textarea {
    resize: vertical;
    min-height: 80px;
  }
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  padding: 1.5rem;
  border-top: 1px solid $border-light;
  background: #fafbfc;
  border-radius: 0 0 16px 16px;

  button {
    padding: 0.8rem 2rem;
    border-radius: 8px;
    font-weight: 600;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-cancel {
    background: white;
    border: 1px solid $border-light;
    color: $text-light;

    &:hover {
      background: $gray-50;
      color: $text-dark;
    }
  }

  .btn-confirm {
    background: $NICOLE-PURPLE;
    border: none;
    color: white;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    box-shadow: 0 4px 12px rgba($NICOLE-PURPLE, 0.25);

    &:hover {
      background: $purple-hover;
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba($NICOLE-PURPLE, 0.35);
    }
  }
}
</style>
