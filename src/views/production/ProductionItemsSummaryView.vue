<script setup lang="ts">
import { ref, onMounted } from 'vue'
import ProductionService from '@/services/production.service'
import ProductionCategoryGroup from './components/ProductionCategoryGroup.vue'
import ProductionHistoryPanel from './components/ProductionHistoryPanel.vue'
import { useProductionSummary } from '@/composables/useProductionSummary'
import type { SummaryItem } from '@/types/production'

const {
  isLoading,
  error,
  delayedGroups,
  todayGroups,
  tomorrowGroups,
  futureGroups,
  fetchSummary,
  toggleCategory,
  toggleExpand,
  voidItem,
  showHistory
} = useProductionSummary()

import { useToast } from '@/composables/useToast'

// ... existing refs ...
const { success, error: showError } = useToast()

const isRegisterModalOpen = ref(false)
const selectedItem = ref<SummaryItem | null>(null)

// Void Modal State
const isVoidModalOpen = ref(false)
const isVoiding = ref(false) // API call in progress
const isProcessingUI = ref(false) // 4s simulated loading
const isRefreshing = ref(false) // Background data sync
const itemToVoid = ref<SummaryItem | null>(null)
const voidConfirmationInput = ref('')

// Actions
const openVoidModal = (item: SummaryItem) => {
  if (isVoiding.value || isProcessingUI.value) return
  itemToVoid.value = item
  voidConfirmationInput.value = ''
  isVoidModalOpen.value = true
}

const closeVoidModal = () => {
  if (isVoiding.value || isProcessingUI.value) return
  isVoidModalOpen.value = false
  setTimeout(() => {
    if (!isVoidModalOpen.value) {
      itemToVoid.value = null
      voidConfirmationInput.value = ''
    }
  }, 300)
}

const confirmVoidAction = async () => {
  if (!itemToVoid.value || isVoiding.value || isProcessingUI.value) return
  if (voidConfirmationInput.value.toLowerCase() !== 'anular') return

  try {
    isVoiding.value = true

    // 1. Execute Void (API Call)
    await voidItem(itemToVoid.value)
    isVoiding.value = false // Done with API

    // 2. Simulate 4s hard processing
    isProcessingUI.value = true
    await new Promise(resolve => setTimeout(resolve, 4000))
    isProcessingUI.value = false

    // 3. Success Feedback & Close Modal 
    success('Orden anulada exitosamente.')
    isVoidModalOpen.value = false

    // 4. Background Refresh
    isRefreshing.value = true
    await fetchSummary(true)
  } catch (err) {
    showError('Error al anular la orden.')
    isVoiding.value = false
    isProcessingUI.value = false
  } finally {
    isRefreshing.value = false
  }
}

const handleRegisterItem = async (item: SummaryItem) => {
  const qty = item.currentInput
  if (!qty || qty <= 0) {
    alert('Ingrese una cantidad válida')
    return
  }

  if (qty > item.totalQuantity) {
    alert(`La cantidad no puede exceder ${item.totalQuantity}`)
    item.currentInput = item.totalQuantity
    return
  }

  try {
    isLoading.value = true
    await ProductionService.registerProgress(item._id, qty)
    await fetchSummary()
  } catch (err) {
    console.error(err)
    alert('Error al registrar progreso')
    isLoading.value = false
  }
}

const toggleHistoryPanel = () => {
  showHistory.value = !showHistory.value
  if (!showHistory.value) {
    fetchSummary()
  }
}

onMounted(async () => {
  await fetchSummary()
})
</script>

