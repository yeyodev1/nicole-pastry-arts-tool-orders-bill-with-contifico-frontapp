<script setup lang="ts">
import { ref, computed } from 'vue'
import SearchableSelect from '@/components/ui/SearchableSelect.vue'
import ProviderCategoryService from '@/services/provider-category.service'

const props = defineProps<{
  form: any
  categories: any[]
  units: { value: string; label: string }[]
  isEditing: boolean
}>()

const emit = defineEmits(['category-created'])

const categoryOptions = computed(() =>
  props.categories.map(c => ({ value: c.name, label: c.name }))
)

// Creación de categoría inline
const showNewCatInput = ref(false)
const newCatName = ref('')
const isCreatingCat = ref(false)
const newCatError = ref('')

const handleCreateCategory = async () => {
  if (!newCatName.value.trim()) return
  isCreatingCat.value = true
  newCatError.value = ''
  try {
    const created = await ProviderCategoryService.createCategory(newCatName.value.trim())
    props.form.category = created.name
    emit('category-created', created)
    newCatName.value = ''
    showNewCatInput.value = false
  } catch (err: any) {
    newCatError.value = err.response?.data?.message || 'Error al crear categoría'
  } finally {
    isCreatingCat.value = false
  }
}
</script>

<template>
  <section class="modal-section">
    <div class="section-title"><i class="fas fa-box-open"></i> Información Básica</div>

    <div class="form-group" style="margin-bottom: 1.25rem">
      <label><i class="fas fa-tag"></i> Nombre Comercial / Marca</label>
      <input v-model="form.name" placeholder="Ej. Chocolate Callebaut 70%" />
    </div>

    <div class="form-row">
      <div class="form-group">
        <label><i class="fas fa-folder-open"></i> Categoría</label>
        <SearchableSelect
          v-model="form.category"
          :options="categoryOptions"
          placeholder="Buscar o seleccionar categoría..."
        />
        <div class="category-chips" v-if="categories.length > 0">
          <button
            v-for="cat in categories"
            :key="cat._id || cat.name"
            type="button"
            class="chip"
            :class="{ 'chip--active': form.category === cat.name }"
            @click="form.category = cat.name"
          >
            {{ cat.name }}
          </button>
        </div>

        <div class="new-cat-row" v-if="!showNewCatInput">
          <button type="button" class="btn-add-cat-inline" @click="showNewCatInput = true">
            <i class="fas fa-plus"></i> Nueva categoría
          </button>
        </div>
        <div v-else class="new-cat-form">
          <input
            v-model="newCatName"
            placeholder="Nombre de la categoría..."
            class="new-cat-input"
            @keyup.enter="handleCreateCategory"
            @keyup.escape="showNewCatInput = false; newCatName = ''"
            autofocus
          />
          <button type="button" class="btn-cat-confirm" @click="handleCreateCategory" :disabled="!newCatName.trim() || isCreatingCat">
            <i class="fas fa-check"></i>
          </button>
          <button type="button" class="btn-cat-cancel" @click="showNewCatInput = false; newCatName = ''; newCatError = ''">
            <i class="fas fa-times"></i>
          </button>
          <span v-if="newCatError" class="cat-error">{{ newCatError }}</span>
        </div>
      </div>

      <div class="form-group">
        <label><i class="fas fa-balance-scale"></i> Unidad de Medida</label>
        <select v-model="form.unit" :disabled="isEditing">
          <option v-for="u in units" :key="u.value" :value="u.value">{{ u.label }}</option>
        </select>
      </div>
    </div>
  </section>
</template>

<style lang="scss" scoped>
@use './section-styles' as *;
</style>
