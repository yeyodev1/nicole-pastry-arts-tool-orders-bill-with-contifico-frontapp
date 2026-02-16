<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import HoldConfirmButton from '@/components/ui/HoldConfirmButton.vue'
import RawMaterialService from '@/services/raw-material.service'
import { useToast } from '@/composables/useToast'
import RawMaterialModal from '@/components/SupplyChain/RawMaterialModal.vue'
import DeleteProviderModal from '@/views/SupplyChain/components/DeleteProviderModal.vue'

const props = defineProps<{
  isOpen: boolean
  providerToEdit: any
  isLoading: boolean
}>()

const emit = defineEmits(['close', 'save', 'delete'])
const { success, error: showError } = useToast()

const form = ref({
  name: '',
  email: '',
  phone: '',
  address: '',
  ruc: '',
  commercialAgents: [] as any[]
})

const newAgent = ref({
  name: '',
  email: '',
  phone: ''
})

const relatedItems = ref<any[]>([])
const isLoadingItems = ref(false)

// Raw Material Modal Management
const showItemModal = ref(false)
const itemToEdit = ref<any>(null)
const isSavingItem = ref(false)

const isEditing = computed(() => !!props.providerToEdit)

// Derived categories for the Item Modal (unique strings from materials)
const categories = computed(() => {
  const uniqueCats = new Set<string>()
  relatedItems.value.forEach(m => {
    if (m.category) uniqueCats.add(m.category)
  })
  return Array.from(uniqueCats).map(name => ({ _id: name, name }))
})

const fetchRelatedItems = async () => {
  if (!props.providerToEdit) return
  isLoadingItems.value = true
  try {
    const allItems = await RawMaterialService.getRawMaterials()
    relatedItems.value = allItems.filter((m: any) =>
      (m.provider?._id || m.provider) === props.providerToEdit._id
    )
  } catch (err) {
    showError('Error al cargar artículos relacionados')
  } finally {
    isLoadingItems.value = false
  }
}

const resetForm = () => {
  form.value = {
    name: '',
    email: '',
    phone: '',
    address: '',
    ruc: '',
    commercialAgents: []
  }
  relatedItems.value = []
}

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    if (props.providerToEdit) {
      form.value = JSON.parse(JSON.stringify(props.providerToEdit))
      fetchRelatedItems()
    } else {
      resetForm()
    }
  }
})

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

// Item management functions
const openItemModal = (item: any = null) => {
  itemToEdit.value = item
  showItemModal.value = true
}

const handleSaveItem = async (payload: any) => {
  isSavingItem.value = true
  try {
    // Inject current provider ID if creating new
    if (!itemToEdit.value) {
      payload.provider = props.providerToEdit._id
    }

    if (itemToEdit.value) {
      await RawMaterialService.updateRawMaterial(itemToEdit.value._id, payload)
      success('Artículo actualizado')
    } else {
      await RawMaterialService.createRawMaterial(payload)
      success('Artículo creado')
    }
    showItemModal.value = false
    fetchRelatedItems()
  } catch (err: any) {
    showError(err.response?.data?.message || 'Error al guardar artículo')
  } finally {
    isSavingItem.value = false
  }
}

const handleDeleteItem = async (id: string) => {
  try {
    await RawMaterialService.deleteRawMaterial(id)
    success('Artículo eliminado')
    showItemModal.value = false
    fetchRelatedItems()
  } catch (err) {
    showError('Error al eliminar artículo')
  }
}

// Delete Confirmation Logic
const isDeleteModalOpen = ref(false)

const openDeleteModal = () => {
  isDeleteModalOpen.value = true
}

