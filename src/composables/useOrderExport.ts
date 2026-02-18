import { ref } from 'vue'
// @ts-ignore
import XLSX from 'xlsx-js-style'
import { formatECT } from '@/utils/dateUtils'

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
      // Aggregate products
      const productAggregation: Record<string, { name: string, qty: number, category: string, comments: string[] }> = {}

      orders.forEach(order => {
        const products = order.products || []
        const orderComment = order.comments ? `${order.customerName}: ${order.comments}` : null

        products.forEach((p: any) => {
          const name = p.name || 'Unknown'
          const key = name.trim().toUpperCase()
          const qty = p.quantity || 0
          const cat = p.category || ''

          if (!productAggregation[key]) {
            productAggregation[key] = {
              name: name,
              qty: 0,
              category: cat,
              comments: []
            }
          }
          productAggregation[key].qty += qty

          if (!productAggregation[key].category && cat) {
            productAggregation[key].category = cat
          }

          if (orderComment) {
            productAggregation[key].comments.push(orderComment)
          }
        })
      })

      // Dynamic Grouping Logic
      // Define preferred order for known categories
      const preferredOrder = [
        'TORTAS',
        'INDIVIDUALES',
        'BOLLERIA',
        'GALLETAS',
        'SYROPES',
        'VEGETALES',
        'HELADERIA',
        'CASA MIA',
        'PACK PEQUEÑO', // Added from user image example
        'OTROS'
      ]

      const groupedProducts: Record<string, any[]> = {}

      Object.values(productAggregation).forEach(item => {
        if (item.qty <= 0) return

        let cat = (item.category || '').toUpperCase().trim()
        const name = item.name.toUpperCase()

        // Mapping Logic (can be expanded)
        if (!cat) {
          if (name.includes('TORTA')) cat = 'TORTAS'
          else if (name.includes('INDIVIDUAL')) cat = 'INDIVIDUALES'
          else if (name.includes('PAN') || name.includes('CROISSANT')) cat = 'BOLLERIA'
          else if (name.includes('GALLETA') || name.includes('COOKIE')) cat = 'GALLETAS'
          else cat = 'OTROS'
        }

        if (!groupedProducts[cat]) {
          groupedProducts[cat] = []
        }

        const currentGroup = groupedProducts[cat] as any[]
        currentGroup.push({
          name: item.name,
          unit: 'UNI',
          qty: item.qty,
          comments: item.comments.join('; ')
        })
      })

      // Sort categories based on preferred order, putting unknown ones at the end (before OTROS if possible)
      const sortedCategories = Object.keys(groupedProducts).sort((a, b) => {
        const indexA = preferredOrder.indexOf(a)
        const indexB = preferredOrder.indexOf(b)

        if (indexA !== -1 && indexB !== -1) return indexA - indexB
        if (indexA !== -1) return -1
        if (indexB !== -1) return 1

        // Both unknown, sort alphabetically
        return a.localeCompare(b)
      })

      // Create Worksheet Data with Styling
      const wsData: any[][] = []
      // We will track cell styles
      const wsMerges: any[] = []
      const wsStyle: any = {} // Cell address -> style object

      // Helper to set style
      const setStyle = (row: number, col: number, style: any) => {
        const cellRef = XLSX.utils.encode_cell({ r: row, c: col })
        wsStyle[cellRef] = style
      }

      // Header Info
      wsData.push(['PRODUCTO', 'FECHA', `RESPONSABLE: ${responsibleName.toUpperCase()}`, 'RECIBIDO', 'REBECCA PINTO', 'COMENTARIOS'])
      wsData.push(['', formatECT(new Date().toISOString(), false), `HORA: ${new Date().getHours()}:${new Date().getMinutes().toString().padStart(2, '0')}`, '', 'HORA: 16:00', ''])
      wsData.push(['', '', 'PRIMER DESPACHO', '', 'SEGUNDO DESPACHO', ''])
      wsData.push([]) // Spacer

      // Apply styles to header rows
      // Row 0 (Headers)
      for (let c = 0; c <= 5; c++) {
        setStyle(0, c, { font: { bold: true }, border: { bottom: { style: 'thin' } } })
      }

      let currentRow = 4

      sortedCategories.forEach(cat => {
        const products = groupedProducts[cat] || []
        if (products.length > 0) {
          // Category Header
          wsData.push([cat, '', '', '', '', ''])

          // Merge cells for category header across A-F? Or just leave it in A
          // Let's style the whole row for the category
          for (let c = 0; c <= 5; c++) {
            setStyle(currentRow, c, {
              fill: { fgColor: { rgb: "E0E0E0" } }, // Light Gray background
              font: { bold: true, sz: 12 }
            })
          }
          currentRow++

          products.forEach(p => {
            wsData.push([p.name, p.unit, p.qty, '', '', p.comments])
            currentRow++
          })
          // Spacer after category
          wsData.push([])
          currentRow++
        }
      })

      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.aoa_to_sheet(wsData)

      // Apply merges (if any needed, none strict right now)
      // ws['!merges'] = wsMerges

      // Apply styles
      Object.keys(wsStyle).forEach(cell => {
        if (!ws[cell]) return
        ws[cell].s = wsStyle[cell]
      })

      // Column Widths
      ws['!cols'] = [{ wch: 40 }, { wch: 10 }, { wch: 25 }, { wch: 15 }, { wch: 20 }, { wch: 50 }]

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
  const exportDispatchOrder = async (orders: any[], branchName: string) => {
    isExporting.value = true
    try {
      const wsData: any[][] = []
      const wsStyle: Record<string, any> = {}

      // Helper to set style
      const setStyle = (row: number, col: number, style: any) => {
        const cellRef = XLSX.utils.encode_cell({ r: row, c: col })
        wsStyle[cellRef] = style
      }

      // 1. Branch Header Row (Row 0)
      wsData.push([`REPORTE DE ENTREGAS - ${branchName.toUpperCase()}`])

      // Style for Branch Header
      setStyle(0, 0, {
        font: { bold: true, sz: 14, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "6A1B9A" } }, // Purple
        alignment: { horizontal: 'left', vertical: 'center' }
      })

      // 2. Column Headers (Row 1)
      const headers = ['FECHA DE ENTREGA', 'CLIENTE', 'PEDIDO', 'HORA DE ENTREGA', 'DIRECCION DE ENTREGA', 'ESTADO DE PAGO', 'COMENTARIOS']
      wsData.push(headers)

      // Header Style
      for (let c = 0; c < headers.length; c++) {
        setStyle(1, c, {
          font: { bold: true, color: { rgb: "FFFFFF" } },
          fill: { fgColor: { rgb: "2C3E50" } }, // Dark Blue Header
          alignment: { horizontal: 'center', vertical: 'center' },
          border: {
            top: { style: 'thin', color: { rgb: "000000" } },
            bottom: { style: 'thin', color: { rgb: "000000" } },
            left: { style: 'thin', color: { rgb: "000000" } },
            right: { style: 'thin', color: { rgb: "000000" } }
          }
        })
      }

      // Sort orders: Time ASC, then Address/Branch Alphabetical ASC
      const sortedOrders = [...orders].sort((a, b) => {
        const timeA = a.deliveryTime || '99:99'
        const timeB = b.deliveryTime || '99:99'
        if (timeA !== timeB) return timeA.localeCompare(timeB)

        const addrA = (a.deliveryType === 'delivery' ? (a.deliveryAddress || '') : (a.branch || '')).toLowerCase()
        const addrB = (b.deliveryType === 'delivery' ? (b.deliveryAddress || '') : (b.branch || '')).toLowerCase()
        return addrA.localeCompare(addrB)
      })

      sortedOrders.forEach((order, index) => {
        const dateStr = order.deliveryDate ? formatECT(order.deliveryDate, false) : ''
        const products = order.products || []
        const itemsStr = products.map((p: any) => `${p.quantity} ${p.name}`).join(' + ')

        let address = ''
        if (order.deliveryType === 'delivery') {
          address = order.deliveryAddress || 'Domicilio'
        } else {
          address = order.branch || 'Retiro en Local'
        }

        // Payment Status Logic
        const total = order.totalValue || 0
        const payments = order.payments || []
        const totalPaid = payments.reduce((sum: number, p: any) => sum + (Number(p.monto) || 0), 0)
        const remaining = Math.max(0, total - totalPaid)

        let paymentStatusStr = ''

        if (order.isGlobalCourtesy) {
          paymentStatusStr = 'CORTESÍA'
        } else if (order.settledInIsland) {
          paymentStatusStr = 'PAGADO (ISLA)'
        } else if (remaining < 0.01) {
          paymentStatusStr = 'PAGADO'
        } else {
          paymentStatusStr = `PENDIENTE ($${remaining.toFixed(2)})`
        }

        let paymentMethodStr = order.paymentMethod
        if (!paymentMethodStr || paymentMethodStr === 'Por confirmar' || paymentMethodStr === 'Por Cobrar') {
          if (payments && payments.length > 0) {
            const methods = [...new Set(payments.map((p: any) => {
              const m = p.forma_cobro
              if (m === 'TRA') return 'Transferencia'
              if (m === 'EFE') return 'Efectivo'
              if (m === 'TC') return 'Tarjeta Crédito'
              if (m === 'TD') return 'Tarjeta Débito'
              return m
            }))]
            if (methods.length > 0) {
              paymentMethodStr = methods.join(', ')
            } else {
              paymentMethodStr = 'Por Confirmar'
            }
          } else {
            paymentMethodStr = 'Por Confirmar'
          }
        }

        const paymentColumn = `${paymentStatusStr} - ${paymentMethodStr}`

        const rowIdx = index + 2
        wsData.push([
          dateStr,
          order.customerName,
          itemsStr,
          order.deliveryTime || '',
          address,
          paymentColumn,
          order.comments || ''
        ])

        // Determine Row Style based on Destination
        let rowColor = 'FFFFFF' // Default white
        const addrLower = address.toLowerCase()
        if (addrLower.includes('mall del sol')) {
          rowColor = 'FFF9C4' // Light Yellow
        } else if (addrLower.includes('san marino')) {
          rowColor = 'E1F5FE' // Light Blue
        }

        // Apply style to all cells in the row
        for (let c = 0; c < headers.length; c++) {
          setStyle(rowIdx, c, {
            fill: { fgColor: { rgb: rowColor } },
            border: {
              top: { style: 'thin', color: { rgb: "CCCCCC" } },
              bottom: { style: 'thin', color: { rgb: "CCCCCC" } },
              left: { style: 'thin', color: { rgb: "CCCCCC" } },
              right: { style: 'thin', color: { rgb: "CCCCCC" } }
            },
            alignment: { vertical: 'center' }
          })
        }
      })

      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.aoa_to_sheet(wsData)

      // Column Widths
      ws['!cols'] = [{ wch: 15 }, { wch: 30 }, { wch: 40 }, { wch: 15 }, { wch: 30 }, { wch: 25 }, { wch: 40 }]

      // Apply styles from wsStyle to ws
      Object.keys(wsStyle).forEach(cellRef => {
        if (ws[cellRef]) {
          ws[cellRef].s = wsStyle[cellRef]
        }
      })

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
