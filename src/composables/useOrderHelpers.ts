import type { POSOrder } from '@/services/pos.service'

export function useOrderHelpers() {
  const getEffectivePaymentMethod = (order: POSOrder): string => {
    if (order.paymentMethod && order.paymentMethod !== 'Por confirmar' && order.paymentMethod !== 'Por Cobrar') {
      return order.paymentMethod
    }
    if (order.payments?.length) {
      const methods = [...new Set(order.payments.map(p => {
        const m = p.forma_cobro
        if (m === 'TRA') return 'Transferencia'
        if (m === 'EFE') return 'Efectivo'
        if (m === 'TC') return 'Tarjeta Crédito'
        if (m === 'TD') return 'Tarjeta Débito'
        return m
      }))]
      return methods.join(', ')
    }
    return order.paymentMethod || 'Por confirmar'
  }

  const getStatusLabel = (order: POSOrder): string => {
    if (order.posStatus === 'DELIVERED') return 'Entregado'
    if (order.posStatus === 'RECEIVED') return 'Recibido en Sucursal'
    if (order.posStatus === 'IN_TRANSIT') return 'En Tránsito'
    return 'Esperando Producción'
  }

  const getStatusColorClass = (order: POSOrder): string => {
    const map: Record<string, string> = {
      RECEIVED: 'status-blue',
      IN_TRANSIT: 'status-yellow',
      DELIVERED: 'status-green',
    }
    return map[order.posStatus] ?? 'status-gray'
  }

  const calculateTotalPaid = (order: POSOrder): number =>
    (order.payments || []).reduce((sum, p) => sum + Number(p.monto), 0)

  const calculateRemainingBalance = (order: POSOrder): number => {
    if (order.isGlobalCourtesy) return 0
    return Math.max(0, (order.totalValue || 0) - calculateTotalPaid(order))
  }

  const isOrderFullyPaid = (order: POSOrder): boolean => {
    if (order.isGlobalCourtesy || order.settledInIsland) return true
    if (order.isCredit) return false
    return calculateRemainingBalance(order) < 0.01
  }

  return {
    getEffectivePaymentMethod,
    getStatusLabel,
    getStatusColorClass,
    calculateRemainingBalance,
    isOrderFullyPaid,
  }
}
