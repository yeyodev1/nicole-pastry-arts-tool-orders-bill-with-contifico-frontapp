<script setup lang="ts">
import { ref, onMounted } from 'vue'
import ProductionService from '@/services/production.service'

/**
 * PRODUCTION HISTORY PANEL
 * 
 * Displays strict list of items completed TODAY.
 * Allows reverting items to production in case of error.
 */

interface HistoryItem {
  _id: string
  totalQuantity: number
  urgency: string
  orders: {
    id: string
  }[]
}

import { useToast } from '@/composables/useToast'

const emit = defineEmits(['close'])
const { success, error: showError } = useToast()

const isLoading = ref(true)
const historyItems = ref<HistoryItem[]>([])
const error = ref('')
const filterMode = ref<'FINISHED' | 'VOID'>('FINISHED')

// Confirmation Modal State
const isConfirmModalOpen = ref(false)
const isProcessingRevert = ref(false)
const itemToRevert = ref<HistoryItem | null>(null)

const fetchHistory = async () => {
  try {
    isLoading.value = true
    error.value = ''
    const allOrders = await ProductionService.getAllOrders()

    // Filter: Finished/Void AND Updated Today (Strict Local)
    const todayStr = new Date().toISOString().split('T')[0] || ''

    const filteredOrders = allOrders.filter(o =>
      o.productionStage === filterMode.value &&
      o.updatedAt &&
      o.updatedAt.startsWith(todayStr)
    )

    // Group by Product Name
    const groupedMap = new Map<string, { total: number, ids: string[], lastUpdate: string }>()

    filteredOrders.forEach(o => {
      o.products.forEach(p => {
        const key = p.name
        if (!groupedMap.has(key)) {
          groupedMap.set(key, { total: 0, ids: [], lastUpdate: o.updatedAt })
        }
        const entry = groupedMap.get(key)!
        entry.total += p.quantity

        // Track unique Order IDs for this product to enable Revert
        if (!entry.ids.includes(o._id)) {
          entry.ids.push(o._id)
        }
      })
    })

    const results: HistoryItem[] = []
    groupedMap.forEach((val, key) => {
      results.push({
        _id: key,
        totalQuantity: val.total,
        urgency: val.lastUpdate,
        orders: val.ids.map(id => ({ id }))
      })
    })

    // Sort by most recent
    results.sort((a, b) => new Date(b.urgency).getTime() - new Date(a.urgency).getTime())

    historyItems.value = results

  } catch (err) {
    console.error(err)
    error.value = 'Error al cargar el historial.'
  } finally {
    isLoading.value = false
  }
}

const setFilter = (mode: 'FINISHED' | 'VOID') => {
  filterMode.value = mode
  fetchHistory()
}

const openConfirmModal = (item: HistoryItem) => {
  itemToRevert.value = item
  isConfirmModalOpen.value = true
}

const closeConfirmModal = () => {
  if (isProcessingRevert.value) return
  isConfirmModalOpen.value = false
  itemToRevert.value = null
}

const handleRevertAction = async () => {
  if (!itemToRevert.value || isProcessingRevert.value) return

  try {
    isProcessingRevert.value = true
    const idsToRevert = itemToRevert.value.orders.map(o => o.id)
    if (idsToRevert.length === 0) {
      closeConfirmModal()
      return
    }

    if (filterMode.value === 'VOID') {
      // Use strict restore endpoint for voided items
      const restorePromises = idsToRevert.map(id => ProductionService.restoreOrder(id))
      await Promise.all(restorePromises)
    } else {
      // Use individual updates instead of batchUpdate (more consistent with Dashboard logic)
      const revertPromises = idsToRevert.map(id =>
        ProductionService.updateTask(id, { stage: 'PENDING' })
      )
      await Promise.all(revertPromises)
    }

    success(filterMode.value === 'VOID' ? 'Item restaurado exitosamente.' : 'Item devuelto a producción.')
    isConfirmModalOpen.value = false
    await fetchHistory()

  } catch (err) {
    console.error(err)
    showError('Error al procesar la solicitud. Reintente.')
  } finally {
    isProcessingRevert.value = false
  }
}

const canRevert = (item: HistoryItem): boolean => {
  if (filterMode.value === 'FINISHED') return true
  if (filterMode.value === 'VOID') {
    const voidTime = new Date(item.urgency).getTime()
    const now = new Date().getTime()
    const diffHours = (now - voidTime) / (1000 * 60 * 60)
    return diffHours < 1
  }
  return false
}

onMounted(() => {
  fetchHistory()
})
</script>

