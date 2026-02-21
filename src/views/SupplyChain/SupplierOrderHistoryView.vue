<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import SupplierOrderService from '@/services/supplier-order.service'
import { useToast } from '@/composables/useToast'
import ConfirmationModal from '@/components/ConfirmationModal.vue'
import SupplierOrderModal from '@/components/SupplyChain/SupplierOrderModal.vue'

const { success, error: showError } = useToast()

const orders = ref<any[]>([])
const isLoading = ref(false)
const currentPage = ref(1)
const totalPages = ref(1)

// Modal states
const showEditModal = ref(false)
const selectedOrder = ref<any>(null)
const showDeleteModal = ref(false)
const orderToDelete = ref<string | null>(null)

const fetchOrders = async () => {
  isLoading.value = true
  try {
    const data = await SupplierOrderService.getOrders({ page: currentPage.value })
    orders.value = data.orders
    totalPages.value = data.pages
  } catch (err) {
    showError('Error al cargar historial de pedidos.')
  } finally {
    isLoading.value = false
  }
}

const getStatusBadgeClass = (status: string) => {
  switch (status) {
    case 'PENDING': return 'status-pending'
    case 'SENT': return 'status-sent'
    case 'RECEIVED': return 'status-received'
    case 'CANCELLED': return 'status-cancelled'
    default: return ''
  }
}

const translateStatus = (status: string) => {
  switch (status) {
    case 'PENDING': return 'PENDIENTE'
    case 'SENT': return 'ENVIADO'
    case 'RECEIVED': return 'RECIBIDO'
    case 'CANCELLED': return 'CANCELADO'
    default: return status
  }
}

const formatDate = (date: string) => {
  return new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium' }).format(new Date(date))
}

const handleEdit = (order: any) => {
  selectedOrder.value = order
  showEditModal.value = true
}

const confirmDelete = (id: string) => {
  orderToDelete.value = id
  showDeleteModal.value = true
}

const handleDelete = async () => {
  if (!orderToDelete.value) return
  try {
    await SupplierOrderService.deleteOrder(orderToDelete.value)
    success('Pedido eliminado correctamente.')
    fetchOrders()
  } catch (err) {
    showError('No se pudo eliminar el pedido.')
  } finally {
    showDeleteModal.value = false
    orderToDelete.value = null
  }
}

const onOrderSaved = () => {
  fetchOrders()
}

onMounted(() => {
  fetchOrders()
})
</script>

<template>
  <div class="supplier-orders-history">
    <div class="header">
      <div class="title">
        <h1>Historial de Pedidos</h1>
        <p>Gestión de compras a proveedores</p>
      </div>
    </div>

    <div class="content-area">
      <div v-if="isLoading" class="loading-container">
        <div class="spinner"></div>
        <p>Cargando pedidos...</p>
      </div>

      <div v-else class="table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th>Fecha Creación</th>
              <th>Proveedor</th>
              <th>Insumos</th>
              <th>Entrega Requerida</th>
              <th>Estado</th>
              <th class="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="orders.length === 0">
              <td colspan="6" class="text-center">No hay pedidos registrados.</td>
            </tr>
            <tr v-for="order in orders" :key="order._id">
              <td>{{ formatDate(order.createdAt) }}</td>
              <td class="fw-700">{{ order.provider?.name }}</td>
              <td>
                <div class="items-summary">
                  {{ order.items.length }} ítem(s)
                  <span class="items-preview">({{order.items.map((i: any) => i.name).join(', ').substring(0, 30)}}...)</span>
                </div>
              </td>
              <td class="fw-600">{{ formatDate(order.deliveryDate) }}</td>
              <td>
                <span class="status-badge" :class="getStatusBadgeClass(order.status)">
                  {{ translateStatus(order.status) }}
                </span>
              </td>
              <td class="text-right">
                <div class="actions-group">
                  <button class="btn-icon" @click="handleEdit(order)" title="Editar">
                    <i class="fas fa-edit"></i>
                  </button>
                  <button class="btn-icon btn-delete" @click="confirmDelete(order._id)" title="Eliminar">
                    <i class="fas fa-trash"></i>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Pagination -->
        <div class="pagination" v-if="totalPages > 1">
          <button :disabled="currentPage === 1" @click="currentPage--; fetchOrders()">Anterior</button>
          <span>Página {{ currentPage }} de {{ totalPages }}</span>
          <button :disabled="currentPage === totalPages" @click="currentPage++; fetchOrders()">Siguiente</button>
        </div>
      </div>
    </div>

    <!-- Modals -->
    <SupplierOrderModal
      :is-open="showEditModal"
      :order-id="selectedOrder?._id"
      :provider="selectedOrder?.provider"
      :all-materials="[]"
      @close="showEditModal = false"
      @saved="onOrderSaved"
    />

    <ConfirmationModal
      :is-open="showDeleteModal"
      title="Eliminar Pedido"
      message="¿Estás seguro de que deseas eliminar este pedido? Esta acción no se puede deshacer."
      confirm-text="Eliminar"
      @confirm="handleDelete"
      @close="showDeleteModal = false"
    />
  </div>
</template>

<style lang="scss" scoped>
.supplier-orders-history {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.header {
  margin-bottom: 2rem;

  h1 {
    font-size: 2rem;
    font-weight: 800;
    color: #1e293b;
    margin: 0;
  }

  p {
    color: #64748b;
    margin: 0.25rem 0 0;
  }
}

.content-area {
  background: white;
  border-radius: 20px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

.table-responsive {
  width: 100%;
  overflow-x: auto;
}

.table {
  width: 100%;
  border-collapse: collapse;

  th {
    text-align: left;
    padding: 1rem 1.5rem;
    background: #f8fafc;
    color: #64748b;
    font-size: 0.75rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 1px solid #f1f5f9;
  }

  td {
    padding: 1rem 1.5rem;
    border-bottom: 1px solid #f1f5f9;
    color: #334155;
    font-size: 0.95rem;
  }

  tr:hover {
    background: #fdf2ff; // Very light purple
  }
}

.fw-700 {
  font-weight: 700;
}

.fw-600 {
  font-weight: 600;
}

.items-summary {
  .items-preview {
    font-size: 0.8rem;
    color: #94a3b8;
    margin-left: 0.5rem;
  }
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;

  &.status-pending {
    background: #fef9c3;
    color: #854d0e;
  }

  &.status-sent {
    background: #dcfce7;
    color: #166534;
  }

  &.status-received {
    background: #dbeafe;
    color: #1e40af;
  }

  &.status-cancelled {
    background: #fee2e2;
    color: #991b1b;
  }
}

.actions-group {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.btn-icon {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  background: white;
  color: #64748b;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;

  &:hover {
    background: $NICOLE-PURPLE;
    color: white;
    border-color: $NICOLE-PURPLE;
  }

  &.btn-delete:hover {
    background: #ef4444;
    border-color: #ef4444;
  }
}

.pagination {
  padding: 1.5rem;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1.5rem;
  border-top: 1px solid #f1f5f9;

  button {
    padding: 0.5rem 1rem;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
    background: white;
    font-weight: 600;
    cursor: pointer;

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    &:not(:disabled):hover {
      background: #f8fafc;
      border-color: $NICOLE-PURPLE;
    }
  }

  span {
    font-size: 0.9rem;
    color: #64748b;
    font-weight: 600;
  }
}

.loading-container {
  padding: 4rem 2rem;
  text-align: center;

  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #f1f5f9;
    border-top-color: $NICOLE-PURPLE;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.text-right {
  text-align: right;
}
</style>