const handleConfirmDelete = () => {
  handleDelete()
  isDeleteModalOpen.value = false
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

        <div class="form-row">
          <div class="form-group">
            <label>RUC</label>
            <input v-model="form.ruc" type="text" placeholder="1234567890001" />
          </div>
          <div class="form-group">
            <label>Teléfono General</label>
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
        <div class="section-container">
          <div class="section-header">
            <h3>Agentes Comerciales</h3>
            <span class="badge">{{ form.commercialAgents.length }}</span>
          </div>
          
          <div class="add-agent-box">
            <div class="agent-inputs">
              <input v-model="newAgent.name" placeholder="Nombre completo" />
              <input v-model="newAgent.phone" placeholder="Celular" />
              <input v-model="newAgent.email" placeholder="Email" />
            </div>
            <button @click="addAgent" class="btn-add-circle" :disabled="!newAgent.name">
              <i class="fas fa-plus"></i>
            </button>
          </div>

          <div class="agents-list">
            <div v-for="(agent, idx) in form.commercialAgents" :key="idx" class="agent-compact-card">
              <div class="agent-main">
                <div class="agent-avatar">{{ agent.name.charAt(0) }}</div>
                <div class="agent-data">
                  <strong>{{ agent.name }}</strong>
                  <div class="agent-pills">
                    <span v-if="agent.phone"><i class="fas fa-phone"></i> {{ agent.phone }}</span>
                    <span v-if="agent.email"><i class="fas fa-envelope"></i> {{ agent.email }}</span>
                  </div>
                </div>
              </div>
              <button @click="removeAgent(idx)" class="btn-trash"><i class="fas fa-trash-alt"></i></button>
            </div>
            <div v-if="form.commercialAgents.length === 0" class="empty-mini">
              No hay agentes registrados
            </div>
          </div>
        </div>

        <!-- Related Items Section -->
        <div class="section-container" v-if="isEditing">
           <div class="section-header">
            <h3>Artículos Relacionados</h3>
            <div class="header-actions">
              <button class="btn-mini-plus" @click="openItemModal()">
                <i class="fas fa-plus"></i> Nuevo Ítem
              </button>
            </div>
          </div>

          <div v-if="isLoadingItems" class="mini-loading">
            <div class="mini-spinner"></div>
          </div>
          <div v-else class="items-grid">
            <div v-for="item in relatedItems" :key="item._id" class="item-mini-card" @click="openItemModal(item)">
              <div class="item-info">
                <span class="item-cat">{{ item.category || 'Sin Categoría' }}</span>
                <span class="item-name">{{ item.name }}</span>
                <span class="item-price">${{ item.presentationPrice?.toFixed(2) }} ({{ item.presentationName }})</span>
              </div>
              <i class="fas fa-chevron-right"></i>
            </div>
            <div v-if="relatedItems.length === 0" class="empty-mini">
               Sin artículos asociados
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer flex-column">
        <div v-if="isEditing" class="delete-section">
          <button class="btn-delete" @click="openDeleteModal">
            <i class="fas fa-trash-alt"></i> ELIMINAR PROVEEDOR
          </button>
        </div>
        
        <div class="footer-actions">
          <button class="btn-cancel" @click="$emit('close')">Cancelar</button>
          <HoldConfirmButton 
            :label="isEditing ? 'MANTÉN PARA ACTUALIZAR' : 'MANTÉN PARA GUARDAR'"
            :disabled="!form.name || isLoading"
            :hold-time="1200"
            @confirmed="handleSubmit"
          />
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <DeleteProviderModal
      :is-open="isDeleteModalOpen"
      :provider-name="form.name"
      @close="isDeleteModalOpen = false"
      @confirm="handleConfirmDelete"
    />

    <!-- Raw Material Modal (Nested) -->
    <RawMaterialModal
      :is-open="showItemModal"
      :material-to-edit="itemToEdit"
      :providers="[]" 
      :categories="categories"
      :is-saving="isSavingItem"
      @close="showItemModal = false"
      @save="handleSaveItem"
      @delete="handleDeleteItem"
    />
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
  align-items: end; // Mobile: aligned to bottom
  z-index: 1000;
  padding: 0; // Mobile: full width

  @media (min-width: 640px) {
    align-items: center;
    padding: 1rem;
  }
}

