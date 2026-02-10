<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import RawMaterialService from '@/services/raw-material.service'
import ProviderService from '@/services/provider.service'
import { useToast } from '@/composables/useToast'
import DeleteMaterialModal from './components/DeleteMaterialModal.vue'
import CategoryDeleteModal from './components/CategoryDeleteModal.vue'

const { success, error: showError } = useToast()

const materials = ref<any[]>([])
const providers = ref<any[]>([])
const isLoading = ref(false)
const isSaving = ref(false)
const showModal = ref(false)
const materialToEdit = ref<any>(null)

// Delete Modal State
const showDeleteModal = ref(false)
const materialToDelete = ref<any>(null)

const form = ref({
  name: '',
  unit: 'g',
  quantity: 1,
  cost: 0,
  wastePercentage: 0,
  minStock: 0,
  provider: '',
  category: ''
})

const showCategoryModal = ref(false)
const newCategoryName = ref('')
const categoryInput = ref<HTMLInputElement | null>(null)

// Category Deletion
const showDeleteCategoryModal = ref(false)
const isDeletingCat = ref(false)

const openCategoryModal = () => {
  newCategoryName.value = ''
  showCategoryModal.value = true
  setTimeout(() => categoryInput.value?.focus(), 100)
}

const createCategory = () => {
  if (newCategoryName.value.trim()) {
    form.value.category = newCategoryName.value.trim()
    showCategoryModal.value = false
    success('Categoría creada exitosamente')
  }
}

const openDeleteCategoryModal = () => {
  showDeleteCategoryModal.value = true
}

const deleteCategory = async (categoryToDelete: string) => {
  if (!categoryToDelete) return

  isDeletingCat.value = true
  try {
    // Find all materials with this category
    const materialsToUpdate = materials.value.filter(m => m.category === categoryToDelete)

    // Update each one to remove category
    // In a real app, backend loop or bulk update is better. Here we iterate.
    const updatePromises = materialsToUpdate.map(m => {
      return RawMaterialService.updateRawMaterial(m._id, { category: '' })
    })

    await Promise.all(updatePromises)

    // Refresh local data
    await fetchData()

    // If current form has this category selected, clear it
    if (form.value.category === categoryToDelete) {
      form.value.category = ''
    }

    success(`Categoría "${categoryToDelete}" eliminada y removida de ${materialsToUpdate.length} insumos.`)
    showDeleteCategoryModal.value = false
  } catch (err) {
    showError('Error al eliminar categoría')
    console.error(err)
  } finally {
    isDeletingCat.value = false
  }
}

const units = [
  { value: 'g', label: 'Kilogramos (kg)' },
  { value: 'ml', label: 'Litros (L)' },
  { value: 'u', label: 'Unidades (u)' }
]

// Computed for Categories
const uniqueCategories = computed(() => {
  const cats = new Set(materials.value.map(m => m.category || 'Sin Categoría'))
  if (form.value.category && form.value.category !== 'Sin Categoría') {
    cats.add(form.value.category)
  }
  return Array.from(cats).sort()
})

const groupedMaterials = computed(() => {
  const groups: Record<string, any[]> = {}

  // Initialize from unique categories to ensure order
  uniqueCategories.value.forEach(cat => {
    groups[cat] = []
  })

  materials.value.forEach(m => {
    const cat = m.category || 'Sin Categoría'
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(m)
  })

  return groups
})

// Cost Calculation Helpers
const unitCosts = computed(() => {
  if (!form.value.cost || !form.value.quantity) return null

  // Input Quantity is in Display Units (Kg/L/u)
  // Backend Quantity is in Base Units (g/ml/u)

  const backendQty = toBackendQuantity(form.value.quantity, form.value.unit)
  const totalCost = form.value.cost

  if (backendQty <= 0) return null

  const costPerBaseUnit = totalCost / backendQty // $/g or $/ml or $/u

  if (form.value.unit === 'u') {
    return {
      base: costPerBaseUnit, // $/u
      unitLabel: 'u'
    }
  }

  // If unit is weight/volume (g/ml -> kg/L)
  const wasteFactor = 1 - (form.value.wastePercentage / 100)
  const usableBackendQty = backendQty * wasteFactor

  if (usableBackendQty <= 0) return null

  const costPerUsableBaseUnit = totalCost / usableBackendQty // $/g or $/ml or $/u

  if (form.value.unit === 'u') {
    return {
      base: costPerUsableBaseUnit, // $/u
      unitLabel: 'u',
      isWasteIncluded: form.value.wastePercentage > 0
    }
  }

  return {
    perKgL: costPerUsableBaseUnit * 1000,
    perGml: costPerUsableBaseUnit,
    isWasteIncluded: form.value.wastePercentage > 0
  }
})

