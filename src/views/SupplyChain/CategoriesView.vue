<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import ProviderCategoryService from '@/services/provider-category.service'
import type { IProviderCategory } from '@/services/provider-category.service'
import { useToast } from '@/composables/useToast'
import CategoryDeleteModal from './components/CategoryDeleteModal.vue'

const router = useRouter()
const { success, error: showError } = useToast()

const categories = ref<IProviderCategory[]>([])
const isLoading = ref(false)

// New category
const newName = ref('')
const isCreating = ref(false)

// Edit
const editingId = ref<string | null>(null)
const editingName = ref('')
const isSavingEdit = ref(false)

// Delete modal
const showDeleteModal = ref(false)

const fetchCategories = async () => {
  isLoading.value = true
  try {
    categories.value = await ProviderCategoryService.getCategories()
  } catch (err) {
    showError('Error al cargar categorías')
  } finally {
    isLoading.value = false
  }
}

const handleCreate = async () => {
  if (!newName.value.trim()) return
  isCreating.value = true
  try {
    await ProviderCategoryService.createCategory(newName.value.trim())
    success('Categoría creada')
    newName.value = ''
    fetchCategories()
  } catch (err: any) {
    showError(err.response?.data?.message || 'Error al crear categoría')
  } finally {
    isCreating.value = false
  }
}

const startEdit = (cat: IProviderCategory) => {
  editingId.value = cat._id
  editingName.value = cat.name
}

const cancelEdit = () => {
  editingId.value = null
  editingName.value = ''
}

const handleSaveEdit = async () => {
  if (!editingId.value || !editingName.value.trim()) return
  isSavingEdit.value = true
  try {
    await ProviderCategoryService.updateCategory(editingId.value, editingName.value.trim())
    success('Categoría actualizada')
    editingId.value = null
    fetchCategories()
  } catch (err: any) {
    showError(err.response?.data?.message || 'Error al actualizar')
  } finally {
    isSavingEdit.value = false
  }
}

const handleDelete = async (payload: { categoryId: string; categoryName: string; targetCategory?: string }) => {
  try {
    await ProviderCategoryService.deleteCategory(payload.categoryId, payload.targetCategory)
    success('Categoría eliminada' + (payload.targetCategory ? ` — ítems reasignados a "${payload.targetCategory}"` : ''))
    showDeleteModal.value = false
    fetchCategories()
  } catch (err: any) {
    showError(err.response?.data?.message || 'Error al eliminar categoría')
  }
}

const goToMaterials = (categoryName: string) => {
  router.push({ path: '/supply-chain/materials', query: { category: categoryName } })
}

onMounted(() => {
  fetchCategories()
})
</script>

