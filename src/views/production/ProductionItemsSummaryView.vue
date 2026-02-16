<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import ProductionService from '@/services/production.service'
import ProductionCategoryGroup from './components/ProductionCategoryGroup.vue'
import ProductionHistoryPanel from './components/ProductionHistoryPanel.vue'
import ExportProductionModal from '../orders/components/ExportProductionModal.vue'
import { useProductionSummary } from '@/composables/useProductionSummary'
import { useOrderExport } from '@/composables/useOrderExport'
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
  showHistory,
  isBackgroundLoading,
  selectedItemIds,
  toggleSelection,
  clearSelection,
  batchRegister,
  isRawMode,
  rawBucketFilter,
  rawFilteredOrders,
  rawStatsByDestination,
  selectedRawProducts,
  toggleRawProductSelection,
  clearRawSelection,
  rawOrders
} = useProductionSummary()

import { useToast } from '@/composables/useToast'
import ActionHoldButton from '@/components/common/ActionHoldButton.vue'

const { isExporting, exportDispatchOrder, exportProductionOrder } = useOrderExport()
const showExportModal = ref(false)
const exportMode = ref<'dispatch' | 'production'>('dispatch')

const { success, error: showError } = useToast()

const isBatchModalOpen = ref(false)

const openBatchModal = () => {
  isBatchModalOpen.value = true
}

const handleBatchConfirm = async () => {
  try {
    await batchRegister()
    success('Lote producido exitosamente')
    isBatchModalOpen.value = false
  } catch (err) {
    showError('Falló el proceso por lote')
  }
}

// ... existing code ...
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

const handleRawToggle = () => {
  isRawMode.value = !isRawMode.value
  fetchSummary()
}

const handleExportClick = (mode: 'dispatch' | 'production') => {
  exportMode.value = mode
  showExportModal.value = true
}

const exportSingleItem = (productName: string) => {
  // Select ONLY this product and trigger production export
  clearRawSelection()
  toggleRawProductSelection(productName)
  handleExportClick('production')
}

const handleExportProduction = async (responsibleName: string) => {
  try {
    // 1. Get selected products
    const selectedProducts = Array.from(selectedRawProducts.value)

    // 2. Determine orders to export (always filtered by the active bucket/pills)
    let ordersToExport: any[] = []

    if (selectedProducts.length === 0) {
      // DEFAULT: Export everything in the current bucket
      ordersToExport = rawFilteredOrders.value
    } else {
      // CUSTOM: Export only orders containing the selected products, 
      // but still only within the active bucket
      ordersToExport = rawFilteredOrders.value.filter((order: any) => {
        return order.products.some((p: any) => selectedProducts.includes(p.name))
      }).map((order: any) => {
        return {
          ...order,
          products: order.products.filter((p: any) => selectedProducts.includes(p.name))
        }
      })
    }

    if (ordersToExport.length === 0) {
      showError('No hay órdenes para exportar en este periodo')
      return
    }

    // 3. Export based on mode
    if (exportMode.value === 'dispatch') {
      await exportDispatchOrder(ordersToExport)
    } else {
      await exportProductionOrder(ordersToExport, responsibleName)
    }

    success('Orden de Producción exportada exitosamente')
    showExportModal.value = false
    clearRawSelection()
  } catch (err) {
    console.error(err)
    showError('Error al exportar orden de producción')
  }
}

onMounted(async () => {
  const route = useRoute()
  if (route.query.mode === 'raw') {
    isRawMode.value = true
  }
  await fetchSummary()
})
</script>