.modal-content {
  background: white;
  border-radius: 28px 28px 0 0; // Mobile: top rounded only
  width: 100%;
  max-width: 650px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 -25px 50px -12px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);

  @media (min-width: 640px) {
    border-radius: 28px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15);
    animation: modalIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }
}

@keyframes slideUp {
  from {
    transform: translateY(100%);
  }

  to {
    transform: translateY(0);
  }
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
  padding: 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #f1f5f9;
  position: sticky;
  top: 0;
  background: white;
  z-index: 10;

  .header-title {
    h2 {
      color: $NICOLE-PURPLE;
      margin: 0;
      font-size: 1.25rem;
      font-weight: 900;
      line-height: 1.2;
    }

    .provider-id {
      font-size: 0.7rem;
      color: #94a3b8;
      font-weight: 700;
      margin: 2px 0 0;
      letter-spacing: 0.05em;
    }
  }

  .btn-close {
    background: #f1f5f9;
    border: none;
    width: 36px;
    height: 36px;
    border-radius: 12px;
    color: #64748b;
    font-size: 1.5rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;

    &:active {
      transform: scale(0.95);
    }

    @media(hover: hover) {
      &:hover {
        background: #fee2e2;
        color: #ef4444;
      }
    }
  }
}

.modal-body {
  padding: 1.5rem;
}

.form-group {
  margin-bottom: 1.25rem;

  label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 800;
    color: #64748b;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  input {
    width: 80%;
    padding: 1rem; // Larger touch area
    border: 2px solid #f1f5f9;
    border-radius: 16px;
    font-size: 1rem;
    font-weight: 600;
    background: #f8fafc;
    transition: all 0.2s;
    appearance: none; // Remove system styles

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
  grid-template-columns: 1fr; // Mobile: Stack
  gap: 1.25rem;

  @media (min-width: 640px) {
    grid-template-columns: 1fr 1fr; // Desktop: Side by side
    gap: 1.5rem;
  }
}

.section-container {
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 2px solid #f8fafc;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.25rem;

  h3 {
    font-size: 0.95rem;
    font-weight: 900;
    color: #1e293b;
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .badge {
    background: #f1f5f9;
    color: $NICOLE-PURPLE;
    padding: 0.2rem 0.6rem;
    border-radius: 8px;
    font-size: 0.75rem;
    font-weight: 900;
  }

  .btn-mini-plus {
    background: rgba($NICOLE-PURPLE, 0.1);
    color: $NICOLE-PURPLE;
    border: none;
    padding: 0.6rem 1rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 800;
    cursor: pointer;

    &:active {
      transform: scale(0.95);
    }
  }
}

.add-agent-box {
  background: #f8fafc;
  padding: 1rem;
  border-radius: 20px;
  border: 1px solid #f1f5f9;
  display: flex;
  flex-direction: column; // Mobile: Stack
  gap: 1rem;
  margin-bottom: 1.5rem;

  @media (min-width: 640px) {
    flex-direction: row;
    padding: 1.25rem;
  }

  .agent-inputs {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.75rem;

    @media (min-width: 640px) {
      grid-template-columns: repeat(3, 1fr);
      gap: 0.5rem;
    }

    input {
      padding: 0.8rem;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      font-size: 0.9rem;
      font-weight: 600;
      width: 100%;
    }
  }

  .btn-add-circle {
    width: 100%; // Mobile: Full width button
    height: 48px;
    border-radius: 14px;
    background: $NICOLE-PURPLE;
    color: white;
    border: none;
    cursor: pointer;
    font-weight: 800;
    font-size: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;

    @media (min-width: 640px) {
      width: 44px;
      height: 44px;
      border-radius: 12px;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    &:active {
      transform: scale(0.98);
    }
  }
}

.agent-compact-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: white;
  border: 1px solid #f1f5f9;
  border-radius: 20px;
  margin-bottom: 0.75rem;

  .agent-main {
    display: flex;
    align-items: center;
    gap: 1rem;
    overflow: hidden; // Prevent overflow

    .agent-avatar {
      flex-shrink: 0;
      width: 40px;
      height: 40px;
      border-radius: 12px;
      background: #f1f5f9;
      color: $NICOLE-PURPLE;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      font-size: 1.1rem;
    }

    .agent-data {
      display: flex;
      flex-direction: column;
      overflow: hidden;

      strong {
        font-size: 0.95rem;
        color: #1e293b;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .agent-pills {
        display: flex;
        flex-wrap: wrap; // Allow wrapping on small screens
        gap: 0.5rem;
        font-size: 0.75rem;
        color: #64748b;
        font-weight: 600;
        margin-top: 0.2rem;

        span {
          display: flex;
          align-items: center;
          gap: 0.3rem;
        }

        i {
          color: #cbd5e1;
        }
      }
    }
  }

  .btn-trash {
    flex-shrink: 0;
    background: transparent;
    border: none;
    color: #cbd5e1;
    cursor: pointer;
    padding: 0.8rem; // Larger touch area
    margin-right: -0.5rem;

    @media(hover: hover) {
      &:hover {
        color: #ef4444;
      }
    }
  }
}

.items-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
}

