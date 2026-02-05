<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { deliveryService, type DeliveryReport, type DeliveryPerson } from '@/services/delivery.service'
import OrderService from '@/services/order.service'
import CustomDatePicker from '@/components/ui/CustomDatePicker.vue'
import { useToast } from '@/composables/useToast'
import DeliveryManagementModal from '@/components/modals/DeliveryManagementModal.vue'

const report = ref<DeliveryReport | null>(null)
const riders = ref<DeliveryPerson[]>([])
const loading = ref(false)
const { success, error: showError } = useToast()

// Assignment Modal State
const isManagementModalOpen = ref(false)
const isAssignModalOpen = ref(false)
const selectedOrder = ref<any>(null)
const assigneeRiderId = ref('')
const assigneeRiderName = ref('')
const isAssigning = ref(false)
const isDropdownOpen = ref(false)
const selectedOrderIds = ref<string[]>([])
const isBulkAssignModalOpen = ref(false)

const selectRiderForAssign = (rider: DeliveryPerson) => {
  assigneeRiderId.value = rider._id || ''
  assigneeRiderName.value = rider.name
  isDropdownOpen.value = false
}

const toggleSelection = (orderId: string) => {
  if (selectedOrderIds.value.includes(orderId)) {
    selectedOrderIds.value = selectedOrderIds.value.filter(id => id !== orderId)
  } else {
    selectedOrderIds.value.push(orderId)
  }
}

const toggleAll = (event: Event) => {
  const isChecked = (event.target as HTMLInputElement).checked
  if (isChecked && report.value) {
    // Only selectable orders (unassigned? or all? user said unassigned mostly but "seleccionar varios pedidos no asignado")
    // Let's allow selecting any visible order for flexibility
    selectedOrderIds.value = report.value.orders.map(o => o._id)
  } else {
    selectedOrderIds.value = []
  }
}

const openBulkAssignModal = () => {
  if (selectedOrderIds.value.length === 0) return
  assigneeRiderId.value = ''
  assigneeRiderName.value = ''
  isDropdownOpen.value = false
  isBulkAssignModalOpen.value = true
}

const executeBulkAssign = async () => {
  if (!assigneeRiderId.value) return
  isAssigning.value = true
  try {
    const rider = riders.value.find(r => r._id === assigneeRiderId.value)
    if (!rider) throw new Error('Rider not found')

    const deliveryData = {
      name: rider.name,
      identification: rider.identification,
      personId: rider._id
    }

    await OrderService.bulkAssign(selectedOrderIds.value, deliveryData)

    success(`${selectedOrderIds.value.length} pedidos asignados a ${rider.name}.`)
    isBulkAssignModalOpen.value = false
    selectedOrderIds.value = []
    generateReport() // Refresh report
  } catch (error: any) {
    showError('Error al asignar pedidos masivamente.')
  } finally {
    isAssigning.value = false
  }
}

const filters = ref<{
  startDate: string;
  endDate: string;
  personId: string;
}>({
  startDate: '',
  endDate: '',
  personId: ''
})