<template>
  <div class="history-panel">
      <div class="panel-header">
          <div class="title-group">
                <div class="toggle-group">
                    <button :class="{ active: filterMode === 'FINISHED' }" @click="setFilter('FINISHED')">
                        <i class="fas fa-check-circle"></i> Completados
                    </button>
                    <button :class="{ active: filterMode === 'VOID' }" @click="setFilter('VOID')">
                        <i class="fas fa-ban"></i> Anulados
                    </button>
                </div>
               <span class="subtitle">Items {{ filterMode === 'FINISHED' ? 'completados' : 'anulados' }} hoy</span>
          </div>
          <button class="btn-close" @click="emit('close')">
              <i class="fas fa-times"></i> Cerrar
          </button>
      </div>

      <div v-if="isLoading" class="state-msg">
          <div class="loader"></div>
          <span>Cargando historial...</span>
      </div>

      <div v-else-if="error" class="state-msg error">
          <i class="fas fa-exclamation-circle"></i>
          {{ error }}
      </div>

      <div v-else-if="historyItems.length === 0" class="state-msg empty">
          <div class="icon-box"><i class="fas fa-clipboard-check"></i></div>
          <p>No hay producción finalizada hoy.</p>
          <span>Los items marcados como completos aparecerán aquí.</span>
      </div>

      <div v-else class="history-list">
           <div v-for="item in historyItems" :key="item._id" class="history-card">
               
               <div class="card-left">
                   <div class="status-icon" :class="{ 'void': filterMode === 'VOID' }">
                       <i class="fas" :class="filterMode === 'FINISHED' ? 'fa-check' : 'fa-ban'"></i>
                   </div>
                   <div class="info">
                       <h3 class="product-name">{{ item._id }}</h3>
                       <div class="meta">
                           <span class="time">
                               <i class="far fa-clock"></i> 
                               {{ new Date(item.urgency).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}
                           </span>
                           <span class="qty-badge">{{ item.totalQuantity }} unids.</span>
                       </div>
                   </div>
               </div>

               <div class="card-right">
                   <button 
                    class="btn-revert" 
                    @click="openConfirmModal(item)" 
                    :disabled="!canRevert(item)"
                    :title="filterMode === 'VOID' ? 'Restaurar Orden' : 'Devolver a Producción'"
                   >
                       <i class="fas fa-undo-alt"></i>
                       <span>{{ filterMode === 'VOID' ? 'Restaurar' : 'Devolver' }}</span>
                   </button>
               </div>
           </div>
      </div>

      <!-- Custom Confirmation Modal -->
      <Transition name="modal-fade">
        <div v-if="isConfirmModalOpen" class="modal-overlay">
            <div class="modal-content" :class="{ 'danger-top': filterMode === 'VOID', 'success-top': filterMode === 'FINISHED' }">
                <div class="modal-header">
                    <i class="fas" :class="filterMode === 'FINISHED' ? 'fa-undo-alt' : 'fa-history'"></i>
                    <h2>Confirma Acción</h2>
                </div>

                <div class="modal-body" v-if="itemToRevert">
                    <p>
                        ¿Estás seguro de 
                        <strong>{{ filterMode === 'FINISHED' ? 'devolver a producción' : 'restaurar' }}</strong> 
                        el item:
                    </p>
                    <div class="target-item-info">
                        <strong>{{ itemToRevert._id }}</strong>
                        <span>{{ itemToRevert.totalQuantity }} unidades</span>
                    </div>
                    <p class="warning-text" v-if="filterMode === 'FINISHED'">
                        El item volverá a aparecer en el tablero principal como pendiente.
                    </p>
                </div>

                <div class="modal-actions">
                    <button class="btn-cancel" @click="closeConfirmModal" :disabled="isProcessingRevert">
                        Cancelar
                    </button>
                    <button 
                        class="btn-confirm" 
                        :class="{ 'btn-revert-action': filterMode === 'FINISHED', 'btn-restore-action': filterMode === 'VOID' }" 
                        @click="handleRevertAction" 
                        :disabled="isProcessingRevert"
                    >
                        <i class="fas" :class="isProcessingRevert ? 'fa-spinner fa-spin' : 'fa-check'"></i>
                        {{ isProcessingRevert ? 'Procesando...' : 'Sí, confirmar' }}
                    </button>
                </div>
            </div>
        </div>
      </Transition>
  </div>
</template>

<style lang="scss" scoped>
$color-success: #2ecc71;
$color-text: #2c3e50;
$color-sub: #7f8c8d;
$color-bg: #f8f9fa;
$color-danger: #e74c3c;

.history-panel {
  background: white;
  border-radius: 20px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);
  padding: 2rem;
  max-width: 800px;
  margin: 0 auto;
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  border-bottom: 1px solid #f1f2f6;
  padding-bottom: 1rem;

  .title-group {
    .toggle-group {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
      background: #f1f2f6;
      padding: 4px;
      border-radius: 12px;
      display: inline-flex;

      button {
        border: none;
        background: transparent;
        padding: 8px 16px;
        border-radius: 8px;
        font-weight: 700;
        color: #95a5a6;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 6px;

        &.active {
          background: white;
          color: $color-text;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);

          i {
            color: $color-success;
          }
        }

        &:last-child.active i {
          color: $color-danger;
        }
      }
    }

    .subtitle {
      display: block;
      margin-top: 4px;
      color: $color-sub;
      font-size: 0.9rem;
    }
  }

  .btn-close {
    background: $color-bg;
    border: none;
    padding: 0.6rem 1.2rem;
    border-radius: 30px;
    color: $color-sub;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 0.5rem;

    &:hover {
      background: #e0e0e0;
      color: $color-text;
    }
  }
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-height: 600px;
  overflow-y: auto;
  padding-right: 0.5rem;
}

