import { ref } from 'vue'
// @ts-ignore
import * as XLSX from 'xlsx'
import ProductionService from '@/services/production.service'
import { parseECTDate, formatECT } from '@/utils/dateUtils'

export function useOrderExport() {
  const isExporting = ref(false)

  // --- Helpers ---
  const saveExcelFile = (workbook: XLSX.WorkBook, filename: string) => {
    XLSX.writeFile(workbook, `${filename}.xlsx`)
  }

  // --- Production Export ---
  const exportProductionOrder = async (
    filterMode: 'yesterday' | 'today' | 'tomorrow' | 'future' | 'all',
    responsibleName: string
  ) => {
    isExporting.value = true
    try {
      // 1. Fetch Summary Data (Reusing ProductionService logic)
      // We need to fetch specific bucket or all if "all" (though "all" might be heavy, let's stick to what view does or fetch all for report?)
      // distinct buckets: delayed, today, tomorrow, future. 
      // User likely wants "Today's Production" or "Tomorrow's". 
      // If filterMode is 'all', we might need to fetch multiple.
      // For now let's prioritize the current filterMode bucket.

      let items: any[] = []
      if (filterMode === 'all') {
        // Fetch all relevant buckets
        const [d, t, tm, f] = await Promise.all([
          ProductionService.getSummary('delayed'),
          ProductionService.getSummary('today'),
          ProductionService.getSummary('tomorrow'),
          ProductionService.getSummary('future')
        ])
        items = [
          ...(d?.delayed || []),
          ...(t?.today || []),
          ...(tm?.tomorrow || []),
          ...(f?.future || [])
        ]
      } else {
        const response = await ProductionService.getSummary(filterMode as any)
        items = response ? response[filterMode] : []
      }

      // Group by Category to match User Request Format
      // Expected Categories: TORTAS, INDIVIDUALES, BOLLERIA, GALLETAS, SYROPES, VEGETALES, HELADERIA, CASA MIA, OTROS
      const categoryMap: Record<string, any[]> = {
        'TORTAS': [],
        'INDIVIDUALES': [],
        'BOLLERIA': [],
        'GALLETAS': [],
        'SYROPES': [],
        'VEGETALES': [],
        'HELADERIA': [],
        'CASA MIA': [],
        'OTROS': []
      }

      items.forEach((item: any) => {
        // Calculate total pending quantity
        const pending = (item.orders || []).reduce((acc: number, o: any) => {
          // Only count pending
          if (o.stage === 'FINISHED') return acc
          return acc + (o.pendingInOrder !== undefined ? o.pendingInOrder : o.quantity)
        }, 0)

        if (pending <= 0) return

        const cat = (item.category || '').toUpperCase()
        const name = item._id
        const unit = 'UNI' // Default unit, simplified

        // Simple mapping
        let targetCat = 'OTROS'
        if (cat.includes('CAKE') || cat.includes('TORTA')) targetCat = 'TORTAS'
        else if (cat.includes('INDIVIDUAL')) targetCat = 'INDIVIDUALES'
        else if (cat.includes('BOLLERIA') || cat.includes('PAN')) targetCat = 'BOLLERIA'
        else if (cat.includes('GALLETA') || cat.includes('COOKIE')) targetCat = 'GALLETAS'
        else if (cat.includes('SIROPE') || cat.includes('SYRUP')) targetCat = 'SYROPES'
        else if (cat.includes('VEGETAL') || cat.includes('FRUTA')) targetCat = 'VEGETALES'
        else if (cat.includes('HELADO') || cat.includes('NIEVE')) targetCat = 'HELADERIA'
        else if (cat.includes('CASA') || cat.includes('SALADO')) targetCat = 'CASA MIA'

        const targetList = categoryMap[targetCat]
        if (targetList) {
          targetList.push({ name, unit, qty: pending })
        }
      })

      // Create Worksheet Data
      const wsData: any[][] = []

      // Header Info
      wsData.push(['PRODUCTO', 'FECHA', `RESPONSABLE: ${responsibleName.toUpperCase()}`, 'RECIBIDO', 'REBECCA PINTO'])
      wsData.push(['', formatECT(new Date().toISOString(), false), `HORA: ${new Date().getHours()}:${new Date().getMinutes().toString().padStart(2, '0')}`, '', 'HORA: 16:00'])
      wsData.push(['', '', 'PRIMER DESPACHO', '', 'SEGUNDO DESPACHO'])
      wsData.push([]) // Spacer

      // Rows by Category
      Object.keys(categoryMap).forEach(cat => {
        const products = categoryMap[cat] || []
        if (products.length > 0) {
          wsData.push([cat]) // Category Header
          products.forEach(p => {
            wsData.push([p.name, p.unit, p.qty, '', ''])
          })
          wsData.push([]) // Spacer after category
        }
      })

      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.aoa_to_sheet(wsData)

      // Basic Styling (Column widths)
      ws['!cols'] = [{ wch: 40 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 20 }]

      XLSX.utils.book_append_sheet(wb, ws, 'Orden Produccion')
      saveExcelFile(wb, `Orden_Produccion_${formatECT(new Date().toISOString(), false)}`)

    } catch (error) {
      console.error('Export error:', error)
      throw error
    } finally {
      isExporting.value = false
    }
  }

  // --- Dispatch Export ---
  const exportDispatchOrder = async (orders: any[]) => {
    isExporting.value = true
    try {
      const wsData: any[][] = []

      // Headers from user image:
      // FECHA DE ENTREGA | CLIENTE | PEDIDO | HORA DE ENTREGA | DIRECCION DE ENTREGA | ESTADO DE PAGO
      wsData.push(['FECHA DE ENTREGA', 'CLIENTE', 'PEDIDO', 'HORA DE ENTREGA', 'DIRECCION DE ENTREGA', 'ESTADO DE PAGO'])

      orders.forEach(order => {
        // Format Date
        const dateStr = order.deliveryDate ? formatECT(order.deliveryDate, false) : ''

        // Format Items (e.g., "1 Torta tiramisu, 2 Galletas")
        const products = order.products || []
        const itemsStr = products.map((p: any) => `${p.quantity} ${p.name}`).join(' + ')

        // Address / Destination
        let address = ''
        if (order.deliveryType === 'delivery') {
          address = order.deliveryAddress || 'Domicilio'
        } else {
          address = order.branch || 'Retiro en Local'
        }

        // Payment status (Usually computed or from paymentDetails)
        // Adjust based on your model. Assuming 'paymentStatus' or checking 'paymentDetails'
        const paymentStatus = order.paymentDetails?.status === 'PAID' ? 'PAGADO' : 'PENDIENTE'
        const paymentMethod = order.paymentDetails?.method ? `(${order.paymentDetails.method})` : ''
        const paymentStr = `${paymentStatus} ${paymentMethod}`

        wsData.push([
          dateStr,
          order.customerName,
          itemsStr,
          order.deliveryTime || '',
          address,
          paymentStr
        ])
      })

      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.aoa_to_sheet(wsData)

      // Column Widths
      ws['!cols'] = [{ wch: 15 }, { wch: 30 }, { wch: 40 }, { wch: 15 }, { wch: 30 }, { wch: 25 }]

      XLSX.utils.book_append_sheet(wb, ws, 'Despacho')
      saveExcelFile(wb, `Orden_Despacho_${formatECT(new Date().toISOString(), false)}`)

    } catch (error) {
      console.error('Export dispatch error:', error)
      throw error
    } finally {
      isExporting.value = false
    }
  }

  return {
    isExporting,
    exportProductionOrder,
    exportDispatchOrder
  }
}
