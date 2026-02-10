<script setup lang="ts">
import { ref, onMounted } from 'vue'
import ProviderService from '@/services/provider.service'
import ProviderCategoryService from '@/services/provider-category.service'
import { useToast } from '@/composables/useToast'
import ProviderModal from '@/components/SupplyChain/ProviderModal.vue'
import CategoryDeleteModal from './components/CategoryDeleteModal.vue' // Reuse the cool modal

const { success, error: showError } = useToast()

const providers = ref<any[]>([])
const categories = ref<any[]>([])
const isLoading = ref(false)
const showModal = ref(false)
const showCatDeleteModal = ref(false)
const providerToEdit = ref<any>(null)
const isSaving = ref(false)

const fetchData = async () => {
  isLoading.value = true
  try {
    const [providersData, categoriesData] = await Promise.all([
      ProviderService.getProviders(),
      ProviderCategoryService.getCategories()
    ])
    providers.value = providersData
    categories.value = categoriesData
  } catch (err: any) {
    showError('Error al cargar datos')
    console.error(err)
  } finally {
    isLoading.value = false
  }
}

const openNewProviderModal = () => {
  providerToEdit.value = null
  showModal.value = true
}

const openEditModal = (provider: any) => {
  providerToEdit.value = provider
  showModal.value = true
}

const handleSave = async (formData: any) => {
  isSaving.value = true
  try {
    if (providerToEdit.value) {
      await ProviderService.updateProvider(providerToEdit.value._id, formData)
      success('Proveedor actualizado')
    } else {
      await ProviderService.createProvider(formData)
      success('Proveedor creado')
    }
    showModal.value = false
    fetchData()
  } catch (err: any) {
    showError(err.response?.data?.message || 'Error al guardar proveedor')
  } finally {
    isSaving.value = false
  }
}

const handleDelete = async (id: string) => {
  if (!confirm('¿Estás seguro de eliminar este proveedor?')) return
  try {
    await ProviderService.deleteProvider(id)
    success('Proveedor eliminado')
    fetchData()
  } catch (err: any) {
    showError('Error al eliminar proveedor')
  }
}

const handleDeleteCategory = async (categoryName: string) => {
  try {
    const category = categories.value.find(c => c.name === categoryName)
    if (!category) return

    await ProviderCategoryService.deleteCategory(category._id)
    success('Categoría eliminada')
    showCatDeleteModal.value = false
    fetchData()
  } catch (err: any) {
    showError(err.response?.data?.message || 'Error al eliminar categoría')
  }
}

const handleCreateCategory = async (name: string) => {
  try {
    await ProviderCategoryService.createCategory({ name })
    success('Categoría creada')
    fetchData()
  } catch (err: any) {
    showError(err.response?.data?.message || 'Error al crear categoría')
  }
}

onMounted(() => {
  fetchData()
})
</script>

