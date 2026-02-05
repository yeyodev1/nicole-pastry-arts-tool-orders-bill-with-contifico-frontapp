<script setup lang="ts">


import CustomDatePicker from '@/components/ui/CustomDatePicker.vue'

// Types should match composable
export type FilterMode = 'today' | 'yesterday' | 'tomorrow' | 'all' | 'custom' | 'invoiceError'
export type DateType = 'deliveryDate' | 'createdAt'

const props = defineProps<{
  filterMode: FilterMode
  dateType: DateType
  customDate: string
  searchQuery: string
  showDatePicker: boolean
  // For 'Select All' button logic which is entwined with filters
  showSelectAll: boolean
  isSelectAllActive: boolean
}>()

const emit = defineEmits<{
  (e: 'update:filterMode', value: FilterMode): void
  (e: 'update:dateType', value: DateType): void
  (e: 'update:customDate', value: string): void
  (e: 'update:searchQuery', value: string): void
  (e: 'search'): void
  (e: 'toggle-select-all'): void
}>()
</script>

<template>
  <div class="filter-bar">
    <div class="filter-upper-row">
      <!-- Search Input -->
      <div class="search-wrapper">
        <i class="fas fa-search"></i>
        <input 
          type="text" 
          :value="searchQuery"
          @input="emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
          placeholder="Nombre, RUC o email..."
          @keyup.enter="emit('search')"
        />
      </div>

      <!-- Date Type Selector -->
      <div class="date-type-selector">
        <button 
          class="type-btn" 
          :class="{ active: dateType === 'deliveryDate' }" 
          @click="emit('update:dateType', 'deliveryDate')"
        >
          Entrega
        </button>
        <button 
          class="type-btn" 
          :class="{ active: dateType === 'createdAt' }" 
          @click="emit('update:dateType', 'createdAt')"
        >
          Registro
        </button>
      </div>
    </div>

    <div class="filter-lower-row">
      <div class="quick-filters">
          <button 
            class="filter-pill" 
            :class="{ active: filterMode === 'yesterday' }"
            @click="emit('update:filterMode', 'yesterday')"
          >
            Ayer
          </button>
          <button 
            class="filter-pill" 
            :class="{ active: filterMode === 'today' }"
            @click="emit('update:filterMode', 'today')"
          >
            Hoy
          </button>
          <button 
            class="filter-pill" 
            :class="{ active: filterMode === 'tomorrow' }"
            @click="emit('update:filterMode', 'tomorrow')"
          >
            Mañana
          </button>
          <button 
            class="filter-pill" 
            :class="{ active: filterMode === 'all' }"
            @click="emit('update:filterMode', 'all')"
          >
            Todas
          </button>
          <button 
            class="filter-pill" 
            :class="{ active: filterMode === 'custom' }"
            @click="emit('update:filterMode', 'custom')"
          >
            Fecha...
          </button>
          <button 
            class="filter-pill error" 
            :class="{ active: filterMode === 'invoiceError' }"
            @click="emit('update:filterMode', 'invoiceError')"
          >
            Errores Facturación
          </button>
      </div>
        
      <!-- Date Picker -->
      <div class="date-picker-wrapper" v-if="showDatePicker">
          <CustomDatePicker 
            :model-value="customDate" 
            @update:model-value="emit('update:customDate', $event)"
            :placeholder="filterMode === 'invoiceError' ? 'Filtrar x Fecha (Opcional)' : 'Seleccionar Fecha'"
          />
      </div>

      <!-- Select All Action -->
      <div v-if="showSelectAll" class="batch-select-actions">
          <button class="btn-text" @click="emit('toggle-select-all')">
            {{ isSelectAllActive ? 'Deseleccionar' : 'Todos' }}
          </button>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
/* Filter Bar Styles from OrderListView.vue */
.filter-bar {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  margin-bottom: 2.5rem;
  background: white;
  padding: 1.25rem;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.04);

  .filter-upper-row {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    align-items: center;
  }

  .filter-lower-row {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    align-items: center;
    padding-top: 1rem;
    border-top: 1px solid #f8fafc;
  }

  .search-wrapper {
    position: relative;
    flex: 2;
    min-width: 260px;

    i {
      position: absolute;
      left: 14px;
      top: 50%;
      transform: translateY(-50%);
      color: #94a3b8;
      font-size: 0.9rem;
    }

    input {
      width: 100%;
      padding: 0.75rem 1rem 0.75rem 2.5rem;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      font-size: 0.95rem;
      transition: all 0.2s;
      outline: none;

      &:focus {
        background: white;
        border-color: #8b5cf6;
        box-shadow: 0 0 0 4px rgba(139, 92, 246, 0.1);
      }

      &::placeholder {
        color: #94a3b8;
      }
    }
  }

  .date-type-selector {
    display: flex;
    background: #f1f5f9;
    padding: 0.3rem;
    border-radius: 12px;
    gap: 0.2rem;
    flex: 1;
    min-width: 200px;

    .type-btn {
      flex: 1;
      border: none;
      background: transparent;
      padding: 0.5rem;
      border-radius: 9px;
      font-size: 0.85rem;
      font-weight: 700;
      color: #64748b;
      cursor: pointer;
      transition: all 0.2s;

      &.active {
        background: white;
        color: #8b5cf6;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
      }

      &:hover:not(.active) {
        color: #1e293b;
      }
    }
  }

  .quick-filters {
    display: flex;
    gap: 0.5rem;
    overflow-x: auto;
    padding-bottom: 2px;
    flex: 1;

    .filter-pill {
      padding: 0.5rem 1.25rem;
      border-radius: 20px;
      border: 1px solid #e2e8f0;
      background: white;
      color: #64748b;
      font-weight: 700;
      font-size: 0.85rem;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.2s;

      &:hover {
        background: #f8fafc;
        color: #1e293b;
      }

      &.active {
        background: #8b5cf6;
        color: white;
        border-color: #8b5cf6;
        box-shadow: 0 4px 12px rgba(139, 92, 246, 0.25);
      }
    }
  }

  .date-picker-wrapper {
    min-width: 200px;
    max-width: 100%;
  }

  .batch-select-actions {
    margin-left: auto;

    .btn-text {
      background: none;
      border: none;
      color: #8b5cf6;
      font-weight: 600;
      cursor: pointer;
      font-size: 0.9rem;

      &:hover {
        text-decoration: underline;
      }
    }
  }
}
</style>
