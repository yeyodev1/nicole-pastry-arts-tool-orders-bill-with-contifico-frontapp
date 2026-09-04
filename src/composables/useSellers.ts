import { ref, computed } from 'vue'
import SellerService, { type Seller } from '@/services/seller.service'

// Module-level singleton — shared across all components
const _sellers = ref<Seller[]>([])
const _loaded = ref(false)
const _loading = ref(false)

export function useSellers() {
  const load = async (force = false) => {
    if (_loaded.value && !force) return
    _loading.value = true
    try {
      _sellers.value = await SellerService.getSellers()
      _loaded.value = true
    } catch (e) {
      console.error('Error loading sellers:', e)
    } finally {
      _loading.value = false
    }
  }

  const activeSellers = computed(() =>
    _sellers.value.filter(s => s.isActive).sort((a, b) => a.sortOrder - b.sortOrder)
  )

  const findByIdentification = (identification?: string) =>
    identification
      ? _sellers.value.find(s => s.identification === identification)
      : undefined

  return {
    sellers: _sellers,
    activeSellers,
    findByIdentification,
    isLoading: _loading,
    load,
  }
}
