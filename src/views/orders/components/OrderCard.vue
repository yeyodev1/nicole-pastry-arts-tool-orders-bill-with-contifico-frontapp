<script setup lang="ts">


import { parseECTDate } from '@/utils/dateUtils'

const props = defineProps<{
  order: any
  isSelected: boolean
  batchMode: boolean
}>()

const emit = defineEmits<{
  (e: 'click'): void
  (e: 'toggle-select'): void
  (e: 'copy-summary'): void
  (e: 'payment'): void
  (e: 'invoice-edit'): void
  (e: 'retry-invoice'): void
  (e: 'settle'): void
  (e: 'edit'): void
  (e: 'delete'): void
  (e: 'return'): void
}>()

// Helper Logic moved from ListView
const formatOrderTime = (order: any) => {
  if (order.deliveryTime && order.deliveryTime.includes(':')) {
    return order.deliveryTime
  }
  if (!order.deliveryDate) return '--:--'

  const date = parseECTDate(order.deliveryDate)
  const isMidnight = date.getHours() === 0 && date.getMinutes() === 0

  if (isMidnight) return '--:--'

  const timeOpts: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }
  return new Intl.DateTimeFormat('es-EC', timeOpts).format(date).toUpperCase()
}

const getPaymentStatus = (order: any) => {
  if (order.settledInIsland) return 'settled'
  const totalPaid = (order.payments || []).reduce((sum: number, p: any) => sum + (p.monto || 0), 0)
  const totalValue = order.totalValue || 0
  if (totalPaid >= totalValue - 0.05) return 'paid'
  if (totalPaid > 0) return 'partial'
  return 'pending'
}

// Handler wrappers to stop propagation where needed
const handleRetry = () => emit('retry-invoice')
</script>

<template>
  <article
    class="order-card"
    :class="{
      'selecting': isSelected,
      'invoice-processed': order.invoiceStatus === 'PROCESSED',
      'invoice-error': order.invoiceStatus === 'ERROR'
    }"
    @click="emit('click')"
  >

    <!-- Invoice Error Banner -->
    <div v-if="order.invoiceStatus === 'ERROR'" class="error-banner">
      <i class="fas fa-exclamation-triangle"></i>
      <span>Error de Facturación — Requiere atención</span>
    </div>

    <!-- Batch Checkbox -->
    <div v-if="batchMode" class="batch-checkbox">
       <input 
         type="checkbox" 
         :checked="isSelected"
         @click.stop="emit('toggle-select')"
       >
    </div>

    <!-- Header -->
    <div class="card-header">
       <div class="date-badge">
         <i class="far fa-clock"></i>
         <span class="date-label">Entrega:</span>
         {{ formatOrderTime(order) }}
       </div>
       <span class="type-badge" :class="order.deliveryType">
          {{ order.deliveryType === 'delivery' ? 'Delivery' : 'Retiro' }}
       </span>
    </div>

    <!-- Client Info -->
    <div class="client-section">
       <h3 class="client-name" :title="order.customerName">{{ order.customerName }}</h3>
       <p class="client-detail">
          <i class="fas fa-user-circle"></i> {{ order.responsible }}
       </p>
       
       <div v-if="order.comments" class="order-comments" :title="order.comments">
          <i class="far fa-comment-dots"></i>
          <span>{{ order.comments }}</span>
       </div>
    </div>

    <!-- Financials -->
    <div class="financial-row">
       <div class="amount-group">
          <span class="label">Total</span>
          <span class="amount">${{ order.totalValue.toFixed(2) }}</span>
       </div>
       <div class="status-group">
          <!-- Settlement / Payment Badge -->
          <div v-if="order.settledInIsland" class="settled-badge" :title="'Facturado en ' + order.settledIslandName">
             <i class="fas fa-store"></i>
             <span>{{ order.settledIslandName }}</span>
          </div>

          <!-- Invoice Processed Badge (Explicit) -->
          <div v-else-if="order.invoiceStatus === 'PROCESSED'" class="invoice-badge" title="Factura Generada y Enviada">
             <i class="fas fa-file-invoice-dollar"></i>
             <span>Facturado</span>
          </div>

          <!-- Payment Icon if not settled (or keep logic separate?) -->
          <!-- The previous logic showed Payment Status IF NOT Settled. 
               Now we might have Invoice Processed AND Payment Status (e.g. Paid).
               User wants clear indication of invoice. Let's show BOTH if possible, 
               or Stack them. Flex-col or simple stacking in status-group. -->
          
          <div class="payment-status" :class="getPaymentStatus(order)" title="Estado Pago">
             <i :class="{
              'fas fa-check-circle': getPaymentStatus(order) === 'paid',
              'fas fa-adjust': getPaymentStatus(order) === 'partial',
              'far fa-circle': getPaymentStatus(order) === 'pending'
            }"></i>
             <span v-if="!order.invoiceStatus || order.invoiceStatus !== 'PROCESSED'"> 
                <!-- Hide text if Facturado to save space? Or keep? User wants CLARITY. Keep. -->
                {{
                  getPaymentStatus(order) === 'paid' ? 'Pagado' :
                    getPaymentStatus(order) === 'partial' ? 'Parcial' : 'Pendiente'
                }}
             </span>
             <span v-else>{{ getPaymentStatus(order) === 'paid' ? 'Pagado' : 'Pendiente' }}</span>
          </div>
       </div>
    </div>


    <!-- Actions Footer -->
    <div class="card-actions" @click.stop>

      <!-- Retry Invoice: primary CTA when in ERROR state -->
      <button
        v-if="order.invoiceStatus === 'ERROR'"
        class="btn-retry-primary"
        @click="handleRetry"
      >
        <i class="fa-solid fa-rotate-right"></i>
        Reintentar Factura
      </button>

      <!-- WhatsApp copy: shown when NOT in error -->
      <button v-else class="btn-whatsapp-copy" @click="emit('copy-summary')">
        <i class="fa-brands fa-whatsapp"></i> Copiar Pedido
      </button>

      <div class="icon-actions">
        <!-- Cobro -->
        <div class="icon-btn-wrap">
          <button
            class="btn-icon"
            @click="emit('payment')"
            :class="{
              'is-paid': getPaymentStatus(order) === 'paid',
              'is-partial': getPaymentStatus(order) === 'partial'
            }"
          >
            <i class="fa-solid fa-dollar-sign"></i>
          </button>
          <span class="icon-label">Cobro</span>
        </div>

        <!-- Datos de factura (solo si no está pagado/procesado) -->
        <div
          v-if="order.invoiceStatus !== 'PROCESSED' && getPaymentStatus(order) !== 'paid' && getPaymentStatus(order) !== 'settled'"
          class="icon-btn-wrap"
        >
          <button class="btn-icon" @click="emit('invoice-edit')">
            <i class="fa-solid fa-file-invoice"></i>
          </button>
          <span class="icon-label">Factura</span>
        </div>

        <!-- Isla (solo si no está facturado en isla) -->
        <div v-if="!order.settledInIsland" class="icon-btn-wrap">
          <button class="btn-icon btn-settle" @click="emit('settle')">
            <i class="fa-solid fa-store"></i>
          </button>
          <span class="icon-label">Isla</span>
        </div>

        <!-- Editar -->
        <div class="icon-btn-wrap">
          <button class="btn-icon btn-edit" @click="emit('edit')">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <span class="icon-label">Editar</span>
        </div>

        <!-- Devolver (solo si fue despachado) -->
        <div
          v-if="['SENT', 'PARTIAL', 'PROBLEM'].includes(order.dispatchStatus || '')"
          class="icon-btn-wrap"
        >
          <button class="btn-icon btn-return" @click="emit('return')">
            <i class="fa-solid fa-reply"></i>
          </button>
          <span class="icon-label">Devolver</span>
        </div>

        <!-- Eliminar -->
        <div class="icon-btn-wrap">
          <button class="btn-icon btn-delete" @click="emit('delete')">
            <i class="fa-solid fa-trash-can"></i>
          </button>
          <span class="icon-label">Eliminar</span>
        </div>
      </div>
    </div>
  </article>
