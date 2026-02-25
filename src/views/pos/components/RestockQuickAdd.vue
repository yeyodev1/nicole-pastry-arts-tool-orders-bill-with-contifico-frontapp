<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import productService from '@/services/product.service';
import { posRestockService } from '@/services/pos-restock.service';
import type { RestockProduct } from '@/views/pos/composables/useRestockModal';
import SearchableSelect from '@/components/ui/SearchableSelect.vue';

const props = defineProps({
  branch: { type: String, required: true }
});

const emit = defineEmits(['add', 'close']);
const router = useRouter();

const searchQuery = ref('');
const searchResults = ref<RestockProduct[]>([]);
const localObjectives = ref<any[]>([]);
const isLoading = ref(false);
const isAddingManual = ref(false);

// Manual Supply State
const manualName = ref('');
const manualUnit = ref('UND');
const category = ref<'Producción' | 'Bodega'>('Producción');
const requiresMinimum = ref(false);

const categoryOptions = [
  { value: 'Producción', label: 'Producción' },
  { value: 'Bodega', label: 'Bodega' }
];

let debounceTimer: ReturnType<typeof setTimeout>;

const fetchLocalObjectives = async () => {
  try {
    const objectives = await posRestockService.getRestockConfiguration(props.branch);
    localObjectives.value = objectives;
  } catch (err) {
    console.error('Error fetching local objectives:', err);
  }
};

onMounted(fetchLocalObjectives);

// CRITICAL: Watch for branch changes (e.g. user switches branch in the modal)
watch(() => props.branch, () => {
  resetForm();
  fetchLocalObjectives();
});

const filteredLocalItems = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return [];

  return localObjectives.value.filter(obj =>
    obj.productName.toLowerCase().includes(q)
  );
});

const searchProducts = async (query: string) => {
  const q = query.trim();
  if (!q || q.length < 3) { // Contifico catalog requires more precision
    searchResults.value = [];
    return;
  }

  isLoading.value = true;
  try {
    const results = await productService.getProducts({ filtro: q, limit: 8 });
    // Filter out products that are already in localObjectives (to avoid duplicates)
    // We match by name case-insensitive
    const localNames = new Set(localObjectives.value.map(o => o.productName.toLowerCase()));
    searchResults.value = (results as any[]).filter(r => !localNames.has(r.nombre.toLowerCase()));
  } catch (error) {
    console.error('Error searching products:', error);
    searchResults.value = [];
  } finally {
    isLoading.value = false;
  }
};

const handleInput = (e: Event) => {
  const val = (e.target as HTMLInputElement).value;
  searchQuery.value = val;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    searchProducts(val);
  }, 400);
};

const goToManagement = () => {
  emit('close');
  router.push({ name: 'pos-restock-management', query: { branch: props.branch } });
};

const selectProduct = async (product: RestockProduct) => {
  try {
    const payload = {
      branch: props.branch,
      productName: product.nombre,
      unit: product.unidad || 'UND',
      contificoId: product.id,
      isGeneral: false,
      category: category.value,
      objectives: { monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0, saturday: 0, sunday: 0 }
    };
    await posRestockService.upsertObjective(payload);

    emit('add', {
      productName: product.nombre,
      unit: product.unidad || 'UND',
      isGeneral: false,
      category: category.value
    });

    resetForm();
    fetchLocalObjectives(); // Refresh local cache
  } catch (err) {
    console.error('Error persisting product:', err);
  }
};

const selectExistingObjective = (obj: any) => {
  emit('add', {
    productName: obj.productName,
    unit: obj.unit,
    isGeneral: obj.isGeneral,
    category: obj.category
  });
  resetForm();
};

const addManual = async () => {
  if (!manualName.value.trim()) return;

  try {
    const payload = {
      branch: props.branch,
      productName: manualName.value.trim(),
      unit: manualUnit.value,
      isGeneral: true,
      requiresMinimum: requiresMinimum.value,
      category: category.value,
      objectives: { monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0, saturday: 0, sunday: 0 }
    };
    await posRestockService.upsertObjective(payload);

    emit('add', {
      productName: manualName.value.trim(),
      unit: manualUnit.value,
      isGeneral: true,
      requiresMinimum: requiresMinimum.value,
      category: category.value
    });

    resetForm();
    fetchLocalObjectives();
  } catch (err) {
    console.error('Error persisting manual item:', err);
  }
};

const resetForm = () => {
  searchQuery.value = '';
  searchResults.value = [];
  isAddingManual.value = false;
  manualName.value = '';
  requiresMinimum.value = false;
};

const startManual = () => {
  manualName.value = searchQuery.value;
  isAddingManual.value = true;
};
</script>

