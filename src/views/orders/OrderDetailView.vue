<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import OrderService from '@/services/order.service'

import InvoiceEditModal from './components/InvoiceEditModal.vue'

const route = useRoute()
const order = ref<any>(null)
const isLoading = ref(false)
const showInvoiceModal = ref(false)

const fetchOrder = async () => {
  const id = route.params.id as string
  if (!id) return

  isLoading.value = true
  try {
    const data = await OrderService.getOrder(id)
    order.value = data
  } catch (error) {
    console.error('Error fetching order:', error)
  } finally {
    isLoading.value = false
  }
}

const handleOrderUpdated = (updatedOrder: any) => {
  order.value = updatedOrder
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' })
}

onMounted(() => {
  fetchOrder()
})
</script>

<template>
  <div class="order-detail-page">
    <header class="app-header">
       <div class="container">
         <div class="header-left">
           <router-link to="/orders" class="back-link">← Volver</router-link>
           <h1>Detalle del Pedido</h1>
         </div>
       </div>
    </header>

    <main class="container" v-if="order">
      <div class="header-info">
        <div class="info-group">
          <span class="label">Pedido #</span>
          <span class="value">{{ order._id.substr(-6).toUpperCase() }}</span>
        </div>
        <div class="info-group">
           <span class="label">Estado Factura</span>
           <span class="badge" :class="order.invoiceStatus || 'NONE'">{{ order.invoiceStatus || 'No Requiere' }}</span>
        </div>
        <div class="info-group">
           <span class="label">Fecha Entrega</span>
           <span class="value">{{ formatDate(order.deliveryDate) }}</span>
        </div>
        <div class="info-group">
           <span class="label">Responsable</span>
           <span class="value">{{ order.responsible }}</span>
        </div>
      </div>

      <div class="content-grid">
        <!-- Products -->
        <section class="card products-card">
          <h2>Productos</h2>
          <div class="table-wrapper">
             <table>
               <thead>
                 <tr>
                   <th>Producto</th>
                   <th class="text-right">Precio Unit.</th>
                   <th class="text-center">Cant.</th>
                   <th class="text-right">Total</th>
                 </tr>
               </thead>
               <tbody>
                 <tr v-for="(item, idx) in order.products" :key="idx">
                   <td>{{ item.name }}</td>
                   <td class="text-right">${{ item.price.toFixed(2) }}</td>
                   <td class="text-center">{{ item.quantity }}</td>
                   <td class="text-right font-bold">${{ (item.price * item.quantity).toFixed(2) }}</td>
                 </tr>
               </tbody>
               <tfoot>
                 <tr>
                   <td colspan="3" class="text-right label-total">Total:</td>
                   <td class="text-right value-total">${{ order.totalValue.toFixed(2) }}</td>
                 </tr>
               </tfoot>
             </table>
          </div>
        </section>

        <!-- Details -->
        <section class="side-info">
           <div class="card client-card">
              <h2>Cliente</h2>
              <div class="field">
                <label>Nombre</label>
                <p>{{ order.customerName }}</p>
              </div>
              <div class="field">
                <label>Teléfono</label>
                <p>{{ order.customerPhone }}</p>
              </div>
              <div class="field">
                <label>Entrega</label>
                <p class="capitalize">{{ order.deliveryType }}</p>
              </div>
              <div class="field" v-if="order.comments">
                <label>Notas Especiales</label>
                <p class="comments">{{ order.comments }}</p>
              </div>
           </div>

           <div class="card invoice-card">
              <div class="card-header-row">
                <h2>Datos Facturación</h2>
                <button v-if="order.invoiceStatus !== 'PROCESSED'" @click="showInvoiceModal = true" class="btn-xs">Editar</button>
              </div>
              
              <div v-if="order.invoiceNeeded">
                  <div class="field">
                    <label>Razón Social</label>
                    <p>{{ order.invoiceData.businessName }}</p>
                  </div>
                  <div class="field">
                    <label>RUC/CI</label>
                    <p>{{ order.invoiceData.ruc }}</p>
                  </div>
                  <div class="field">
                    <label>Email</label>
                    <p>{{ order.invoiceData.email }}</p>
                  </div>
                  <div class="field">
                    <label>Dirección</label>
                    <p>{{ order.invoiceData.address }}</p>
                  </div>
              </div>
              <div v-else class="empty-invoice">
                  <p>No requiere factura.</p>
              </div>
           </div>
        </section>
      </div>
    <InvoiceEditModal
      :is-open="showInvoiceModal"
      :order-id="order._id"
      :invoice-needed="order.invoiceNeeded"
      :current-invoice-data="order.invoiceData"
      @close="showInvoiceModal = false"
      @saved="handleOrderUpdated"
    />
    </main>

    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.app-header {
  background-color: white;
  border-bottom: 1px solid $border-light;
  padding: 1rem 0;
  margin-bottom: 2rem;

  .container {
    display: flex;
    align-items: center;
  }
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1rem;

  h1 {
    margin: 0;
    font-family: $font-principal;
    color: $NICOLE-PURPLE;
    font-size: 1.5rem;
  }

  .back-link {
    text-decoration: none;
    color: $text-light;
    font-weight: 500;

    &:hover {
      color: $NICOLE-PURPLE;
    }
  }
}

