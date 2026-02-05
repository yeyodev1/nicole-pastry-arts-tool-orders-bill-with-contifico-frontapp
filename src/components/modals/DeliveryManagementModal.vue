<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { deliveryService, type DeliveryPerson } from '@/services/delivery.service'
import OrderService from '@/services/order.service'
import DeliveryPersonFormModal from '@/components/modals/DeliveryPersonFormModal.vue'
import DeliveryPersonDeleteModal from '@/components/modals/DeliveryPersonDeleteModal.vue'

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const riders = ref<DeliveryPerson[]>([])
const loading = ref(false)

// Internal Modal State
const isFormModalOpen = ref(false)
const isDeleteModalOpen = ref(false)
const selectedPerson = ref<DeliveryPerson | undefined>(undefined)

const fetchRiders = async () => {
  loading.value = true
  try {
    riders.value = await deliveryService.getPersonnel()
  } catch (error) {
    console.error('Error fetching riders:', error)
  } finally {
    loading.value = false
  }
}

const openNewModal = () => {
  selectedPerson.value = undefined
  isFormModalOpen.value = true
}

const openEditModal = (person: DeliveryPerson) => {
  selectedPerson.value = person
  isFormModalOpen.value = true
}

const openDeleteModal = (person: DeliveryPerson) => {
  selectedPerson.value = person
  isDeleteModalOpen.value = true
}

const handleSave = async (personData: Partial<DeliveryPerson>) => {
  try {
    if (selectedPerson.value?._id) {
      await deliveryService.updatePerson(selectedPerson.value._id, personData)
    } else {
      await deliveryService.createPerson(personData)
    }
    await fetchRiders()
    isFormModalOpen.value = false
  } catch (error) {
    alert('Error al guardar motorizado o transporte.')
  }
}

const handleDelete = async (payload?: { action: 'unassign' | 'reassign', newPersonId?: string }) => {
  if (!selectedPerson.value?._id) return
  try {
    if (payload?.action === 'reassign' && payload.newPersonId) {
      const newRider = riders.value.find(r => r._id === payload.newPersonId)
      if (newRider) {
        await OrderService.reassignDelivery(selectedPerson.value._id, {
          name: newRider.name,
          identification: newRider.identification,
          personId: newRider._id
        })
      }
    } else if (payload?.action === 'unassign') {
      await OrderService.reassignDelivery(selectedPerson.value._id, null)
    }

    await deliveryService.deletePerson(selectedPerson.value._id)
    await fetchRiders()
    isDeleteModalOpen.value = false
    alert('Motorizado eliminado correctamente.')
  } catch (error) {
    alert('Error al eliminar motorizado o transporte.')
  }
}

onMounted(fetchRiders)
</script>

