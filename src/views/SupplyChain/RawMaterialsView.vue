<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import RawMaterialService from '@/services/raw-material.service'
import ProviderService from '@/services/provider.service'
import ProviderCategoryService from '@/services/provider-category.service'
import { useToast } from '@/composables/useToast'
import CategoryManagementModal from './components/CategoryManagementModal.vue'
import HoldConfirmButton from '@/components/ui/HoldConfirmButton.vue'

const { success, error: showError } = useToast()

const materials = ref<any[]>([])
const providers = ref<any[]>([])
const categories = ref<any[]>([])
const isLoading = ref(false)
const isSaving = ref(false)
const showModal = ref(false)
const materialToEdit = ref<any>(null)

// Category Management
const showCategoryModal = ref(false)

const form = ref({
  name: '',
  item: '',
  code: '',
  unit: 'u',
  quantity: 0,
  minStock: 0,
  provider: '',
  category: '',
  presentationName: '',
  presentationPrice: 0,
  presentationQuantity: 1,
  incomingQuantity: 0, // This is "Cuanto llegaría"
  lastInvoice: '',
  lastEntryNumber: '',
  wastePercentage: 0
})

// Auto-calculate unit cost
const calculatedUnitCost = computed(() => {
  if (form.value.presentationPrice > 0 && form.value.presentationQuantity > 0) {
    return form.value.presentationPrice / form.value.presentationQuantity
  }
  return 0
})

const units = [
  { value: 'g', label: 'Gramos (g/kg)' },
  { value: 'ml', label: 'Mililitros (ml/L)' },
  { value: 'u', label: 'Unidades (u)' }
]

const resetForm = () => {
  form.value = {
    name: '',
    item: '',
    code: '',
    unit: 'u',
    quantity: 0,
    minStock: 0,
    provider: '',
    category: '',
    presentationName: '',
    presentationPrice: 0,
    presentationQuantity: 1,
    incomingQuantity: 0,
    lastInvoice: '',
    lastEntryNumber: '',
    wastePercentage: 0
  }
  materialToEdit.value = null
}

const fetchData = async () => {
  isLoading.value = true
  try {
    const [materialsData, providersData, categoriesData] = await Promise.all([
      RawMaterialService.getRawMaterials(),
      ProviderService.getProviders(),
      ProviderCategoryService.getCategories()
    ])
    materials.value = materialsData
    providers.value = providersData
    categories.value = categoriesData
  } catch (err) {
    showError('Error al cargar datos')
  } finally {
    isLoading.value = false
  }
}

const generateCode = (category: string, item: string) => {
  const catChar = category && category.length > 0 ? category.charAt(0).toUpperCase() : 'X'
  const itemChar = item && item.length > 1 ? item.charAt(1).toLowerCase() : (item && item.length > 0 ? item.charAt(0).toLowerCase() : 'x')
  const randomNum = Math.floor(Math.random() * 900) + 100
  return `${catChar}${itemChar}${randomNum}`
}