<template>
  <div class="categories-view">
    <div class="page-header">
      <div class="title-block">
        <h1>Categorías</h1>
        <p>Organiza las materias primas por categoría. Desde aquí puedes crear, editar, eliminar y ver los ítems de cada una.</p>
      </div>
    </div>

    <!-- Create new category -->
    <div class="create-card">
      <div class="create-card-label">
        <i class="fas fa-plus-circle"></i>
        <span>Nueva Categoría</span>
      </div>
      <div class="create-form">
        <input
          v-model="newName"
          placeholder="Ej. Lácteos, Harinas, Chocolates..."
          class="create-input"
          @keyup.enter="handleCreate"
        />
        <button
          class="btn-create"
          @click="handleCreate"
          :disabled="!newName.trim() || isCreating"
        >
          <i class="fas fa-plus"></i>
          {{ isCreating ? 'Creando...' : 'Crear' }}
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <p>Cargando categorías...</p>
    </div>

    <!-- Empty -->
    <div v-else-if="categories.length === 0" class="empty-state">
      <i class="fas fa-tags"></i>
      <p>Aún no hay categorías. Crea la primera arriba.</p>
    </div>

    <!-- Categories grid -->
    <div v-else class="categories-grid">
      <div
        v-for="cat in categories"
        :key="cat._id"
        class="cat-card"
        :class="{ 'is-editing': editingId === cat._id }"
      >
        <!-- View mode -->
        <template v-if="editingId !== cat._id">
          <div class="cat-card-top">
            <div class="cat-icon"><i class="fas fa-tag"></i></div>
            <div class="cat-actions">
              <button class="btn-icon edit" @click="startEdit(cat)" title="Editar nombre">
                <i class="fas fa-pen"></i>
              </button>
              <button class="btn-icon delete" @click="showDeleteModal = true" title="Eliminar categoría">
                <i class="fas fa-trash-alt"></i>
              </button>
            </div>
          </div>
          <div class="cat-name">{{ cat.name }}</div>
          <div class="cat-count">
            <span class="count-num">{{ cat.materialCount ?? 0 }}</span>
            <span class="count-label">materia(s) prima(s)</span>
          </div>
          <button
            class="btn-view-materials"
            @click="goToMaterials(cat.name)"
            :disabled="!cat.materialCount"
          >
            <i class="fas fa-boxes"></i>
            Ver materias primas
            <i class="fas fa-arrow-right btn-arrow"></i>
          </button>
        </template>

        <!-- Edit mode -->
        <template v-else>
          <div class="edit-mode">
            <label class="edit-label">Editar nombre</label>
            <input
              v-model="editingName"
              class="edit-input"
              @keyup.enter="handleSaveEdit"
              @keyup.escape="cancelEdit"
              autofocus
            />
            <div class="edit-actions">
              <button class="btn-save-edit" @click="handleSaveEdit" :disabled="!editingName.trim() || isSavingEdit">
                <i class="fas fa-check"></i> Guardar
              </button>
              <button class="btn-cancel-edit" @click="cancelEdit">
                Cancelar
              </button>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- Delete Modal -->
    <CategoryDeleteModal
      :is-open="showDeleteModal"
      :categories="categories"
      :materials="[]"
      @close="showDeleteModal = false"
      @delete="handleDelete"
    />
  </div>
</template>

<style lang="scss" scoped>
.categories-view {
  padding: 1.5rem;
  min-height: 100vh;

  @media (min-width: 768px) {
    padding: 2.5rem 2rem;
  }
}

.page-header {
  margin-bottom: 2rem;

  h1 {
    font-size: 1.75rem;
    font-weight: 900;
    color: #1e293b;
    margin: 0 0 0.4rem;
    letter-spacing: -0.02em;

    @media (min-width: 640px) { font-size: 2.25rem; }
  }

  p {
    color: #64748b;
    font-size: 0.95rem;
    font-weight: 500;
    margin: 0;
    max-width: 560px;
  }
}

/* Create card */
.create-card {
  background: white;
  border: 2px dashed #e2e8f0;
  border-radius: 20px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  transition: border-color 0.2s;

  &:focus-within {
    border-color: $NICOLE-PURPLE;
    border-style: solid;
  }
}

.create-card-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.78rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: #94a3b8;
  margin-bottom: 0.9rem;

  i { color: $NICOLE-PURPLE; }
}

.create-form {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.create-input {
  flex: 1;
  min-width: 200px;
  padding: 0.85rem 1.1rem;
  border: 2px solid #f1f5f9;
  border-radius: 14px;
  font-size: 0.95rem;
  font-weight: 600;
  background: #f8fafc;
  color: #1e293b;
  transition: all 0.2s;
  outline: none;

  &:focus {
    border-color: $NICOLE-PURPLE;
    background: white;
    box-shadow: 0 0 0 4px rgba($NICOLE-PURPLE, 0.08);
  }

  &::placeholder { color: #cbd5e1; }
}

.btn-create {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.85rem 1.5rem;
  border: none;
  border-radius: 14px;
  background: $NICOLE-PURPLE;
  color: white;
  font-weight: 800;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 8px 16px rgba($NICOLE-PURPLE, 0.25);
  }

  &:disabled { opacity: 0.4; cursor: not-allowed; }
}

/* Categories grid */
.categories-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.25rem;

  @media (min-width: 540px) { grid-template-columns: repeat(2, 1fr); }
  @media (min-width: 900px) { grid-template-columns: repeat(3, 1fr); }
  @media (min-width: 1200px) { grid-template-columns: repeat(4, 1fr); }
}

