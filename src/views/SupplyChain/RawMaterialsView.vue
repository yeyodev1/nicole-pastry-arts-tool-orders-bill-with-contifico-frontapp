<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import RawMaterialService from '@/services/raw-material.service'
import ProviderService from '@/services/provider.service'
import { useToast } from '@/composables/useToast'
import RawMaterialModal from '@/components/SupplyChain/RawMaterialModal.vue'

const { success, error: showError } = useToast()

const materials = ref<any[]>([])
const providers = ref<any[]>([])
const isLoading = ref(false)
const isSaving = ref(false)
const showModal = ref(false)
const materialToEdit = ref<any>(null)
const searchQuery = ref('')
let searchTimeout: any = null

const fetchData = async () => {
  isLoading.value = true
  try {
    const [materialsData, providersData] = await Promise.all([
      RawMaterialService.getRawMaterials(searchQuery.value),
      ProviderService.getProviders()
    ])
    materials.value = materialsData
    providers.value = providersData
  } catch (err) {
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

// Derived categories from materials
const categories = computed(() => {
  const uniqueCats = new Set<string>()
  materials.value.forEach(m => {
    if (m.category) uniqueCats.add(m.category)
  })
  return Array.from(uniqueCats).map(name => ({ _id: name, name }))
})

const groupedMaterials = computed(() => {
  const groups: Record<string, any[]> = {}
  materials.value.forEach(m => {
    const cat = m.category || 'Sin Categoría'
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(m)
  })
  return groups
})

const getDisplayUnit = (unit: string) => {
  if (unit === 'g') return 'kg'
  if (unit === 'ml') return 'L'
  return unit
}

const getDisplayQuantity = (quantity: number, unit: string) => {
  if (unit === 'g' || unit === 'ml') return quantity / 1000
  return quantity
}

const openModal = (material: any = null) => {
  materialToEdit.value = material
  showModal.value = true
}

const handleSave = async (payload: any) => {
  isSaving.value = true
  try {
    if (materialToEdit.value) {
      await RawMaterialService.updateRawMaterial(materialToEdit.value._id, payload)
      success('Registro actualizado')
    } else {
      await RawMaterialService.createRawMaterial(payload)
      success('Registro creado')
    }
    showModal.value = false
    fetchData()
  } catch (err: any) {
    showError(err.response?.data?.message || 'Error al guardar')
  } finally {
    isSaving.value = false
  }
}

const handleDeleteItem = async (id: string) => {
  try {
    await RawMaterialService.deleteRawMaterial(id)
    success('Eliminado correctamente')
    showModal.value = false
    fetchData()
  } catch (err) {
    showError('Error al eliminar')
  }
}

const formatDate = (dateString?: string) => {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

onMounted(() => {
  fetchData()
})
</script>

<template>
  <div class="materials-view">
    <div class="header">
      <div class="title">
        <h1>Centro de Suministros</h1>
        <p>Gestión profesional de materia prima y adquisiciones</p>
      </div>
      <div class="search-container">
        <i class="fas fa-search"></i>
        <input 
          v-model="searchQuery" 
          @input="handleSearch"
          placeholder="Buscar material, código, item..." 
          type="text"
        />
      </div>
      <div class="header-actions">
        <button class="btn-primary" @click="openModal()">
          <i class="fas fa-plus"></i> Ingreso / Nuevo
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <p>Cargando inventario...</p>
    </div>

    <!-- Content -->
    <div v-else class="content-wrapper">
      <div v-if="materials.length === 0" class="empty-state">
        <i class="fas fa-truck-loading"></i>
        <p>El inventario está vacío. Realiza tu primer ingreso.</p>
      </div>

      <template v-for="(group, catName) in groupedMaterials" :key="catName">
        <div class="category-section">
          <div class="category-header">
            <span class="cat-label">{{ catName }}</span>
            <span class="badge">{{ group.length }} ítems</span>
          </div>

          <!-- Professional Table View (Desktop/Tablet) -->
          <div class="desktop-table-container">
            <table class="professional-table">
              <thead>
                <tr>
                  <th>Cod.</th>
                  <th>Proveedor</th>
                  <th>Nombre / Marca</th>
                  <th>Descripción General</th>
                  <th>Presentación</th>
                  <th>Costo U.</th>
                  <th>Inv. Actual</th>
                  <th>Última Ent.</th>
                  <th class="date-col">Fecha</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="m in group" :key="m._id" @click="openModal(m)" :class="{ 'low-stock': m.quantity <= m.minStock }">
                  <td class="sku-cell"><code>{{ m.code || '--' }}</code></td>
                  <td class="provider-cell">{{ m.provider?.name || '-' }}</td>
                  <td>
                    <div class="name-block">
                      <span class="brand-name">{{ m.name }}</span>
                      <span class="invoice-hint" v-if="m.lastInvoice">Fac: {{ m.lastInvoice }}</span>
                    </div>
                  </td>
                  <td><span class="item-desc">{{ m.item || '-' }}</span></td>
                  <td>
                    <span class="pres-pill" v-if="m.presentationName">
                      {{ m.presentationName }} ({{ m.presentationQuantity }}{{ m.unit }})
                    </span>
                    <span v-else>-</span>
                  </td>
                  <td class="cost-cell">${{ m.cost?.toFixed(4) }}</td>
                  <td class="stock-cell">
                    <span class="quantity">{{ getDisplayQuantity(m.quantity, m.unit) }}</span>
                    <span class="unit-tag">{{ getDisplayUnit(m.unit) }}</span>
                  </td>
                  <td><span class="entry-num">{{ m.lastEntryNumber || '-' }}</span></td>
                  <td class="date-col">{{ formatDate(m.lastMovementDate) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Mobile Optimized Cards -->
          <div class="mobile-cards">
            <div v-for="m in group" :key="m._id" class="pro-card" @click="openModal(m)">
              <div class="card-header">
                <div class="sku-info">
                  <code>{{ m.code }}</code>
                  <span class="item-type">{{ m.item }}</span>
                </div>
                <div class="stock-display" :class="{ 'warning': m.quantity <= m.minStock }">
                   {{ getDisplayQuantity(m.quantity, m.unit) }} {{ getDisplayUnit(m.unit) }}
                </div>
              </div>
              <h3 class="material-title">{{ m.name }}</h3>
              <div class="card-meta">
                <div class="meta-item">
                  <i class="fas fa-truck"></i>
                  <span>{{ m.provider?.name || 'Sin Proveedor' }}</span>
                </div>
                <div class="meta-item">
                  <i class="fas fa-tag"></i>
                  <span>${{ m.cost?.toFixed(3) }}/{{ getDisplayUnit(m.unit) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- Professional Entry Modal -->
    <RawMaterialModal
      :is-open="showModal"
      :material-to-edit="materialToEdit"
      :providers="providers"
      :categories="categories"
      :is-saving="isSaving"
      @close="showModal = false"
      @save="handleSave"
      @delete="handleDeleteItem"
    />
  </div>
</template>

<style lang="scss" scoped>
.materials-view {
  padding: 1.5rem;
  max-width: 1400px;
  margin: 0 auto;
  min-height: 100vh;
  background: #fcfcfd;
}

.header {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  margin-bottom: 3rem;

  @media (min-width: 1024px) {
    flex-direction: row;
    justify-content: space-between;
    align-items: flex-end;
  }

  .title {
    h1 {
      color: #1e293b;
      font-size: 2.25rem;
      font-weight: 900;
      letter-spacing: -0.02em;
      margin: 0;
    }

    p {
      color: #64748b;
      font-size: 1.1rem;
      margin-top: 0.5rem;
      font-weight: 500;
    }
  }
}

.search-container {
  flex: 1;
  max-width: 450px;
  position: relative;
  margin: 1rem 0;

  @media (min-width: 1024px) {
    margin: 0 2rem;
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
    padding: 0.9rem 1rem 0.9rem 2.75rem;
    border: 2px solid #e2e8f0;
    border-radius: 16px;
    font-size: 1rem;
    transition: all 0.2s;
    background: white;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.02);

    &:focus {
      outline: none;
      border-color: $NICOLE-PURPLE;
      box-shadow: 0 0 0 4px rgba($NICOLE-PURPLE, 0.1);
    }
  }
}

.header-actions {
  display: flex;
  gap: 1rem;

  .btn-primary {
    height: 52px;
    border-radius: 16px;
    font-weight: 800;
    padding: 0 1.5rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    transition: all 0.2s;
    background: $NICOLE-PURPLE;
    color: white;
    border: none;
    box-shadow: 0 4px 12px rgba($NICOLE-PURPLE, 0.2);

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba($NICOLE-PURPLE, 0.3);
    }
  }
}

.category-section {
  margin-bottom: 4rem;
}

.category-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;

  .cat-label {
    font-size: 1.25rem;
    font-weight: 900;
    color: #1e293b;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .badge {
    background: #f1f5f9;
    color: #64748b;
    padding: 0.4rem 1rem;
    border-radius: 99px;
    font-size: 0.85rem;
    font-weight: 800;
  }
}

/* Professional Table Styles */
.desktop-table-container {
  display: none;

  @media (min-width: 1100px) {
    display: block;
    background: white;
    border-radius: 24px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05), 0 10px 15px -5px rgba(0, 0, 0, 0.02);
    border: 1px solid #f1f5f9;
    overflow: hidden;
  }
}

.professional-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;

  th {
    background: #f8fafc;
    padding: 1.25rem 1rem;
    text-align: left;
    font-size: 0.7rem;
    font-weight: 800;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 2px solid #f1f5f9;

    &.date-col {
      width: 100px;
      text-align: center;
    }
  }

  td {
    padding: 1.25rem 1rem;
    border-bottom: 1px solid #f1f5f9;
    font-size: 0.95rem;
    color: #334155;
    cursor: pointer;
    vertical-align: middle;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    &.date-col {
      text-align: center;
      color: #94a3b8;
      font-weight: 600;
      font-size: 0.85rem;
    }
  }

  tr:hover td {
    background: #fcfcfd;
  }

  tr.low-stock td {
    background: #fff1f2;
  }

  .sku-cell code {
    font-family: 'JetBrains Mono', monospace;
    font-weight: 800;
    color: #64748b;
    background: #f1f5f9;
    padding: 0.35rem 0.6rem;
    border-radius: 8px;
    font-size: 0.8rem;
  }

  .name-block {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;

    .brand-name {
      font-weight: 700;
      color: #1e293b;
    }

    .invoice-hint {
      font-size: 0.7rem;
      color: #94a3b8;
      font-weight: 600;
      text-transform: uppercase;
    }
  }

  .item-desc {
    font-weight: 600;
    color: $NICOLE-PURPLE;
    font-size: 0.85rem;
    text-transform: uppercase;
  }

  .pres-pill {
    font-size: 0.75rem;
    font-weight: 700;
    color: #475569;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    padding: 0.25rem 0.6rem;
    border-radius: 8px;
  }

  .cost-cell {
    font-weight: 900;
    font-family: 'JetBrains Mono', monospace;
    color: #0f172a;
  }

  .stock-cell {
    .quantity {
      font-weight: 900;
      color: #1e293b;
      font-size: 1.1rem;
    }

    .unit-tag {
      font-size: 0.75rem;
      font-weight: 800;
      color: #94a3b8;
      margin-left: 0.35rem;
    }
  }

  .entry-num {
    font-weight: 700;
    color: #64748b;
    font-size: 0.85rem;
  }
}

/* Mobile Cards View */
.mobile-cards {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.25rem;

  @media (min-width: 640px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (min-width: 1100px) {
    display: none;
  }
}

.pro-card {
  background: white;
  padding: 1.5rem;
  border-radius: 28px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.03);
  border: 1px solid #f1f5f9;
  cursor: pointer;

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1.25rem;

    .sku-info {
      display: flex;
      flex-direction: column;

      code {
        font-family: 'JetBrains Mono';
        font-weight: 800;
        color: #94a3b8;
        font-size: 0.75rem;
      }

      .item-type {
        font-size: 0.8rem;
        font-weight: 900;
        color: $NICOLE-PURPLE;
        text-transform: uppercase;
        margin-top: 2px;
      }
    }

    .stock-display {
      background: #f1f5f9;
      padding: 0.5rem 0.85rem;
      border-radius: 12px;
      font-weight: 900;
      color: #1e293b;
      font-size: 0.95rem;

      &.warning {
        background: #fee2e2;
        color: #ef4444;
      }
    }
  }

  .material-title {
    font-size: 1.25rem;
    font-weight: 900;
    color: #1e293b;
    margin: 0 0 1rem;
  }

  .card-meta {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding-top: 1rem;
    border-top: 2px solid #f8fafc;

    .meta-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-size: 0.9rem;
      color: #64748b;

      i {
        color: #cbd5e1;
        width: 14px;
      }

      span {
        font-weight: 600;
      }
    }
  }
}

/* Utils */
.loading-state {
  text-align: center;
  padding: 10rem 0;

  .spinner {
    width: 60px;
    height: 60px;
    border: 6px solid #f1f5f9;
    border-top-color: $NICOLE-PURPLE;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 2rem;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.empty-state {
  text-align: center;
  padding: 10rem 2rem;
  background: white;
  border-radius: 40px;
  border: 3px dashed #f1f5f9;
  color: #94a3b8;

  i {
    font-size: 5rem;
    margin-bottom: 2rem;
    opacity: 0.2;
  }

  p {
    font-size: 1.25rem;
    font-weight: 600;
  }
}
</style>