<template>
  <div class="summary-view" :class="{ 'has-selection': selectedItemIds.size > 0 }">
    <div class="header-section">
      <div class="header-content">
        <h1>
          Resumen de Producción
          <span v-if="isRefreshing || isBackgroundLoading" class="refreshing-badge">
            <i class="fas fa-sync-alt fa-spin"></i>
            {{ isBackgroundLoading ? 'Cargando futuro...' : 'Actualizando...' }}
          </span>
        </h1>
        <p>Control de items pendientes y registro de progreso</p>
      </div>
      <div class="header-actions">
        <button class="btn-history" @click="toggleHistoryPanel" :class="{ active: showHistory }">
          <i class="fas" :class="showHistory ? 'fa-arrow-left' : 'fa-history'"></i>
          {{ showHistory ? 'Volver' : 'Ver Completados' }}
        </button>
        <button v-if="!showHistory" class="btn-raw" @click="handleRawToggle" :class="{ active: isRawMode }">
          <i class="fas fa-eye"></i>
          {{ isRawMode ? 'Vista Normal' : 'Ver Crudo' }}
        </button>
        <button class="btn-refresh" @click="fetchSummary(false)" :disabled="isLoading || isBackgroundLoading" v-if="!showHistory">
          <i class="fas fa-sync-alt" :class="{ 'fa-spin': isLoading || isBackgroundLoading }"></i>
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

      <!-- Raw Mode View -->
      <div v-if="isRawMode" class="raw-mode-container">
        <div class="raw-header">
          <div class="raw-info-bar">
            <i class="fas fa-info-circle"></i>
            <span>Mostrando totales "en crudo" (incluye producidos). Acciones deshabilitadas.</span>
          </div>

          <!-- Raw Filter Bar -->
          <div class="raw-actions-row">
            <div class="raw-filter-pills">
              <button 
                v-for="bucket in ['delayed', 'today', 'tomorrow', 'future', 'all']" 
                :key="bucket"
                class="raw-pill"
                :class="{ active: rawBucketFilter === bucket, [bucket]: true }"
                @click="rawBucketFilter = bucket as any"
              >
                <i v-if="bucket === 'delayed'" class="fas fa-clock"></i>
                <i v-else-if="bucket === 'today'" class="fas fa-calendar-day"></i>
                <i v-else-if="bucket === 'tomorrow'" class="fas fa-sun"></i>
                <i v-else-if="bucket === 'future'" class="fas fa-calendar-alt"></i>
                <i v-else class="fas fa-layer-group"></i>
                {{ bucket === 'delayed' ? 'Atrasados' : bucket === 'today' ? 'Hoy' : bucket === 'tomorrow' ? 'Mañana' : bucket === 'future' ? 'Futuro' : 'Todos' }}
              </button>
            </div>

            <div class="raw-export-actions" v-if="rawOrders.length > 0">
               <button 
                class="btn-export-prod delivery" 
                :disabled="isExporting"
                @click="handleExportClick('dispatch')"
               >
                 <i class="fas" :class="isExporting && exportMode === 'dispatch' ? 'fa-spinner fa-spin' : 'fa-truck-loading'"></i>
                 {{ selectedRawProducts.size > 0 ? `Entrega Seleccionados (${selectedRawProducts.size})` : 'Orden de Entrega' }}
               </button>
               <button 
                class="btn-export-prod production" 
                :disabled="isExporting"
                @click="handleExportClick('production')"
               >
                 <i class="fas" :class="isExporting && exportMode === 'production' ? 'fa-spinner fa-spin' : 'fa-bread-slice'"></i>
                 {{ selectedRawProducts.size > 0 ? `Producción Seleccionados (${selectedRawProducts.size})` : 'Orden de Producción' }}
               </button>
            </div>
          </div>
        </div>

        <div class="destination-grid">
          <div v-for="(products, destination) in rawStatsByDestination" :key="destination" class="destination-card">
            <div class="dest-title">
              <div class="dest-icon-box">
                <i v-if="destination === 'San Marino'" class="fas fa-store"></i>
                <i v-else-if="destination === 'Mall del Sol'" class="fas fa-shopping-bag"></i>
                <i v-else-if="destination === 'Centro Prod.'" class="fas fa-industry"></i>
                <i v-else-if="destination === 'Delivery'" class="fas fa-motorcycle"></i>
                <i v-else class="fas fa-map-marker-alt"></i>
              </div>
              <div class="dest-info">
                <h3>{{ destination }}</h3>
                <span class="dest-total">{{Object.values(products).reduce((a, b) => a + b, 0)}} unids</span>
              </div>
            </div>
            <div class="dest-table-container">
              <table class="raw-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th class="col-qty">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr 
                    v-for="(qty, productName) in products" 
                    :key="productName"
                    class="raw-row"
                    :class="{ selected: selectedRawProducts.has(productName) }"
                    @click="toggleRawProductSelection(productName)"
                  >
                    <td class="col-check">
                      <div class="custom-checkbox" :class="{ checked: selectedRawProducts.has(productName) }">
                        <i v-if="selectedRawProducts.has(productName)" class="fas fa-check"></i>
                      </div>
                    </td>
                    <td>{{ productName }}</td>
                    <td class="col-qty">
                      <strong>{{ qty }}</strong>
                      <button class="btn-item-export" @click.stop="exportSingleItem(productName)" title="Exportar Producción de este item">
                        <i class="fas fa-file-export"></i>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div v-if="Object.keys(rawStatsByDestination).length === 0" class="empty-raw">
          <i class="fas fa-folder-open"></i>
          <p>No hay items registrados para este periodo en modo crudo.</p>
        </div>
      </div>

      <!-- Normal View -->
      <template v-else>
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
              :selected-ids="selectedItemIds"
              @toggle-category="toggleCategory"
              @toggle-item="toggleExpand"
              @register-item="handleRegisterItem"
              @void-item="openVoidModal"
              @toggle-selection="toggleSelection"
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
      </template>

    </div>

    <!-- Floating Action Bar for Batch Selection -->
    <Transition name="slide-up">
        <div v-if="selectedItemIds.size > 0" class="floating-batch-bar">
            <div class="batch-info">
                <span class="count">{{ selectedItemIds.size }}</span>
                <span class="label">items seleccionados</span>
            </div>
            <div class="batch-actions">
                <button class="btn-clear" @click="clearSelection">Cancelar</button>
                <button class="btn-process" @click="openBatchModal">
                    PROCESAR LOTE
                    <i class="fas fa-arrow-right"></i>
                </button>
            </div>
        </div>
    </Transition>

    <!-- Batch Confirmation Modal -->
    <Transition name="modal-fade">
        <div v-if="isBatchModalOpen" class="modal-overlay">
            <div class="modal-content batch-modal">
                <div class="modal-header">
                    <i class="fas fa-layer-group"></i>
                    <h2>Confirmar Producción Masiva</h2>
                </div>
                
                <p>
                    Vas a marcar como <strong>TERMINADOS</strong> {{ selectedItemIds.size }} items.
                    <br>
                    <small>Se registrará la cantidad total pendiente para cada uno.</small>
                </p>

                <div class="batch-summary">
                    <ul>
                       <li v-for="id in Array.from(selectedItemIds).slice(0, 5)" :key="id">
                           {{ id }}
                       </li>
                       <li v-if="selectedItemIds.size > 5">... y {{ selectedItemIds.size - 5 }} más</li>
                    </ul>
                </div>
        
                <div class="modal-actions centered">
                    <button class="btn-cancel" @click="isBatchModalOpen = false">Cancelar</button>
                    
                    <div class="hold-wrapper">
                         <ActionHoldButton 
                            label="MANTENER 2S PARA CONFIRMAR"
                            :duration="2000"
                            color="#2ecc71"
                            @trigger="handleBatchConfirm"
                         />
                    </div>
                </div>
            </div>
        </div>
    </Transition>

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

    <!-- Selection Tooltip / Float Bar for Raw -->
    <Transition name="slide-up">
      <div v-if="isRawMode && selectedRawProducts.size > 0" class="floating-batch-bar raw">
        <div class="batch-info">
          <span class="count">{{ selectedRawProducts.size }}</span>
          <span class="label">Productos seleccionados</span>
        </div>
        <div class="batch-actions">
          <button class="btn-clear" @click="clearRawSelection">Deseleccionar</button>
          <button class="btn-process delivery" @click="handleExportClick('dispatch')" :disabled="isExporting">
            <i class="fas fa-truck-loading"></i>
            Entrega
          </button>
          <button class="btn-process production" @click="handleExportClick('production')" :disabled="isExporting">
            <i class="fas fa-bread-slice"></i>
            Producción
          </button>
        </div>
      </div>
    </Transition>

    <ExportProductionModal 
      :is-open="showExportModal"
      :is-loading="isExporting"
      @close="showExportModal = false"
      @confirm="handleExportProduction"
    />

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

  &.has-selection {
    padding-bottom: 7rem; // Extra space for FAB
  }
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
    flex-direction: column;
    gap: 0.75rem;
    width: 100%;

    @media (min-width: 768px) {
      flex-direction: row;
      width: auto;
    }

    button {
      width: 100%;
      background: white;
      border: 1px solid #e1e8ed;
      padding: 0.85rem 1.25rem;
      border-radius: 12px;
      font-weight: 700;
      font-size: 0.9rem;
      color: #2c3e50;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.6rem;
      transition: all 0.2s;
      white-space: nowrap;

      @media (min-width: 768px) {
        width: auto;
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

      &.btn-raw {
        color: $color-delayed;
        border-color: rgba($color-delayed, 0.3);

        &.active {
          background: $color-delayed;
          color: white;
          border-color: $color-delayed;
        }

        &:hover:not(.active) {
          background: rgba($color-delayed, 0.05);
          border-color: $color-delayed;
        }
      }
    }
  }
}

