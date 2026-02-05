<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { deliveryService, type DeliveryPerson } from '@/services/delivery.service'
import OrderService from '@/services/order.service'
import { useToast } from '@/composables/useToast'

const props = defineProps<{
  order: any
}>()

const emit = defineEmits<{
  (e: 'updated', order: any): void
}>()

const { success, error: showError } = useToast()
const riders = ref<DeliveryPerson[]>([])
const isLoading = ref(false)
const isEditing = ref(false)
const selectedRiderId = ref('')
const selectedRiderName = ref('')
const isDropdownOpen = ref(false)

const selectRider = (rider: DeliveryPerson) => {
  selectedRiderId.value = rider._id || ''
  selectedRiderName.value = rider.name
  isDropdownOpen.value = false
}

const fetchRiders = async () => {
  try {
    riders.value = await deliveryService.getPersonnel()
  } catch (error) {
    console.error('Error fetching riders:', error)
  }
}

const toggleEdit = () => {
  if (!isEditing.value) {
    selectedRiderId.value = props.order.deliveryPerson?.personId || ''
    selectedRiderName.value = props.order.deliveryPerson?.name || ''
    isDropdownOpen.value = false
  }
  isEditing.value = !isEditing.value
}

const saveRider = async () => {
  if (!selectedRiderId.value) return

  isLoading.value = true
  try {
    const rider = riders.value.find(r => r._id === selectedRiderId.value)
    if (!rider) throw new Error('Rider not found')

    const updateData = {
      deliveryPerson: {
        name: rider.name,
        identification: rider.identification,
        personId: rider._id
      }
    }

    const updated = await OrderService.updateOrder(props.order._id, updateData)
    success('Motorizado asignado correctamente.')
    emit('updated', updated)
    isEditing.value = false
  } catch (error: any) {
    showError(error.response?.data?.message || 'Error al asignar motorizado.')
  } finally {
    isLoading.value = false
  }
}

onMounted(fetchRiders)
</script>

<template>
  <div class="card assign-card" :class="{ 'warning': !order.deliveryPerson }">
    <div class="header">
      <h2>Entrega / Transporte</h2>
      <button v-if="!isEditing" @click="toggleEdit" class="btn-edit-link">
        {{ order.deliveryPerson ? 'Cambiar' : 'Asignar' }}
      </button>
    </div>

    <div v-if="!isEditing" class="view-mode">
       <div v-if="order.deliveryPerson" class="rider-info">
          <div class="avatar">{{ order.deliveryPerson.name.charAt(0) }}</div>
          <div class="details">
             <span class="name">{{ order.deliveryPerson.name }}</span>
             <span class="id">{{ order.deliveryPerson.identification }}</span>
          </div>
       </div>
       <div v-else class="no-rider">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <p>No se ha asignado motorizado o transporte aún.</p>
       </div>
    </div>

    <div v-else class="edit-mode">
       <div class="custom-dropdown-container">
          <div 
            class="dropdown-trigger" 
            @click="isDropdownOpen = !isDropdownOpen"
            :class="{ 'open': isDropdownOpen, 'placeholder': !selectedRiderId }"
          >
             <span>{{ selectedRiderName || 'Seleccione motorizado o transporte...' }}</span>
             <i class="fa-solid fa-chevron-down arrow"></i>
          </div>
          
          <div v-if="isDropdownOpen" class="dropdown-menu">
             <div 
               v-for="rider in riders" 
               :key="rider._id" 
               class="dropdown-option"
               :class="{ 'selected': selectedRiderId === rider._id }"
               @click="selectRider(rider)"
             >
                <div class="option-avatar">{{ rider.name.charAt(0) }}</div>
                <div class="option-details">
                   <span class="option-name">{{ rider.name }}</span>
                   <span class="option-id">{{ rider.identification }}</span>
                </div>
                <i v-if="selectedRiderId === rider._id" class="fa-solid fa-check check-icon"></i>
             </div>
             <div v-if="riders.length === 0" class="empty-dropdown">
                No hay motorizados registrados.
             </div>
          </div>
       </div>

       <div class="actions">
          <button @click="isEditing = false" class="btn-cancel" :disabled="isLoading">Cancelar</button>
          <button @click="saveRider" class="btn-save" :disabled="isLoading || !selectedRiderId">
             <i v-if="isLoading" class="fa-solid fa-spinner fa-spin"></i>
             Guardar
          </button>
       </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.card {
  background: white;
  border-radius: 12px;
  border: 1px solid $border-light;
  padding: 1.25rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.01);
  width: 100%;
  box-sizing: border-box;

  &.warning {
    border-color: #fed7aa;
    background: #fffaf5;
  }
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid $gray-50;

  h2 {
    margin: 0;
    font-size: 1rem;
    color: $text-dark;
    font-weight: 700;
  }
}

.btn-edit-link {
  background: transparent;
  border: none;
  color: $NICOLE-PURPLE;
  font-weight: 700;
  font-size: 0.85rem;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
}

.rider-info {
  display: flex;
  gap: 0.75rem;
  align-items: center;

  .avatar {
    width: 36px;
    height: 36px;
    background: rgba($NICOLE-PURPLE, 0.1);
    color: $NICOLE-PURPLE;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 0.9rem;
  }

  .details {
    display: flex;
    flex-direction: column;

    .name {
      font-weight: 700;
      color: $text-dark;
      font-size: 0.95rem;
    }

    .id {
      font-size: 0.8rem;
      color: $text-light;
    }
  }
}

.no-rider {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem 0;
  color: #9a3412;
  text-align: center;

  i {
    font-size: 1.5rem;
    color: #ea580c;
  }

  p {
    margin: 0;
    font-size: 0.85rem;
    font-weight: 600;
  }
}

.edit-mode {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
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

  &:hover:not(.open) {
    background: white;
    border-color: rgba($NICOLE-PURPLE, 0.3);
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

.empty-dropdown {
  padding: 2rem;
  text-align: center;
  color: $text-light;
  font-size: 0.9rem;
  font-style: italic;
}

.actions {
  display: flex;
  gap: 0.5rem;

  button {
    flex: 1;
    padding: 0.8rem;
    border-radius: 12px;
    font-weight: 700;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-cancel {
    background: transparent;
    border: 1px solid $border-light;
    color: $text-light;

    &:hover {
      background: $gray-50;
    }
  }

  .btn-save {
    background: $NICOLE-PURPLE;
    border: none;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;

    &:hover:not(:disabled) {
      background: $purple-hover;
      transform: translateY(-1px);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }
}
</style>
