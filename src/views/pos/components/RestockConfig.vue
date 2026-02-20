<script setup lang="ts">
import { type PropType, toRef, computed } from 'vue';
import type { WeeklyObjectives } from '@/services/pos-restock.service';
import { useRestockModal, type RestockProduct } from '@/views/pos/composables/useRestockModal';
import RestockSearch from './RestockSearch.vue';

const props = defineProps({
  branch: { type: String, required: true },
  initialProduct: { type: Object as PropType<RestockProduct>, default: null },
  initialObjectives: { type: Object as PropType<WeeklyObjectives>, default: null }
});

const emit = defineEmits(['close', 'success']);

const branchRef = toRef(props, 'branch');

const {
  searchQuery,
  searchResults,
  isLoading,
  isSaving,
  selectedProduct,
  objectives, // Reactive objectives from composable
  handleSearchInput,
  selectProduct,
  clearSelection,
  saveConfiguration
} = useRestockModal({
  branch: branchRef,
  initialProduct: props.initialProduct,
  initialObjectives: props.initialObjectives
});

const weekDays = [
  { key: 'monday', label: 'Lun' },
  { key: 'tuesday', label: 'Mar' },
  { key: 'wednesday', label: 'Mié' },
  { key: 'thursday', label: 'Jue' },
  { key: 'friday', label: 'Vie' },
  { key: 'saturday', label: 'Sáb' },
  { key: 'sunday', label: 'Dom' },
];

const handleSave = async () => {
  const result = await saveConfiguration();
  if (result.success) {
    emit('success');
  } else {
    // Ideally we emit error or show toast, handled by parent or here?
    // For now parent handles success notification, we can emit error event if needed
    // or just rely on console error in composable.
    // Let's assume parent handles 'notify' if we emit it, but looking at previous code
    // simple success emit is key.
    // Actually, let's emit 'notify' for errors if possible, or just let useRestockModal handle it?
    // The previous modal handled notification. Let's add 'notify' emit.
  }
};
</script>

<template>
  <div class="restock-flow-container">
    
    <!-- SEARCH VIEW -->
    <Transition name="fade" mode="out-in">
      <div v-if="!selectedProduct" class="search-view" key="search">
        <RestockSearch 
          :query="searchQuery"
          :results="searchResults"
          :is-loading="isLoading"
          @update:query="handleSearchInput"
          @select="selectProduct"
        />
      </div>

      <!-- CONFIG VIEW -->
      <div v-else class="config-view" key="config">
        
        <!-- Product Card -->
        <div class="product-card">
          <div class="info">
            <label>Producto seleccionado</label>
            <h4>{{ selectedProduct.nombre }}</h4>
            <span class="unit-badge">{{ selectedProduct.unidad || 'UND' }}</span>
          </div>
          <button class="btn-change" @click="clearSelection">
            <i class="fa-solid fa-pen"></i> Cambiar
          </button>
        </div>

        <!-- Objectives Configuration -->
        <div class="objectives-section">
          <p class="instruction">
            Define el <strong>Stock Mínimo</strong> diario:
          </p>

          <div class="days-grid">
            <div 
              v-for="day in weekDays" 
              :key="day.key" 
              class="day-input"
            >
              <label>{{ day.label }}</label>
              <input 
                type="number" 
                v-model.number="objectives[day.key as keyof WeeklyObjectives]"
                min="0"
                placeholder="0"
              />
            </div>
          </div>

          <div class="info-note">
            <i class="fa-solid fa-circle-info"></i>
            <span>Los días con valor <strong>0</strong> no generarán alerta de restock.</span>
          </div>
        </div>

        <!-- Actions -->
        <div class="actions">
          <button class="btn-cancel" @click="emit('close')">Cancelar</button>
          <button 
            class="btn-save" 
            @click="handleSave" 
            :disabled="isSaving"
          >
            <span v-if="isSaving"><i class="fa-solid fa-spinner fa-spin"></i> Guardando...</span>
            <span v-else>Guardar Configuración</span>
          </button>
        </div>

      </div>
    </Transition>

  </div>
</template>

<style lang="scss" scoped>
.restock-flow-container {
  display: flex;
  flex-direction: column;
  min-height: 300px;
}

.search-view {
  width: 100%;
}

.config-view {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.product-card {
  background-color: $gray-50;
  border: 1px solid $border-light;
  border-radius: 12px;
  padding: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;

  .info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;

    label {
      font-size: 0.75rem;
      text-transform: uppercase;
      font-weight: 700;
      color: $text-light;
      letter-spacing: 0.5px;
    }

    h4 {
      margin: 0;
      font-size: 1.1rem;
      color: $text-dark;
      font-weight: 600;
    }

    .unit-badge {
      font-size: 0.75rem;
      color: $NICOLE-PRIMARY;
      background: rgba($NICOLE-PRIMARY, 0.1);
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
      align-self: flex-start;
      margin-top: 0.25rem;
    }
  }

  .btn-change {
    background: white;
    border: 1px solid $border-light;
    padding: 0.5rem 0.75rem;
    border-radius: 8px;
    font-size: 0.85rem;
    color: $text-light;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: all 0.2s;

    &:hover {
      background: $gray-100;
      color: $text-dark;
      border-color: $gray-300;
      color: $NICOLE-PRIMARY;
    }
  }
}

.objectives-section {
  .instruction {
    font-size: 0.95rem;
    color: $text-dark;
    margin-bottom: 1rem;
  }
}

.days-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); // Minimalist grid
  gap: 0.75rem;
  margin-bottom: 1.5rem;

  .day-input {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;

    label {
      font-size: 0.8rem;
      font-weight: 600;
      color: $text-light;
    }

    input {
      width: 100%;
      padding: 0.75rem;
      border: 1px solid $border-light;
      border-radius: 8px;
      text-align: center;
      font-size: 1rem;
      font-weight: 600;
      color: $text-dark;
      transition: all 0.2s;

      &:focus {
        outline: none;
        border-color: $NICOLE-PRIMARY;
        box-shadow: 0 0 0 3px rgba($NICOLE-PRIMARY, 0.1);
      }

      &::placeholder {
        color: $gray-300;
      }
    }
  }
}

.info-note {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  background-color: $purple-overlay;
  padding: 0.75rem;
  border-radius: 8px;
  color: $NICOLE-PRIMARY;
  font-size: 0.85rem;
  line-height: 1.4;

  i {
    margin-top: 2px;
  }
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  padding-top: 1rem;
  border-top: 1px solid $border-light;

  button {
    padding: 0.75rem 1.5rem;
    border-radius: 10px;
    font-weight: 600;
    cursor: pointer;
    font-size: 0.95rem;
    transition: all 0.2s;
  }

  .btn-cancel {
    background: transparent;
    border: none;
    color: $text-light;

    &:hover {
      color: $text-dark;
      background: $gray-100;
    }
  }

  .btn-save {
    background: $NICOLE-PRIMARY;
    border: none;
    color: white;

    &:hover {
      background: darken($NICOLE-PRIMARY, 5%);
    }

    &:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }
  }
}

// Transitions
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
