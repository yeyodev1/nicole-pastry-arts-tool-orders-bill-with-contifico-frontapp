<script setup lang="ts">
import { ref, computed, watch } from 'vue'

interface Product {
  _id: string
  name: string
  quantity: number
  quantitySent: number // Form state
}

const props = defineProps<{
  isOpen: boolean
  orderId: string
  destination: string
  products: { _id: string, name: string, quantity: number }[]
}>()

const emit = defineEmits(['close', 'confirm'])

const items = ref<Product[]>([])
const notes = ref('')

// Initialize items when modal opens with products data
watch(() => props.isOpen, (val) => {
  if (val) {
    items.value = props.products.map(p => ({
      ...p,
      quantitySent: p.quantity // Default to full shipment
    }))
    notes.value = ''
  }
})

const totalStatus = computed(() => {
  let excess = false
  let partial = false

  items.value.forEach(i => {
    if (i.quantitySent > i.quantity) excess = true
    if (i.quantitySent < i.quantity) partial = true
  })

  if (excess) return { label: 'EXCESO DETECTADO', class: 'status-excess' }
  if (partial) return { label: 'ENVÍO PARCIAL', class: 'status-partial' }
  return { label: 'ENVÍO COMPLETO', class: 'status-ok' }
})

const handleConfirm = () => {
  const payload = {
    items: items.value.map(i => ({
      productId: i._id,
      name: i.name,
      quantitySent: i.quantitySent
    })),
    notes: notes.value,
    destination: props.destination
  }
  emit('confirm', payload)
}
</script>

<template>
  <div v-if="isOpen" class="modal-overlay" @click="$emit('close')">
    <div class="modal-content" @click.stop>
      <header>
        <h2>Reportar Envío</h2>
        <span class="destination-badge">{{ destination }}</span>
      </header>

      <div class="status-bar" :class="totalStatus.class">
        {{ totalStatus.label }}
      </div>

      <div class="items-list">
        <div v-for="item in items" :key="item._id" class="item-row">
          <div class="item-info">
            <span class="name">{{ item.name }}</span>
            <span class="req">Pedido: {{ item.quantity }}</span>
          </div>
          <div class="item-input">
            <label>Enviado:</label>
            <input 
              type="number" 
              v-model.number="item.quantitySent" 
              min="0"
              :class="{
                'input-excess': item.quantitySent > item.quantity,
                'input-partial': item.quantitySent < item.quantity
              }"
            />
          </div>
        </div>
      </div>

      <div class="notes-section">
        <label>Notas Adicionales:</label>
        <textarea v-model="notes" placeholder="Ej: Se enviaron 2 de más por compensación..."></textarea>
         <p class="hint">Podrás editar este reporte durante 1 hora.</p>
      </div>

      <div class="actions">
        <button class="btn-cancel" @click="$emit('close')">Cancelar</button>
        <button class="btn-confirm" @click="handleConfirm">Registrar Envío</button>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
$font-stack: 'Inter', system-ui, sans-serif;

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
  backdrop-filter: blur(2px);
}

.modal-content {
  background: white;
  width: 90%;
  max-width: 500px;
  border-radius: 12px;
  padding: 1.5rem;
  font-family: $font-stack;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  max-height: 90vh;
  overflow-y: auto;
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;

  h2 {
    margin: 0;
    font-size: 1.25rem;
    color: #2c3e50;
  }

  .destination-badge {
    background: #eaf2f8;
    color: #3498db;
    padding: 0.2rem 0.6rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
  }
}

.status-bar {
  text-align: center;
  padding: 0.5rem;
  border-radius: 6px;
  font-weight: 700;
  font-size: 0.8rem;
  margin-bottom: 1.5rem;

  &.status-ok {
    background: #eafaf1;
    color: #2ecc71;
  }

  &.status-partial {
    background: #fef9e7;
    color: #f1c40f;
  }

  &.status-excess {
    background: #fdedec;
    color: #e74c3c;
  }
}

.items-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.item-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 0.8rem;
  border-bottom: 1px solid #f1f2f6;

  .item-info {
    display: flex;
    flex-direction: column;

    .name {
      font-weight: 600;
      font-size: 0.9rem;
      color: #2c3e50;
    }

    .req {
      font-size: 0.75rem;
      color: #7f8c8d;
    }
  }

  .item-input {
    display: flex;
    align-items: center;
    gap: 0.5rem;

    label {
      font-size: 0.75rem;
      font-weight: 600;
      color: #95a5a6;
    }

    input {
      width: 60px;
      padding: 0.4rem;
      border: 1px solid #bdc3c7;
      border-radius: 6px;
      text-align: center;
      font-weight: 700;

      &.input-excess {
        border-color: #e74c3c;
        color: #e74c3c;
        background: #fdedec;
      }

      &.input-partial {
        border-color: #f1c40f;
      }
    }
  }
}

.notes-section {
  margin-bottom: 1.5rem;

  label {
    display: block;
    font-size: 0.8rem;
    font-weight: 600;
    margin-bottom: 0.4rem;
    color: #2c3e50;
  }

  textarea {
    width: 100%;
    padding: 0.8rem;
    border: 1px solid #dfe6e9;
    border-radius: 8px;
    font-family: inherit;
    resize: vertical;
    min-height: 80px;

    &:focus {
      outline: none;
      border-color: #3498db;
    }
  }

  .hint {
    font-size: 0.7rem;
    color: #95a5a6;
    margin-top: 0.3rem;
    text-align: right;
  }
}

.actions {
  display: flex;
  gap: 1rem;

  button {
    flex: 1;
    padding: 0.8rem;
    border-radius: 8px;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
    border: none;
    transition: all 0.2s;

    &.btn-cancel {
      background: #f1f2f6;
      color: #7f8c8d;

      &:hover {
        background: #e1e8ed;
      }
    }

    &.btn-confirm {
      background: #2ecc71;
      color: white;

      &:hover {
        background: #27ae60;
      }
    }
  }
}
</style>
