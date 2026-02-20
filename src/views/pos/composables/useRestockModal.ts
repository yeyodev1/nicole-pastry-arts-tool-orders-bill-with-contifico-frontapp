import { ref, watch, unref, type Ref } from 'vue';
import productService from '@/services/product.service';
import { posRestockService, type WeeklyObjectives } from '@/services/pos-restock.service';
import type { Product } from '@/types/order';

// Interface for the extended product with unit, if not in original type
export interface RestockProduct extends Product {
  unidad?: string;
  contificoId?: string; // or id if itmaps correctly
  categoria_nombre?: string;
}

export interface UseRestockModalProps {
  branch: string | Ref<string>;
  initialProduct?: RestockProduct;
  initialObjectives?: WeeklyObjectives;
}

export function useRestockModal(props: UseRestockModalProps) {
  // State
  const searchQuery = ref('');
  const searchResults = ref<RestockProduct[]>([]);
  const isLoading = ref(false);
  const isSaving = ref(false);
  const selectedProduct = ref<RestockProduct | null>(null);

  const defaultObjectives: WeeklyObjectives = {
    monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0, saturday: 0, sunday: 0
  };

  const objectives = ref<WeeklyObjectives>({ ...defaultObjectives });

  let debounceTimer: ReturnType<typeof setTimeout>;

  // Initialize with initial data if provided
  const initialize = () => {
    if (props.initialProduct) {
      selectedProduct.value = props.initialProduct;
      objectives.value = props.initialObjectives ? { ...props.initialObjectives } : { ...defaultObjectives };
    } else {
      selectedProduct.value = null;
      objectives.value = { ...defaultObjectives };
      searchQuery.value = '';
      searchResults.value = [];
    }
  };

  // Watch for changes in props to re-initialize (e.g. opening modal with different product)
  watch(() => props.initialProduct, initialize, { immediate: true });

  // Actions
  const searchProducts = async (query: string) => {
    if (!query || query.length < 3) {
      searchResults.value = [];
      return;
    }

    isLoading.value = true;
    try {
      // Using existing product service
      const results = await productService.getProducts({ filtro: query, limit: 10 });
      searchResults.value = results as RestockProduct[];
    } catch (error) {
      console.error('Error searching products:', error);
      searchResults.value = [];
    } finally {
      isLoading.value = false;
    }
  };

  const handleSearchInput = (query: string) => {
    searchQuery.value = query;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      searchProducts(query);
    }, 400);
  };

  const selectProduct = (product: RestockProduct) => {
    selectedProduct.value = product;
    // Reset objectives when selecting a new product
    objectives.value = { ...defaultObjectives };
    searchResults.value = [];
  };

  const clearSelection = () => {
    // If we are in "Edit Mode" (initialProduct exists), clearing selection might mean 
    // going back to search? Or maybe canceling?
    // Usually "Change" button calls this.
    // If we are editing, maybe we shouldn't allow changing product easily or it treats as new add?
    // For now, standard behavior: clear selection allows searching new.
    selectedProduct.value = null;
    searchResults.value = [];
    searchQuery.value = '';
    objectives.value = { ...defaultObjectives };
  };

  const saveConfiguration = async (): Promise<{ success: boolean; message?: string }> => {
    if (!selectedProduct.value) {
      return { success: false, message: 'No hay producto seleccionado.' };
    }

    isSaving.value = true;
    try {
      // Prioritize contificoId if available, otherwise use id
      const idToUse = selectedProduct.value.contificoId || selectedProduct.value.id;

      if (!idToUse) {
        return { success: false, message: 'El producto seleccionado no tiene un ID válido.' };
      }

      const currentBranch = unref(props.branch);

      const payload = {
        branch: currentBranch,
        productName: selectedProduct.value.nombre,
        unit: selectedProduct.value.unidad || 'UND',
        contificoId: idToUse,
        objectives: objectives.value
      };

      await posRestockService.upsertObjective(payload);
      return { success: true };
    } catch (error) {
      console.error('Error saving configuration:', error);
      return { success: false, message: 'Error al conectar con el servidor. Intente nuevamente.' };
    } finally {
      isSaving.value = false;
    }
  };

  return {
    // State
    searchQuery,
    searchResults,
    isLoading,
    isSaving,
    selectedProduct,
    objectives,

    // Actions
    handleSearchInput,
    selectProduct,
    clearSelection,
    saveConfiguration
  };
}