<template>
  <div class="providers-view">
    <div class="header">
      <div class="title">
        <h1>Proveedores</h1>
        <p>Gestiona tus proveedores y agentes comerciales</p>
      </div>
      <div class="header-actions">
        <button class="btn-secondary" @click="showCatDeleteModal = true">
          <i class="fas fa-tags"></i> Gestionar Categorías
        </button>
        <button class="btn-primary" @click="openNewProviderModal">
          <i class="fas fa-plus"></i> Nuevo Proveedor
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="loading-container">
      <div class="spinner"></div>
      <p>Cargando proveedores...</p>
    </div>

    <!-- List -->
    <div v-else class="providers-grid">
      <div v-if="providers.length === 0" class="empty-state">
        <i class="fas fa-truck-loading"></i>
        <p>No hay proveedores registrados.</p>
      </div>

      <div v-for="provider in providers" :key="provider._id" class="provider-card">
        <div class="card-header">
          <div class="header-main">
            <h3>{{ provider.name }}</h3>
            <span v-if="provider.category" class="category-badge">
              {{ provider.category.name }}
            </span>
          </div>
          <div class="actions">
            <button @click="openEditModal(provider)" class="btn-icon"><i class="fas fa-edit"></i></button>
            <button @click="handleDelete(provider._id)" class="btn-icon delete"><i class="fas fa-trash"></i></button>
          </div>
        </div>
        
        <div class="card-body">
          <p v-if="provider.ruc"><i class="fas fa-id-card"></i> {{ provider.ruc }}</p>
          <p v-if="provider.phone"><i class="fas fa-phone"></i> {{ provider.phone }}</p>
          <p v-if="provider.email"><i class="fas fa-envelope"></i> {{ provider.email }}</p>
          
          <div v-if="provider.commercialAgents?.length" class="agents-preview">
            <span>{{ provider.commercialAgents.length }} Agentes</span>
            <div class="agent-avatars">
               <div v-for="(agent, i) in provider.commercialAgents.slice(0, 3)" :key="i" class="avatar" :title="agent.name">
                 {{ agent.name.charAt(0) }}
               </div>
               <div v-if="provider.commercialAgents.length > 3" class="avatar more">+{{ provider.commercialAgents.length - 3 }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <ProviderModal
      :is-open="showModal"
      :provider-to-edit="providerToEdit"
      :categories="categories"
      :is-loading="isSaving"
      @close="showModal = false"
      @save="handleSave"
      @create-category="handleCreateCategory"
    />

    <CategoryDeleteModal
       :is-open="showCatDeleteModal"
       :categories="categories.map(c => c.name)"
       :materials="providers.map(p => ({ ...p, category: p.category?.name || '' }))" 
       @close="showCatDeleteModal = false"
       @delete="handleDeleteCategory"
    />
  </div>
</template>

<style lang="scss" scoped>
.providers-view {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
  min-height: 80vh;
  /* Ensure full height for centering */
  display: flex;
  flex-direction: column;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;

  h1 {
    color: $NICOLE-PURPLE;
    margin: 0;
  }

  p {
    color: $text-light;
    margin: 0.5rem 0 0;
  }
}

.header-actions {
  display: flex;
  gap: 1rem;
}

.btn-secondary {
  background: white;
  border: 1px solid $border-light;
  color: $text-dark;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
  transition: all 0.2s;

  &:hover {
    background: $gray-50;
    border-color: $gray-300;
  }
}

.category-badge {
  background: $purple-overlay;
  color: $NICOLE-PURPLE;
  padding: 0.2rem 0.6rem;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
  margin-top: 0.25rem;
  display: inline-block;
}

.header-main {
  display: flex;
  flex-direction: column;
}

.btn-primary {
  background: $NICOLE-PURPLE;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
  transition: all 0.2s;

  &:hover {
    background: $purple-dark;
    transform: translateY(-1px);
  }
}

.providers-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
  width: 100%;
}

.provider-card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  border: 1px solid $border-light;
  transition: all 0.2s;

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.08);
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;

    h3 {
      margin: 0;
      color: $text-dark;
      font-size: 1.2rem;
    }
  }

  .card-body {
    p {
      margin: 0.5rem 0;
      color: $text-light;
      font-size: 0.9rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;

      i {
        color: $gray-400;
        width: 16px;
      }
    }
  }
}

.actions {
  display: flex;
  gap: 0.5rem;

  .btn-icon {
    background: none;
    border: none;
    color: $gray-400;
    cursor: pointer;
    padding: 0.25rem;
    transition: color 0.2s;

    &:hover {
      color: $NICOLE-PURPLE;
    }

    &.delete:hover {
      color: $error;
    }
  }
}

.agents-preview {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid $border-light;
  display: flex;
  justify-content: space-between;
  align-items: center;

  span {
    font-size: 0.8rem;
    color: $gray-500;
    font-weight: 500;
  }
}

.agent-avatars {
  display: flex;

  .avatar {
    width: 24px;
    height: 24px;
    background: $purple-light;
    color: $NICOLE-PURPLE;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    border: 2px solid white;
    margin-left: -8px;
    font-weight: bold;

    &:first-child {
      margin-left: 0;
    }

    &.more {
      background: $gray-200;
      color: $text-light;
    }
  }
}

.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: 4rem;
  color: $gray-400;

  i {
    font-size: 3rem;
    margin-bottom: 1rem;
  }
}

/* Professional Loading Spinner */
.loading-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 400px;
  gap: 1.5rem;

  p {
    color: $text-light;
    font-weight: 500;
    font-size: 1.1rem;
    animation: pulse 1.5s infinite ease-in-out;
  }
}

.spinner {
  width: 50px;
  height: 50px;
  border: 4px solid rgba($NICOLE-PURPLE, 0.1);
  border-left-color: $NICOLE-PURPLE;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

@keyframes pulse {

  0%,
  100% {
    opacity: 0.6;
  }

  50% {
    opacity: 1;
  }
}
</style>
