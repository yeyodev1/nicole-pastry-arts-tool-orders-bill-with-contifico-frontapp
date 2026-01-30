import { ref, computed } from 'vue'
import ProductionService from '@/services/production.service'
import type { SummaryItem, CategoryGroup } from '@/types/production'

export function useProductionSummary() {
  const isLoading = ref(true)
  const error = ref('')

  // Data Refs 
  const delayedItems = ref<SummaryItem[]>([])
  const todayItems = ref<SummaryItem[]>([])
  const tomorrowItems = ref<SummaryItem[]>([])
  const futureItems = ref<SummaryItem[]>([])
  const collapsedCategoryIds = ref<Set<string>>(new Set())

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

  const hasItems = computed(() => {
    return delayedItems.value.length > 0 || todayItems.value.length > 0 || tomorrowItems.value.length > 0 || futureItems.value.length > 0
  })

  const fetchSummary = async (background = false) => {
    try {
      if (!background) isLoading.value = true
      const response = await ProductionService.getSummary()
      const data = response.dashboard || response

      // 1. Flatten all items from backend
      const allBackendItems = [
        ...(data.today || []),
        ...(data.tomorrow || []),
        ...(data.future || [])
      ]

      // 2. Define Date Boundaries (Strict Local Time)
      const now = new Date()
      const startOfToday = new Date(now)
      startOfToday.setHours(0, 0, 0, 0)

      const startOfTomorrow = new Date(startOfToday)
      startOfTomorrow.setDate(startOfTomorrow.getDate() + 1)

      const startOfFuture = new Date(startOfTomorrow)
      startOfFuture.setDate(startOfFuture.getDate() + 1)

      // 3. Buckets Storage
      const buckets: Record<string, Map<string, { category: string, orders: any[] }>> = {
        delayed: new Map(),
        today: new Map(),
        tomorrow: new Map(),
        future: new Map()
      }

      // 4. Iterate and Re-Distribute
      allBackendItems.forEach((item: any) => {
        if (!item.orders || !Array.isArray(item.orders)) return

        item.orders.forEach((order: any) => {
          const d = new Date(order.delivery)
          let bucketKey = 'future'

          if (d < startOfToday) {
            bucketKey = 'delayed'
          } else if (d >= startOfToday && d < startOfTomorrow) {
            bucketKey = 'today'
          } else if (d >= startOfTomorrow && d < startOfFuture) {
            bucketKey = 'tomorrow'
          } else {
            bucketKey = 'future'
          }

          const productMap = buckets[bucketKey]
          const prodName = item._id

          if (productMap && !productMap.has(prodName)) {
            productMap.set(prodName, {
              category: item.category || 'Otros',
              orders: []
            })
          }
          if (productMap) {
            const entry = productMap.get(prodName)
            if (entry) entry.orders.push(order)
          }
        })
      })

      // 5. Convert Maps to SummaryItem[]
      const buildItems = (bucketKey: string): SummaryItem[] => {
        const map = buckets[bucketKey]
        const result: SummaryItem[] = []

        if (map) {
          map.forEach((val, key) => {
            // Calculate urgency (min delivery date)
            const minDate = val.orders.reduce((min: number, o: any) => {
              const d = new Date(o.delivery).getTime()
              return d < min ? d : min
            }, Infinity)

            result.push({
              _id: key,
              totalQuantity: val.orders.reduce((acc, o) => acc + (o.pendingInOrder !== undefined ? o.pendingInOrder : (o.quantity || 0)), 0),
              urgency: new Date(minDate).toISOString(),
              category: val.category,
              orders: val.orders.map(o => ({
                id: o.id,
                quantity: o.pendingInOrder !== undefined ? o.pendingInOrder : o.quantity,
                client: o.client,
                delivery: o.delivery,
                stage: o.stage
              })),
              mode: 'custom' as const,
              currentInput: undefined
            })
          })
        }
        return result
      }

      delayedItems.value = buildItems('delayed')
      todayItems.value = buildItems('today')
      tomorrowItems.value = buildItems('tomorrow')
      futureItems.value = buildItems('future')

    } catch (err) {
      console.error(err)
      error.value = 'No se pudo cargar el resumen de producción.'
    } finally {
      if (!background) isLoading.value = false
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

  return {
    isLoading,
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
    completedItems
  }
}
