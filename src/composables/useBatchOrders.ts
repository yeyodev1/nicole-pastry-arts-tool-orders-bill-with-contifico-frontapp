import { ref, computed } from 'vue'
import OrderService from '@/services/order.service'
import { useToast } from '@/composables/useToast'

// Separate helper for concurrency
const chunkArray = (arr: any[], size: number) => {
  const chunks = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

export function useBatchOrders(orders: any, fetchOrders: () => void) {
  const { success, error: showError, info } = useToast()

  const selectedOrderIds = ref<Set<string>>(new Set())
  const isBatchProcessing = ref(false)

  // Controls confirmation modal
  const showBatchRetryModal = ref(false)
  const batchSkippedCount = ref(0)
  const batchValidCount = ref(0)


  const toggleSelection = (orderId: string) => {
    if (selectedOrderIds.value.has(orderId)) {
      selectedOrderIds.value.delete(orderId)
    } else {
      selectedOrderIds.value.add(orderId)
    }
  }

  const toggleSelectAll = (filteredOrders: any[]) => {
    // If all visible are selected, deselect them
    // Logic: check intersection or size
    // Simple logic: if selection size matches filtered count, clear. Else, add all.
    // Note: This matches "Select All visible" logic.
    if (selectedOrderIds.value.size === filteredOrders.length && filteredOrders.length > 0) {
      selectedOrderIds.value.clear()
    } else {
      filteredOrders.forEach(order => selectedOrderIds.value.add(order._id))
    }
  }

  // Pre-validation and Modal Open
  const handleBatchRetry = () => {
    const ids = Array.from(selectedOrderIds.value)
    if (ids.length === 0) return

    // 1. Validation
    // Access unref(orders) or orders.value depending on how it's passed.
    // Assuming 'orders' is a Ref passed in.
    const allOrders = orders.value || []
    const ordersToRetry = ids.map(id => allOrders.find((o: any) => o._id === id)).filter(Boolean)

    const validOrders = ordersToRetry.filter((o: any) =>
      o.invoiceData?.ruc?.trim() &&
      o.invoiceData?.email?.trim() &&
      o.invoiceData?.businessName?.trim()
    )

    const skippedCount = ordersToRetry.length - validOrders.length

    if (validOrders.length === 0) {
      showError('Ninguna orden valida seleccionada.')
      return
    }

    // Set State for Modal
    batchSkippedCount.value = skippedCount
    batchValidCount.value = validOrders.length

    // Open Modal
    showBatchRetryModal.value = true
  }


  // Execute Logic (Called by Modal)
  const executeBatchRetry = async () => {
    showBatchRetryModal.value = false

    const ids = Array.from(selectedOrderIds.value)
    const allOrders = orders.value || []
    const validOrders = ids.map(id => allOrders.find((o: any) => o._id === id))
      .filter((o: any) => o && o.invoiceData?.ruc?.trim())

    if (validOrders.length === 0) return

    isBatchProcessing.value = true
    selectedOrderIds.value.clear()
    info(`Procesando ${validOrders.length} facturas... (Lotes de 5)`)

    const BATCH_SIZE = 5
    const chunks = chunkArray(validOrders, BATCH_SIZE)

    let successCount = 0
    let failCount = 0

    for (const chunk of chunks) {
      const promises = chunk.map((order: any) => OrderService.generateInvoice(order._id))
      const results = await Promise.allSettled(promises)

      successCount += results.filter(r => r.status === 'fulfilled').length
      failCount += results.filter(r => r.status === 'rejected').length
    }

    isBatchProcessing.value = false

    // Clear selection ONLY on success (or partial success)
    if (failCount === 0) {
      success(`Proceso finalizado. ${successCount} facturas exitosas.`)
      selectedOrderIds.value.clear()
    } else {
      showError(`Finalizado: ${successCount} exitosas, ${failCount} fallidas.`)
      // Optional: Don't clear selection so user can retry failed ones?
      // For now, clear to reset state.
      selectedOrderIds.value.clear()
    }
    fetchOrders()
  }

  return {
    selectedOrderIds,
    isBatchProcessing,
    showBatchRetryModal,
    batchSkippedCount,
    batchValidCount,
    toggleSelection,
    toggleSelectAll,
    handleBatchRetry,
    executeBatchRetry
  }
}