<template>
  <div class="summary-view">
    <div class="header-section">
      <div class="header-content">
        <h1>
          Resumen de Producción
          <span v-if="isRefreshing" class="refreshing-badge">
            <i class="fas fa-sync-alt fa-spin"></i>
            Actualizando...
          </span>
        </h1>
        <p>Control de items pendientes y registro de progreso</p>
      </div>
      <div class="header-actions">
        <button class="btn-history" @click="toggleHistoryPanel" :class="{ active: showHistory }">
          <i class="fas" :class="showHistory ? 'fa-arrow-left' : 'fa-history'"></i>
          {{ showHistory ? 'Volver' : 'Ver Completados' }}
        </button>
        <button class="btn-refresh" @click="fetchSummary(false)" :disabled="isLoading" v-if="!showHistory">
          <i class="fas fa-sync-alt" :class="{ 'fa-spin': isLoading }"></i>
          Actualizar
        </button>
      </div>
    </div>

    <div v-if="isLoading" class="loading-state">
      <span class="loader"></span>
      <p>Cargando información...</p>
    </div>

    <div v-else-if="error" class="error-msg">
      <i class="fas fa-exclamation-triangle"></i>
      {{ error }}
      <button @click="fetchSummary(false)">Reintentar</button>
    </div>

    <!-- History View -->
    <ProductionHistoryPanel 
        v-else-if="showHistory" 
        @close="toggleHistoryPanel"
    />

    <div v-else class="content-wrapper">

      <!-- Loop for Delayed, Today, Tomorrow, Future -->
      <div v-for="(timeGroup, type) in { delayed: delayedGroups, today: todayGroups, tomorrow: tomorrowGroups, future: futureGroups }" :key="type">
        
        <section v-if="timeGroup.length > 0" class="list-section" :class="type">
          <div class="section-title" :class="type">
            <h2>
              <i v-if="type === 'delayed'" class="fas fa-exclamation-triangle"></i>
              <i v-else-if="type === 'today'" class="fas fa-calendar-day"></i>
              <i v-else-if="type === 'tomorrow'" class="fas fa-sun"></i>
              <i v-else class="fas fa-calendar-alt"></i>
              
              {{ type === 'delayed' ? 'ATRASADO / PENDIENTE' : type === 'today' ? 'PARA HOY / URGENTE' : type === 'tomorrow' ? 'PARA MAÑANA' : 'FUTURO' }}
            </h2>
            <span class="count-badge">
              {{timeGroup.reduce((acc, cat) => acc + cat.items.length, 0)}} items
            </span>
          </div>

          <div class="groups-container">
            <ProductionCategoryGroup
              v-for="cat in timeGroup"
              :key="cat.id"
              :category="cat"
              :urgency-type="String(type)"
              @toggle-category="toggleCategory"
              @toggle-item="toggleExpand"
              @register-item="handleRegisterItem"
              @void-item="openVoidModal"
            />
          </div>

          <hr class="section-divider" />
        </section>
      </div>

      <div v-if="delayedGroups.length === 0 && todayGroups.length === 0 && tomorrowGroups.length === 0 && futureGroups.length === 0" class="empty-state">
        <i class="fas fa-check-circle"></i>
        <p>No hay producción pendiente</p>
        <span>Buen trabajo, el tablero está limpio.</span>
      </div>
    </div>

    <!-- Void Confirmation Modal -->
    <Transition name="modal-fade">
      <div v-if="isVoidModalOpen" class="modal-overlay">
        <div class="modal-content danger">
          <div class="modal-header">
             <i class="fas fa-exclamation-triangle"></i>
             <h2>Confirmar Anulación</h2>
          </div>
          
          <p v-if="itemToVoid">
              Para anular <strong>{{ itemToVoid._id }}</strong> ({{ itemToVoid.totalQuantity }} unids), escribe la palabra clave.
              <br><small>Esta acción requiere confirmación manual para evitar accidentes.</small>
          </p>
  
          <div class="input-group">
              <label>Escribe "anular" para confirmar:</label>
              <input 
                v-model="voidConfirmationInput" 
                type="text" 
                placeholder="anular"
                class="confirm-input"
                :disabled="isVoiding || isProcessingUI"
              />
          </div>
  
          <div class="modal-actions">
             <button class="btn-cancel" @click="closeVoidModal" :disabled="isVoiding || isProcessingUI">Cancelar</button>
             <button 
               class="btn-confirm-void" 
               :disabled="voidConfirmationInput.trim().toLowerCase() !== 'anular' || isVoiding || isProcessingUI"
               @click="confirmVoidAction"
              >
               <i class="fas" :class="isVoiding ? 'fa-spinner fa-spin' : 'fa-ban'"></i> 
               {{ isVoiding ? 'ANULANDO...' : 'ANULAR ORDEN' }}
             </button>
          </div>

          <!-- Internal Modal UI Simulation Overlay -->
          <Transition name="fade">
            <div v-if="isProcessingUI" class="modal-processing-overlay">
              <div class="processing-loader"></div>
              <p>Procesando...</p>
            </div>
          </Transition>
        </div>
      </div>
    </Transition>

  </div>
</template>

<style lang="scss" scoped>
$font-stack-system: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
$color-urgent: #e74c3c;
$color-warning: #f1c40f;
$color-info: #3498db;
$color-delayed: #e67e22;

.summary-view {
  min-height: 100vh;
  background: #f8f9fa;
  color: #2c3e50;
  padding-bottom: 4rem;
  font-family: $font-stack-system;
}