.item-mini-card {
  background: white;
  padding: 1rem;
  border-radius: 20px;
  border: 1px solid #f1f5f9;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;

  // Use active state for better touch feedback
  &:active {
    background: #f8fafc;
    transform: scale(0.99);
  }

  @media(hover: hover) {
    &:hover {
      background: #fcfcfd;
      border-color: $NICOLE-PURPLE;
    }
  }

  .item-info {
    display: flex;
    flex-direction: column;

    .item-cat {
      font-size: 0.65rem;
      font-weight: 800;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .item-name {
      font-size: 1rem;
      font-weight: 800;
      color: #1e293b;
      margin: 2px 0 4px;
    }

    .item-price {
      font-size: 0.85rem;
      font-weight: 600;
      color: $NICOLE-PURPLE;
    }
  }

  i {
    color: #cbd5e1;
    font-size: 1rem;
    padding-left: 1rem;
  }
}

.empty-mini {
  text-align: center;
  padding: 2rem;
  color: #94a3b8;
  font-size: 0.9rem;
  font-weight: 600;
  font-style: italic;
}

.mini-loading {
  display: flex;
  justify-content: center;
  padding: 2rem;
}

.mini-spinner {
  width: 30px;
  height: 30px;
  border: 3px solid #f1f5f9;
  border-top-color: $NICOLE-PURPLE;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.modal-footer {
  padding: 1.5rem;
  background: #fff; // Sticky footer often looks better white on mobile
  border-top: 1px solid #f1f5f9;
  position: sticky;
  bottom: 0;
  z-index: 10;

  // Safe area for iPhone home bar
  padding-bottom: calc(1.5rem + env(safe-area-inset-bottom));

  .delete-section {
    margin-bottom: 1rem;

    .btn-delete {
      width: 100%;
      height: 56px;
      border-radius: 18px;
      background: #fee2e2;
      color: #ef4444;
      font-weight: 900;
      border: 1px solid #fca5a5;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      transition: all 0.2s;

      &:active {
        transform: scale(0.98);
      }

      @media(hover: hover) {
        &:hover {
          background: #fecaca;
        }
      }
    }
  }

  .footer-actions {
    display: flex;
    flex-direction: column-reverse; // Stack buttons on mobile (cancel on bottom)
    gap: 0.75rem;

    @media (min-width: 640px) {
      flex-direction: row;
      gap: 1rem;
    }

    .btn-cancel {
      width: 100%;
      height: 56px;
      background: white;
      border: 2px solid #f1f5f9;
      border-radius: 18px;
      font-weight: 800;
      color: #64748b;
      cursor: pointer;

      @media (min-width: 640px) {
        flex: 0 0 120px;
      }
    }

    .hold-confirm-btn {
      flex: 1;
      border-radius: 18px;
      font-weight: 900;
      height: 56px;
    }
  }
}
</style>