<template>
  <div class="quick-add-container">
    <div v-if="!isAddingManual" class="search-mode">
      <div class="search-input-wrapper">
        <i class="fa-solid fa-magnifying-glass search-icon"></i>
        <input 
          type="text" 
          :value="searchQuery"
          @input="handleInput"
          placeholder="Busca por nombre (ej: escoba, bon, pan...)"
          class="quick-search-input"
          autofocus
        />
        <i v-if="isLoading" class="fa-solid fa-spinner fa-spin loading-spinner"></i>
      </div>

      <!-- Results Dropdown -->
      <div v-if="searchQuery.trim().length > 0" class="results-dropdown">
        <!-- Section: Local Objectives (Items already in the branch) -->
        <div v-if="filteredLocalItems.length > 0" class="dropdown-section highlighted">
           <div class="section-header">Configurados en {{ branch }}</div>
           <div 
            v-for="obj in filteredLocalItems" 
            :key="obj._id" 
            class="result-row local"
            @click="selectExistingObjective(obj)"
           >
             <div class="p-info">
               <span class="p-name">{{ obj.productName }}</span>
               <div class="p-meta">
                 <span class="p-cat badge" :class="obj.category.toLowerCase()">{{ obj.category }}</span>
                 <span v-if="obj.isGeneral" class="p-gen">Suministro</span>
               </div>
             </div>
             <i class="fa-solid fa-plus-circle"></i>
           </div>
        </div>

        <!-- Section: Catalog Search (Contifico) -->
        <div v-if="searchResults.length > 0" class="dropdown-section catalog-results">
           <div class="section-header">Resultados nuevos (Contifico)</div>
           <div 
            v-for="p in searchResults" 
            :key="p.id" 
            class="result-row catalog"
            @click="selectProduct(p)"
           >
             <div class="p-info">
               <span class="p-name">{{ p.nombre }}</span>
               <span class="p-cat">{{ p.categoria_nombre }}</span>
             </div>
             <i class="fa-solid fa-plus"></i>
           </div>
        </div>

        <!-- Section: Manual Create -->
        <div class="manual-trigger" @click="startManual">
          <i class="fa-solid fa-plus-circle"></i>
          <span>¿Es un suministro nuevo? Crear "<strong>{{ searchQuery }}</strong>"</span>
        </div>

        <!-- Fallback: Redirect -->
        <div class="management-link" @click="goToManagement">
           <i class="fa-solid fa-gear"></i>
           <span>¿No lo encuentras? Ir a Gestión Avanzada</span>
        </div>
      </div>
    </div>

    <!-- Manual Entry Small Form (Inline) -->
    <div v-else class="manual-mode">
      <div class="manual-header">
        <span class="title">Nuevo Suministro</span>
        <button class="btn-close-manual" @click="isAddingManual = false">&times;</button>
      </div>
      
      <div class="manual-fields">
        <input v-model="manualName" type="text" placeholder="Nombre..." class="mini-input name">
        <select v-model="manualUnit" class="mini-input unit">
          <option value="UND">UND</option>
          <option value="PAQ">PAQ</option>
          <option value="KG">KG</option>
          <option value="L">L</option>
        </select>
        <div class="dest-select">
          <SearchableSelect 
            v-model="category"
            :options="categoryOptions"
          />
        </div>
        <div class="min-stock-toggle" title="¿Controlar stock mínimo diario?">
          <input type="checkbox" v-model="requiresMinimum" id="req-min-quick">
          <label for="req-min-quick">Meta Diaria</label>
        </div>
        <button class="btn-confirm-add" @click="addManual" :disabled="!manualName.trim()">
          <i class="fa-solid fa-check"></i>
        </button>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.quick-add-container {
  margin-bottom: 1.5rem;
  background: #fff;
  border: 1.5px solid #e2e8f0;
  border-radius: 12px;
  overflow: visible; // To allow dropdown
  position: relative;
  transition: all 0.2s;

  &:focus-within {
    border-color: $NICOLE-PRIMARY;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  }
}

.search-mode {
  position: relative;
}

.search-input-wrapper {
  display: flex;
  align-items: center;
  padding: 0 1rem;
  height: 48px;

  .search-icon {
    color: #94a3b8;
    margin-right: 0.75rem;
  }

  .loading-spinner {
    color: $NICOLE-PRIMARY;
    margin-left: 0.5rem;
  }

  .quick-search-input {
    flex: 1;
    border: none;
    outline: none;
    font-size: 0.95rem;
    font-weight: 500;
    color: #1e293b;
    background: transparent;

    &::placeholder {
      color: #94a3b8;
    }
  }
}

.results-dropdown {
  position: absolute;
  top: 100%;
  left: -1px;
  right: -1px;
  background: white;
  border: 1px solid #e2e8f0;
  border-top: none;
  border-radius: 0 0 12px 12px;
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1);
  z-index: 100;
  max-height: 300px;
  overflow-y: auto;
}