.raw-mode-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  margin-bottom: 2rem;

  .raw-header {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    margin-bottom: 2rem;

    .raw-info-bar {
      background: #fff8e1;
      border-left: 4px solid #ffc107;
      color: #856404;
      padding: 1rem 1.25rem;
      border-radius: 12px;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-size: 0.95rem;
      font-weight: 600;
    }

    .raw-filter-pills {
      display: flex;
      gap: 0.5rem;
      overflow-x: auto;
      padding: 0.5rem;
      background: white;
      border-radius: 16px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.03);
      border: 1px solid #f1f2f6;
      -webkit-overflow-scrolling: touch;
      margin-bottom: 0.5rem;
      width: 100%;

      &::-webkit-scrollbar {
        display: none;
      }

      -ms-overflow-style: none;
      scrollbar-width: none;

      .raw-pill {
        flex-shrink: 0;
        background: transparent;
        border: 1px solid #f1f2f6;
        color: #64748b;
        padding: 0.6rem 1.25rem;
        border-radius: 12px;
        font-size: 0.9rem;
        font-weight: 700;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

        &:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
        }

        &.active {
          color: white;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          transform: translateY(-1px);

          &.delayed {
            background: $color-delayed;
            border-color: $color-delayed;
          }

          &.today {
            background: $color-urgent;
            border-color: $color-urgent;
          }

          &.tomorrow {
            background: $color-warning;
            border-color: $color-warning;
          }

          &.future {
            background: $color-info;
            border-color: $color-info;
          }

          &.all {
            background: #64748b;
            border-color: #64748b;
          }
        }
      }

      @media (min-width: 1024px) {
        flex-wrap: wrap;
        width: auto;
        margin-bottom: 0;
      }
    }
  }

  .raw-actions-row {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-top: 1.5rem;

    .raw-export-actions {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      width: 100%;

      .btn-export-prod {
        width: 100%;
        justify-content: center;
        background: #8e44ad;
        color: white;
        border: none;
        padding: 0.75rem 1.25rem;
        border-radius: 12px;
        font-weight: 700;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        transition: all 0.2s;
        box-shadow: 0 4px 12px rgba(142, 68, 173, 0.25);

        &.delivery {
          background: #3498db;
          box-shadow: 0 4px 12px rgba(52, 152, 219, 0.25);

          &:hover:not(:disabled) {
            background: darken(#3498db, 5%);
          }
        }

        &.production {
          background: #e67e22;
          box-shadow: 0 4px 12px rgba(230, 126, 34, 0.25);

          &:hover:not(:disabled) {
            background: darken(#e67e22, 5%);
          }
        }

        &:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 15px rgba(0, 0, 0, 0.15);
        }

        &:disabled {
          background: #cbd5e1;
          box-shadow: none;
          cursor: not-allowed;
          color: #94a3b8;
        }
      }
    }

    @media (min-width: 1024px) {
      flex-direction: row;
      justify-content: space-between;
      align-items: center;

      .raw-export-actions {
        flex-direction: row;
        width: auto;

        .btn-export-prod {
          width: auto;
        }
      }
    }
  }

  .raw-row {
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: #f8fafc !important;
    }

    &.selected {
      background: rgba(142, 68, 173, 0.05) !important;

      td {
        color: #8e44ad !important;
        font-weight: 700;
      }
    }

    .col-check {
      width: 40px;
      padding-right: 0;
    }

    .custom-checkbox {
      width: 20px;
      height: 20px;
      border: 2px solid #cbd5e1;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      background: white;

      i {
        font-size: 0.8rem;
        color: white;
      }

      &.checked {
        background: #8e44ad;
        border-color: #8e44ad;
      }
    }

    .col-qty {
      width: 100px;
      text-align: right;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.75rem;

      .btn-item-export {
        background: #f1f5f9;
        border: 1px solid #e2e8f0;
        color: #64748b;
        width: 32px;
        height: 32px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s;

        &:hover {
          background: #e2e8f0;
          color: #e67e22;
          border-color: #e67e22;
        }
      }
    }
  }
}