</template>

<style lang="scss" scoped>
/* Copied and adapted from OrderListView */
.order-card {
  background: white;
  border-radius: 14px;
  border: 1px solid #e2e8f0;
  padding: 1.35rem 1.4rem;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  transition: box-shadow 0.2s ease, transform 0.2s ease;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  position: relative;
  gap: 1.1rem;
  overflow: hidden;


  /* Styles for processed invoice */
  &.invoice-processed {
    background: #f0fdf4;
    border-left: 4px solid #22c55e;
  }

  /* Styles for invoice error */
  &.invoice-error {
    border-left: 4px solid #ef4444;
  }

  &.selecting {
    border-color: #8b5cf6;
    background: #fdf4ff;
  }


  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .date-badge {
      font-size: 0.85rem;
      color: #64748b;
      display: flex;
      align-items: center;
      gap: 0.4rem;

      .date-label {
        font-size: 0.7rem;
        font-weight: 700;
        text-transform: uppercase;
        color: #94a3b8;
        letter-spacing: 0.4px;
      }
    }

    .type-badge {
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      padding: 4px 8px;
      border-radius: 6px;

      &.delivery {
        background: #fee2e2;
        color: #b91c1c;
      }

      &.retiro {
        background: #e0f2fe;
        color: #0369a1;
      }
    }
  }

  /* Invoice Processed Badge Logic can be added here if needed, 
     but the border-left and bg is usually enough visual cue. */


  .client-section {
    min-width: 0;

    .client-name {
      font-size: 1.1rem;
      font-weight: 700;
      color: #1e293b;
      margin: 0 0 0.25rem 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: block;
      max-width: 100%;
    }

    .client-detail {
      font-size: 0.85rem;
      color: #64748b;
      margin: 0 0 0.5rem 0;
    }

    .order-comments {
      font-size: 0.8rem;
      color: #64748b;
      background: #f8fafc;
      padding: 0.4rem 0.6rem;
      border-radius: 6px;
      display: -webkit-box;
      line-clamp: 2;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-top: 0.5rem;
      border: 1px solid #e2e8f0;

      i {
        color: #8b5cf6;
        margin-right: 0.3rem;
      }
    }
  }

  .financial-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    padding-top: 0.5rem;
    border-top: 1px dashed #f1f5f9;

    .amount-group {
      display: flex;
      flex-direction: column;

      .label {
        font-size: 0.7rem;
        text-transform: uppercase;
        color: #94a3b8;
        font-weight: 700;
      }

      .amount {
        font-size: 1.2rem;
        font-weight: 800;
        color: #8b5cf6;
        font-family: inherit; // Or specific font
      }
    }

    .status-group {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0.25rem;
    }

    .invoice-badge {
      font-size: 0.75rem;
      font-weight: 700;
      color: #15803d; // Green-700
      background: #dcfce7; // Green-100
      border: 1px solid #86efac; // Green-300
      padding: 2px 8px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      gap: 0.3rem;
      cursor: help;
    }

    .payment-status {

      font-size: 0.8rem;
      font-weight: 600;
      color: #ef4444; // error
      display: flex;
      align-items: center;
      gap: 0.3rem;

      &.paid {
        color: #22c55e;
      }

      &.partial {
        color: #f59e0b;
      }
    }

    .settled-badge {
      font-size: 0.75rem;
      font-weight: 700;
      color: #8b5cf6;
      background: rgba(139, 92, 246, 0.08);
      padding: 4px 10px;
      border-radius: 20px;
      display: flex;
      align-items: center;
      gap: 0.4rem;
      border: 1px solid rgba(139, 92, 246, 0.15);

      i {
        font-size: 0.8rem;
      }
    }
  }

  .card-actions {
    margin-top: auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
    padding-top: 1rem;
    border-top: 1px solid #f8fafc;

    @media (max-width: 480px) {
      flex-direction: column;
      align-items: stretch;
    }

    .btn-whatsapp-copy {
      flex: 1;
      background: #25D366;
      color: white;
      border: none;
      padding: 0.6rem 1rem;
      border-radius: 8px;
      font-weight: 700;
      font-size: 0.9rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      cursor: pointer;
      transition: all 0.2s;
      box-shadow: 0 2px 4px rgba(37, 211, 102, 0.2);

      &:hover {
        background: #128c7e;
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(37, 211, 102, 0.3);
      }
    }

    .btn-retry-primary {
      flex: 1;
      background: #ef4444;
      color: white;
      border: none;
      padding: 0.6rem 1rem;
      border-radius: 8px;
      font-weight: 700;
      font-size: 0.9rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      cursor: pointer;
      transition: all 0.2s;
      box-shadow: 0 2px 4px rgba(239, 68, 68, 0.25);
      animation: pulse-red 2s infinite;

      &:hover {
        background: #dc2626;
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(239, 68, 68, 0.35);
      }
    }

    .icon-actions {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
      justify-content: flex-end;
      align-items: flex-end;

      @media (max-width: 480px) {
        justify-content: center;
        margin-top: 0.5rem;
      }
    }

    .icon-btn-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.2rem;

      .icon-label {
        font-size: 0.6rem;
        font-weight: 600;
        color: #94a3b8;
        text-transform: uppercase;
        letter-spacing: 0.3px;
        white-space: nowrap;
      }
    }

    .btn-icon {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid #e2e8f0;
      background: white;
      color: #64748b;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 1rem;

      &:hover {
        border-color: #8b5cf6;
        color: #8b5cf6;
        background: #f8fafc;
      }

      &.is-paid {
        color: #22c55e;
        border-color: #22c55e;
        background: #f0fdf4;
      }

      &.is-partial {
        color: #f59e0b;
        border-color: #f59e0b;
        background: #fffbeb;
      }

      &.btn-delete:hover {
        color: #ef4444;
        border-color: #ef4444;
        background: #fef2f2;
      }

      &.btn-return {
        color: #f97316;
        border-color: #fed7aa;
        background: #fff7ed;

        &:hover {
          background: #f97316;
          color: white;
          border-color: #f97316;
        }
      }

      &.btn-settle:hover {
        color: #8b5cf6;
        border-color: #8b5cf6;
        background: #fdf4ff;
      }
    }
  }
}

.error-banner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #fef2f2;
  color: #dc2626;
  font-size: 0.8rem;
  font-weight: 700;
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  border: 1px solid #fecaca;
  margin: -0.25rem 0;

  i {
    font-size: 0.85rem;
    flex-shrink: 0;
  }
}

@keyframes pulse-red {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.3); }
  50% { box-shadow: 0 0 0 4px rgba(239, 68, 68, 0); }
}

.batch-checkbox {
  position: absolute;
  top: 1rem;
  right: 1rem;
  z-index: 10;

  input {
    width: 22px;
    height: 22px;
    cursor: pointer;
    accent-color: #8b5cf6;
  }
}
</style>
