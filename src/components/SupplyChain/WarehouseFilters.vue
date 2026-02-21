<script setup lang="ts">
import { ref, watch } from 'vue'
import CustomDatePicker from '@/components/ui/CustomDatePicker.vue'

const props = defineProps<{
  materials: any[],
  initialFilters?: any
}>()

const emit = defineEmits<{
  (e: 'filter', filters: any): void
}>()

const filters = ref({
  type: props.initialFilters?.type || '',
  materialId: props.initialFilters?.materialId || '',
  startDate: props.initialFilters?.startDate || '',
  endDate: props.initialFilters?.endDate || ''
})

// Update local filters if prop changes (for initialization)
watch(() => props.initialFilters, (newInit) => {
  if (newInit) {
    filters.value = { ...filters.value, ...newInit }
  }
}, { deep: true })

// Deep watch filters to emit changes
watch(filters, (newFilters) => {
  emit('filter', { ...newFilters })
}, { deep: true })

const clearFilters = () => {
  filters.value = {
    type: '',
    materialId: '',
    startDate: '',
    endDate: ''
  }
}
</script>

<template>
  <div class="filters-container">
    <div class="filter-group">
      <label>Tipo</label>
      <select v-model="filters.type">
        <option value="">Todos</option>
        <option value="IN">Entradas</option>
        <option value="OUT">Salidas</option>
        <option value="LOSS">Bajas / Mermas</option>
      </select>
    </div>

    <div class="filter-group">
      <label>Materia Prima</label>
      <select v-model="filters.materialId">
        <option value="">Todas</option>
        <option v-for="m in materials" :key="m._id" :value="m._id">
          {{ m.name }}
        </option>
      </select>
    </div>

    <div class="filter-group date-filter">
      <CustomDatePicker 
        v-model="filters.startDate" 
        label="Desde" 
        placeholder="Inicio"
      />
    </div>

    <div class="filter-group date-filter">
      <CustomDatePicker 
        v-model="filters.endDate" 
        label="Hasta" 
        placeholder="Fin"
      />
    </div>

    <div class="filter-actions">
       <button class="btn-clear" @click="clearFilters">
         <i class="fas fa-undo"></i> Limpiar
       </button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.filters-container {
  display: grid;
  grid-template-columns: 1fr 1fr 1.5fr 1.5fr auto;
  gap: 1.5rem;
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
  border: 1px solid $border-light;
  margin-bottom: 2rem;
  align-items: flex-end;

  @media (max-width: 900px) {
    grid-template-columns: 1fr 1fr;

    .filter-actions {
      grid-column: span 2;
      justify-content: flex-end;
    }
  }

  @media (max-width: 600px) {
    grid-template-columns: 1fr;

    .filter-actions {
      grid-column: span 1;
    }
  }
}

.filter-group {
  label {
    display: block;
    font-size: 0.85rem;
    font-weight: 700;
    color: $text-light;
    margin-bottom: 0.5rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  select {
    width: 100%;
    padding: 0.85rem 1rem;
    border: 1px solid $border-light;
    border-radius: 10px;
    font-size: 0.95rem;
    color: $text-dark;
    background-color: white;
    transition: all 0.2s;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 1rem center;
    background-size: 1.25rem;

    &:focus {
      outline: none;
      border-color: $NICOLE-PURPLE;
      box-shadow: 0 0 0 4px rgba($NICOLE-PURPLE, 0.1);
    }
  }
}

.date-filter {
  :deep(.label) {
    font-size: 0.85rem;
    font-weight: 700;
    color: $text-light;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
}

.filter-actions {
  display: flex;
  align-items: center;
  padding-bottom: 2px;
}

.btn-clear {
  background: none;
  border: 1px solid $border-light;
  color: $text-light;
  padding: 0.6rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s;

  &:hover {
    background: $gray-50;
    color: $text-dark;
    border-color: $gray-300;
  }
}
</style>
