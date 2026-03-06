<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { ProductionTask } from '@/services/production.service'
import ProductionService from '@/services/production.service'
import { useDialog } from '@/composables/useDialog'

const props = defineProps<{
  isOpen: boolean
  task: ProductionTask | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'update', task: ProductionTask): void
}>()

const dialog = useDialog()
const notes = ref('')
const isSaving = ref(false)

// Initialize notes when task changes
watch(() => props.task, (newTask) => {
  if (newTask) {
    notes.value = newTask.productionNotes || ''
  }
})

const formatDate = (dateString?: string) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('es-EC', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

const isUrgent = computed(() => {
  if (!props.task) return false
  const delivery = new Date(props.task.deliveryDate)
  const now = new Date()
  const diffHours = (delivery.getTime() - now.getTime()) / (1000 * 60 * 60)
  return diffHours < 24 && diffHours > 0
})

const saveNotes = async () => {
  if (!props.task) return

  try {
    isSaving.value = true
    const updatedTask = await ProductionService.updateTask(props.task._id, {
      notes: notes.value
    })

    // Update local task object to reflect changes immediately
    const mergedTask = { ...props.task, ...updatedTask }

    emit('update', mergedTask)
    emit('close')
  } catch (error) {
    await dialog.alert('Error al guardar las notas.', { variant: 'error', title: 'Error' })
    console.error(error)
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div v-if="isOpen && task" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content" :class="{ 'urgent-border': isUrgent }">
      <header class="modal-header">
        <div class="header-main">
          <h2>Orden #{{ task._id.slice(-4) }}</h2>
          <span class="delivery-badge" :class="{ urgent: isUrgent }">
            {{ formatDate(task.deliveryDate) }}
          </span>
        </div>
        <button class="btn-close" @click="$emit('close')">&times;</button>
      </header>

      <div class="modal-body">
        <section class="info-grid">
          <div class="info-group">
            <label>Cliente</label>
            <p>{{ task.customerName }}</p>
          </div>
          <div class="info-group">
            <label>Responsable</label>
            <p>{{ task.responsible }}</p>
          </div>
           <div class="info-group">
            <label>Estado</label>
            <span class="status-badge" :class="task.productionStage.toLowerCase()">
              {{ task.productionStage === 'IN_PROCESS' ? 'EN PROCESO' : task.productionStage }}
            </span>
          </div>
        </section>

        <section class="products-section">
          <h3>Productos</h3>
          <ul class="product-list">
            <li v-for="(prod, idx) in task.products" :key="idx" class="product-item">
              <span class="qty">{{ prod.quantity }}x</span>
              <span class="name">{{ prod.name }}</span>
            </li>
          </ul>
        </section>

        <section v-if="task.comments" class="comments-section">
          <h3>Comentarios de Ventas</h3>
          <div class="sales-comments">
            {{ task.comments }}
          </div>
        </section>

        <section class="notes-section">
          <h3>Notas de Producción</h3>
          <textarea 
            v-model="notes" 
            placeholder="Agregar detalles de producción, decoración, etc..."
            rows="4"
          ></textarea>
        </section>
      </div>

      <footer class="modal-footer">
        <button class="btn-cancel" @click="$emit('close')">Cancelar</button>
        <button class="btn-save" @click="saveNotes" :disabled="isSaving">
          {{ isSaving ? 'Guardando...' : 'Guardar Notas' }}
        </button>
      </footer>
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
  padding: 1rem;
}

.modal-content {
  background: white;
  width: 100%;
  max-width: 600px;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  max-height: 90vh;
  border-top: 6px solid $NICOLE-PURPLE;

  &.urgent-border {
    border-top-color: $error;
  }
}

.modal-header {
  padding: 1.5rem;
  border-bottom: 1px solid $border-light;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;

  .header-main {
    h2 {
      margin: 0;
      color: $text-dark;
      font-family: $font-principal;
    }
  }

  .delivery-badge {
    display: inline-block;
    margin-top: 0.5rem;
    font-size: 0.9rem;
    font-weight: 500;
    color: $text-light;

    &.urgent {
      color: $error;
      font-weight: 700;
    }
  }

  .btn-close {
    background: none;
    border: none;
    font-size: 2rem;
    line-height: 1;
    color: $text-light;
    cursor: pointer;
    padding: 0;
    margin-top: -0.5rem;

    &:hover {
      color: $text-dark;
    }
  }
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;

  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }

  .info-group {
    label {
      display: block;
      font-size: 0.75rem;
      color: $text-light;
      margin-bottom: 0.25rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    p {
      margin: 0;
      font-weight: 600;
      color: $text-dark;
    }
  }
}

.status-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;

  &.pending {
    background: $gray-200;
    color: $gray-700;
  }

  &.in_process {
    background: rgba($warning, 0.1);
    color: $warning;
  }

  &.finished {
    background: rgba($success, 0.1);
    color: $success;
  }
}

h3 {
  font-size: 1rem;
  color: $NICOLE-PURPLE;
  margin: 0 0 0.75rem 0;
  font-family: $font-secondary;
  border-bottom: 1px solid $border-light;
  padding-bottom: 0.5rem;
}

.product-list {
  list-style: none;
  padding: 0;
  margin: 0;

  .product-item {
    display: flex;
    gap: 0.75rem;
    padding: 0.5rem 0;
    border-bottom: 1px solid $gray-100;

    &:last-child {
      border-bottom: none;
    }

    .qty {
      font-weight: 700;
      color: $text-dark;
      min-width: 30px;
    }

    .name {
      color: $text-dark;
    }
  }
}

.sales-comments {
  background: $gray-50;
  padding: 1rem;
  border-radius: 8px;
  font-style: italic;
  color: $text-dark;
  font-size: 0.9rem;
  border-left: 3px solid $gray-300;
}

.notes-section {
  textarea {
    width: 100%;
    padding: 1rem;
    border: 1px solid $border-light;
    border-radius: 8px;
    font-family: inherit;
    font-size: 0.95rem;
    resize: vertical;
    transition: all 0.2s;
    background: #fffdf5; // Slight yellow tint for notes

    &:focus {
      outline: none;
      border-color: $NICOLE-PURPLE;
      box-shadow: 0 0 0 3px rgba($NICOLE-PURPLE, 0.1);
    }
  }
}

.modal-footer {
  padding: 1.5rem;
  border-top: 1px solid $border-light;
  display: flex;
  justify-content: flex-end;
  gap: 1rem;

  button {
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    font-family: $font-secondary;
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

  .btn-save {
    background: $NICOLE-PURPLE;
    border: none;
    color: white;

    &:hover:not(:disabled) {
      background: $purple-dark;
      transform: translateY(-1px);
    }

    &:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }
  }
}
</style>
