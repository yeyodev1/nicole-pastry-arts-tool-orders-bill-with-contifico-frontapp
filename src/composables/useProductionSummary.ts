import { ref, computed } from 'vue'
import ProductionService from '@/services/production.service'
import type { CategoryGroup } from '@/types/production'
import { parseECTDate, getECTNow, isSameDayECT } from '@/utils/dateUtils'

export function useProductionSummary() {
  const isLoading = ref(true)
  const error = ref('')
  const isBackgroundLoading = ref(false)

  // Single source of truth cache
  const rawOrders = ref<any[]>([])
  const rawBucketFilter = ref<'delayed' | 'today' | 'tomorrow' | 'future' | 'all'>('today')
  const sourceFilter = ref<'all' | 'nicole' | 'sucree'>('all')
  const selectedRawProducts = ref<Set<string>>(new Set())

  // History
  const showHistory = ref(false)

  // Category collapse (kept for history panel compatibility)
  const collapsedCategoryIds = ref<Set<string>>(new Set())

  const rawFilteredOrders = computed(() => {
    if (!rawOrders.value.length) return []

    const today = getECTNow()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    return rawOrders.value.filter(order => {
      // Source filter (client-side — no API call)
      if (sourceFilter.value !== 'all' && order.contificoSource !== sourceFilter.value) return false

      if (rawBucketFilter.value === 'all') return order.productionStage !== 'VOID'

      if (!order.deliveryDate) return false
      const dDate = parseECTDate(order.deliveryDate)

      if (rawBucketFilter.value === 'today') return isSameDayECT(dDate, today) && order.productionStage !== 'VOID'
      if (rawBucketFilter.value === 'tomorrow') return isSameDayECT(dDate, tomorrow) && order.productionStage !== 'VOID'
      if (rawBucketFilter.value === 'delayed') return dDate < today && order.productionStage !== 'VOID'
      if (rawBucketFilter.value === 'future') {
        const afterTomorrow = new Date(tomorrow)
        afterTomorrow.setDate(afterTomorrow.getDate() + 1)
        afterTomorrow.setHours(0, 0, 0, 0)
        return dDate >= afterTomorrow && order.productionStage !== 'VOID'
      }
      return false
    })
  })

  const rawStatsByDestination = computed(() => {
    const stats: Record<string, Record<string, number>> = {}
    if (!rawFilteredOrders.value.length) return stats

    rawFilteredOrders.value.forEach(order => {
      let dest = 'Otros / Sin Local'
      if (order.deliveryType === 'delivery') {
        dest = 'Delivery'
      } else if (order.branch) {
        const b = order.branch.toLowerCase()
        if (b.includes('marino')) dest = 'San Marino'
        else if (b.includes('mall') || b.includes('sol')) dest = 'Mall del Sol'
        else if (b.includes('centro') || b.includes('producci')) dest = 'Centro Prod.'
        else dest = order.branch
      }

      if (!stats[dest]) stats[dest] = {}
      const destGroup = stats[dest] as Record<string, number>

      order.products.forEach((p: any) => {
        destGroup[p.name] = (destGroup[p.name] || 0) + (p.quantity || 0)
      })
    })

    return stats
  })

  // Groups by Destination → Round Label → Product → Quantity
  const rawStatsByDestinationAndRound = computed(() => {
    const stats: Record<string, Record<string, Record<string, number>>> = {}
    if (!rawFilteredOrders.value.length) return stats

    rawFilteredOrders.value.forEach(order => {
      let dest = 'Otros / Sin Local'
      if (order.deliveryType === 'delivery') {
        dest = 'Delivery'
      } else if (order.branch) {
        const b = order.branch.toLowerCase()
        if (b.includes('marino')) dest = 'San Marino'
        else if (b.includes('mall') || b.includes('sol')) dest = 'Mall del Sol'
        else if (b.includes('centro') || b.includes('producci')) dest = 'Centro Prod.'
        else dest = order.branch
      }

      const isRestock = order.salesChannel === 'Restock' || order.salesChannel === 'Restock-Bodega'
      const roundLabel = isRestock && order.comments ? order.comments : ''

      if (!stats[dest]) stats[dest] = {}
      if (!stats[dest]![roundLabel]) stats[dest]![roundLabel] = {}
      const roundGroup = stats[dest]![roundLabel] as Record<string, number>

      order.products.forEach((p: any) => {
        roundGroup[p.name] = (roundGroup[p.name] || 0) + (p.quantity || 0)
      })
    })

    return stats
  })

  // Total pending quantity per product across filtered orders
  const totalByProduct = computed(() => {
    const totals: Record<string, number> = {}
    rawFilteredOrders.value.forEach(order => {
      order.products.forEach((p: any) => {
        if (p.productionStatus !== 'COMPLETED') {
          const pending = p.quantity - (p.produced || 0)
          if (pending > 0) totals[p.name] = (totals[p.name] || 0) + pending
        }
      })
    })
    return totals
  })

  const fetchSummary = async (background = false) => {
    try {
      if (!background) isLoading.value = true
      error.value = ''
      rawOrders.value = await ProductionService.getAllOrders('all')
      if (!background) isLoading.value = false
    } catch (err) {
      console.error(err)
      error.value = 'No se pudo cargar el resumen de producción.'
    } finally {
      if (!background) isLoading.value = false
      isBackgroundLoading.value = false
    }
  }

  const toggleRawProductSelection = (productName: string) => {
    if (selectedRawProducts.value.has(productName)) {
      selectedRawProducts.value.delete(productName)
    } else {
      selectedRawProducts.value.add(productName)
    }
  }

  const clearRawSelection = () => {
    selectedRawProducts.value.clear()
  }

  const isBatchProcessing = ref(false)

  const batchCompleteSelected = async () => {
    if (selectedRawProducts.value.size === 0) return
    const items = Array.from(selectedRawProducts.value)
      .map(name => ({ productName: name, quantity: totalByProduct.value[name] || 0 }))
      .filter(i => i.quantity > 0)
    if (items.length === 0) return
    try {
      isBatchProcessing.value = true
      await ProductionService.batchRegisterProgress(items)
      clearRawSelection()
      await fetchSummary(true)
    } finally {
      isBatchProcessing.value = false
    }
  }

  // Kept for history panel / other potential callers
  const toggleCategory = (categoryGroup: CategoryGroup) => {
    if (collapsedCategoryIds.value.has(categoryGroup.id)) {
      collapsedCategoryIds.value.delete(categoryGroup.id)
    } else {
      collapsedCategoryIds.value.add(categoryGroup.id)
    }
  }

  const toggleExpand = (item: any) => {
    item.isExpanded = !item.isExpanded
  }

  const voidItem = async (item: any) => {
    try {
      const voidPromises = item.orders.map((o: any) => ProductionService.voidOrder(o.id))
      await Promise.all(voidPromises)
    } catch (err) {
      console.error(err)
      error.value = 'Error al anular item'
      throw err
    }
  }

  return {
    isLoading,
    isBackgroundLoading,
    error,
    showHistory,
    fetchSummary,
    // Raw mode (now the only mode)
    rawOrders,
    rawBucketFilter,
    sourceFilter,
    rawFilteredOrders,
    rawStatsByDestination,
    rawStatsByDestinationAndRound,
    selectedRawProducts,
    toggleRawProductSelection,
    clearRawSelection,
    batchCompleteSelected,
    isBatchProcessing,
    totalByProduct,
    // Secondary (history panel / compatibility)
    collapsedCategoryIds,
    toggleCategory,
    toggleExpand,
    voidItem,
  }
}
