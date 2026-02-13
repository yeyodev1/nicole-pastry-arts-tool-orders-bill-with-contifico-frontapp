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
    orders: any[],
    responsibleName: string
  ) => {
    isExporting.value = true
    try {
      // Aggregate products from the provided orders list
      // We want to sum up quantities for each product across all selected orders.
      const productAggregation: Record<string, { name: string, qty: number, category: string }> = {}

      orders.forEach(order => {
        // Skip orders that shouldn't be in production? 
        // Usually we export exactly what is filtered.
        // If the user filtered by "Invoice Error", they still might want a production list for those.
        // So we process all passed orders.

        const products = order.products || []
        products.forEach((p: any) => {
          const name = p.name || 'Unknown'
          const key = p._id || name // Use ID if available for uniqueness, else name
          const qty = p.quantity || 0
          const cat = p.category || ''

          if (!productAggregation[key]) {
            productAggregation[key] = {
              name: name,
              qty: 0,
              category: cat
            }
          }
          productAggregation[key].qty += qty
          // Update category if we found one and previous was empty
          if (!productAggregation[key].category && cat) {
            productAggregation[key].category = cat
          }
        })
      })

      // Group by Category to match User Request Format
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

      Object.values(productAggregation).forEach(item => {
        if (item.qty <= 0) return

        const cat = (item.category || '').toUpperCase()
        const name = item.name
        const unit = 'UNI'

        // Mapping Logic
        let targetCat = 'OTROS'
        // Try strict mapping first if category is known
        if (categoryMap[cat]) {
          targetCat = cat
        } else {
          // Heuristic mapping
          if (cat.includes('CAKE') || cat.includes('TORTA') || name.toUpperCase().includes('TORTA')) targetCat = 'TORTAS'
          else if (cat.includes('INDIVIDUAL') || name.toUpperCase().includes('INDIVIDUAL')) targetCat = 'INDIVIDUALES'
          else if (cat.includes('BOLLERIA') || cat.includes('PAN') || name.toUpperCase().includes('PAN')) targetCat = 'BOLLERIA'
          else if (cat.includes('GALLETA') || cat.includes('COOKIE') || name.toUpperCase().includes('GALLETA')) targetCat = 'GALLETAS'
          else if (cat.includes('SIROPE') || cat.includes('SYRUP')) targetCat = 'SYROPES'
          else if (cat.includes('VEGETAL') || cat.includes('FRUTA')) targetCat = 'VEGETALES'
          else if (cat.includes('HELADO') || cat.includes('NIEVE')) targetCat = 'HELADERIA'
          else if (cat.includes('CASA') || cat.includes('SALADO')) targetCat = 'CASA MIA'
        }

        const targetList = categoryMap[targetCat] || categoryMap['OTROS'] || []
        targetList.push({ name, unit, qty: item.qty })
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
      // FECHA DE ENTREGA | CLIENTE | PEDIDO | HORA DE ENTREGA | DIRECCION DE ENTREGA | ESTADO DE PAGO | COMENTARIOS
      wsData.push(['FECHA DE ENTREGA', 'CLIENTE', 'PEDIDO', 'HORA DE ENTREGA', 'DIRECCION DE ENTREGA', 'ESTADO DE PAGO', 'COMENTARIOS'])

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
          paymentStr,
          order.comments || ''
        ])
      })

      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.aoa_to_sheet(wsData)

      // Column Widths
      ws['!cols'] = [{ wch: 15 }, { wch: 30 }, { wch: 40 }, { wch: 15 }, { wch: 30 }, { wch: 25 }, { wch: 40 }]

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