const itemsCountByCategory = computed(() => {
  const counts: Record<string, number> = {}
  materials.value.forEach(m => {
    const cat = m.category || 'Sin Categoría'
    counts[cat] = (counts[cat] || 0) + 1
  })
  return counts
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

const toBackendQuantity = (inputQty: number, unit: string) => {
  if (unit === 'g' || unit === 'ml') return inputQty * 1000
  return inputQty
}

const openModal = (material: any = null) => {
  if (material) {
    materialToEdit.value = material
    form.value = {
      name: material.name,
      item: material.item || '',
      code: material.code || '',
      unit: material.unit || 'u',
      quantity: getDisplayQuantity(material.quantity || 0, material.unit),
      minStock: getDisplayQuantity(material.minStock || 0, material.unit),
      provider: material.provider?._id || '',
      category: material.category || '',
      presentationName: material.presentationName || '',
      presentationPrice: material.presentationPrice || 0,
      presentationQuantity: material.presentationQuantity || 1,
      incomingQuantity: 0,
      lastInvoice: material.lastInvoice || '',
      lastEntryNumber: material.lastEntryNumber || '',
      wastePercentage: material.wastePercentage || 0
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

    // Add incoming stock if any
    if (payload.incomingQuantity > 0) {
      const incomingInBaseUnits = payload.incomingQuantity * payload.presentationQuantity
      payload.quantity = (payload.quantity * (payload.unit === 'u' ? 1 : 1000)) + (payload.unit === 'u' ? incomingInBaseUnits : (incomingInBaseUnits))
      // wait, the payload.quantity in form is already in display units (kg/L)
      // let's re-calculate correctly
      const currentInBase = toBackendQuantity(form.value.quantity, form.value.unit)
      const incomingInBase = payload.incomingQuantity * payload.presentationQuantity
      payload.quantity = currentInBase + incomingInBase
      payload.lastMovementDate = new Date()
    } else {
      payload.quantity = toBackendQuantity(payload.quantity, payload.unit)
    }

    payload.minStock = toBackendQuantity(payload.minStock || 0, payload.unit)
    payload.cost = calculatedUnitCost.value

    if (!payload.code) {
      payload.code = generateCode(payload.category, payload.item || payload.name)
    }

    if (!payload.provider) delete payload.provider
    delete payload.incomingQuantity // Frontend only

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

const handleDeleteItem = async () => {
  if (!materialToEdit.value) return
  try {
    await RawMaterialService.deleteRawMaterial(materialToEdit.value._id)
    success('Eliminado correctamente')
    showModal.value = false
    fetchData()
  } catch (err) {
    showError('Error al eliminar')
  }
}

const handleDeleteCategory = async ({ categoryId, reassignId }: { categoryId: string, reassignId: string | null }) => {
  try {
    const category = categories.value.find(c => c._id === categoryId)
    if (!category) return

    // Reassign items logic
    const materialsToUpdate = materials.value.filter(m => (m.category || 'Sin Categoría') === category.name)
    if (materialsToUpdate.length > 0) {
      await Promise.all(materialsToUpdate.map(m =>
        RawMaterialService.updateRawMaterial(m._id, { category: reassignId || '' })
      ))
    }

    await ProviderCategoryService.deleteCategory(categoryId)
    success('Categoría eliminada')
    fetchData()
  } catch (err) {
    showError('Error al eliminar categoría')
  }
}

const handleCreateCategory = async (name: string) => {
  try {
    await ProviderCategoryService.createCategory({ name })
    success('Categoría creada')
    fetchData()
  } catch (err) {
    showError('Error al crear categoría')
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
      <div class="header-actions">
        <button class="btn-secondary" @click="showCategoryModal = true">
          <i class="fas fa-tags"></i> Categorías
        </button>
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
    <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
      <div class="modal-content pro-modal">
        <div class="modal-header">
          <div class="header-info">
            <h2>{{ materialToEdit ? 'Detalle y Gestión de Stock' : 'Nuevo Ingreso de Material' }}</h2>
            <p v-if="materialToEdit" class="sku-subtitle">SKU: {{ form.code }} | {{ form.item }}</p>
          </div>
          <button class="btn-close" @click="showModal = false">&times;</button>
        </div>

        <div class="modal-body">
          <!-- Information Section -->
          <div class="section-title">Información del Producto</div>
          <div class="form-row">
            <div class="form-group flex-2">
              <label>Nombre Específico / Marca</label>
              <input v-model="form.name" placeholder="Ej. Chocolate Callebaut 70%" />
            </div>
            <div class="form-group flex-1">
              <label>Descripción / Ítem</label>
              <input v-model="form.item" placeholder="Ej. Chocolate" />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Categoría</label>
              <select v-model="form.category">
                <option value="">Sin Categoría</option>
                <option v-for="cat in categories" :key="cat._id" :value="cat.name">{{ cat.name }}</option>
              </select>
            </div>
            <div class="form-group">
              <label>Unidad Base</label>
              <select v-model="form.unit" :disabled="materialToEdit">
                <option v-for="u in units" :key="u.value" :value="u.value">{{ u.label }}</option>
              </select>
            </div>
          </div>

          <!-- Procurement Section -->
          <div class="section-divider"></div>
          <div class="section-title">Datos del Proveedor y Compra</div>
          
          <div class="form-group">
            <label>Proveedor Asociado</label>
            <select v-model="form.provider">
              <option value="">-- Seleccionar Proveedor --</option>
              <option v-for="p in providers" :key="p._id" :value="p._id">{{ p.name }}</option>
            </select>
          </div>

          <div class="form-row highlight">
            <div class="form-group flex-2">
              <label>Presentación del Proveedor</label>
              <input v-model="form.presentationName" placeholder="Ej. Saco 25kg, Galón 4L" />
            </div>
            <div class="form-group flex-1">
              <label>Cant. en {{ form.unit }}</label>
              <input type="number" v-model.number="form.presentationQuantity" />
            </div>
            <div class="form-group flex-1">
              <label>Precio Compra ($)</label>
              <input type="number" v-model.number="form.presentationPrice" step="0.01" />
            </div>
          </div>

          <div class="cost-summary" v-if="calculatedUnitCost > 0">
            <span class="label">Costo por {{ getDisplayUnit(form.unit) }}:</span>
            <span class="value">${{ (calculatedUnitCost * (form.unit === 'u' ? 1 : 1000)).toFixed(4) }}</span>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>No. Factura</label>
              <input v-model="form.lastInvoice" placeholder="001-001..." />
            </div>
            <div class="form-group">
              <label>No. de Ingreso</label>
              <input v-model="form.lastEntryNumber" placeholder="Ej. ENT-123" />
            </div>
          </div>

          <!-- Action Section: Incoming Stock -->
          <div class="section-divider"></div>
          <div class="section-title highlight-title">Gestión de Stock</div>
          <div class="stock-action-box">
             <div class="stock-current">
                <label>Inventario Actual</label>
                <div class="value">{{ form.quantity }} {{ getDisplayUnit(form.unit) }}</div>
             </div>
             <div class="stock-incoming">
                <label>CUANTO LLEGARÍA (Presentaciones)</label>
                <input type="number" v-model.number="form.incomingQuantity" class="entry-field" />
             </div>
             <div class="stock-total">
                <label>Existencia Final</label>
                <div class="value total">{{ (form.quantity + (form.incomingQuantity * (form.unit === 'u' ? form.presentationQuantity : form.presentationQuantity / 1000))).toFixed(2) }} {{ getDisplayUnit(form.unit) }}</div>
             </div>
          </div>
        </div>

        <div class="modal-footer pro-footer">
          <HoldConfirmButton 
            v-if="materialToEdit"
            label="ELIMINAR REGISTRO"
            color="#ef4444"
            class="btn-delete"
            @confirmed="handleDeleteItem"
          />
          <div class="main-actions">
            <button class="btn-cancel" @click="showModal = false">Cerrar</button>
            <HoldConfirmButton 
              :label="materialToEdit ? 'GUARDAR CAMBIOS' : 'CONFIRMAR INGRESO'"
              :disabled="isSaving || !form.name || !form.item"
              :hold-time="1200"
              @confirmed="handleSubmit"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Category Modal -->
    <CategoryManagementModal
      :is-open="showCategoryModal"
      :categories="categories"
      :items-count-by-category="itemsCountByCategory"
      @close="showCategoryModal = false"
      @create="handleCreateCategory"
      @delete="handleDeleteCategory"
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

.header-actions {
  display: flex;
  gap: 1rem;

  button {
    height: 52px;
    border-radius: 16px;
    font-weight: 800;
    padding: 0 1.5rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-primary {
    background: $NICOLE-PURPLE;
    color: white;
    border: none;
    box-shadow: 0 4px 12px rgba($NICOLE-PURPLE, 0.2);

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba($NICOLE-PURPLE, 0.3);
    }
  }

  .btn-secondary {
    background: white;
    border: 2px solid #f1f5f9;
    color: #475569;

    &:hover {
      background: #f8fafc;
      border-color: #e2e8f0;
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

/* Professional Modal Styles */
.pro-modal {
  width: 95%;
  max-width: 700px;
  max-height: 90vh;
  border-radius: 36px;
  padding: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  padding: 2rem 2.5rem;
  background: white;
  border-bottom: 1px solid #f1f5f9;

  h2 {
    font-size: 1.75rem;
    font-weight: 900;
    color: #1e293b;
    margin: 0;
    letter-spacing: -0.02em;
  }

  .sku-subtitle {
    font-size: 0.9rem;
    font-weight: 800;
    color: $NICOLE-PURPLE;
    margin: 0.5rem 0 0;
    text-transform: uppercase;
  }

  .btn-close {
    background: #f1f5f9;
    border: none;
    width: 44px;
    height: 44px;
    border-radius: 14px;
    color: #64748b;
    cursor: pointer;
    font-size: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;

    &:hover {
      background: #fee2e2;
      color: #ef4444;
    }
  }
}

.modal-body {
  padding: 2rem 2.5rem;
  overflow-y: auto;
  flex: 1;
  background: white;
}

.section-title {
  font-size: 0.8rem;
  font-weight: 900;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 1.25rem;
}

.section-divider {
  height: 2px;
  background: #f8fafc;
  margin: 2rem -2.5rem;
}

.highlight-title {
  color: $NICOLE-PURPLE;
}

.form-row {
  display: flex;
  gap: 1.5rem;
  margin-bottom: 1.5rem;

  &.highlight {
    background: #f8fafc;
    padding: 1.5rem;
    border-radius: 20px;
    border: 2px dashed #e2e8f0;
  }

  .flex-2 {
    flex: 2;
  }

  .flex-1 {
    flex: 1;
  }
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;

  label {
    font-size: 0.85rem;
    font-weight: 800;
    color: #64748b;
  }

  input,
  select {
    padding: 1rem;
    border: 2px solid #f1f5f9;
    border-radius: 14px;
    font-size: 1rem;
    font-weight: 600;
    background: #f8fafc;
    transition: all 0.2s;

    &:focus {
      outline: none;
      border-color: $NICOLE-PURPLE;
      background: white;
      box-shadow: 0 0 0 5px rgba($NICOLE-PURPLE, 0.08);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }
}

.cost-summary {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 1rem;
  margin-top: -0.5rem;
  margin-bottom: 2rem;

  .label {
    font-weight: 800;
    color: #94a3b8;
    font-size: 0.9rem;
  }

  .value {
    font-weight: 900;
    color: #0f172a;
    font-size: 1.25rem;
    font-family: 'JetBrains Mono';
  }
}

/* Stock Management Box */
.stock-action-box {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
  padding: 2rem;
  background: #fafafa;
  border-radius: 24px;
  border: 2px solid #f1f5f9;

  .stock-current,
  .stock-incoming,
  .stock-total {
    text-align: center;

    label {
      display: block;
      font-size: 0.7rem;
      font-weight: 900;
      color: #94a3b8;
      text-transform: uppercase;
      margin-bottom: 0.75rem;
    }

    .value {
      font-size: 1.5rem;
      font-weight: 900;
      color: #475569;
    }

    .total {
      color: $NICOLE-PURPLE;
      font-size: 1.75rem;
    }

    .entry-field {
      width: 100%;
      text-align: center;
      font-size: 1.5rem;
      font-weight: 900;
      color: #0f172a;
      background: white;
      border: 3px solid $NICOLE-PURPLE;
      padding: 0.75rem;
      border-radius: 16px;

      &:focus {
        box-shadow: 0 0 0 5px rgba($NICOLE-PURPLE, 0.15);
      }
    }
  }
}

.pro-footer {
  padding: 2rem 2.5rem;
  background: #fcfcfd;
  border-top: 1px solid #f1f5f9;
  display: flex;
  flex-direction: column;
  gap: 1rem;

  .btn-delete {
    width: 100%;
    border-radius: 16px;
    height: 52px;
    font-weight: 900;
    opacity: 0.8;

    &:hover {
      opacity: 1;
    }
  }

  .main-actions {
    display: flex;
    gap: 1rem;
    width: 100%;

    .btn-cancel {
      flex: 0 0 120px;
      background: white;
      border: 2px solid #f1f5f9;
      border-radius: 16px;
      font-weight: 800;
      color: #64748b;
      cursor: pointer;

      &:hover {
        background: #f8fafc;
      }
    }

    .hold-confirm-btn {
      flex: 1;
      height: 56px;
      border-radius: 18px;
      font-size: 1.1rem;
      font-weight: 900;
      letter-spacing: 0.02em;
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