const getLocalDate = (d: Date) => {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const initFilters = () => {
  const now = new Date()
  // Default: from 1st of current month to 7 days in the future
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
  const nextWeek = new Date(now)
  nextWeek.setDate(now.getDate() + 7)

  filters.value.startDate = getLocalDate(firstDay)
  filters.value.endDate = getLocalDate(nextWeek)
}

const fetchRiders = async () => {
  try {
    riders.value = await deliveryService.getPersonnel()
  } catch (error) {
    console.error('Error fetching riders:', error)
  }
}

const generateReport = async () => {
  loading.value = true
  try {
    report.value = await deliveryService.getReport(
      filters.value.startDate as string,
      filters.value.endDate as string,
      filters.value.personId || undefined
    )
  } catch (error) {
    console.error('Error generating report:', error)
  } finally {
    loading.value = false
  }
}

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('es-EC', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

const openAssignModal = (order: any) => {
  selectedOrder.value = order
  assigneeRiderId.value = order.deliveryPerson?.personId || ''
  assigneeRiderName.value = order.deliveryPerson?.name || ''
  isDropdownOpen.value = false
  isAssignModalOpen.value = true
}

const executeAssign = async () => {
  if (!selectedOrder.value || !assigneeRiderId.value) return
  isAssigning.value = true
  try {
    const rider = riders.value.find(r => r._id === assigneeRiderId.value)
    if (!rider) throw new Error('Rider not found')

    await OrderService.updateOrder(selectedOrder.value._id, {
      deliveryPerson: {
        name: rider.name,
        identification: rider.identification,
        personId: rider._id
      }
    })

    success('Motorizado asignado correctamente.')
    isAssignModalOpen.value = false
    generateReport() // Refresh report
  } catch (error: any) {
    showError(error.response?.data?.message || 'Error al asignar motorizado.')
  } finally {
    isAssigning.value = false
  }
}

onMounted(() => {
  initFilters()
  fetchRiders()
  generateReport()
})
</script>

<template>
  <div class="delivery-report-view">
    <header class="view-header">
      <div class="header-content">
        <h1>Reporte de Motorizados / Transporte</h1>
        <p>Consulta y liquida los valores de envío acumulados.</p>
      </div>
      <button class="btn-secondary manage-btn" @click="isManagementModalOpen = true">
        <i class="fa-solid fa-users-gear"></i> Gestionar Motorizados
      </button>
    </header>

    <div class="filter-card card">
      <div class="filter-grid">
        <div class="form-group">
          <CustomDatePicker
            label="Fecha Inicio"
            v-model="filters.startDate"
          />
        </div>
        <div class="form-group">
          <CustomDatePicker
            label="Fecha Fin"
            v-model="filters.endDate"
          />
        </div>
        <div class="form-group">
          <label>Motorizado / Transporte</label>
          <select v-model="filters.personId">
            <option value="">Todos</option>
            <option v-for="rider in riders" :key="rider._id" :value="rider._id">
              {{ rider.name }}
            </option>
          </select>
        </div>
        <div class="filter-actions">
          <button @click="generateReport" class="btn-primary" :disabled="loading">
            <i class="fa-solid fa-sync" :class="{ 'fa-spin': loading }"></i>
            Actualizar Reporte
          </button>
        </div>
      </div>
    </div>

    <div v-if="report" class="report-content">
      <div class="summary-cards">
        <div class="summary-card total">
          <span class="label">Total a Pagar</span>
          <span class="value">${{ report.total.toFixed(2) }}</span>
        </div>
        <div class="summary-card count">
          <span class="label">Total Entregas</span>
          <span class="value">{{ report.count }}</span>
        </div>
      </div>

      <div class="details-section card">
        <h3>Desglose por Motorizado / Transporte</h3>
        <table class="report-table">
          <thead>
            <tr>
              <th>Transporte</th>
              <th>Entregas</th>
              <th>Total Acumulado</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in report.summary" :key="item.name">
              <td>{{ item.name }}</td>
              <td>{{ item.count }}</td>
              <td class="amount">${{ item.total.toFixed(2) }}</td>
            </tr>
            <tr v-if="report.summary.length === 0">
              <td colspan="3" class="empty">No hay datos para este periodo.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="orders-section card">
        <div class="section-header">
            <h3>Detalle de Pedidos</h3>
            <button v-if="selectedOrderIds.length > 0" class="btn-bulk-assign" @click="openBulkAssignModal">
                <i class="fa-solid fa-user-tag"></i> Asignar ({{ selectedOrderIds.length }})
            </button>
        </div>
        <div class="table-container">
          <table class="report-table">
            <thead>
              <tr>
                <th>
                    <input type="checkbox" @change="toggleAll" :checked="report.orders.length > 0 && selectedOrderIds.length === report.orders.length" />
                </th>
                <th>Fecha Entrega</th>
                <th>Cliente</th>
                <th>Motorizado / Transporte</th>
                <th>Valor Envío</th>
                <th>Total Pedido</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="order in report.orders" :key="order._id" :class="{ 'selected-row': selectedOrderIds.includes(order._id) }">
                <td>
                    <input type="checkbox" :checked="selectedOrderIds.includes(order._id)" @change="toggleSelection(order._id)" />
                </td>
                <td>{{ formatDate(order.deliveryDate) }}</td>
                <td>{{ order.customerName }}</td>
                <td>
                  <div v-if="order.deliveryPerson" class="rider-tag">
                    <i class="fa-solid fa-truck-fast"></i>
                    {{ order.deliveryPerson.name }}
                  </div>
                  <div v-else class="rider-tag unassigned">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                    Sin asignar
                  </div>
                </td>
                <td class="amount">${{ order.deliveryValue.toFixed(2) }}</td>
                <td>${{ order.totalValue.toFixed(2) }}</td>
                <td>
                  <button @click="openAssignModal(order)" class="btn-table-action" :title="order.deliveryPerson ? 'Cambiar Motorizado' : 'Asignar Motorizado'">
                    <i class="fa-solid fa-user-plus"></i>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Bulk Assign Modal -->
    <div v-if="isBulkAssignModalOpen" class="modal-overlay" @click.self="isBulkAssignModalOpen = false">
      <div class="modal quick-assign-modal">
        <header class="modal-header">
          <h2>Asignación Masiva</h2>
          <p>Asignando <strong>{{ selectedOrderIds.length }}</strong> pedidos seleccionados.</p>
        </header>

        <div class="modal-body">
          <div class="form-group">
            <label>Seleccionar Motorizado o Transporte</label>
            <div class="custom-dropdown-container">
               <div 
                 class="dropdown-trigger" 
                 @click="isDropdownOpen = !isDropdownOpen"
                 :class="{ 'open': isDropdownOpen, 'placeholder': !assigneeRiderId }"
               >
                  <span>{{ assigneeRiderName || 'Seleccione transporte...' }}</span>
                  <i class="fa-solid fa-chevron-down arrow"></i>
               </div>
               
               <div v-if="isDropdownOpen" class="dropdown-menu">
                  <div 
                    v-for="rider in riders" 
                    :key="rider._id" 
                    class="dropdown-option"
                    :class="{ 'selected': assigneeRiderId === rider._id }"
                    @click="selectRiderForAssign(rider)"
                  >
                     <div class="option-avatar">{{ rider.name.charAt(0) }}</div>
                     <div class="option-details">
                        <span class="option-name">{{ rider.name }}</span>
                        <span class="option-id">{{ rider.identification }}</span>
                     </div>
                     <i v-if="assigneeRiderId === rider._id" class="fa-solid fa-check check-icon"></i>
                  </div>
               </div>
            </div>
          </div>
        </div>

        <div class="modal-actions">
          <button @click="isBulkAssignModalOpen = false" class="btn-secondary" :disabled="isAssigning">Cancelar</button>
          <button @click="executeBulkAssign" class="btn-primary" :disabled="isAssigning || !assigneeRiderId">
            <i v-if="isAssigning" class="fa-solid fa-spinner fa-spin"></i>
            Asignar a Todos
          </button>
        </div>
      </div>
    </div>

    <!-- Quick Assign Modal -->
    <div v-if="isAssignModalOpen" class="modal-overlay" @click.self="isAssignModalOpen = false">
      <div class="modal quick-assign-modal">
        <header class="modal-header">
          <h2>Asignar Transporte</h2>
          <p>Pedido para: <strong>{{ selectedOrder.customerName }}</strong></p>
        </header>

        <div class="modal-body">
          <div class="form-group">
            <label>Seleccionar Motorizado o Transporte</label>
            <div class="custom-dropdown-container">
               <div 
                 class="dropdown-trigger" 
                 @click="isDropdownOpen = !isDropdownOpen"
                 :class="{ 'open': isDropdownOpen, 'placeholder': !assigneeRiderId }"
               >
                  <span>{{ assigneeRiderName || 'Seleccione transporte...' }}</span>
                  <i class="fa-solid fa-chevron-down arrow"></i>
               </div>
               
               <div v-if="isDropdownOpen" class="dropdown-menu">
                  <div 
                    v-for="rider in riders" 
                    :key="rider._id" 
                    class="dropdown-option"
                    :class="{ 'selected': assigneeRiderId === rider._id }"
                    @click="selectRiderForAssign(rider)"
                  >
                     <div class="option-avatar">{{ rider.name.charAt(0) }}</div>
                     <div class="option-details">
                        <span class="option-name">{{ rider.name }}</span>
                        <span class="option-id">{{ rider.identification }}</span>
                     </div>
                     <i v-if="assigneeRiderId === rider._id" class="fa-solid fa-check check-icon"></i>
                  </div>
               </div>
            </div>
          </div>
        </div>

        <div class="modal-actions">
          <button @click="isAssignModalOpen = false" class="btn-secondary" :disabled="isAssigning">Cancelar</button>
          <button @click="executeAssign" class="btn-primary" :disabled="isAssigning || !assigneeRiderId">
            <i v-if="isAssigning" class="fa-solid fa-spinner fa-spin"></i>
            Guardar Asignación
          </button>
        </div>
      </div>
    </div>

    <!-- Management Modal -->
    <DeliveryManagementModal 
      :is-open="isManagementModalOpen"
      @close="isManagementModalOpen = false; fetchRiders()"
    />
  </div>
</template>

<style lang="scss" scoped>
.delivery-report-view {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.view-header {
  margin-bottom: 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;

  h1 {
    color: $text-dark;
    margin: 0;
  }

  p {
    color: $text-light;
    margin: 0.5rem 0 0;
  }

  .manage-btn {
    background: white;
    border: 1px solid $border-light;
    color: $text-dark;
    padding: 0.75rem 1.25rem;
    border-radius: 12px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: all 0.2s;

    &:hover {
      border-color: $NICOLE-PURPLE;
      color: $NICOLE-PURPLE;
      background: rgba($NICOLE-PURPLE, 0.05);
    }
  }

  @media(max-width: 600px) {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;

    .manage-btn {
      width: 100%;
      justify-content: center;
    }
  }
}

.card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  border: 1px solid $border-light;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.02);
  margin-bottom: 2rem;
}

.filter-actions {
  display: flex;
  gap: 1rem;
}

.btn-bulk-assign {
  background: #0ea5e9;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s;

  &:hover {
    background: darken(#0ea5e9, 5%);
  }
}

.filter-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  align-items: flex-end;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 90%;

  label {
    font-weight: 600;
    font-size: 0.9rem;
    color: $text-dark;
  }

  input,
  select {
    padding: 0.75rem;
    border-radius: 8px;
    border: 1px solid $border-light;
    background: $gray-50;
  }
}

.btn-primary {
  background: $NICOLE-PURPLE;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
}

.summary-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  margin-bottom: 2rem;
}