<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="emit('close')">
    <div class="modal management-modal">
        <header class="modal-header">
            <div class="header-content">
                <h2>Gestión de Motorizados / Transporte</h2>
                <p>Administra la lista de repartidores y transporte externo disponible.</p>
            </div>
            
            <div class="header-actions">
                <button class="btn-primary" @click="openNewModal">
                    <i class="fa-solid fa-plus"></i> Nuevo
                </button>
                <button class="btn-close" @click="emit('close')"><i class="fa-solid fa-xmark"></i></button>
            </div>
        </header>

        <div v-if="loading" class="loading-state">
            <div class="spinner"></div>
            <span>Cargando...</span>
        </div>

        <div v-else class="riders-list">
            <div v-if="riders.length === 0" class="empty-state">
                <i class="fa-solid fa-truck-fast"></i>
                <p>No hay motorizados o transporte registrados.</p>
                <button class="btn-secondary" @click="openNewModal">Agregar el primero</button>
            </div>

            <div class="riders-grid">
                <div v-for="rider in riders" :key="rider._id" class="rider-card">
                    <div class="rider-info">
                        <div class="avatar">{{ rider.name.charAt(0) }}</div>
                        <div class="details">
                            <h3>{{ rider.name }}</h3>
                            <span class="id"><i class="fa-solid fa-id-card"></i> {{ rider.identification }}</span>
                            <span v-if="rider.phone" class="phone"><i class="fa-solid fa-phone"></i> {{ rider.phone }}</span>
                        </div>
                    </div>
                    <div class="rider-actions">
                        <button class="btn-edit" @click="openEditModal(rider)" title="Editar">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button class="btn-delete" @click="openDeleteModal(rider)" title="Eliminar">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Nested Modals -->
        <DeliveryPersonFormModal 
            :is-open="isFormModalOpen"
            :person="selectedPerson"
            @close="isFormModalOpen = false"
            @save="handleSave"
        />

        <DeliveryPersonDeleteModal 
            :is-open="isDeleteModalOpen"
            :person-id="selectedPerson?._id || ''"
            :person-name="selectedPerson?.name || ''"
            :riders="riders"
            @close="isDeleteModalOpen = false"
            @confirm="handleDelete"
        />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 2000; // Lower than child modals but higher than page
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal.management-modal {
  background: white;
  width: 95%;
  max-width: 800px;
  height: 80vh; // Fixed height for scrolling list
  border-radius: 20px;
  padding: 0; // Padding handled by internal sections
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  padding: 1.5rem 2rem;
  border-bottom: 1px solid $border-light;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  background: white;

  h2 {
    margin: 0;
    color: $text-dark;
    font-size: 1.4rem;
    font-weight: 800;
  }

  p {
    margin: 0.25rem 0 0;
    color: $text-light;
    font-size: 0.95rem;
  }
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1.5rem;

  .btn-close {
    background: transparent;
    border: none;
    font-size: 1.4rem;
    color: $text-light;
    cursor: pointer;
    transition: color 0.2s;

    &:hover {
      color: $text-dark;
    }
  }
}

.riders-list {
  flex: 1;
  overflow-y: auto;
  padding: 2rem;
  background: $gray-50;

  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-thumb {
    background: $gray-200;
    border-radius: 4px;
  }
}

.riders-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
}

.rider-card {
  background: white;
  border-radius: 16px;
  padding: 1.25rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 1px solid $border-light;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
  transition: all 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 15px rgba(0, 0, 0, 0.05);
    border-color: $NICOLE-PURPLE;
  }
}

.rider-info {
  display: flex;
  gap: 1rem;
  align-items: center;
  overflow: hidden;

  .avatar {
    width: 42px;
    height: 42px;
    background: rgba($NICOLE-PURPLE, 0.1);
    color: $NICOLE-PURPLE;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.1rem;
    font-weight: 800;
    flex-shrink: 0;
  }

  .details {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    overflow: hidden;

    h3 {
      margin: 0;
      font-size: 1rem;
      color: $text-dark;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    span {
      font-size: 0.8rem;
      color: $text-light;
      display: flex;
      align-items: center;
      gap: 0.3rem;

      i {
        font-size: 0.75rem;
        width: 12px;
      }
    }
  }
}

.rider-actions {
  display: flex;
  gap: 0.4rem;
  flex-shrink: 0;

  button {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    font-size: 0.9rem;
  }

  .btn-edit {
    background: $gray-50;
    color: $text-light;

    &:hover {
      background: rgba($NICOLE-PURPLE, 0.1);
      color: $NICOLE-PURPLE;
    }
  }

  .btn-delete {
    background: $gray-50;
    color: $text-light;

    &:hover {
      background: #fee2e2;
      color: #dc2626;
    }
  }
}

.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  color: $text-light;

  i {
    font-size: 2.5rem;
    margin-bottom: 1rem;
    opacity: 0.4;
  }
}

.btn-primary {
  background: $NICOLE-PURPLE;
  color: white;
  border: none;
  padding: 0.6rem 1.2rem;
  border-radius: 10px;
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s;

  &:hover {
    background: $purple-hover;
  }
}

.btn-secondary {
  background: $gray-100;
  color: $NICOLE-PURPLE;
  border: none;
  padding: 0.6rem 1.2rem;
  border-radius: 8px;
  font-weight: 700;
  cursor: pointer;
  margin-top: 1rem;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 1rem;
  color: $text-light;

  .spinner {
    width: 30px;
    height: 30px;
    border: 3px solid rgba($NICOLE-PURPLE, 0.3);
    border-radius: 50%;
    border-top-color: $NICOLE-PURPLE;
    animation: spin 1s linear infinite;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
