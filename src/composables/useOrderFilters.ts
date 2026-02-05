import { ref, watch, computed } from 'vue'
import OrderService from '@/services/order.service'
import { getECTTodayString } from '@/utils/dateUtils'
import { useToast } from '@/composables/useToast'

export type FilterMode = 'today' | 'yesterday' | 'tomorrow' | 'all' | 'custom' | 'invoiceError'
export type DateType = 'deliveryDate' | 'createdAt'

export function useOrderFilters() {
  const { error: showError } = useToast()

  const orders = ref<any[]>([])
  const isLoading = ref(false)

  // Filter State
  const filterMode = ref<FilterMode>('today')
  const dateType = ref<DateType>('deliveryDate')
  const customDate = ref('')
  const searchQuery = ref('')

  // Check if we are in a mode that supports specific date selection
  const showDatePicker = computed(() => {
    return filterMode.value === 'custom' || filterMode.value === 'invoiceError'
  })

  const fetchOrders = async () => {
    isLoading.value = true
    try {
      const filters: any = {
        dateType: dateType.value
      }

      // 1. Search filter
      if (searchQuery.value) {
        filters.search = searchQuery.value
      }

      // 2. Date filters logic
      const todayStr = getECTTodayString()
      // Note: rudimentary parsing for yesterday/tomorrow calculation
      // For production, date-fns or similar is better, but sticking to existing logic pattern
      const [y, m, d] = todayStr.split('-').map(Number) as [number, number, number]
      const todayDate = new Date(y, m - 1, d)

      if (filterMode.value !== 'all') {
        if (filterMode.value === 'today') {
          filters.startDate = todayStr
          filters.endDate = todayStr
        } else if (filterMode.value === 'yesterday') {
          const target = new Date(todayDate)
          target.setDate(target.getDate() - 1)
          const dateStr = formatDate(target)
          filters.startDate = dateStr
          filters.endDate = dateStr
        } else if (filterMode.value === 'tomorrow') {
          const target = new Date(todayDate)
          target.setDate(target.getDate() + 1)
          const dateStr = formatDate(target)
          filters.startDate = dateStr
          filters.endDate = dateStr
        } else if (filterMode.value === 'custom' && customDate.value) {
          filters.startDate = customDate.value
          filters.endDate = customDate.value
        } else if (filterMode.value === 'invoiceError') {
          filters.invoiceStatus = 'ERROR'
          // Optional date filter for errors
          if (customDate.value) {
            filters.startDate = customDate.value
            filters.endDate = customDate.value
          }
        }
      }

      const data = await OrderService.getOrders(filters)
      orders.value = data
    } catch (error) {
      console.error('Error fetching orders:', error)
      showError('Error al cargar los pedidos')
    } finally {
      isLoading.value = false
    }
  }

  // Simple formatter YYYY-MM-DD
  const formatDate = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }

  // Reactivity
  watch([filterMode, customDate, dateType], () => {
    // Logic for clearing 'customDate' when switching modes could be here,
    // but typically we might want to persist if the user comes back.
    // However, if switching To 'today', customDate is ignored anyway.

    // Safety check: don't fetch if custom is empty
    if (filterMode.value === 'custom' && !customDate.value) return

    fetchOrders()
  })

  // Debounced search
  let searchTimeout: any = null
  watch(searchQuery, () => {
    clearTimeout(searchTimeout)
    searchTimeout = setTimeout(() => {
      fetchOrders()
    }, 500)
  })

  return {
    orders,
    isLoading,
    filterMode,
    dateType,
    customDate,
    searchQuery,
    showDatePicker,
    fetchOrders
  }
}