.summary-card {
  background: white;
  padding: 2rem;
  border-radius: 16px;
  border-left: 5px solid $NICOLE-PURPLE;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);

  .label {
    color: $text-light;
    font-size: 1rem;
    font-weight: 500;
  }

  .value {
    color: $text-dark;
    font-size: 2.5rem;
    font-weight: 800;
    margin-top: 0.5rem;
  }

  &.total {
    border-left-color: $success;

    .value {
      color: $success;
    }
  }
}

.report-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;

  th {
    text-align: left;
    padding: 1rem;
    border-bottom: 2px solid $gray-100;
    color: $text-light;
    font-weight: 600;
    font-size: 0.85rem;
    text-transform: uppercase;
  }

  tr.selected-row {
    background-color: rgba($NICOLE-PURPLE, 0.03);
  }

  td {
    padding: 1rem;
    border-bottom: 1px solid $gray-50;
    color: $text-dark;
    font-size: 0.95rem;
  }

  .amount {
    font-weight: 700;
    color: $NICOLE-PURPLE;
  }

  .rider-tag {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.8rem;
    background: #f0f9ff;
    color: #0369a1;
    border-radius: 20px;
    font-size: 0.85rem;
    font-weight: 600;

    &.unassigned {
      background: #fff7ed;
      color: #9a3412;
      border: 1px solid #fed7aa;
    }

    i {
      font-size: 0.8rem;
    }
  }

  .btn-table-action {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: none;
    background: $gray-50;
    color: $text-light;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;

    &:hover {
      background: rgba($NICOLE-PURPLE, 0.1);
      color: $NICOLE-PURPLE;
      transform: scale(1.1);
    }
  }

  .empty {
    text-align: center;
    padding: 3rem;
    color: $text-light;
    font-style: italic;
  }
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;

  h3 {
    margin: 0;
  }
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal {
  background: white;
  width: 95%;
  max-width: 450px;
  border-radius: 20px;
  padding: 2rem;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);

  .modal-header {
    margin-bottom: 2rem;

    h2 {
      margin: 0;
      color: $text-dark;
      font-size: 1.4rem;
    }

    p {
      margin: 0.5rem 0 0;
      color: $text-light;
      font-size: 0.9rem;
    }
  }

  .modal-body {
    margin-bottom: 2rem;
  }

  .custom-dropdown-container {
    position: relative;
    width: 100%;
  }

  .dropdown-trigger {
    width: 100%;
    padding: 0.85rem 1.25rem;
    background: $gray-50;
    border: 1.5px solid $border-light;
    border-radius: 14px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 0.95rem;
    font-weight: 600;
    color: $text-dark;
    box-sizing: border-box;

    &.placeholder {
      color: $text-light;
      font-weight: 500;
    }

    &.open {
      border-color: $NICOLE-PURPLE;
      background: white;
      box-shadow: 0 0 0 4px rgba($NICOLE-PURPLE, 0.1);

      .arrow {
        transform: rotate(180deg);
      }
    }

    .arrow {
      font-size: 0.8rem;
      color: $text-light;
      transition: transform 0.3s ease;
    }
  }

  .dropdown-menu {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    right: 0;
    background: white;
    border-radius: 16px;
    border: 1px solid $border-light;
    box-shadow: 0 15px 35px rgba(0, 0, 0, 0.15);
    z-index: 100;
    max-height: 250px;
    overflow-y: auto;
    padding: 0.5rem;
    animation: slideDown 0.2s ease-out;

    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-thumb {
      background: $gray-200;
      border-radius: 3px;
    }
  }

  .dropdown-option {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.15s ease;
    margin-bottom: 2px;
    text-align: left;

    &:hover {
      background: rgba($NICOLE-PURPLE, 0.05);
    }

    &.selected {
      background: rgba($NICOLE-PURPLE, 0.1);

      .option-name {
        color: $NICOLE-PURPLE;
      }
    }

    .option-avatar {
      width: 32px;
      height: 32px;
      background: $gray-100;
      color: $text-light;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 0.8rem;
    }

    .option-details {
      flex: 1;
      display: flex;
      flex-direction: column;

      .option-name {
        font-weight: 700;
        font-size: 0.9rem;
        color: $text-dark;
      }

      .option-id {
        font-size: 0.75rem;
        color: $text-light;
      }
    }

    .check-icon {
      color: $NICOLE-PURPLE;
      font-size: 0.9rem;
    }
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }

    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .modal-actions {
    display: flex;
    gap: 1rem;

    button {
      flex: 1;
      padding: 1rem;
      border-radius: 12px;
      font-weight: 700;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
    }

    .btn-secondary {
      background: $gray-50;
      color: $text-light;
    }

    .btn-primary {
      background: $NICOLE-PURPLE;
      color: white;
    }
  }
}

.table-container {
  overflow-x: auto;
}

@media (max-width: 600px) {
  .summary-cards {
    grid-template-columns: 1fr;
  }

  .delivery-report-view {
    padding: 1rem;
  }
}
</style>
