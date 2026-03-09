<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import SupplierOrderService from '@/services/supplier-order.service'
import ProviderService from '@/services/provider.service'
import RawMaterialService from '@/services/raw-material.service'
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

// Create modal states
const showSelectProviderModal = ref(false)
const selectedProviderIdToCreate = ref('')
const isCreatingNewOrder = ref(false)

const providers = ref<any[]>([])
const allMaterials = ref<any[]>([])

const fetchDependencies = async () => {
  try {
    providers.value = await ProviderService.getProviders()
    allMaterials.value = await RawMaterialService.getRawMaterials()
  } catch (err) {
    // console.error(err)
  }
}

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
  isCreatingNewOrder.value = false
  selectedOrder.value = null
}

const openCreateNewOrder = () => {
  selectedProviderIdToCreate.value = ''
  showSelectProviderModal.value = true
}

const proceedToCreateOrder = () => {
  if (!selectedProviderIdToCreate.value) {
    showError('Debes seleccionar un proveedor.')
    return
  }
  const providerObj = providers.value.find(p => p._id === selectedProviderIdToCreate.value)
  selectedOrder.value = { provider: providerObj }
  showSelectProviderModal.value = false
  setTimeout(() => {
    isCreatingNewOrder.value = true
    showEditModal.value = true
  }, 100)
}

onMounted(() => {
  fetchOrders()
  fetchDependencies()
})
</script>

<template>
  <div class="supplier-orders-history">
    <div class="header">
      <div class="title">
        <h1>Historial de Pedidos</h1>
        <p>Historial y gestión de compras a proveedores</p>
      </div>
      <div class="actions">
        <button class="btn-create" @click="openCreateNewOrder">
          <i class="fas fa-plus"></i>
          <span>Crear Pedido</span>
        </button>
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
      :order-id="isCreatingNewOrder ? null : selectedOrder?._id"
      :provider="selectedOrder?.provider"
      :all-materials="allMaterials"
      @close="showEditModal = false; isCreatingNewOrder = false"
      @saved="onOrderSaved"
    />

    <!-- Select Provider Modal for New Order -->
    <teleport to="body">
      <transition name="fade">
        <div v-if="showSelectProviderModal" class="modal-overlay" @click.self="showSelectProviderModal = false">
          <div class="modal-content select-provider-modal">
            <h2>Crear Nuevo Pedido</h2>
            <p>Selecciona el proveedor al cual realizarás el pedido:</p>
            <div class="form-group">
              <select v-model="selectedProviderIdToCreate" class="provider-select">
                <option value="" disabled>Seleccione un proveedor...</option>
                <option v-for="prov in providers" :key="prov._id" :value="prov._id">{{ prov.name }}</option>
              </select>
            </div>
            <div class="modal-actions">
              <button class="btn-cancel" @click="showSelectProviderModal = false">Cancelar</button>
              <button class="btn-primary" @click="proceedToCreateOrder" :disabled="!selectedProviderIdToCreate">Continuar</button>
            </div>
          </div>
        </div>
      </transition>
    </teleport>

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
  display: flex;
  justify-content: space-between;
  align-items: center;

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

.btn-create {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  background: $NICOLE-PURPLE;
  color: white;
  border: none;
  border-radius: 12px;
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba($NICOLE-PURPLE, 0.3);
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

// Select Provider Modal
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
  padding: 1rem;
}

.select-provider-modal {
  background: white;
  padding: 2rem;
  border-radius: 20px;
  width: 100%;
  max-width: 450px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);

  h2 {
    margin: 0 0 0.5rem;
    font-size: 1.5rem;
    color: #1e293b;
  }

  p {
    color: #64748b;
    margin-bottom: 1.5rem;
    font-size: 0.95rem;
  }

  .form-group {
    margin-bottom: 2rem;
  }

  .provider-select {
    width: 100%;
    padding: 0.75rem 1rem;
    border-radius: 12px;
    border: 2px solid #e2e8f0;
    font-size: 1rem;
    font-weight: 600;
    color: #1e293b;
    background: #f8fafc;
    appearance: none;
    background-image: url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23475569%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E");
    background-repeat: no-repeat;
    background-position: right 1rem top 50%;
    background-size: 0.65rem auto;

    &:focus {
      outline: none;
      border-color: $NICOLE-PURPLE;
      background: white;
    }
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;

    button {
      padding: 0.75rem 1.5rem;
      border-radius: 12px;
      font-weight: 700;
      cursor: pointer;
      border: none;
      transition: all 0.2s;

      &.btn-cancel {
        background: #f1f5f9;
        color: #64748b;

        &:hover {
          background: #e2e8f0;
        }
      }

      &.btn-primary {
        background: $NICOLE-PURPLE;
        color: white;

        &:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba($NICOLE-PURPLE, 0.3);
        }

        &:disabled {
          background: #cbd5e1;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }
      }
    }
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
