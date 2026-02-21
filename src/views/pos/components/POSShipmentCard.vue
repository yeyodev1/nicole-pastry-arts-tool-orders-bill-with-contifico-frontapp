<script setup lang="ts">
import type { POSOrder } from '@/services/pos.service'
import { formatECT } from '@/utils/dateUtils'
import { useOrderHelpers } from '@/composables/useOrderHelpers'

const props = defineProps({
  order: { type: Object as () => POSOrder, required: true },
  selectedBranch: { type: String, required: true },
})

const emit = defineEmits<{
  (e: 'deliver', order: POSOrder): void
}>()

const { getEffectivePaymentMethod, getStatusLabel, getStatusColorClass, calculateRemainingBalance, isOrderFullyPaid } = useOrderHelpers()
</script>

<template>
  <div class="shipment-card" :class="getStatusColorClass(order)">
    <div class="card-header">
      <div class="header-left">
        <div class="order-id-track">
          <span class="id-label">ID:</span>
          <span class="id-value">{{ order._id.slice(-6).toUpperCase() }}</span>
        </div>
        <span class="order-badge">#{{ order.orderNumber }}</span>
        <div class="status-pill">
          <i v-if="order.posStatus === 'DELIVERED'" class="fa-solid fa-check-circle"></i>
          <i v-else-if="order.posStatus === 'RECEIVED'" class="fa-solid fa-store"></i>
          <i v-else-if="order.posStatus === 'IN_TRANSIT'" class="fa-solid fa-truck-fast"></i>
          <i v-else class="fa-solid fa-clock"></i>
          <span>{{ getStatusLabel(order) }}</span>
        </div>
        <div v-if="selectedBranch === 'Todas las sucursales'" class="branch-mini-pill">
          <i class="fa-solid fa-map-location-dot"></i> {{ order.branch }}
        </div>
      </div>
      <div class="header-right">
        <div class="delivery-time-badge">
          <i class="fa-regular fa-clock"></i><span>{{ order.deliveryTime }}</span>
        </div>
        <span class="date">{{ formatECT(order.deliveryDate, false) }}</span>
      </div>
    </div>

    <div class="card-body">
      <div class="customer-info">
        <div class="customer-avatar"><i class="fa-solid fa-user"></i></div>
        <div class="customer-details">
          <span class="detail-label">Cliente</span>
          <span class="detail-value">{{ order.customerName }}</span>
        </div>
      </div>

      <div class="items-preview">
        <div class="preview-header"><i class="fa-solid fa-box-open"></i> Productos ({{ order.products.length }})</div>
        <div class="products-list">
          <div v-for="p in order.products" :key="p._id" class="product-item">
            <span class="qty">{{ p.quantity }}x</span>
            <span class="name">{{ p.name }}</span>
          </div>
        </div>
      </div>

      <div class="payment-info">
        <div class="p-row">
          <div class="payment-method">
            <i class="fa-solid fa-credit-card"></i>
            <span>{{ getEffectivePaymentMethod(order) }}</span>
          </div>
          <div class="payment-status">
            <div v-if="order.settledInIsland" class="settled-badge">
              <i class="fa-solid fa-umbrella-beach"></i> Facturado en Isla
            </div>
            <div v-else-if="isOrderFullyPaid(order)" class="paid-badge">
              <i class="fa-solid fa-circle-check"></i> Pedido Pagado Completo
            </div>
            <div v-else class="balance-badge">
              <span class="balance-label">Por Cobrar:</span>
              <span class="balance-value">${{ calculateRemainingBalance(order).toFixed(2) }}</span>
            </div>
          </div>
          <span class="total-amount">${{ order.totalValue.toFixed(2) }}</span>
        </div>
      </div>
    </div>

    <div class="card-actions">
      <button v-if="order.posStatus !== 'DELIVERED'" class="action-btn btn-deliver" @click="emit('deliver', order)">
        <i class="fa-solid fa-hand-holding-heart"></i> Entregar a Cliente
      </button>
      <button v-else class="action-btn btn-delivered-static" disabled>
        <i class="fa-solid fa-check-double"></i> Entregado
      </button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.shipment-card {
  background: white;
  border-radius: 16px;
  border: 1px solid #E2E8F0;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.shipment-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 20px -5px rgba(0, 0, 0, 0.1);
}

