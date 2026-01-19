<script setup lang="ts">
import { ref, onMounted } from 'vue'
import OrderService from '@/services/order.service'

const orders = ref<any[]>([])
const isLoading = ref(false)

const fetchOrders = async () => {
  isLoading.value = true
  try {
    const data = await OrderService.getOrders()
    orders.value = data
  } catch (error) {
    console.error('Error fetching orders:', error)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchOrders()
})

</script>

<template>
  <div class="orders-list-page">
    <header class="app-header">
       <div class="container">
         <h1>Lista de Pedidos</h1>
         <router-link to="/orders/new" class="btn-primary">Nuevo Pedido</router-link>
       </div>
    </header>

    <main class="container">
      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <span>Cargando pedidos...</span>
      </div>

      <div v-else class="table-container">
        <table>
          <thead>
            <tr>
              <th>Fecha Entrega</th>
              <th>Cliente</th>
              <th>Tipo</th>
              <th>Responsable</th>
              <th>Total</th>
              <th>Facturación</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="order in orders" :key="order._id">
               <td>{{ new Date(order.deliveryDate).toLocaleDateString() }} {{ new Date(order.deliveryDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}</td>
               <td>
                 <div class="client-column">
                   <span class="name">{{ order.customerName }}</span>
                   <span class="phone">{{ order.customerPhone }}</span>
                 </div>
               </td>
               <td>
                 <span class="badge" :class="order.deliveryType">
                    {{ order.deliveryType === 'delivery' ? 'Delivery' : 'Retiro' }}
                 </span>
               </td>
               <td>{{ order.responsible }}</td>
               <td class="total">${{ order.totalValue.toFixed(2) }}</td>
               <td>
                  <span v-if="order.invoiceNeeded" class="status-badge" :class="order.invoiceStatus">
                    {{ order.invoiceStatus }}
                  </span>
                  <span v-else class="status-text">-</span>
               </td>
            </tr>
            <tr v-if="orders.length === 0">
              <td colspan="6" class="empty-cell">No hay pedidos registrados</td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>
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
    justify-content: space-between;
    align-items: center;
  }

  h1 {
    margin: 0;
    font-family: $font-principal;
    color: $NICOLE-PURPLE;
  }
}

.table-container {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  border: 1px solid $border-light;
  overflow-x: auto;

  table {
    width: 100%;
    border-collapse: collapse;

    thead {
      background: $gray-50;

      th {
        padding: 1rem;
        text-align: left;
        font-family: $font-secondary;
        font-weight: 600;
        color: $text-light;
        font-size: 0.9rem;
        border-bottom: 1px solid $border-light;
      }
    }

    tbody {
      tr {
        border-bottom: 1px solid $border-light;

        &:last-child {
          border-bottom: none;
        }

        &:hover {
          background-color: $gray-50;
        }
      }

      td {
        padding: 1rem;
        font-size: 0.9rem;
        color: $text-dark;
      }
    }
  }
}

.client-column {
  display: flex;
  flex-direction: column;

  .name {
    font-weight: 500;
  }

  .phone {
    font-size: 0.8rem;
    color: $text-light;
  }
}

.badge {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 500;
  text-transform: capitalize;

  &.delivery {
    background-color: rgba($NICOLE-PURPLE, 0.1);
    color: $NICOLE-PURPLE;
  }

  &.retiro {
    background-color: $gray-200;
    color: $text-dark;
  }
}

.status-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;

  &.PENDING {
    background-color: rgba($warning, 0.1);
    color: $warning;
  }

  &.PROCESSED {
    background-color: rgba($success, 0.1);
    color: $success;
  }

  &.ERROR {
    background-color: rgba($error, 0.1);
    color: $error;
  }
}

.status-text {
  color: $gray-400;
}

.total {
  font-weight: 600;
  color: $NICOLE-SECONDARY;
}

.btn-primary {
  background-color: $NICOLE-PURPLE;
  color: white;
  padding: 0.6rem 1.2rem;
  border-radius: 8px;
  text-decoration: none;
  font-weight: 600;
  font-size: 0.9rem;

  &:hover {
    background-color: $purple-hover;
  }
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem;
  gap: 1rem;
  color: $text-light;

  .spinner {
    width: 30px;
    height: 30px;
    border: 3px solid rgba($NICOLE-PURPLE, 0.3);
    border-radius: 50%;
    border-top-color: $NICOLE-PURPLE;
    animation: spin 1s ease-in-out infinite;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.empty-cell {
  text-align: center;
  color: $text-light;
  padding: 2rem !important;
}

.container {
  width: 100%;
  max-width: 100%;
  padding: 0 2rem;
}
</style>
