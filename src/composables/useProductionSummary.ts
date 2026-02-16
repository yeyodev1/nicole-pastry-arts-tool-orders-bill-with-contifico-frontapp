import { ref, computed } from 'vue'
import ProductionService from '@/services/production.service'
import type { SummaryItem, CategoryGroup } from '@/types/production'
import { parseECTDate, getECTNow, getECTTodayString, isSameDayECT } from '@/utils/dateUtils'

export function useProductionSummary() {
  const isLoading = ref(true)
  const error = ref('')
  const isBackgroundLoading = ref(false)

  // Data Refs 
  const delayedItems = ref<SummaryItem[]>([])
  const todayItems = ref<SummaryItem[]>([])
  const tomorrowItems = ref<SummaryItem[]>([])
  const futureItems = ref<SummaryItem[]>([])
  const collapsedCategoryIds = ref<Set<string>>(new Set())
  const isRawMode = ref(false)
  const rawBucketFilter = ref<'delayed' | 'today' | 'tomorrow' | 'future' | 'all'>('today')
  const rawOrders = ref<any[]>([])
  const selectedRawProducts = ref<Set<string>>(new Set())

  // History Data
  const showHistory = ref(false)
  const completedItems = ref<SummaryItem[]>([])

  const CATEGORY_ORDER = [
    'cakes enteros',
    'cakes porcion',
    'pack de turrones',
    'panetton',
    'secos market',
    'individual',
    'panaderais',
    'Otros'
  ]

  const groupByCategory = (items: SummaryItem[], prefix: string): CategoryGroup[] => {
    const groups: Record<string, SummaryItem[]> = {}

    items.forEach(item => {
      const cat = item.category || 'Otros'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(item)
    })

    return Object.keys(groups)
      .map(key => {
        const id = `${prefix}-${key.replace(/\s+/g, '-').toLowerCase()}`
        return {
          name: key,
          items: groups[key] || [],
          isExpanded: !collapsedCategoryIds.value.has(id),
          id: id
        }
      })
      .sort((a, b) => {
        const idxA = CATEGORY_ORDER.indexOf(a.name)
        const idxB = CATEGORY_ORDER.indexOf(b.name)
        const posA = idxA === -1 ? 999 : idxA
        const posB = idxB === -1 ? 999 : idxB
        return posA - posB
      })
  }

  const delayedGroups = computed(() => groupByCategory(delayedItems.value, 'delayed'))
  const todayGroups = computed(() => groupByCategory(todayItems.value, 'today'))
  const tomorrowGroups = computed(() => groupByCategory(tomorrowItems.value, 'tomorrow'))
  const futureGroups = computed(() => groupByCategory(futureItems.value, 'future'))

  const rawFilteredOrders = computed(() => {
    if (!rawOrders.value.length) return []

    const today = getECTNow()
    today.setHours(0, 0, 0, 0)

    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Manual bucketing
    return rawOrders.value.filter(order => {
      if (rawBucketFilter.value === 'all') {
        return order.productionStage !== 'VOID'
      }

      if (!order.deliveryDate) return false
      const dDate = parseECTDate(order.deliveryDate)

      if (rawBucketFilter.value === 'today') {
        return isSameDayECT(dDate, today) && order.productionStage !== 'VOID'
      }
      if (rawBucketFilter.value === 'tomorrow') {
        return isSameDayECT(dDate, tomorrow) && order.productionStage !== 'VOID'
      }
      if (rawBucketFilter.value === 'delayed') {
        return dDate < today && order.productionStage !== 'VOID'
      }
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

  const hasItems = computed(() => {
    return delayedItems.value.length > 0 || todayItems.value.length > 0 || tomorrowItems.value.length > 0 || futureItems.value.length > 0
  })

  // Helper to process raw items from backend into SummaryItems
  const processBucketItems = (rawItems: any[]): SummaryItem[] => {
    if (!rawItems || !Array.isArray(rawItems)) return []

    const result: SummaryItem[] = []

    // Raw items are already grouped by Product Name from backend service
    // structure: { _id: productName, category: ..., orders: [...] }

    rawItems.forEach(group => {
      // Filter out valid orders
      const activeOrders = group.orders.filter((o: any) => {
        if (isRawMode.value) return true // Show all orders in Raw Mode
        const isFinished = o.stage === 'FINISHED'
        const qty = o.pendingInOrder !== undefined ? o.pendingInOrder : (o.quantity || 0)
        return !isFinished && qty > 0
      })

      if (activeOrders.length === 0) return

      // Urgency Calculation
      const minDate = activeOrders.reduce((min: number, o: any) => {
        const d = parseECTDate(o.delivery).getTime()
        return d < min ? d : min
      }, Infinity)

      result.push({
        _id: group._id,
        totalQuantity: activeOrders.reduce((acc: number, o: any) => {
          if (isRawMode.value) return acc + (o.quantity || 0)
          return acc + (o.pendingInOrder !== undefined ? o.pendingInOrder : (o.quantity || 0))
        }, 0),
        urgency: new Date(minDate).toISOString(),
        category: group.category,
        orders: activeOrders.map((o: any) => ({
          id: o.id,
          quantity: isRawMode.value ? (o.quantity || 0) : (o.pendingInOrder !== undefined ? o.pendingInOrder : o.quantity),
          client: o.client,
          delivery: o.delivery,
          stage: o.stage,
          branch: o.branch,
          deliveryType: o.deliveryType
        })),
        mode: 'custom' as const,
        currentInput: undefined
      })
    })

    return result
  }

  const fetchBucket = async (bucket: 'delayed' | 'today' | 'tomorrow' | 'future') => {
    try {
      const response = await ProductionService.getSummary(bucket)
      const items = response && response[bucket] ? response[bucket] : []
      const processed = processBucketItems(items)

      if (bucket === 'delayed') delayedItems.value = processed
      else if (bucket === 'today') todayItems.value = processed
      else if (bucket === 'tomorrow') tomorrowItems.value = processed
      else if (bucket === 'future') futureItems.value = processed
    } catch (err) {
      console.error(`Error loading bucket ${bucket}:`, err)
    }
  }

  // Renamed to fetchSummaryIncremental to be explicit, but kept as fetchSummary for compatibility
  const fetchSummary = async (background = false) => {
    try {
      if (!background) {
        isLoading.value = true
      }
      error.value = ''

      if (isRawMode.value) {
        // Professional approach: fetch all orders and process locally for true demand
        rawOrders.value = await ProductionService.getAllOrders()
        if (!background) isLoading.value = false
        return
      }

      // 1. Critical Path: Delayed & Today
      await Promise.all([
        fetchBucket('delayed'),
        fetchBucket('today')
      ])

      // 2. Unlock UI (Critical data is here)
      if (!background) isLoading.value = false

      // 3. Background Path: Tomorrow & Future
      isBackgroundLoading.value = true
      await Promise.all([
        fetchBucket('tomorrow'),
        fetchBucket('future')
      ])
    } catch (err) {
      console.error(err)
      error.value = 'No se pudo cargar el resumen de producción.'
    } finally {
      if (!background) isLoading.value = false
      isBackgroundLoading.value = false
    }
  }

  // Toggle Category Logic
  const toggleCategory = (categoryGroup: CategoryGroup) => {
    if (collapsedCategoryIds.value.has(categoryGroup.id)) {
      collapsedCategoryIds.value.delete(categoryGroup.id)
    } else {
      collapsedCategoryIds.value.add(categoryGroup.id)
    }
  }

  const toggleExpand = (item: SummaryItem) => {
    item.isExpanded = !item.isExpanded
  }

  const voidItem = async (item: SummaryItem) => {
    try {
      // Void item by item (or batch if service supported it, but we have strict orders)
      const voidPromises = item.orders.map(o => ProductionService.voidOrder(o.id))
      await Promise.all(voidPromises)
    } catch (err) {
      console.error(err)
      error.value = 'Error al anular item'
      throw err // Re-throw to allow component to handle UX
    }
  }

  const selectedItemIds = ref<Set<string>>(new Set())

  const toggleSelection = (item: SummaryItem) => {
    if (selectedItemIds.value.has(item._id)) {
      selectedItemIds.value.delete(item._id)
    } else {
      selectedItemIds.value.add(item._id)
    }
  }

  const clearSelection = () => {
    selectedItemIds.value.clear()
  }

  const batchRegister = async () => {
    if (selectedItemIds.value.size === 0) return

    try {
      isLoading.value = true

      // Prepare Payload
      // We need to find the items to get their quantities (we default to ALL pending for batch)
      const itemsToRegister: { productName: string; quantity: number }[] = []

      // Helper to find item across all lists
      const findItem = (id: string) => {
        const all = [...delayedItems.value, ...todayItems.value, ...tomorrowItems.value, ...futureItems.value]
        return all.find(i => i._id === id)
      }

      for (const id of selectedItemIds.value) {
        const item = findItem(id)
        if (item) {
          itemsToRegister.push({
            productName: item._id,
            quantity: item.totalQuantity // Batch always full amount for simplicity
          })
        }
      }

      await ProductionService.batchRegisterProgress(itemsToRegister)

      clearSelection()
      await fetchSummary()

    } catch (err) {
      console.error(err)
      error.value = 'Error al registrar lote'
      isLoading.value = false
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

  return {
    isLoading,
    isBackgroundLoading, // Exported to show a small loader if needed
    error,
    delayedGroups,
    todayGroups,
    tomorrowGroups,
    futureGroups,
    hasItems,
    collapsedCategoryIds,
    fetchSummary,
    toggleCategory,
    toggleExpand,
    voidItem,
    showHistory,
    completedItems,
    // Selection
    selectedItemIds,
    toggleSelection,
    clearSelection,
    batchRegister,
    // Raw Mode
    isRawMode,
    rawBucketFilter,
    rawFilteredOrders,
    rawStatsByDestination,
    selectedRawProducts,
    toggleRawProductSelection,
    clearRawSelection,
    rawOrders
  }
}