.status-blue {
  border-left: 6px solid #3B82F6;
  background-color: #EFF6FF;
  border-color: #DBEAFE;
}

.status-yellow {
  border-left: 6px solid #F59E0B;
  background-color: #FFFBEB;
  border-color: #FEF3C7;
}

.status-green {
  border-left: 6px solid #22C55E;
  background-color: #F0FDF4;
  border-color: #DCFCE7;
}

.status-gray {
  border-left: 6px solid #94A3B8;
  background-color: #F8FAFC;
  border-color: #E2E8F0;
}

.card-header {
  padding: 1rem;
  background: rgba(255, 255, 255, 0.4);
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.5rem;
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.header-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.4rem;
}

.order-id-track {
  display: flex;
  gap: 0.3rem;
  font-size: 0.65rem;
  font-weight: 800;
  color: #94A3B8;
  letter-spacing: 0.05em;
}

.id-value {
  color: #64748B;
}

.order-badge {
  background: $NICOLE-PURPLE;
  color: white;
  padding: 0.25rem 0.6rem;
  border-radius: 6px;
  font-weight: 800;
  font-size: 0.85rem;
  width: fit-content;
}

.status-pill {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  color: #475569;
}

.branch-mini-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.7rem;
  font-weight: 800;
  color: $NICOLE-PURPLE;
  background: rgba($NICOLE-PURPLE, 0.1);
  padding: 2px 8px;
  border-radius: 4px;
  text-transform: uppercase;
}

.delivery-time-badge {
  background: #FEF3C7;
  color: #92400E;
  padding: 0.3rem 0.6rem;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  border: 1px solid #FDE68A;
}

.date {
  font-size: 0.8rem;
  font-weight: 600;
  color: #64748B;
}

.card-body {
  padding: 1.25rem;
  flex: 1;
}

.customer-info {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.customer-avatar {
  width: 40px;
  height: 40px;
  background: #F1F5F9;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748B;
  font-size: 1.1rem;
}

.customer-details {
  display: flex;
  flex-direction: column;
}

.detail-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: #94A3B8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.detail-value {
  font-size: 1rem;
  font-weight: 800;
  color: #1E293B;
}

.items-preview {
  background: rgba(255, 255, 255, 0.6);
  border-radius: 12px;
  padding: 1rem;
  border: 1px solid rgba(0, 0, 0, 0.05);
  margin-bottom: 1.25rem;
}

.preview-header {
  font-size: 0.75rem;
  font-weight: 800;
  color: #64748B;
  text-transform: uppercase;
  margin-bottom: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.products-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.product-item {
  display: flex;
  gap: 0.75rem;
  font-size: 0.9rem;
  color: #334155;
  line-height: 1.4;
}

.qty {
  font-weight: 800;
  color: $NICOLE-PURPLE;
  min-width: 2.5ch;
}

.name {
  font-weight: 600;
}

.payment-info {
  padding-top: 1rem;
  border-top: 1px solid #F1F5F9;
}

.p-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.payment-method {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: #64748B;
}

.payment-status {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.paid-badge,
.settled-badge {
  padding: 0.25rem 0.6rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  text-transform: uppercase;
}

.paid-badge {
  background: #DCFCE7;
  color: #166534;
}

.settled-badge {
  background: #F3E8FF;
  color: #6B21A8;
}

.balance-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1;
}

.balance-label {
  font-size: 0.65rem;
  font-weight: 800;
  color: #94A3B8;
  text-transform: uppercase;
}

.balance-value {
  font-size: 1rem;
  font-weight: 900;
  color: #E11D48;
}

.total-amount {
  font-size: 1.1rem;
  font-weight: 900;
  color: $NICOLE-SECONDARY;
}

.card-actions {
  padding: 1rem;
  background: #FCFCFD;
  border-top: 1px solid #F1F5F9;
}

.action-btn {
  width: 100%;
  padding: 0.85rem;
  border-radius: 12px;
  font-weight: 800;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.95rem;
  transition: all 0.2s;
  cursor: pointer;
}

.btn-deliver {
  background: #22C55E;
  color: white;
  border: none;
}

.btn-deliver:hover {
  background: #16A34A;
  box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
}

.btn-delivered-static {
  background: #F0FDF4;
  color: #16A34A;
  border: 1px solid #DCFCE7;
  cursor: default;
}
</style>