.cat-card {
  background: white;
  border-radius: 24px;
  padding: 1.5rem;
  border: 2px solid #f1f5f9;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;

  &:hover:not(.is-editing) {
    transform: translateY(-4px);
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.07);
    border-color: rgba($NICOLE-PURPLE, 0.2);
  }

  &.is-editing {
    border-color: $NICOLE-PURPLE;
    box-shadow: 0 0 0 4px rgba($NICOLE-PURPLE, 0.08);
  }
}

.cat-card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.cat-icon {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  background: rgba($NICOLE-PURPLE, 0.08);
  color: $NICOLE-PURPLE;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
}

.cat-actions {
  display: flex;
  gap: 0.4rem;
}

.btn-icon {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  transition: all 0.15s;

  &.edit {
    background: #f1f5f9;
    color: #64748b;
    &:hover { background: rgba($NICOLE-PURPLE, 0.1); color: $NICOLE-PURPLE; }
  }

  &.delete {
    background: #fff1f2;
    color: #fca5a5;
    &:hover { background: #fee2e2; color: #ef4444; }
  }
}

.cat-name {
  font-size: 1.15rem;
  font-weight: 900;
  color: #1e293b;
  line-height: 1.2;
}

.cat-count {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;

  .count-num {
    font-size: 1.5rem;
    font-weight: 900;
    color: $NICOLE-PURPLE;
    font-family: 'JetBrains Mono', monospace;
  }

  .count-label {
    font-size: 0.78rem;
    font-weight: 600;
    color: #94a3b8;
  }
}

.btn-view-materials {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.9rem;
  border-radius: 12px;
  border: 1.5px solid #e2e8f0;
  background: #f8fafc;
  color: #475569;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: auto;

  .btn-arrow { margin-left: auto; font-size: 0.7rem; }

  &:hover:not(:disabled) {
    border-color: $NICOLE-PURPLE;
    color: $NICOLE-PURPLE;
    background: rgba($NICOLE-PURPLE, 0.05);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

/* Edit mode */
.edit-mode {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.edit-label {
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: $NICOLE-PURPLE;
}

.edit-input {
  padding: 0.75rem;
  border: 2px solid $NICOLE-PURPLE;
  border-radius: 12px;
  font-size: 0.95rem;
  font-weight: 700;
  color: #1e293b;
  background: white;
  outline: none;
  box-shadow: 0 0 0 4px rgba($NICOLE-PURPLE, 0.08);
}

.edit-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-save-edit {
  flex: 1;
  padding: 0.65rem;
  border: none;
  border-radius: 10px;
  background: $NICOLE-PURPLE;
  color: white;
  font-weight: 800;
  font-size: 0.85rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  transition: opacity 0.2s;

  &:disabled { opacity: 0.4; cursor: not-allowed; }
}

.btn-cancel-edit {
  padding: 0.65rem 0.9rem;
  border: 1.5px solid #e2e8f0;
  border-radius: 10px;
  background: white;
  color: #64748b;
  font-weight: 700;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.15s;

  &:hover { background: #f1f5f9; }
}

/* States */
.loading-state {
  text-align: center;
  padding: 8rem 0;

  .spinner {
    width: 48px;
    height: 48px;
    border: 5px solid #f1f5f9;
    border-top-color: $NICOLE-PURPLE;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 1.5rem;
  }

  p { color: #64748b; font-weight: 600; }
}

.empty-state {
  text-align: center;
  padding: 8rem 2rem;
  background: white;
  border-radius: 32px;
  border: 2px dashed #e2e8f0;
  color: #94a3b8;

  i { font-size: 4rem; margin-bottom: 1.5rem; opacity: 0.2; display: block; }
  p { font-size: 1.1rem; font-weight: 500; }
}

@keyframes spin { to { transform: rotate(360deg); } }
</style>
