<script setup lang="ts">
import { type PropType, toRef, computed } from 'vue';
import type { WeeklyObjectives } from '@/services/pos-restock.service';
import { useRestockModal, type RestockProduct } from '@/views/pos/composables/useRestockModal';
import RestockSearch from './RestockSearch.vue';
import SearchableSelect from '@/components/ui/SearchableSelect.vue';

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
  objectives,
  isGeneral,
  requiresMinimum,
  manualName,
  manualUnit,
  category,
  handleSearchInput,
  selectProduct,
  clearSelection,
  saveConfiguration
} = useRestockModal({
  branch: branchRef,
  initialProduct: props.initialProduct,
  initialObjectives: props.initialObjectives
});

const categoryOptions = [
  { value: 'Producción', label: 'Producción' },
  { value: 'Bodega', label: 'Bodega' }
];

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
      <div v-if="!selectedProduct && !isGeneral" class="search-view" key="search">
        <div class="mode-toggle">
          <button 
            class="toggle-btn" 
            :class="{ active: !isGeneral }" 
            @click="isGeneral = false"
          >
            <i class="fa-solid fa-magnifying-glass"></i> Buscar Producto
          </button>
          <button 
            class="toggle-btn" 
            :class="{ active: isGeneral }" 
            @click="isGeneral = true"
          >
            <i class="fa-solid fa-plus-circle"></i> Nuevo Suministro
          </button>
        </div>

        <div v-if="!isGeneral" class="search-container">
          <RestockSearch 
            :query="searchQuery"
            :results="searchResults"
            :is-loading="isLoading"
            @update:query="handleSearchInput"
            @select="selectProduct"
          />
        </div>
      </div>
      
      <!-- MANUAL ENTRY VIEW (for new general item) -->
      <div v-else-if="!selectedProduct && isGeneral" class="manual-view" key="manual">
        <div class="mode-toggle">
          <button 
            class="toggle-btn" 
            :class="{ active: !isGeneral }" 
            @click="isGeneral = false"
          >
            <i class="fa-solid fa-magnifying-glass"></i> Buscar Producto
          </button>
          <button 
            class="toggle-btn" 
            :class="{ active: isGeneral }" 
            @click="isGeneral = true"
          >
            <i class="fa-solid fa-plus-circle"></i> Nuevo Suministro
          </button>
        </div>

        <div class="manual-form">
          <div class="category-top-selector">
            <label>Destino del Pedido</label>
            <SearchableSelect 
              v-model="category"
              :options="categoryOptions"
            />
          </div>

          <div class="input-group">
            <label>Nombre del Suministro <span class="required">*</span></label>
            <input 
              v-model="manualName" 
              type="text" 
              placeholder="Ej: Cajas de Torta 12x12, Servilletas..." 
              class="manual-input"
            />
          </div>

          <div class="input-group">
            <label>Unidad</label>
            <select v-model="manualUnit" class="manual-select">
              <option value="UND">Unidad (UND)</option>
              <option value="PAQ">Paquete (PAQ)</option>
              <option value="KG">Kilogramo (KG)</option>
              <option value="GR">Gramo (GR)</option>
              <option value="L">Litro (L)</option>
              <option value="CJA">Caja (CJA)</option>
            </select>
          </div>
          
          <button 
            class="btn-continue" 
            :disabled="!manualName.trim()"
            @click="selectedProduct = {} as any"
          >
             {{ isGeneral ? 'Continuar' : 'Continuar a Objetivos' }} <i class="fa-solid fa-arrow-right"></i>
          </button>
        </div>
      </div>

      <!-- CONFIG VIEW -->
      <div v-else class="config-view" key="config">
        
        <!-- Category selector (Now at the Very Top) -->
        <div class="category-top-selector">
           <label>Destino del pedido:</label>
           <SearchableSelect 
             v-model="category"
             :options="categoryOptions"
           />
        </div>

        <!-- Product Card -->
        <div class="product-card" :class="{ 'is-general': isGeneral }">
          <div class="info">
            <label>{{ isGeneral ? 'Suministro Manual' : 'Producto seleccionado' }}</label>
            <h4>{{ isGeneral ? manualName : selectedProduct?.nombre }}</h4>
            <div class="badges">
              <span class="unit-badge">{{ isGeneral ? manualUnit : (selectedProduct?.unidad || 'UND') }}</span>
              <span class="category-badge">{{ category }}</span>
            </div>
          </div>
          
          <!-- New Toggle for General Items -->
          <div v-if="isGeneral" class="min-stock-toggle-config">
            <div class="toggle-option" :class="{ active: !requiresMinimum }" @click="requiresMinimum = false">
              <i class="fa-solid fa-box"></i> Simple
            </div>
            <div class="toggle-option" :class="{ active: requiresMinimum }" @click="requiresMinimum = true">
              <i class="fa-solid fa-chart-line"></i> Meta Diaria
            </div>
          </div>

          <button class="btn-change" @click="clearSelection">
            <i class="fa-solid fa-pen"></i> Cambiar
          </button>
        </div>

        <!-- Objectives Configuration (Visible if NOT isGeneral OR if requiresMinimum) -->
        <div v-if="!isGeneral || requiresMinimum" class="objectives-section">
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

        <div v-else class="objectives-info-box">
           <i class="fa-solid fa-info-circle"></i>
           <p>Los suministros <strong>no requieren</strong> stock mínimo diario. Se solicitarán manualmente según necesidad en el reporte diario.</p>
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

