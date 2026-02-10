<script setup lang="ts">
import { ref, watch, computed } from 'vue'

const props = defineProps<{
  isOpen: boolean
  providerToEdit: any
  categories: any[]
  isLoading: boolean
}>()

const emit = defineEmits(['close', 'save', 'create-category'])

const form = ref({
  name: '',
  email: '',
  phone: '',
  address: '',
  ruc: '',
  category: '',
  commercialAgents: [] as any[]
})

const newAgent = ref({
  name: '',
  email: '',
  phone: ''
})

const showCategoryModal = ref(false)
const newCategoryName = ref('')
const categoryInput = ref<HTMLInputElement | null>(null)

const openCategoryModal = () => {
  newCategoryName.value = ''
  showCategoryModal.value = true
  setTimeout(() => categoryInput.value?.focus(), 100)
}

const createCategory = () => {
  if (newCategoryName.value.trim()) {
    emit('create-category', newCategoryName.value.trim())
    form.value.category = '' // Reset selection or we can try to guess ID if we want, but letting user select is safer
    showCategoryModal.value = false
  }
}

const isEditing = computed(() => !!props.providerToEdit)

const resetForm = () => {
  form.value = {
    name: '',
    email: '',
    phone: '',
    address: '',
    ruc: '',
    category: '',
    commercialAgents: []
  }
}

watch(() => props.providerToEdit, (newVal) => {
  if (newVal) {
    form.value = JSON.parse(JSON.stringify(newVal))
    // category might be an object if populated, we need the ID
    if (newVal.category && typeof newVal.category === 'object') {
      form.value.category = newVal.category._id
    }
  } else {
    resetForm()
  }
}, { immediate: true })

const addAgent = () => {
  if (!newAgent.value.name) return
  form.value.commercialAgents.push({ ...newAgent.value })
  newAgent.value = { name: '', email: '', phone: '' }
}

const removeAgent = (index: number) => {
  form.value.commercialAgents.splice(index, 1)
}

const handleSubmit = () => {
  emit('save', form.value)
}
</script>

<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h2>{{ isEditing ? 'Editar Proveedor' : 'Nuevo Proveedor' }}</h2>
        <button class="btn-close" @click="$emit('close')">&times;</button>
      </div>

      <div class="modal-body">
        <div class="form-group">
          <label>Nombre Empresa *</label>
          <input v-model="form.name" type="text" placeholder="Ej. Distribuidora ABC" required />
        </div>

        <div class="form-group">
            <div class="label-row">
              <label>Categoría</label>
              <button 
                type="button" 
                class="btn-link"
                @click="openCategoryModal"
              >
                + Nueva Categoría
              </button>
            </div>
            <div class="select-wrapper">
                <select v-model="form.category" class="styled-select">
                    <option value="">-- Seleccionar --</option>
                    <option v-for="cat in categories" :key="cat._id" :value="cat._id">{{ cat.name }}</option>
                </select>
                <i class="fas fa-chevron-down select-icon"></i>
            </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>RUC</label>
            <input v-model="form.ruc" type="text" placeholder="1234567890001" />
          </div>
          <div class="form-group">
            <label>Teléfono</label>
            <input v-model="form.phone" type="text" placeholder="099..." />
          </div>
        </div>

        <div class="form-group">
          <label>Email General</label>
          <input v-model="form.email" type="email" placeholder="contacto@proveedor.com" />
        </div>

        <div class="form-group">
          <label>Dirección</label>
          <input v-model="form.address" type="text" placeholder="Av. Principal 123" />
        </div>

        <!-- Agents Section -->
        <div class="agents-section">
          <h3>Agentes Comerciales</h3>
          
          <div class="add-agent-form">
            <input v-model="newAgent.name" placeholder="Nombre Agente" />
            <input v-model="newAgent.phone" placeholder="Teléfono" />
            <input v-model="newAgent.email" placeholder="Email" />
            <button @click="addAgent" class="btn-add-agent" :disabled="!newAgent.name">
              <i class="fas fa-plus"></i>
            </button>
          </div>

          <div class="agents-list">
            <div v-if="form.commercialAgents.length === 0" class="empty-agents">
              No hay agentes registrados
            </div>
            <div v-for="(agent, idx) in form.commercialAgents" :key="idx" class="agent-item">
              <div class="agent-info">
                <strong>{{ agent.name }}</strong>
                <span v-if="agent.phone">{{ agent.phone }}</span>
                <span v-if="agent.email">{{ agent.email }}</span>
              </div>
              <button @click="removeAgent(idx)" class="btn-remove-agent">&times;</button>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" @click="$emit('close')">Cancelar</button>
        <button class="btn-primary" @click="handleSubmit" :disabled="!form.name || isLoading">
          {{ isLoading ? 'Guardando...' : (isEditing ? 'Actualizar' : 'Guardar') }}
        </button>
      </div>

      <!-- Nested Category Modal -->
      <div v-if="showCategoryModal" class="modal-overlay z-high" @click.self="showCategoryModal = false">
        <div class="modal-content small-modal">
          <div class="modal-header">
             <h2>Nueva Categoría</h2>
             <button class="btn-close" @click="showCategoryModal = false">&times;</button>
          </div>
          <div class="modal-body">
             <div class="form-group">
               <label>Nombre de Categoría</label>
               <input v-model="newCategoryName" placeholder="Ej. Lácteos" @keyup.enter="createCategory" ref="categoryInput" />
             </div>
          </div>
          <div class="modal-footer">
            <button class="btn-secondary" @click="showCategoryModal = false">Cancelar</button>
            <button class="btn-primary" @click="createCategory" :disabled="!newCategoryName">Crear</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;

  h2 {
    color: $NICOLE-PURPLE;
    margin: 0;
    font-size: 1.5rem;
  }

  .btn-close {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: $text-light;
  }
}

