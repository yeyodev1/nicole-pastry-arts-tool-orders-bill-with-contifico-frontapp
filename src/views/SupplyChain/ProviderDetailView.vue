<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ProviderService from '@/services/provider.service'
import RawMaterialService from '@/services/raw-material.service'
import ProviderCategoryService from '@/services/provider-category.service'
import type { IProviderCategory } from '@/services/provider-category.service'
import { useToast } from '@/composables/useToast'
import ProviderModal from '@/components/SupplyChain/ProviderModal.vue'
import RawMaterialModal from '@/components/SupplyChain/RawMaterialModal.vue'

const route = useRoute()
const router = useRouter()
const { success, error: showError } = useToast()

const providerId = route.params.id as string

const provider = ref<any>(null)
const materials = ref<any[]>([])
const categories = ref<IProviderCategory[]>([])
const isLoading = ref(false)
const isSaving = ref(false)

const showProviderModal = ref(false)
const showMaterialModal = ref(false)
const materialToEdit = ref<any>(null)

const fetchData = async () => {
  isLoading.value = true
  try {
    const [providerData, materialsData, categoriesData] = await Promise.all([
      ProviderService.getProviderById(providerId),
      RawMaterialService.getRawMaterials(undefined, providerId, undefined),
      ProviderCategoryService.getCategories()
    ])
    provider.value = providerData
    materials.value = materialsData
    categories.value = categoriesData
  } catch (err) {
    showError('Error al cargar datos del proveedor')
  } finally {
    isLoading.value = false
  }
}

const handleProviderSave = async (formData: any) => {
  isSaving.value = true
  try {
    await ProviderService.updateProvider(providerId, formData)
    success('Proveedor actualizado')
    showProviderModal.value = false
    fetchData()
  } catch (err: any) {
    showError(err.response?.data?.message || 'Error al guardar proveedor')
  } finally {
    isSaving.value = false
  }
}

const handleProviderDelete = async (id: string) => {
  try {
    await ProviderService.deleteProvider(id)
    success('Proveedor eliminado')
    router.push('/supply-chain/providers')
  } catch (err: any) {
    showError('Error al eliminar proveedor')
  }
}

const openNewMaterial = () => {
  materialToEdit.value = null
  showMaterialModal.value = true
}

const openEditMaterial = (material: any) => {
  materialToEdit.value = material
  showMaterialModal.value = true
}

const handleMaterialSave = async (payload: any) => {
  isSaving.value = true
  try {
    if (materialToEdit.value) {
      await RawMaterialService.updateRawMaterial(materialToEdit.value._id, payload)
      success('Material actualizado')
    } else {
      await RawMaterialService.createRawMaterial({ ...payload, provider: providerId })
      success('Material creado')
    }
    showMaterialModal.value = false
    fetchData()
  } catch (err: any) {
    showError(err.response?.data?.message || 'Error al guardar material')
  } finally {
    isSaving.value = false
  }
}

const handleCategoryCreated = (newCat: IProviderCategory) => {
  categories.value = [...categories.value, newCat].sort((a, b) => a.name.localeCompare(b.name))
}

const handleMaterialDelete = async (id: string) => {
  try {
    await RawMaterialService.deleteRawMaterial(id)
    success('Material eliminado')
    showMaterialModal.value = false
    fetchData()
  } catch (err) {
    showError('Error al eliminar material')
  }
}

const getDisplayUnit = (unit: string) => {
  if (unit === 'g') return 'kg'
  if (unit === 'ml') return 'lt'
  return unit
}

const getDisplayQuantity = (quantity: number, unit: string) => {
  if (unit === 'g' || unit === 'ml') return quantity / 1000
  return quantity
}

onMounted(() => {
  fetchData()
})
</script>