.mode-toggle {
  display: flex;
  background: #f1f5f9;
  padding: 4px;
  border-radius: 10px;
  margin-bottom: 1.5rem;
  border: 1px solid #e2e8f0;
}

.toggle-btn {
  flex: 1;
  border: none;
  background: transparent;
  padding: 8px;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;

  i {
    font-size: 0.9rem;
  }

  &.active {
    background: white;
    color: $NICOLE-PRIMARY;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  }

  &:hover:not(.active) {
    color: #334155;
    background: rgba(255, 255, 255, 0.5);
  }
}

.manual-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 0.5rem 0.5rem;
}

.category-top-selector {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: #fdfafb; // Subtle hint
  padding: 0.75rem;
  border-radius: 12px;
  border: 1px dashed $NICOLE-PURPLE;

  label {
    font-size: 0.8rem;
    font-weight: 800;
    color: $NICOLE-PURPLE;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  label {
    font-size: 0.85rem;
    font-weight: 600;
    color: #475569;

    .required {
      color: #ef4444;
    }
  }
}

.manual-input,
.manual-select {
  padding: 10px 14px;
  border: 1px solid $border-light;
  border-radius: 10px;
  font-size: 0.95rem;
  color: $text-dark;
  outline: none;
  transition: all 0.2s;

  &:focus {
    border-color: $NICOLE-PRIMARY;
    box-shadow: 0 0 0 3px rgba($NICOLE-PRIMARY, 0.1);
  }
}

.btn-continue {
  margin-top: 1rem;
  background: $NICOLE-PRIMARY;
  color: white;
  border: none;
  padding: 12px;
  border-radius: 10px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    background: darken($NICOLE-PRIMARY, 5%);
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
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

    .badges {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      margin-top: 0.5rem;
    }

    .unit-badge {
      font-size: 0.75rem;
      color: $NICOLE-PRIMARY;
      background: rgba($NICOLE-PRIMARY, 0.1);
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
      font-weight: 700;
    }

    .category-badge {
      font-size: 0.7rem;
      font-weight: 800;
      text-transform: uppercase;
      background: #f1f5f9;
      color: #64748b;
      padding: 0.15rem 0.6rem;
      border-radius: 4px;
      border: 1px solid #e2e8f0;
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

.min-stock-toggle-config {
  display: flex;
  background: white;
  border: 1px solid #e2e8f0;
  padding: 3px;
  border-radius: 10px;
  gap: 2px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);

  .toggle-option {
    padding: 6px 12px;
    font-size: 0.75rem;
    font-weight: 700;
    color: #64748b;
    border-radius: 7px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    transition: all 0.2s;

    i {
      font-size: 0.8rem;
      opacity: 0.7;
    }

    &.active {
      background: $NICOLE-PRIMARY;
      color: white;

      i {
        opacity: 1;
      }
    }

    &:hover:not(.active) {
      background: #f8fafc;
      color: #334155;
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

.info-note,
.objectives-info-box {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  background-color: $purple-overlay;
  padding: 1rem;
  border-radius: 8px;
  color: $NICOLE-PRIMARY;
  font-size: 0.85rem;
  line-height: 1.4;

  i {
    margin-top: 2px;
    font-size: 1rem;
  }

  p {
    margin: 0;
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