.header-info {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  margin-bottom: 2rem;
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  border: 1px solid $border-light;

  .info-group {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;

    .label {
      font-size: 0.85rem;
      color: $text-light;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .value {
      font-weight: 600;
      font-size: 1.1rem;
      color: $text-dark;
    }
  }
}

.content-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 2rem;
  padding-bottom: 4rem;
}

.card {
  background: white;
  border-radius: 12px;
  border: 1px solid $border-light;
  padding: 1.5rem;

  h2 {
    margin: 0 0 1.5rem 0;
    font-size: 1.2rem;
    color: $NICOLE-SECONDARY;
    border-bottom: 1px solid $border-light;
    padding-bottom: 0.75rem;
  }
}

.side-info {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.field {
  margin-bottom: 1rem;

  label {
    display: block;
    font-size: 0.85rem;
    color: $text-light;
    font-weight: 500;
    margin-bottom: 0.2rem;
  }

  p {
    margin: 0;
    font-weight: 500;
    color: $text-dark;
  }

  .comments {
    background: $gray-50;
    padding: 0.75rem;
    border-radius: 6px;
    font-size: 0.9rem;
    font-style: italic;
  }
}

.table-wrapper {
  table {
    width: 100%;
    border-collapse: collapse;

    th {
      text-align: left;
      padding: 0.75rem;
      background: $gray-50;
      color: $text-light;
      font-weight: 600;
      font-size: 0.9rem;
    }

    td {
      padding: 1rem 0.75rem;
      border-bottom: 1px solid $border-light;
    }

    tfoot {
      td {
        border-top: 2px solid $border-light;
        padding-top: 1rem;
      }

      .label-total {
        font-weight: 600;
        font-size: 1.1rem;
      }

      .value-total {
        font-weight: 700;
        font-size: 1.2rem;
        color: $NICOLE-SECONDARY;
      }
    }
  }
}

.text-right {
  text-align: right;
}

.text-center {
  text-align: center;
}

.font-bold {
  font-weight: 600;
}

.capitalize {
  text-transform: capitalize;
}

.badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: 600;

  &.PENDING {
    background: rgba($warning, 0.15);
    color: darken($warning, 10%);
  }

  &.PROCESSED {
    background: rgba($success, 0.15);
    color: darken($success, 10%);
  }

  &.ERROR {
    background: rgba($error, 0.15);
    color: darken($error, 10%);
  }

  &.NONE {
    background: $gray-100;
    color: $text-light;
  }
}

.loading-state {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: white;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 50;

  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid rgba($NICOLE-PURPLE, 0.2);
    border-top-color: $NICOLE-PURPLE;
    border-radius: 50%;
    animation: spin 1s infinite linear;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 900px) {
  .content-grid {
    grid-template-columns: 1fr;
  }

  .header-info {
    grid-template-columns: 1fr 1fr;
  }
}

.card-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid $border-light;
  margin-bottom: 1.5rem;
  padding-bottom: 0.75rem;

  h2 {
    border-bottom: none;
    margin: 0;
    padding: 0;
  }
}

.btn-xs {
  background: white;
  border: 1px solid $border-light;
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  font-size: 0.8rem;
  cursor: pointer;
  color: $NICOLE-PURPLE;
  font-weight: 500;

  &:hover {
    background: $gray-50;
    border-color: $NICOLE-PURPLE;
  }
}

.empty-invoice {
  color: $text-light;
  font-size: 0.9rem;
  font-style: italic;
}
</style>