.history-card {
  background: white;
  border: 1px solid #f1f2f6;
  border-radius: 16px;
  padding: 1.2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.06);
    border-color: #e1e2e6;
  }

  .card-left {
    display: flex;
    align-items: center;
    gap: 1.2rem;

    .status-icon {
      width: 42px;
      height: 42px;
      background: linear-gradient(135deg, $color-success, #27ae60);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 1.1rem;
      box-shadow: 0 4px 10px rgba(46, 204, 113, 0.3);

      &.void {
        background: linear-gradient(135deg, $color-danger, #c0392b);
        box-shadow: 0 4px 10px rgba(231, 76, 60, 0.3);
      }
    }

    .info {
      .product-name {
        margin: 0;
        font-size: 1.1rem;
        font-weight: 700;
        color: $color-text;
      }

      .meta {
        display: flex;
        gap: 1rem;
        margin-top: 0.3rem;
        align-items: center;

        .time {
          font-size: 0.85rem;
          color: $color-sub;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .qty-badge {
          background: #eafaf1;
          color: $color-success;
          font-size: 0.8rem;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 6px;
        }
      }
    }
  }

  .card-right {
    .btn-revert {
      background: transparent;
      border: 1px solid #ffecec;
      color: $color-danger;
      padding: 0.5rem 1rem;
      border-radius: 10px;
      cursor: pointer;
      font-size: 0.9rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      transition: all 0.2s;

      &:hover:not(:disabled) {
        background: #fff5f5;
        border-color: $color-danger;
        transform: translateX(-2px);
      }

      &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
        filter: grayscale(1);
      }
    }
  }
}

.state-msg {
  text-align: center;
  padding: 3rem;
  color: $color-sub;

  &.empty {
    .icon-box {
      font-size: 3rem;
      color: #dcdde1;
      margin-bottom: 1rem;
    }

    p {
      font-size: 1.1rem;
      font-weight: 600;
    }
  }

  .loader {
    width: 30px;
    height: 30px;
    border: 3px solid #f3f3f3;
    border-top: 3px solid $color-success;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem;
  }
}

/* Custom Modal Styles */
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
  z-index: 10000;
  backdrop-filter: blur(4px);
  padding: 1rem;
}

.modal-content {
  background: white;
  border-radius: 20px;
  width: 100%;
  max-width: 400px;
  padding: 2rem;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2);
  text-align: center;
  border-top: 6px solid #f1f2f6;

  &.success-top {
    border-top-color: $color-success;
  }

  &.danger-top {
    border-top-color: $color-danger;
  }

  .modal-header {
    margin-bottom: 1.5rem;

    i {
      font-size: 2.5rem;
      color: $color-sub;
      margin-bottom: 0.8rem;
    }

    h2 {
      margin: 0;
      font-size: 1.4rem;
      color: $color-text;
    }
  }

  .modal-body {
    margin-bottom: 2rem;

    p {
      color: $color-sub;
      font-size: 0.95rem;
      margin-bottom: 1rem;
    }

    .target-item-info {
      background: $color-bg;
      padding: 1rem;
      border-radius: 12px;
      margin: 1rem 0;
      display: flex;
      flex-direction: column;
      gap: 4px;

      strong {
        color: $color-text;
        font-size: 1.1rem;
      }

      span {
        color: $color-sub;
        font-size: 0.85rem;
        font-weight: 600;
      }
    }

    .warning-text {
      font-size: 0.8rem;
      color: $color-danger;
      font-weight: 600;
      font-style: italic;
    }
  }

  .modal-actions {
    display: flex;
    gap: 1rem;
    justify-content: center;

    button {
      padding: 0.8rem 1.5rem;
      border-radius: 12px;
      font-weight: 700;
      font-size: 0.9rem;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 8px;

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }

    .btn-cancel {
      background: #f1f2f6;
      color: $color-sub;

      &:hover:not(:disabled) {
        background: #e0e0e0;
      }
    }

    .btn-confirm {
      color: white;

      &.btn-revert-action {
        background: $color-success;

        &:hover:not(:disabled) {
          background: #27ae60;
        }
      }

      &.btn-restore-action {
        background: $color-danger;

        &:hover:not(:disabled) {
          background: #c0392b;
        }
      }
    }
  }
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

@keyframes spin {
  100% {
    transform: rotate(360deg);
  }
}
</style>
