import { ref } from 'vue'
import WarehouseService from '@/services/warehouse.service'
import RawMaterialService from '@/services/raw-material.service'
import ProviderService from '@/services/provider.service'
import SupplierOrderService from '@/services/supplier-order.service'
import { useToast } from '@/composables/useToast'

export function useWarehouse() {
  const { success, error: showError } = useToast()

  // --- Utils: Strictly America/Guayaquil (Ecuador) ---
  const getEcuadorTime = () => {
    return new Intl.DateTimeFormat('es-EC', {
      timeZone: 'America/Guayaquil', hour: '2-digit', minute: '2-digit', hour12: false
    }).format(new Date())
  }

  const getEcuadorDate = () => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date())
    const y = parts.find(p => p.type === 'year')?.value
    const m = parts.find(p => p.type === 'month')?.value
    const d = parts.find(p => p.type === 'day')?.value
    return `${y}-${m}-${d}`
  }

  const getEcuadorMonthStart = () => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit'
    }).formatToParts(new Date())
    const y = parts.find(p => p.type === 'year')?.value
    const m = parts.find(p => p.type === 'month')?.value
    return `${y}-${m}-01`
  }

  // --- State ---
  const materials = ref<any[]>([])
  const providers = ref<any[]>([])
  const movements = ref<any[]>([])
  const suggestedOrders = ref<any[]>([])
  const isLoading = ref(false)
  const isLoadingSuggestions = ref(false)

  // --- API Calls ---
  const fetchDependencies = async () => {
    try {
      const [materialsData, providersData] = await Promise.all([
        RawMaterialService.getRawMaterials(),
        ProviderService.getProviders()
      ])
      materials.value = materialsData
      providers.value = providersData
    } catch (err) {
      console.error(err)
      showError('Error loading dependencies')
    }
  }

  const fetchMovements = async (params: any) => {
    isLoading.value = true
    try {
      const data = await WarehouseService.getMovements(params)
      movements.value = data.movements
      return data
    } catch (err) {
      console.error(err)
      showError('Error loading movements')
      return null
    } finally {
      isLoading.value = false
    }
  }

  const fetchTodaySuggestions = async () => {
    if (isLoadingSuggestions.value) return
    isLoadingSuggestions.value = true
    try {
      const today = getEcuadorDate()
      const response = await SupplierOrderService.getOrders({
        startDate: today, endDate: today, status: 'SENT', limit: 10
      })
      suggestedOrders.value = response.orders
    } catch (err: any) {
      console.error('Error fetching suggestions:', err)
    } finally {
      isLoadingSuggestions.value = false
    }
  }

  return {
    materials,
    providers,
    movements,
    suggestedOrders,
    isLoading,
    isLoadingSuggestions,
    getEcuadorTime,
    getEcuadorDate,
    getEcuadorMonthStart,
    fetchDependencies,
    fetchMovements,
    fetchTodaySuggestions,
    success,
    showError
  }
}
