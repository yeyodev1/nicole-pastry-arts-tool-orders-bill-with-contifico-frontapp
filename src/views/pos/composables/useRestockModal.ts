import { ref, watch, unref, type Ref } from 'vue';
import productService from '@/services/product.service';
import { posRestockService, type WeeklyObjectives } from '@/services/pos-restock.service';
import type { Product } from '@/types/order';

// Interface for the extended product with unit, if not in original type
export interface RestockProduct extends Product {
  unidad?: string;
  unit?: string;
  productName?: string;
  contificoId?: string; // or id if itmaps correctly
  categoria_nombre?: string;
  isGeneral?: boolean;
  requiresMinimum?: boolean;
  category?: 'Producción' | 'Bodega';
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
  const isGeneral = ref(false);
  const requiresMinimum = ref(false);
  const manualName = ref('');
  const manualUnit = ref('UND');
  const category = ref<'Producción' | 'Bodega'>('Producción');

  let debounceTimer: ReturnType<typeof setTimeout>;

  // Initialize with initial data if provided
  const initialize = () => {
    if (props.initialProduct) {
      selectedProduct.value = props.initialProduct;
      objectives.value = props.initialObjectives ? { ...props.initialObjectives } : { ...defaultObjectives };

      // CRITICAL: Robust isGeneral detection
      const productIsGeneral = props.initialProduct.isGeneral === true || !props.initialProduct.contificoId;
      isGeneral.value = productIsGeneral;
      requiresMinimum.value = props.initialProduct.requiresMinimum || false;

      manualName.value = props.initialProduct.productName || props.initialProduct.nombre || '';
      manualUnit.value = props.initialProduct.unit || props.initialProduct.unidad || 'UND';
      category.value = props.initialProduct.category || 'Producción';
    } else {
      selectedProduct.value = null;
      objectives.value = { ...defaultObjectives };
      searchQuery.value = '';
      searchResults.value = [];
      isGeneral.value = false;
      requiresMinimum.value = false;
      manualName.value = '';
      manualUnit.value = 'UND';
      category.value = 'Producción';
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
    isGeneral.value = false;
    // We could preserve category or reset it, let's keep current category choice
  };

  const clearSelection = () => {
    selectedProduct.value = null;
    searchResults.value = [];
    searchQuery.value = '';
    objectives.value = { ...defaultObjectives };
    isGeneral.value = false;
    requiresMinimum.value = false;
    manualName.value = '';
    manualUnit.value = 'UND';
    category.value = 'Producción';
  };

  const saveConfiguration = async (): Promise<{ success: boolean; message?: string }> => {
    const isNowGeneral = isGeneral.value === true;

    if (!isNowGeneral && !selectedProduct.value) {
      return { success: false, message: 'No hay producto seleccionado.' };
    }

    if (isNowGeneral && !manualName.value.trim()) {
      return { success: false, message: 'El nombre del item es requerido.' };
    }

    isSaving.value = true;
    try {
      const currentBranch = unref(props.branch);
      let payload: any;

      if (isNowGeneral) {
        payload = {
          branch: currentBranch,
          productName: manualName.value.trim(),
          unit: manualUnit.value || 'UND',
          isGeneral: true,
          requiresMinimum: requiresMinimum.value,
          category: category.value,
          objectives: objectives.value
        };
      } else {
        // Prioritize contificoId if available, otherwise use id (from Contifico search)
        const idToUse = selectedProduct.value?.contificoId || selectedProduct.value?.id;

        if (!idToUse) {
          return { success: false, message: 'El producto seleccionado no tiene un ID de Contifico válido.' };
        }

        payload = {
          branch: currentBranch,
          productName: selectedProduct.value?.nombre || selectedProduct.value?.productName,
          unit: selectedProduct.value?.unidad || selectedProduct.value?.unit || 'UND',
          contificoId: idToUse,
          isGeneral: false,
          category: category.value,
          objectives: objectives.value
        };
      }

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
    isGeneral,
    requiresMinimum,
    manualName,
    manualUnit,
    category,

    // Actions
    handleSearchInput,
    selectProduct,
    clearSelection,
    saveConfiguration
  };
}
