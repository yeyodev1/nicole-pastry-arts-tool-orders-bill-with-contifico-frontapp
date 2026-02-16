<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import HoldConfirmButton from '@/components/ui/HoldConfirmButton.vue'

const props = defineProps<{
  isOpen: boolean
  providerToEdit: any
  categories: any[]
  isLoading: boolean
}>()

const emit = defineEmits(['close', 'save', 'delete', 'create-category'])

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
    form.value.category = ''
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

const handleDelete = () => {
  if (props.providerToEdit) {
    emit('delete', props.providerToEdit._id)
  }
}
</script>

<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content provider-modal">
      <div class="modal-header">
        <div class="header-title">
          <h2>{{ isEditing ? 'Editar Proveedor' : 'Nuevo Proveedor' }}</h2>
          <p v-if="isEditing" class="provider-id">ID: {{ providerToEdit._id.slice(-6).toUpperCase() }}</p>
        </div>
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
            <input v-model="newAgent.name" placeholder="Nombre" />
            <input v-model="newAgent.phone" placeholder="Celular" />
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
                <div class="agent-meta">
                  <span v-if="agent.phone"><i class="fas fa-phone"></i> {{ agent.phone }}</span>
                  <span v-if="agent.email"><i class="fas fa-envelope"></i> {{ agent.email }}</span>
                </div>
              </div>
              <button @click="removeAgent(idx)" class="btn-remove-agent"><i class="fas fa-times"></i></button>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer flex-column">
        <HoldConfirmButton 
          v-if="isEditing"
          label="MANTÉN PARA ELIMINAR"
          color="#EF4444"
          class="btn-delete-hold"
          :hold-time="1200"
          @confirmed="handleDelete"
        />
        
        <div class="footer-actions">
          <button class="btn-secondary" @click="$emit('close')">Cancelar</button>
          <HoldConfirmButton 
            :label="isEditing ? 'MANTÉN PARA ACTUALIZAR' : 'MANTÉN PARA GUARDAR'"
            :disabled="!form.name || isLoading"
            :hold-time="1200"
            @confirmed="handleSubmit"
          />
        </div>
      </div>

      <!-- Nested Category Modal -->
      <Transition name="sub-modal">
        <div v-if="showCategoryModal" class="sub-modal-overlay" @click.self="showCategoryModal = false">
          <div class="sub-modal-card">
            <div class="sub-header">
               <h4>Nueva Categoría</h4>
            </div>
            <div class="sub-body">
               <input v-model="newCategoryName" placeholder="Ej. Lácteos" ref="categoryInput" />
            </div>
            <div class="sub-footer">
              <button class="btn-secondary-sm" @click="showCategoryModal = false">Cancelar</button>
              <HoldConfirmButton 
                label="MANTÉN PARA CREAR"
                :disabled="!newCategoryName"
                :hold-time="1200"
                @confirmed="createCategory"
              />
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.4);
  backdrop-filter: blur(8px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-content {
  background: white;
  border-radius: 28px;
  width: 95%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  animation: modalIn 0.3s ease-out;
}

@keyframes modalIn {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.modal-header {
  padding: 1.5rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #f1f5f9;

  .header-title {
    h2 {
      color: $NICOLE-PURPLE;
      margin: 0;
      font-size: 1.5rem;
      font-weight: 900;
    }

    .provider-id {
      font-size: 0.75rem;
      color: #94a3b8;
      font-weight: 700;
      margin: 2px 0 0;
    }
  }

  .btn-close {
    background: #f1f5f9;
    border: none;
    width: 36px;
    height: 36px;
    border-radius: 12px;
    color: #64748b;
    font-size: 1.25rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;

    &:hover {
      background: #e2e8f0;
      color: #0f172a;
    }
  }
}

.modal-body {
  padding: 2rem;
}

.form-group {
  margin-bottom: 1.5rem;

  label {
    display: block;
    margin-bottom: 0.6rem;
    font-weight: 700;
    color: #475569;
    font-size: 0.8rem;
    text-transform: uppercase;
  }

  input,
  select {
    width: 100%;
    padding: 1rem;
    border: 2px solid #f1f5f9;
    border-radius: 14px;
    font-size: 1rem;
    background: #f8fafc;
    transition: all 0.2s;

    &:focus {
      outline: none;
      border-color: $NICOLE-PURPLE;
      background: white;
      box-shadow: 0 0 0 4px rgba($NICOLE-PURPLE, 0.1);
    }
  }
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}

.agents-section {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 2px solid #f1f5f9;

  h3 {
    font-size: 1.1rem;
    color: #1e293b;
    margin-bottom: 1.25rem;
    font-weight: 800;
  }
}

.add-agent-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
  background: #f8fafc;
  padding: 1rem;
  border-radius: 16px;
  border: 1px solid #f1f5f9;

  @media (min-width: 640px) {
    flex-direction: row;

    input {
      flex: 1;
    }
  }

  input {
    padding: 0.75rem 1rem;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    font-size: 0.9rem;
  }

  .btn-add-agent {
    background: $NICOLE-PURPLE;
    color: white;
    border: none;
    border-radius: 10px;
    width: 44px;
    height: 44px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1rem;

    &:disabled {
      background: #cbd5e1;
      cursor: not-allowed;
    }
  }
}

.agents-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.agent-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: white;
  border: 1px solid #f1f5f9;
  border-radius: 14px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);

  .agent-info {
    strong {
      color: #1e293b;
      font-size: 0.95rem;
    }

    .agent-meta {
      display: flex;
      gap: 1rem;
      margin-top: 0.25rem;
      font-size: 0.8rem;
      color: #64748b;

      i {
        color: #cbd5e1;
      }
    }
  }

  .btn-remove-agent {
    background: #fee2e2;
    border: none;
    color: #ef4444;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8rem;
  }
}