.header-section {
  background: white;
  padding: 1.25rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  margin-bottom: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;

  @media (min-width: 768px) {
    padding: 1.5rem 2rem;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
  }

  .header-content {
    h1 {
      font-size: 1.5rem;
      color: #2c3e50;
      margin: 0 0 0.25rem 0;
      font-weight: 800;
      letter-spacing: -0.5px;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem;

      @media (min-width: 768px) {
        font-size: 1.8rem;
      }

      .refreshing-badge {
        font-size: 0.75rem;
        background: #e1f5fe;
        color: #0288d1;
        padding: 0.25rem 0.75rem;
        border-radius: 20px;
        font-weight: 700;
        display: flex;
        align-items: center;
        gap: 0.4rem;
        border: 1px solid #b3e5fc;
      }
    }

    p {
      color: #7f8c8d;
      margin: 0;
      font-size: 0.9rem;
    }
  }

  .header-actions {
    display: flex;
    gap: 0.75rem;
    width: 100%;

    @media (min-width: 768px) {
      width: auto;
    }

    button {
      flex: 1;
      background: white;
      border: 1px solid #e1e8ed;
      padding: 0.75rem 1rem;
      border-radius: 12px;
      font-weight: 700;
      font-size: 0.85rem;
      color: #2c3e50;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      transition: all 0.2s;
      white-space: nowrap;

      @media (min-width: 768px) {
        flex: none;
        padding: 0.6rem 1.2rem;
        border-radius: 8px;
        font-size: 0.9rem;
      }

      &:hover {
        background: #f8fafc;
        border-color: #cbd5e1;
        transform: translateY(-1px);
      }

      i {
        font-size: 1rem;
      }

      &.btn-history.active {
        background: #2c3e50;
        color: white;
        border-color: #2c3e50;
      }

      &.btn-refresh {
        color: $color-info;
        border-color: rgba($color-info, 0.3);

        &:hover {
          background: rgba($color-info, 0.05);
          border-color: $color-info;
        }
      }
    }
  }
}

.content-wrapper {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
}

.list-section {
  margin-bottom: 3rem;

  &.delayed .section-title h2 {
    color: $color-delayed;
  }

  &.today .section-title h2 {
    color: $color-urgent;
  }

  &.tomorrow .section-title h2 {
    color: $color-warning;
  }

  &.future .section-title h2 {
    color: $color-info;
  }
}

.section-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #e1e8ed;

  h2 {
    font-size: 1.2rem;
    font-weight: 800;
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 1px;
    display: flex;
    align-items: center;
    gap: 0.8rem;

    i {
      font-size: 1.4rem;
    }
  }

  .count-badge {
    background: #e1e8ed;
    color: #7f8c8d;
    padding: 0.3rem 0.8rem;
    border-radius: 20px;
    font-size: 0.85rem;
    font-weight: 600;
  }
}

.section-divider {
  border: 0;
  height: 1px;
  background: #e1e8ed;
  margin: 2rem 0;
}

.loading-state,
.error-msg,
.empty-state {
  padding: 4rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  color: #7f8c8d;

  .loader {
    width: 32px;
    height: 32px;
    border: 4px solid #f3f3f3;
    border-top: 4px solid #3498db;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  button {
    background: #3498db;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    cursor: pointer;
  }

  i {
    font-size: 3rem;
    margin-bottom: 1rem;
    color: #bdc3c7;
  }
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
  backdrop-filter: blur(3px);

  .modal-content {
    background: white;
    padding: 2rem;
    border-radius: 16px;
    width: 90%;
    max-width: 450px;
    box-shadow: 0 15px 35px rgba(0, 0, 0, 0.2);
    text-align: center;
    position: relative; // For internal overlay
    overflow: hidden;

    &.danger {
      border-top: 5px solid $color-urgent;
    }

    .modal-header {
      margin-bottom: 1.5rem;

      i {
        font-size: 3rem;
        color: $color-urgent;
        margin-bottom: 0.5rem;
      }

      h2 {
        margin: 0;
        color: #2c3e50;
      }
    }

    .input-group {
      margin: 1.5rem 0;
      text-align: left;

      label {
        display: block;
        margin-bottom: 0.5rem;
        font-weight: 600;
        color: #7f8c8d;
        font-size: 0.9rem;
      }

      .confirm-input {
        width: 100%;
        padding: 0.8rem;
        border: 2px solid #e0e0e0;
        border-radius: 8px;
        font-size: 1rem;
        outline: none;

        &:focus {
          border-color: $color-urgent;
        }

        &:disabled {
          background: #f8f9fa;
          cursor: not-allowed;
        }
      }
    }

    .modal-actions {
      display: flex;
      gap: 1rem;
      justify-content: flex-end;
      margin-top: 2rem;

      button {
        padding: 0.8rem 1.2rem;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        border: none;
        transition: all 0.2s;

        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      }

      .btn-cancel {
        background: #f1f2f6;
        color: #7f8c8d;

        &:hover:not(:disabled) {
          background: #e1e2e6;
        }
      }

      .btn-confirm-void {
        background: $color-urgent;
        color: white;
        display: flex;
        align-items: center;
        gap: 0.5rem;

        &:not(:disabled):hover {
          background: #c0392b;
          transform: translateY(-1px);
        }
      }
    }

    /* Internal Modal Overlay */
    .modal-processing-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(255, 255, 255, 0.95);
      z-index: 10;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;

      .processing-loader {
        width: 40px;
        height: 40px;
        border: 4px solid #f3f3f3;
        border-top: 4px solid $color-urgent;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-bottom: 1rem;
      }

      p {
        font-size: 1.1rem;
        font-weight: 700;
        color: #2c3e50;
      }
    }
  }
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.4s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Modal Transitions */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.3s ease;

  .modal-content {
    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;

  .modal-content {
    transform: scale(0.9) translateY(20px);
  }
}
</style>
