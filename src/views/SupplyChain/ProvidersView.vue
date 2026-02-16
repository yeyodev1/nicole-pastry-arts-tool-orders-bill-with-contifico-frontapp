<script setup lang="ts">
import { ref, onMounted } from 'vue'
import ProviderService from '@/services/provider.service'
import { useToast } from '@/composables/useToast'
import ProviderModal from '@/components/SupplyChain/ProviderModal.vue'

const { success, error: showError } = useToast()

const providers = ref<any[]>([])
const isLoading = ref(false)
const isSaving = ref(false)
const showModal = ref(false)
const providerToEdit = ref<any>(null)
const searchQuery = ref('')
let searchTimeout: any = null

const fetchData = async () => {
  isLoading.value = true
  try {
    const data = await ProviderService.getProviders(searchQuery.value)
    providers.value = data
  } catch (err: any) {
    showError('Error al cargar datos')
  } finally {
    isLoading.value = false
  }
}

const handleSearch = () => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    fetchData()
  }, 400)
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
  try {
    await ProviderService.deleteProvider(id)
    success('Proveedor eliminado')
    showModal.value = false
    fetchData()
  } catch (err: any) {
    showError('Error al eliminar proveedor')
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
        <p>Catálogo de aliados y suministros</p>
      </div>
      <div class="search-container">
        <i class="fas fa-search"></i>
        <input 
          v-model="searchQuery" 
          @input="handleSearch"
          placeholder="Buscar proveedor, ruc, teléfono..." 
          type="text"
        />
      </div>
      <div class="header-actions">
        <button class="btn-primary" @click="openNewProviderModal">
          <i class="fas fa-plus"></i> Nuevo Proveedor
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <p>Cargando proveedores...</p>
    </div>

    <!-- Content -->
    <div v-else class="content-wrapper">
      <div v-if="providers.length === 0" class="empty-state">
        <i class="fas fa-truck-loading"></i>
        <p>Aún no tienes proveedores registrados.</p>
      </div>

      <div class="mobile-cards">
        <div v-for="p in providers" :key="p._id" class="provider-card" @click="openEditModal(p)">
          <div class="card-top">
            <div class="card-title">
              <h3>{{ p.name }}</h3>
              <span class="item-count-badge" v-if="p.itemCount > 0">{{ p.itemCount }} ítems</span>
            </div>
          </div>
          <div class="card-details">
            <div class="detail" v-if="p.phone">
              <i class="fas fa-phone"></i> {{ p.phone }}
            </div>
            <div class="detail" v-if="p.email">
              <i class="fas fa-envelope"></i> {{ p.email }}
            </div>
            <div class="agents-row" v-if="p.commercialAgents?.length">
              <span class="agent-count">{{ p.commercialAgents.length }} Agentes</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Desktop Grid -->
      <div class="desktop-grid">
        <div v-for="p in providers" :key="p._id" class="provider-card-desktop" @click="openEditModal(p)">
          <div class="card-header">
            <div class="header-info">
              <h3>{{ p.name }}</h3>
              <div class="meta-pills">
                <span class="pill items" v-if="p.itemCount > 0">{{ p.itemCount }} productos</span>
                <span class="pill agents" v-if="p.commercialAgents?.length">{{ p.commercialAgents.length }} agentes</span>
              </div>
            </div>
            <div class="actions">
               <div class="btn-view"><i class="fas fa-edit"></i></div>
            </div>
          </div>
          <div class="card-body">
            <div class="info-row" v-if="p.ruc">
              <i class="fas fa-id-card"></i> {{ p.ruc }}
            </div>
            <div class="info-row" v-if="p.phone">
              <i class="fas fa-phone"></i> {{ p.phone }}
            </div>
            <div class="info-row" v-if="p.email">
              <i class="fas fa-envelope"></i> {{ p.email }}
            </div>
          </div>
          <div class="card-footer" v-if="p.commercialAgents?.length">
             <div class="agents-avatars">
               <div v-for="(agent, i) in p.commercialAgents.slice(0, 3)" :key="i" class="avatar">
                 {{ agent.name.charAt(0) }}
               </div>
               <div v-if="p.commercialAgents.length > 3" class="avatar more">+{{ p.commercialAgents.length - 3 }}</div>
             </div>
             <span class="agents-label">Gestión de agentes</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Modals -->
    <ProviderModal
      :is-open="showModal"
      :provider-to-edit="providerToEdit"
      :is-loading="isSaving"
      @close="showModal = false"
      @save="handleSave"
      @delete="handleDelete"
    />
  </div>
</template>

<style lang="scss" scoped>
.providers-view {
  padding: 1rem;
  max-width: 1200px;
  margin: 0 auto;

  @media (min-width: 768px) {
    padding: 2rem;
  }
}

.header {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  margin-bottom: 2.5rem;

  @media (min-width: 768px) {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }

  h1 {
    color: $NICOLE-PURPLE;
    margin: 0;
    font-size: 1.75rem;
    font-weight: 800;
  }

  p {
    color: #64748b;
    margin: 0.25rem 0 0;
  }
}

.search-container {
  flex: 1;
  max-width: 400px;
  position: relative;

  @media (max-width: 768px) {
    max-width: 100%;
  }

  i {
    position: absolute;
    left: 1rem;
    top: 50%;
    transform: translateY(-50%);
    color: #94a3b8;
  }

  input {
    width: 100%;
    padding: 0.75rem 1rem 0.75rem 2.75rem;
    border: 2px solid #f1f5f9;
    border-radius: 14px;
    font-size: 0.95rem;
    transition: all 0.2s;
    background: #f8fafc;

    &:focus {
      outline: none;
      border-color: $NICOLE-PURPLE;
      background: white;
      box-shadow: 0 0 0 4px rgba($NICOLE-PURPLE, 0.1);
    }
  }
}

.header-actions {
  display: flex;
  gap: 1rem;

  button {
    flex: 1;

    @media (min-width: 768px) {
      flex: none;
    }
  }
}

// Mobile Layout
.mobile-cards {
  display: flex;
  flex-direction: column;
  gap: 1rem;

  @media (min-width: 768px) {
    display: none;
  }

  .provider-card {
    background: white;
    padding: 1.5rem;
    border-radius: 24px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    border: 1px solid #f1f5f9;
    cursor: pointer;

    .card-title {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;

      h3 {
        margin: 0;
        font-size: 1.2rem;
        color: #1e293b;
        font-weight: 900;
      }

      .item-count-badge {
        font-size: 0.7rem;
        font-weight: 800;
        background: #f1f5f9;
        color: #64748b;
        padding: 0.25rem 0.6rem;
        border-radius: 8px;
        text-transform: uppercase;
      }
    }

    .card-details {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;

      .detail {
        font-size: 0.9rem;
        color: #475569;
        display: flex;
        align-items: center;
        gap: 0.75rem;

        i {
          color: #cbd5e1;
          width: 14px;
        }
      }

      .agent-count {
        font-size: 0.8rem;
        color: $NICOLE-PURPLE;
        font-weight: 700;
        margin-top: 0.5rem;
        display: block;
        border-top: 1px solid #f1f5f9;
        padding-top: 0.5rem;
      }
    }
  }
}

// Desktop Layout
.desktop-grid {
  display: none;

  @media (min-width: 768px) {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1.5rem;
  }

  .provider-card-desktop {
    background: white;
    border-radius: 28px;
    padding: 1.75rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.03);
    border: 2px solid #f1f5f9;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    display: flex;
    flex-direction: column;

    &:hover {
      transform: translateY(-8px);
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
      border-color: $NICOLE-PURPLE;

      .btn-view {
        background: $NICOLE-PURPLE;
        color: white;
      }
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 1.5rem;

      .meta-pills {
        display: flex;
        gap: 0.5rem;
        margin-top: 0.5rem;

        .pill {
          font-size: 0.65rem;
          font-weight: 900;
          text-transform: uppercase;
          padding: 0.25rem 0.6rem;
          border-radius: 8px;

          &.items {
            background: rgba($NICOLE-PURPLE, 0.1);
            color: $NICOLE-PURPLE;
          }

          &.agents {
            background: #f1f5f9;
            color: #64748b;
          }
        }
      }

      h3 {
        margin: 0;
        font-size: 1.35rem;
        color: #0f172a;
        font-weight: 900;
      }

      .btn-view {
        width: 36px;
        height: 36px;
        border-radius: 12px;
        background: #f1f5f9;
        color: #94a3b8;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      }
    }

    .card-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.8rem;
      margin-bottom: 1.5rem;

      .info-row {
        font-size: 0.95rem;
        color: #475569;
        display: flex;
        align-items: center;
        gap: 0.75rem;

        i {
          color: #cbd5e1;
          font-size: 0.85rem;
        }
      }
    }

    .card-footer {
      padding-top: 1.25rem;
      border-top: 1px solid #f8fafc;
      display: flex;
      align-items: center;
      gap: 0.75rem;

      .agents-avatars {
        display: flex;

        .avatar {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: $NICOLE-PURPLE;
          color: white;
          border: 3px solid white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.7rem;
          font-weight: 900;
          margin-left: -12px;

          &:first-child {
            margin-left: 0;
          }

          &.more {
            background: #f1f5f9;
            color: #64748b;
          }
        }
      }

      .agents-label {
        font-size: 0.85rem;
        color: #94a3b8;
        font-weight: 600;
      }
    }
  }
}

.btn-primary {
  background: $NICOLE-PURPLE;
  color: white;
  border: none;
  padding: 1rem 1.75rem;
  border-radius: 16px;
  font-weight: 800;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: all 0.2s;

  &:hover {
    background: darken($NICOLE-PURPLE, 5%);
    transform: translateY(-1px);
    box-shadow: 0 10px 15px rgba($NICOLE-PURPLE, 0.2);
  }
}

.loading-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  gap: 1.5rem;

  .spinner {
    width: 48px;
    height: 48px;
    border: 4px solid #f1f5f9;
    border-top-color: $NICOLE-PURPLE;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  p {
    color: #64748b;
    font-weight: 600;
    font-size: 1.1rem;
  }
}

.empty-state {
  text-align: center;
  padding: 6rem 1rem;
  background: white;
  border-radius: 32px;
  border: 2px dashed #e2e8f0;
  color: #94a3b8;
  margin: 2rem 0;

  i {
    font-size: 4rem;
    margin-bottom: 2rem;
    opacity: 0.3;
  }

  p {
    font-size: 1.2rem;
    font-weight: 500;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