.destination-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;

  @media (min-width: 768px) {
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 1.5rem;
  }
}

.destination-card {
  background: white;
  border-radius: 20px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.04);
  overflow: hidden;
  border: 1px solid #f1f2f6;
  transition: transform 0.2s, box-shadow 0.2s;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 15px 35px rgba(0, 0, 0, 0.08);
  }

  .dest-title {
    background: #fcfcfc;
    padding: 1.25rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    border-bottom: 2px solid #f8f9fa;

    .dest-icon-box {
      width: 48px;
      height: 48px;
      border-radius: 14px;
      background: #f1f5f9;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.4rem;
      color: $color-info;
    }

    .dest-info {
      flex: 1;

      h3 {
        margin: 0;
        font-size: 1.1rem;
        font-weight: 800;
        color: #1e293b;
      }

      .dest-total {
        font-size: 0.8rem;
        color: #94a3b8;
        font-weight: 600;
        text-transform: uppercase;
      }
    }
  }

  .dest-table-container {
    padding: 1rem;
  }

  .raw-table {
    width: 100%;
    border-collapse: collapse;

    th {
      padding: 0.5rem 0.75rem 1rem;
      font-size: 0.75rem;
      text-transform: uppercase;
      color: #94a3b8;
      font-weight: 700;
      letter-spacing: 0.05em;
      border-bottom: 1px solid #f1f5f9;
    }

    td {
      padding: 1rem 0.75rem;
      font-size: 0.95rem;
      color: #334155;
      border-bottom: 1px solid #f8fafc;
      font-weight: 500;
    }

    .col-qty {
      text-align: right;
      width: 100px;

      strong {
        color: $color-info;
        font-weight: 800;
        font-size: 1.1rem;
      }
    }

    tr:last-child td {
      border-bottom: none;
    }

    tr:hover td {
      background: #fdfdfd;
    }
  }
}