.empty-agents {
  text-align: center;
  padding: 1rem;
  color: #94a3b8;
  font-style: italic;
  font-size: 0.9rem;
}

.modal-footer {
  padding: 1.5rem 2rem 2.5rem;
  background: #f8fafc;
  border-top: 1px solid #f1f5f9;
  gap: 1rem;

  .btn-delete-hold {
    width: 100%;
    margin-bottom: 0.5rem;
  }

  .footer-actions {
    display: flex;
    gap: 1rem;
    width: 100%;

    .btn-secondary {
      flex: 0 0 100px;
      padding: 0;
      background: white;
      border: 2px solid #f1f5f9;
      border-radius: 16px;
      font-weight: 800;
      color: #64748b;
    }

    .hold-confirm-btn {
      flex: 1;
    }
  }
}

.label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.6rem;

  label {
    margin-bottom: 0;
  }
}

.btn-link {
  background: none;
  border: none;
  color: $NICOLE-PURPLE;
  font-size: 0.8rem;
  font-weight: 800;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.05em;

  &:hover {
    color: darken($NICOLE-PURPLE, 10%);
  }
}

.select-wrapper {
  position: relative;

  .styled-select {
    padding-right: 2.5rem;
    cursor: pointer;
  }

  .select-icon {
    position: absolute;
    right: 1.25rem;
    top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
    color: #64748b;
    font-size: 0.8rem;
  }
}

/* Nested Category Modal Styles */
.sub-modal-overlay {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.4);
  backdrop-filter: blur(4px);
  z-index: 2010;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 1.5rem;
}

.sub-modal-card {
  background: white;
  width: 100%;
  max-width: 360px;
  border-radius: 28px;
  padding: 2rem;
  box-shadow: 0 30px 60px -12px rgba(0, 0, 0, 0.3);

  .sub-header h4 {
    margin: 0 0 1.5rem;
    text-align: center;
    font-size: 1.25rem;
    font-weight: 900;
    color: #1e293b;
  }

  .sub-body input {
    width: 100%;
    padding: 1rem;
    border: 2px solid #f1f5f9;
    border-radius: 14px;
    font-size: 1rem;
    background: #f8fafc;
    margin-bottom: 1.5rem;
    text-align: center;
    font-weight: 700;

    &:focus {
      border-color: $NICOLE-PURPLE;
      background: white;
    }
  }
}

.sub-footer {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;

  .btn-secondary-sm {
    background: #f1f5f9;
    color: #64748b;
    border: none;
    padding: 0.9rem;
    border-radius: 14px;
    font-weight: 800;
    cursor: pointer;
  }
}

.sub-modal-enter-active,
.sub-modal-leave-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.sub-modal-enter-from,
.sub-modal-leave-to {
  opacity: 0;
  transform: scale(0.9);
}
</style>