.form-group {
  margin-bottom: 1rem;

  label {
    display: block;
    margin-bottom: 0.5rem;
    color: $text-dark;
    font-weight: 500;
  }

  input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid $border-light;
    border-radius: 6px;
    font-size: 0.95rem;

    &:focus {
      outline: none;
      border-color: $NICOLE-PURPLE;
      box-shadow: 0 0 0 2px $purple-overlay;
    }
  }
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.agents-section {
  margin-top: 1.5rem;
  border-top: 1px solid $border-light;
  padding-top: 1rem;

  h3 {
    font-size: 1.1rem;
    color: $text-dark;
    margin-bottom: 1rem;
  }
}

.add-agent-form {
  display: grid;
  grid-template-columns: 2fr 1.5fr 1.5fr auto;
  gap: 0.5rem;
  margin-bottom: 1rem;

  input {
    padding: 0.5rem;
    border: 1px solid $border-light;
    border-radius: 4px;
    font-size: 0.85rem;
  }

  .btn-add-agent {
    background: $NICOLE-PURPLE;
    color: white;
    border: none;
    border-radius: 4px;
    width: 32px;
    cursor: pointer;

    &:disabled {
      background: $gray-300;
      cursor: not-allowed;
    }
  }
}

.agents-list {
  background: $gray-50;
  border-radius: 6px;
  padding: 0.5rem;
}

.agent-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  border-bottom: 1px solid $border-light;
  font-size: 0.9rem;

  &:last-child {
    border-bottom: none;
  }

  .agent-info {
    display: flex;
    gap: 1rem;
    align-items: center;
    flex-wrap: wrap;

    strong {
      color: $text-dark;
    }

    span {
      color: $text-light;
      font-size: 0.85rem;
    }
  }

  .btn-remove-agent {
    background: none;
    border: none;
    color: $error;
    cursor: pointer;
    font-size: 1.2rem;
  }
}

.empty-agents {
  text-align: center;
  padding: 1rem;
  color: $gray-500;
  font-style: italic;
  font-size: 0.9rem;
}

.modal-footer {
  margin-top: 2rem;
  display: flex;
  justify-content: flex-end;
  gap: 1rem;

  button {
    padding: 0.75rem 1.5rem;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
    font-size: 0.95rem;
    border: none;
  }

  .btn-secondary {
    background: $gray-200;
    color: $text-dark;

    &:hover {
      background: $gray-300;
    }
  }

  .btn-primary {
    background: $NICOLE-PURPLE;
    color: white;

    &:hover {
      background: $purple-dark;
    }

    &:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }
  }
}

// Category selection styles
.label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;

  label {
    margin-bottom: 0;
  }
}

.btn-link {
  background: none;
  border: none;
  color: $NICOLE-PURPLE;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;

  &:hover {
    color: $purple-dark;
  }
}

.select-wrapper {
  position: relative;

  .styled-select {
    width: 100%;
    padding: 0.75rem;
    padding-right: 2.5rem;
    border: 1px solid $border-light;
    border-radius: 6px;
    appearance: none;
    background-color: white;
    cursor: pointer;
    font-size: 0.95rem;
    color: $text-dark;

    &:focus {
      outline: none;
      border-color: $NICOLE-PURPLE;
      box-shadow: 0 0 0 2px $purple-overlay;
    }
  }

  .select-icon {
    position: absolute;
    right: 1rem;
    top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
    color: $text-light;
    font-size: 0.8rem;
  }
}

.z-high {
  z-index: 1100 !important;
}

.small-modal {
  max-width: 400px !important;
  margin: auto;
}
</style>