.dropdown-section {
  border-bottom: 1px solid #f1f5f9;

  &:last-of-type {
    border-bottom: none;
  }
}

.section-header {
  font-size: 0.65rem;
  font-weight: 800;
  color: #94a3b8;
  text-transform: uppercase;
  padding: 0.75rem 1rem 0.25rem;
  letter-spacing: 0.5px;
}

.result-row {
  padding: 0.75rem 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background: #f8fafc;

    .p-name {
      color: $NICOLE-PRIMARY;
    }
  }

  &.local {
    background: rgba($NICOLE-PRIMARY, 0.04);
    border-bottom: 1px solid rgba($NICOLE-PRIMARY, 0.1);

    &:hover {
      background: rgba($NICOLE-PRIMARY, 0.08);
    }

    .p-name {
      color: $NICOLE-PRIMARY;
    }
  }

  .p-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .p-name {
    font-size: 0.9rem;
    font-weight: 700;
    color: #334155;
    transition: color 0.2s;
  }

  .p-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .badge {
    font-size: 0.6rem;
    font-weight: 800;
    padding: 1px 6px;
    border-radius: 4px;
    text-transform: uppercase;

    &.producción {
      background: #A855F7;
      color: white;
    }

    &.bodega {
      background: #16a34a;
      color: white;
    }
  }

  .p-gen {
    font-size: 0.6rem;
    font-weight: 800;
    color: #4f46e5;
    background: #e0e7ff;
    padding: 1px 6px;
    border-radius: 4px;
  }

  i {
    color: #94a3b8;
    font-size: 1.2rem;
  }

  &.local i {
    color: $NICOLE-PRIMARY;
  }
}

.highlighted {
  background: #fdf2f8; // Very light pink/purple for priority

  .section-header {
    color: $NICOLE-PRIMARY;
  }
}

.catalog-results {
  .section-header {
    color: #64748b;
  }
}

.manual-trigger {
  padding: 1rem;
  background: #fdfafb;
  color: $NICOLE-PURPLE;
  font-size: 0.9rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
  border-top: 1px solid #f1f5f9;

  i {
    font-size: 1.1rem;
  }

  &:hover {
    background: #f5f0f2;
    color: darken($NICOLE-PURPLE, 10%);
  }
}

.management-link {
  padding: 0.85rem 1rem;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  color: #64748b;
  font-size: 0.85rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #f1f5f9;
    color: $NICOLE-PRIMARY;
  }
}

.manual-mode {
  padding: 0.75rem 1rem;
  background: #fdfafb;
  animation: fadeIn 0.2s ease;
}

.manual-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;

  .title {
    font-size: 0.7rem;
    font-weight: 900;
    text-transform: uppercase;
    color: $NICOLE-PURPLE;
    letter-spacing: 1px;
  }

  .btn-close-manual {
    background: none;
    border: none;
    font-size: 1.25rem;
    color: #94a3b8;
    cursor: pointer;
    line-height: 1;

    &:hover {
      color: #ef4444;
    }
  }
}

.manual-fields {
  display: flex;
  gap: 0.5rem;
  align-items: center;

  .mini-input {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 6px 10px;
    font-size: 0.9rem;
    outline: none;

    &:focus {
      border-color: $NICOLE-PRIMARY;
    }

    &.name {
      flex: 2;
    }

    &.unit {
      flex: 0.6;
    }
  }

  .dest-select {
    flex: 1.5;

    :deep(.select-trigger) {
      padding: 0.45rem 0.75rem;
      font-size: 0.85rem;
      border-color: #e2e8f0;
      border-radius: 8px;
    }
  }

  .btn-confirm-add {
    background: $NICOLE-PRIMARY;
    color: white;
    border: none;
    width: 36px;
    height: 36px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;

    &:hover:not(:disabled) {
      transform: scale(1.05);
      background: darken($NICOLE-PRIMARY, 5%);
    }

    &:disabled {
      background: #cbd5e1;
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
}

.min-stock-toggle {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  background: white;
  border: 1px solid #e2e8f0;
  padding: 0 0.75rem;
  border-radius: 8px;
  height: 36px;
  cursor: pointer;

  input {
    cursor: pointer;
    width: 16px;
    height: 16px;
    accent-color: $NICOLE-PRIMARY;
  }

  label {
    font-size: 0.75rem;
    font-weight: 700;
    color: #64748b;
    cursor: pointer;
    white-space: nowrap;
  }

  &:hover {
    border-color: $NICOLE-PRIMARY;

    label {
      color: $NICOLE-PRIMARY;
    }
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-5px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