<template>
  <div class="detail-view">
    <!-- Back nav -->
    <button class="btn-back" @click="router.push('/supply-chain/providers')">
      <i class="fas fa-arrow-left"></i> Proveedores
    </button>

    <!-- Loading -->
    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <p>Cargando proveedor...</p>
    </div>

    <template v-else-if="provider">
      <!-- Provider Header Card -->
      <div class="provider-header-card">
        <div class="provider-avatar">{{ provider.name.charAt(0) }}</div>
        <div class="provider-info">
          <h1>{{ provider.name }}</h1>
          <div class="info-pills">
            <span class="pill" v-if="provider.ruc"><i class="fas fa-id-card"></i> {{ provider.ruc }}</span>
            <span class="pill" v-if="provider.phone"><i class="fas fa-phone"></i> {{ provider.phone }}</span>
            <span class="pill" v-if="provider.email"><i class="fas fa-envelope"></i> {{ provider.email }}</span>
            <span class="pill" v-if="provider.address"><i class="fas fa-map-marker-alt"></i> {{ provider.address }}</span>
          </div>
          <div class="agents-row" v-if="provider.commercialAgents?.length">
            <span class="agents-label"><i class="fas fa-users"></i> Agentes comerciales:</span>
            <span class="agent-chip" v-for="(a, i) in provider.commercialAgents" :key="i">{{ a.name }}</span>
          </div>
        </div>
        <button class="btn-edit-provider" @click="showProviderModal = true">
          <i class="fas fa-pen"></i> Editar proveedor
        </button>
      </div>

      <!-- Portfolio Section -->
      <div class="portfolio-section">
        <div class="portfolio-header">
          <div>
            <h2>Portafolio de Materias Primas</h2>
            <p>{{ materials.length }} ítem(s) registrado(s) con este proveedor</p>
          </div>
          <button class="btn-new-material" @click="openNewMaterial">
            <i class="fas fa-plus"></i> Nueva Materia Prima
          </button>
        </div>

        <!-- Empty -->
        <div v-if="materials.length === 0" class="empty-portfolio">
          <i class="fas fa-box-open"></i>
          <p>Este proveedor no tiene materias primas registradas aún.</p>
          <button class="btn-new-material outlined" @click="openNewMaterial">
            <i class="fas fa-plus"></i> Agregar primera materia prima
          </button>
        </div>

        <!-- Desktop Table -->
        <div v-else class="table-container">
          <table class="materials-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre / Marca</th>
                <th>Categoría</th>
                <th>Presentación</th>
                <th>Costo U.</th>
                <th>Stock Actual</th>
                <th>Fecha Últ. Mov.</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in materials" :key="m._id" @click="openEditMaterial(m)" :class="{ 'low-stock': m.quantity <= m.minStock }">
                <td><code>{{ m.code || '--' }}</code></td>
                <td>
                  <span class="mat-name">{{ m.name }}</span>
                  <span class="mat-item" v-if="m.item">{{ m.item }}</span>
                </td>
                <td><span class="cat-badge">{{ m.category || '-' }}</span></td>
                <td>
                  <span class="pres-pill" v-if="m.presentationName">
                    {{ m.presentationName }} ({{ m.presentationQuantity }}{{ m.unit }})
                  </span>
                  <span v-else>-</span>
                </td>
                <td class="cost">${{ m.cost?.toFixed(4) }}</td>
                <td class="stock">
                  {{ getDisplayQuantity(m.quantity, m.unit) }}
                  <span class="unit">{{ getDisplayUnit(m.unit) }}</span>
                </td>
                <td class="date">
                  {{ m.lastMovementDate ? new Date(m.lastMovementDate).toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '-' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Mobile Cards -->
        <div v-if="materials.length > 0" class="mobile-cards">
          <div v-for="m in materials" :key="m._id" class="mat-card" @click="openEditMaterial(m)" :class="{ 'low-stock': m.quantity <= m.minStock }">
            <div class="mat-card-top">
              <code>{{ m.code || '--' }}</code>
              <span class="stock-badge" :class="{ warning: m.quantity <= m.minStock }">
                {{ getDisplayQuantity(m.quantity, m.unit) }} {{ getDisplayUnit(m.unit) }}
              </span>
            </div>
            <div class="mat-name">{{ m.name }}</div>
            <div class="mat-meta">
              <span v-if="m.category"><i class="fas fa-tag"></i> {{ m.category }}</span>
              <span><i class="fas fa-dollar-sign"></i> ${{ m.cost?.toFixed(3) }}/{{ getDisplayUnit(m.unit) }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Provider Edit Modal -->
    <ProviderModal
      :is-open="showProviderModal"
      :provider-to-edit="provider"
      :is-loading="isSaving"
      @close="showProviderModal = false"
      @save="handleProviderSave"
      @delete="handleProviderDelete"
    />

    <!-- Raw Material Modal (create + edit) -->
    <RawMaterialModal
      :is-open="showMaterialModal"
      :material-to-edit="materialToEdit"
      :providers="provider ? [provider] : []"
      :categories="categories"
      :is-saving="isSaving"
      @close="showMaterialModal = false"
      @save="handleMaterialSave"
      @delete="handleMaterialDelete"
      @category-created="handleCategoryCreated"
    />
  </div>
</template>

<style lang="scss" scoped>
.detail-view {
  padding: 1.25rem;
  max-width: 1200px;
  margin: 0 auto;
  min-height: 100vh;

  @media (min-width: 768px) {
    padding: 2rem;
  }
}

.btn-back {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: none;
  border: none;
  color: #64748b;
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
  padding: 0.5rem 0;
  margin-bottom: 1.5rem;
  transition: color 0.2s;

  &:hover { color: $NICOLE-PURPLE; }

  i { font-size: 0.85rem; }
}

/* Provider Header */
.provider-header-card {
  background: white;
  border-radius: 28px;
  padding: 1.75rem;
  border: 1px solid #f1f5f9;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
  margin-bottom: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;

  @media (min-width: 768px) {
    flex-direction: row;
    align-items: flex-start;
    gap: 1.75rem;
  }
}

.provider-avatar {
  width: 64px;
  height: 64px;
  border-radius: 20px;
  background: $NICOLE-PURPLE;
  color: white;
  font-size: 1.75rem;
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.provider-info {
  flex: 1;

  h1 {
    font-size: 1.5rem;
    font-weight: 900;
    color: #1e293b;
    margin: 0 0 0.75rem;

    @media (min-width: 768px) {
      font-size: 1.85rem;
    }
  }
}

.info-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.75rem;

  .pill {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 99px;
    padding: 0.35rem 0.75rem;
    font-size: 0.82rem;
    font-weight: 600;
    color: #475569;

    i { color: #94a3b8; font-size: 0.75rem; }
  }
}

.agents-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.25rem;

  .agents-label {
    font-size: 0.8rem;
    font-weight: 700;
    color: #94a3b8;
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .agent-chip {
    background: rgba($NICOLE-PURPLE, 0.08);
    color: $NICOLE-PURPLE;
    border-radius: 99px;
    padding: 0.25rem 0.7rem;
    font-size: 0.78rem;
    font-weight: 700;
  }
}

.btn-edit-provider {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  border: 2px solid #e2e8f0;
  border-radius: 16px;
  background: white;
  color: #475569;
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  align-self: flex-start;

  &:hover {
    border-color: $NICOLE-PURPLE;
    color: $NICOLE-PURPLE;
    background: rgba($NICOLE-PURPLE, 0.05);
  }
}

/* Portfolio */
.portfolio-section {
  background: white;
  border-radius: 28px;
  border: 1px solid #f1f5f9;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
  overflow: hidden;
}

.portfolio-header {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.5rem 1.75rem;
  border-bottom: 1px solid #f8fafc;

  @media (min-width: 640px) {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }

  h2 {
    font-size: 1.15rem;
    font-weight: 900;
    color: #1e293b;
    margin: 0;
  }

  p {
    font-size: 0.85rem;
    color: #94a3b8;
    margin: 0.25rem 0 0;
    font-weight: 600;
  }
}

.btn-new-material {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  border: none;
  border-radius: 16px;
  background: $NICOLE-PURPLE;
  color: white;
  font-weight: 800;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 8px 16px rgba($NICOLE-PURPLE, 0.25);
  }

  &.outlined {
    background: white;
    border: 2px solid $NICOLE-PURPLE;
    color: $NICOLE-PURPLE;

    &:hover {
      background: rgba($NICOLE-PURPLE, 0.05);
      box-shadow: none;
    }
  }
}

.empty-portfolio {
  text-align: center;
  padding: 5rem 2rem;
  color: #94a3b8;

  i {
    font-size: 4rem;
    margin-bottom: 1.5rem;
    opacity: 0.2;
    display: block;
  }

  p {
    font-size: 1.1rem;
    font-weight: 500;
    margin-bottom: 2rem;
  }
}

/* Desktop Table */
.table-container {
  display: none;
  overflow-x: auto;

  @media (min-width: 900px) {
    display: block;
  }
}

.materials-table {
  width: 100%;
  border-collapse: collapse;

  th {
    background: #f8fafc;
    padding: 1rem 1.25rem;
    text-align: left;
    font-size: 0.7rem;
    font-weight: 800;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 2px solid #f1f5f9;
  }

  td {
    padding: 1rem 1.25rem;
    border-bottom: 1px solid #f8fafc;
    font-size: 0.9rem;
    color: #334155;
    cursor: pointer;
    vertical-align: middle;
  }

  tr:hover td { background: #fcfcfd; }

  tr.low-stock td { background: #fff1f2; }

  code {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.78rem;
    font-weight: 800;
    color: #64748b;
    background: #f1f5f9;
    padding: 0.3rem 0.55rem;
    border-radius: 6px;
  }

  .mat-name {
    display: block;
    font-weight: 700;
    color: #1e293b;
  }

  .mat-item {
    display: block;
    font-size: 0.75rem;
    font-weight: 700;
    color: $NICOLE-PURPLE;
    text-transform: uppercase;
    margin-top: 2px;
  }

  .cat-badge {
    font-size: 0.75rem;
    font-weight: 700;
    background: rgba($NICOLE-PURPLE, 0.08);
    color: $NICOLE-PURPLE;
    padding: 0.25rem 0.6rem;
    border-radius: 8px;
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

  .cost {
    font-weight: 900;
    font-family: 'JetBrains Mono', monospace;
    color: #0f172a;
  }

  .stock {
    font-weight: 900;
    color: #1e293b;

    .unit {
      font-size: 0.75rem;
      font-weight: 700;
      color: #94a3b8;
      margin-left: 0.25rem;
    }
  }

  .date {
    font-size: 0.82rem;
    font-weight: 600;
    color: #94a3b8;
  }
}

/* Mobile Cards */
.mobile-cards {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1px;
  background: #f8fafc;

  @media (min-width: 540px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (min-width: 900px) {
    display: none;
  }
}

.mat-card {
  background: white;
  padding: 1.25rem 1.5rem;
  cursor: pointer;
  transition: background 0.15s;

  &:hover { background: #fcfcfd; }

  &.low-stock { background: #fff8f8; }

  .mat-card-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.6rem;

    code {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.75rem;
      font-weight: 800;
      color: #94a3b8;
      background: #f1f5f9;
      padding: 0.25rem 0.5rem;
      border-radius: 6px;
    }
  }

  .stock-badge {
    font-weight: 900;
    font-size: 0.85rem;
    background: #f1f5f9;
    color: #1e293b;
    padding: 0.3rem 0.65rem;
    border-radius: 10px;

    &.warning {
      background: #fee2e2;
      color: #ef4444;
    }
  }

  .mat-name {
    font-size: 1rem;
    font-weight: 800;
    color: #1e293b;
    margin-bottom: 0.5rem;
  }

  .mat-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    font-size: 0.8rem;
    font-weight: 600;
    color: #64748b;

    i { color: #cbd5e1; margin-right: 0.2rem; }
  }
}

/* Loading */
.loading-state {
  text-align: center;
  padding: 10rem 0;

  .spinner {
    width: 50px;
    height: 50px;
    border: 5px solid #f1f5f9;
    border-top-color: $NICOLE-PURPLE;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 1.5rem;
  }

  p {
    color: #64748b;
    font-weight: 600;
  }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