// Helpers for Unit Conversion
const getDisplayUnit = (unit: string) => {
  if (unit === 'g') return 'kg'
  if (unit === 'ml') return 'L'
  return unit
}

const getDisplayQuantity = (quantity: number, unit: string) => {
  if (unit === 'g' || unit === 'ml') return quantity / 1000
  return quantity
}

const toBackendQuantity = (inputQty: number, unit: string) => {
  if (unit === 'g' || unit === 'ml') return inputQty * 1000
  return inputQty
}

const getStockStatus = (m: any) => {
  if (!m.minStock) return 'optimal'
  if (m.quantity < m.minStock) return 'low'
  if (m.quantity < m.minStock * 1.5) return 'warning'
  return 'optimal'
}

const resetForm = () => {
  form.value = { name: '', unit: 'g', quantity: 1, cost: 0, wastePercentage: 0, minStock: 0, provider: '', category: '' }
  materialToEdit.value = null
}

const fetchData = async () => {
  isLoading.value = true
  try {
    const [materialsData, providersData] = await Promise.all([
      RawMaterialService.getRawMaterials(),
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

const openModal = (material: any = null) => {
  if (material) {
    materialToEdit.value = material
    form.value = {
      name: material.name,
      unit: material.unit,
      quantity: getDisplayQuantity(material.quantity || 0, material.unit), // Convert to kg/L for edit
      cost: material.cost || 0,
      wastePercentage: material.wastePercentage || 0,
      minStock: getDisplayQuantity(material.minStock || 0, material.unit),
      provider: material.provider?._id || '',
      category: material.category || ''
    }
  } else {
    resetForm()
  }

  showModal.value = true
}

const handleSubmit = async () => {
  isSaving.value = true
  try {
    const payload: any = { ...form.value }

    // Convert quantities back to backend units (g/ml)
    payload.quantity = toBackendQuantity(payload.quantity, payload.unit)
    payload.minStock = toBackendQuantity(payload.minStock || 0, payload.unit)

    if (!payload.provider) {
      delete payload.provider
    }

    if (materialToEdit.value) {
      await RawMaterialService.updateRawMaterial(materialToEdit.value._id, payload)
      success('Materia prima actualizada')
    } else {
      await RawMaterialService.createRawMaterial(payload)
      success('Materia prima creada')
    }
    showModal.value = false
    fetchData()
  } catch (err: any) {
    console.error(err)
    showError(err.response?.data?.message || 'Error al guardar')
  } finally {
    isSaving.value = false
  }
}

const openDeleteModal = (material: any) => {
  materialToDelete.value = material
  showDeleteModal.value = true
}

const handleDeleteConfirm = async () => {
  if (!materialToDelete.value) return

  try {
    await RawMaterialService.deleteRawMaterial(materialToDelete.value._id)
    success('Materia prima eliminada correctamente')
    fetchData()
  } catch (err) {
    console.error(err)
    showError('Error al eliminar materia prima')
  } finally {
    showDeleteModal.value = false
    materialToDelete.value = null
  }
}

onMounted(() => {
  fetchData()
})
</script>

<template>
  <div class="materials-view">
    <div class="header">
      <div class="title">
        <h1>Materia Prima</h1>
        <p>Catálogo de insumos y materiales</p>
      </div>
      <button class="btn-primary" @click="openModal()">
        <i class="fas fa-plus"></i> Nueva Materia Prima
      </button>
    </div>

    <div v-if="isLoading" class="loading">Cargando...</div>

    <div v-else class="materials-table-container">
      <table class="materials-table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Stock Actual</th>
            <th>Stock Mínimo</th>
            <th>Merma (%)</th>
            <th>Costo Total</th>
            <th>Costo Unit. Real</th>
            <th>Proveedor Principal</th>
            <th class="actions-col">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="materials.length === 0">
            <td colspan="8" class="empty-cell">No hay materias primas registradas</td>
          </tr>
          <template v-for="cat in uniqueCategories" :key="cat">
            <tr class="category-header">
              <td colspan="8">{{ cat }}</td>
            </tr>
            <tr 
              v-for="material in groupedMaterials[cat]" 
              :key="material._id"
              class="material-row"
              @click="openModal(material)"
            >
              <td class="name-cell">{{ material.name }}</td>
              <td>
                <span class="unit-badge" :class="[material.unit, getStockStatus(material)]">
                  {{ getDisplayQuantity(material.quantity, material.unit) }} {{ getDisplayUnit(material.unit) }}
                </span>
              </td>
              <td class="min-stock-cell">
                 {{ getDisplayQuantity(material.minStock || 0, material.unit) }} {{ getDisplayUnit(material.unit) }}
              </td>
              <td class="waste-cell">
                <span v-if="material.wastePercentage > 0" class="waste-badge">
                  {{ material.wastePercentage }}%
                </span>
                <span v-else class="text-muted">0%</span>
              </td>
              <td class="cost-cell">${{ material.cost?.toFixed(2) }}</td>
              <td class="unit-cost-cell">
                <div v-if="material.quantity > 0 && material.cost > 0">
                  <div class="primary-cost">
                    ${{ (material.cost / ((material.quantity * (1 - (material.wastePercentage || 0) / 100)) / 1000 || 1)).toFixed(2) }} 
                    <span class="unit-label">/ {{ getDisplayUnit(material.unit) }}</span>
                  </div>
                  <div class="secondary-cost">
                    ${{ (material.cost / (material.quantity * (1 - (material.wastePercentage || 0) / 100) || 1)).toFixed(5) }} 
                    <span class="unit-label">/ {{ material.unit }}</span>
                  </div>
                </div>
                <div v-else class="text-muted">-</div>
              </td>
              <td>
                <span v-if="material.provider" class="provider-link">{{ material.provider.name }}</span>
                <span v-else class="text-muted">-</span>
              </td>
              <td class="actions-cell" @click.stop>
                <button @click.stop="openModal(material)" class="btn-icon"><i class="fas fa-edit"></i></button>
                <button 
                  class="btn-icon delete"
                  @click.stop="openDeleteModal(material)"
                >
                  <i class="fas fa-trash"></i>
                </button>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <!-- Modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
      <div class="modal-content">
        <div class="modal-header">
          <h2>{{ materialToEdit ? 'Editar' : 'Nueva' }} Materia Prima</h2>
          <button class="btn-close" @click="showModal = false">&times;</button>
        </div>
        
        <div class="modal-body">
          <div class="form-group">
            <label>Nombre</label>
            <input v-model="form.name" placeholder="Ej. Harina de Trigo" />
          </div>

          <div class="form-group">
            <div class="label-row">
              <label>Categoría</label>
              <div class="category-actions">
                <button 
                  type="button" 
                  class="btn-link-danger"
                  @click="openDeleteCategoryModal"
                  title="Eliminar una categoría existente"
                >
                  <i class="fas fa-trash-alt"></i>
                </button>
                <button 
                  type="button" 
                  class="btn-link"
                  @click="openCategoryModal"
                >
                  + Nueva Categoría
                </button>
              </div>
            </div>
            <div class="select-wrapper">
                <select v-model="form.category" class="styled-select">
                <option value="">-- Seleccionar --</option>
                <option v-for="cat in uniqueCategories" :key="cat" :value="cat">{{ cat }}</option>
                </select>
                <i class="fas fa-chevron-down select-icon"></i>
            </div>
          </div>

          <div class="form-group">
            <label>Unidad de Medida</label>
            <select v-model="form.unit">
              <option v-for="u in units" :key="u.value" :value="u.value">{{ u.label }}</option>
            </select>
          </div>

          <div class="form-row">
            <div class="form-group half">
              <label>Cantidad Actual ({{ getDisplayUnit(form.unit) }})</label>
              <input type="number" v-model.number="form.quantity" min="0" step="0.01" />
            </div>
            <div class="form-group half">
              <label>Stock Mínimo ({{ getDisplayUnit(form.unit) }})</label>
              <input type="number" v-model.number="form.minStock" min="0" step="0.01" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group half">
              <label>Costo Total ($)</label>
              <input type="number" v-model.number="form.cost" min="0" step="0.01" />
            </div>
          </div>

          <div class="form-group">
            <label>Porcentaje de Merma (%)</label>
            <div class="input-with-icon">
              <input type="number" v-model.number="form.wastePercentage" min="0" max="100" step="0.1" />
              <i class="fas fa-percent"></i>
            </div>
            <p class="form-helper">El costo unitario se calculará sobre la parte utilizable.</p>
          </div>
          
          <!-- Cost Analysis -->
          <div v-if="unitCosts" class="cost-analysis">
            <div class="analysis-header">
              <span class="label">Análisis de Costo Real</span>
              <span v-if="unitCosts.isWasteIncluded" class="is-waste">
                <i class="fas fa-exclamation-triangle"></i> Incluye {{ form.wastePercentage }}% de merma
              </span>
            </div>
            
            <div v-if="form.unit === 'u'" class="analysis-body">
               <span>Costo por Unidad: <strong>${{ unitCosts.base?.toFixed(4) }}</strong></span>
            </div>
            <div v-else class="analysis-body">
               <div class="main-cost">Costo por {{ unitCosts.unitLabel }}: <strong>${{ unitCosts.perKgL?.toFixed(2) }}</strong></div>
               <div class="small-cost">Costo por {{ form.unit }}: ${{ unitCosts.perGml?.toFixed(5) }}</div>
            </div>
          </div>

          <div class="form-group">
            <label>Proveedor (Opcional)</label>
            <select v-model="form.provider">
              <option value="">-- Seleccionar --</option>
              <option v-for="p in providers" :key="p._id" :value="p._id">{{ p.name }}</option>
            </select>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-secondary" @click="showModal = false">Cancelar</button>
          <button class="btn-primary" @click="handleSubmit" :disabled="!form.name || isSaving || !form.provider">
            {{ isSaving ? 'Guardando...' : 'Guardar' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Category Creation Modal (Stacked) -->
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

    <!-- Delete Category Modal -->
    <CategoryDeleteModal
        :is-open="showDeleteCategoryModal"
        :categories="uniqueCategories"
        :materials="materials"
        @close="showDeleteCategoryModal = false"
        @delete="deleteCategory"
    />

    <!-- Delete Modal -->
    <DeleteMaterialModal
      :is-open="showDeleteModal"
      :material-name="materialToDelete?.name || ''"
      @close="showDeleteModal = false"
      @confirm="handleDeleteConfirm"
    />
  </div>
</template>

<style lang="scss" scoped>
.materials-view {
  padding: 2rem;
  max-width: 1000px;
  margin: 0 auto;
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
    margin: 0.5rem 0 0;
    color: $text-light;
  }
}

.btn-primary {
  background: $NICOLE-PURPLE;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;

  &:hover {
    background: $purple-dark;
  }
}

.materials-table-container {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  overflow-x: auto;
  /* Horizontal Scroll */
  border: 1px solid $border-light;
}

.materials-table {
  width: 100%;
  min-width: 700px;
  /* Ensure scroll on small screens */
  border-collapse: collapse;

  th,
  td {
    padding: 1rem 1.5rem;
    text-align: left;
    border-bottom: 1px solid $border-light;
  }

  th {
    background: $gray-50;
    font-weight: 600;
    color: $text-light;
    font-size: 0.9rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  tr:last-child td {
    border-bottom: none;
  }

  /* Category Header */
  .category-header {
    td {
      background-color: $gray-100;
      color: $NICOLE-PURPLE;
      font-weight: 700;
      font-size: 0.95rem;
      padding: 0.75rem 1.5rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-top: 2px solid white;
    }
  }

  /* Row Interactions */
  .material-row {
    cursor: pointer;
    transition: background-color 0.2s;

    &:hover {
      background-color: $gray-50;
    }
  }

  /* ... rest of existing styles ... */

  /* Cost Analysis */
  .cost-analysis {
    background-color: #fffbeb;
    border: 1px solid #fef3c7;
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 1.5rem;

    .analysis-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
      border-bottom: 1px solid rgba(#b45309, 0.1);
      padding-bottom: 0.4rem;

      .label {
        font-size: 0.75rem;
        font-weight: 700;
        text-transform: uppercase;
        color: #92400e;
      }
    }

    .main-cost {
      font-size: 1rem;
      color: $text-dark;

      strong {
        color: #b45309;
        font-size: 1.25rem;
      }
    }

    .small-cost {
      font-size: 0.8rem;
      color: #92400e;
      opacity: 0.8;
      margin-top: 2px;
    }
  }

  .name-cell {
    font-weight: 500;
    color: $text-dark;
  }

  .cost-cell {
    font-family: monospace;
    font-weight: 500;
    color: $text-dark;
  }

  .unit-cost-cell {
    font-family: monospace;

    .primary-cost {
      font-weight: 600;
      color: $NICOLE-PURPLE;
      font-size: 0.95rem;
    }

    .secondary-cost {
      font-size: 0.8rem;
      color: $text-light;
      margin-top: 2px;
    }

    .unit-label {
      font-size: 0.75rem;
      color: $gray-400;
      font-weight: normal;
    }
  }
}

.unit-badge {
  display: inline-block;
  padding: 0.25rem 0.6rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 600;
  background: $gray-100;
  color: $text-light;

  &.g {
    background: #e3f2fd;
    color: #1976d2;
  }

  &.ml {
    background: #e8f5e9;
    color: #388e3c;
  }

  &.u {
    background: #fff3e0;
    color: #f57c00;
  }

  &.low {
    background: #fee2e2 !important;
    color: #b91c1c !important;
    border: 1px solid #f87171;
  }

  &.warning {
    background: #fef3c7 !important;
    color: #92400e !important;
    border: 1px solid #fbbf24;
  }
}

.provider-link {
  color: $NICOLE-PURPLE;
  font-weight: 500;
}

.text-muted {
  color: $gray-400;
  font-style: italic;
}

.actions-cell {
  display: flex;
  gap: 0.5rem;
}

.btn-icon {
  background: none;
  border: none;
  cursor: pointer;
  color: $gray-400;

  &:hover {
    color: $NICOLE-PURPLE;
  }

  &.delete {
    transition: transform 0.2s, color 0.2s;

    &:hover {
      color: $error;
    }
  }
}

/* Modal Styles */
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
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.input-with-icon {
  position: relative;
  display: flex;
  align-items: center;

  input {
    padding-right: 2.5rem !important;
  }

  i {
    position: absolute;
    right: 1rem;
    color: $text-light;
    font-size: 0.9rem;
  }
}

.form-helper {
  font-size: 0.8rem;
  color: $text-light;
  margin-top: 0.4rem;
  font-style: italic;
}

.waste-cell {
  .waste-badge {
    background: #fffbeb;
    color: #b45309;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    font-size: 0.8rem;
    font-weight: 700;
  }
}

.is-waste {
  color: #b45309;
  font-size: 0.75rem;
  font-weight: 700;
  margin-left: 4px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;

  h2 {
    color: $NICOLE-PURPLE;
    margin: 0;
  }

  .btn-close {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
  }
}

.form-group {
  margin-bottom: 1rem;

  label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
  }

  input,
  select {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid $border-light;
    border-radius: 6px;
  }
}


.category-toggle {
  margin-top: 0.5rem;

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
    color: $NICOLE-PURPLE;
    cursor: pointer;
    font-weight: normal;

    input[type="checkbox"] {
      width: auto;
      margin: 0;
      accent-color: $NICOLE-PURPLE;
      height: 16px;
      width: 16px;
    }
  }
}

.form-row {
  display: flex;
  gap: 1rem;

  .form-group.half {
    flex: 1;
  }
}

.modal-footer {
  margin-top: 2rem;
  display: flex;
  justify-content: flex-end;
  gap: 1rem;

  .btn-secondary {
    background: $gray-200;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 6px;
    cursor: pointer;
  }
}

/* Specific Utilities */
.z-high {
  z-index: 1100 !important; // Higher than standard modal
}

.small-modal {
  max-width: 400px !important;
}

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

.btn-link-danger {
  background: none;
  border: none;
  color: $error; // Using standard error color
  font-size: 0.85rem;
  cursor: pointer;
  padding: 0;
  margin-right: 1rem;
  opacity: 0.7;

  &:hover {
    opacity: 1;
    color: #d32f2f;
  }
}

.category-actions {
  display: flex;
  align-items: center;
}

.select-wrapper {
  position: relative;

  .styled-select {
    width: 100%;
    padding: 0.75rem;
    padding-right: 2.5rem; // Space for icon
    border: 1px solid $border-light;
    border-radius: 6px;
    appearance: none; // Hide default arrow
    background-color: white;
    cursor: pointer;
    font-size: 1rem;
    color: $text-dark;

    &:focus {
      outline: none;
      border-color: $NICOLE-PURPLE;
      box-shadow: 0 0 0 2px rgba($NICOLE-PURPLE, 0.1);
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

.text-danger {
  color: $error;
}

.modal-text {
  color: $text-light;
  margin-bottom: 1rem;
  font-size: 0.95rem;
}
</style>