.empty-raw {
  padding: 6rem 2rem;
  text-align: center;
  color: #cbd5e1;

  i {
    font-size: 4rem;
    margin-bottom: 1.5rem;
    opacity: 0.3;
  }

  p {
    font-size: 1.1rem;
    font-weight: 600;
  }
}

.floating-batch-bar.raw {
  background: #47195c;
  border-top: 2px solid #8e44ad;

  .count {
    background: #8e44ad;
  }

  .btn-process {
    background: #8e44ad;
    color: white;

    i {
      color: white;
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

.floating-batch-bar {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  width: 90%;
  max-width: 600px;
  background: #1e293b;
  color: white;
  padding: 1rem 1.5rem;
  border-radius: 16px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 1000;

  .batch-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;

    .count {
      background: $color-info;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 0.9rem;
    }

    .label {
      font-weight: 600;
    }
  }

  .batch-actions {
    display: flex;
    gap: 1rem;

    .btn-clear {
      background: transparent;
      border: 1px solid rgba(255, 255, 255, 0.3);
      color: white;
      padding: 0.5rem 1rem;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;

      &:hover {
        background: rgba(255, 255, 255, 0.1);
      }
    }

    .btn-process {
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 12px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      transition: all 0.2s;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);

      &.delivery {
        background: #3498db;
        color: white;

        &:hover:not(:disabled) {
          background: darken(#3498db, 5%);
          transform: translateY(-2px);
        }
      }

      &.production {
        background: #e67e22;
        color: white;

        &:hover:not(:disabled) {
          background: darken(#e67e22, 5%);
          transform: translateY(-2px);
        }
      }

      &:disabled {
        background: #cbd5e1;
        color: #94a3b8;
        cursor: not-allowed;
        box-shadow: none;
      }
    }
  }
}

.batch-modal {
  .batch-summary {
    background: #f8fafc;
    border-radius: 8px;
    padding: 1rem;
    margin: 1.5rem 0;
    text-align: left;
    max-height: 150px;
    overflow-y: auto;

    ul {
      margin: 0;
      padding-left: 1.5rem;

      li {
        margin-bottom: 0.3rem;
        font-weight: 600;
        color: #475569;
      }
    }
  }

  .modal-actions.centered {
    justify-content: center;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;

    .hold-wrapper {
      width: 100%;
      max-width: 300px;
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

.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s;
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateX(-50%) translateY(100px); // keep centered X but move Y
  opacity: 0;
}
</style>
