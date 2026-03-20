<script setup lang="ts">
import { ref, onMounted } from 'vue'
import ProductionHistoryPanel from './components/ProductionHistoryPanel.vue'
import ExportProductionModal from '../orders/components/ExportProductionModal.vue'
import { useProductionSummary } from '@/composables/useProductionSummary'
import { useOrderExport } from '@/composables/useOrderExport'
import ActionHoldButton from '@/components/common/ActionHoldButton.vue'
import { useToast } from '@/composables/useToast'

const {
  isLoading,
  error,
  fetchSummary,
  showHistory,
  isBackgroundLoading,
  rawBucketFilter,
  rawFilteredOrders,
  rawStatsByDestinationAndRound,
  rawStatsByDestRoundCategory,
  collapsedProductCategories,
  toggleProductCategory,
  selectedRawProducts,
  toggleRawProductSelection,
  clearRawSelection,
  rawOrders,
  sourceFilter,
  batchCompleteSelected,
  isBatchProcessing,
  totalByProduct,
} = useProductionSummary()

const { isExporting, exportDispatchOrder, exportProductionOrder } = useOrderExport()
const showExportModal = ref(false)
const exportMode = ref<'dispatch' | 'production'>('dispatch')
const isBatchConfirmOpen = ref(false)

const { success, error: showError } = useToast()

const toggleHistoryPanel = () => {
  showHistory.value = !showHistory.value
  if (!showHistory.value) {
    fetchSummary()
  }
}

const handleSourceFilter = (src: 'all' | 'nicole' | 'sucree') => {
  sourceFilter.value = src
}

const handleExportClick = (mode: 'dispatch' | 'production') => {
  exportMode.value = mode
  showExportModal.value = true
}

const exportSingleItem = (productName: string) => {
  clearRawSelection()
  toggleRawProductSelection(productName)
  handleExportClick('production')
}

const handleExportProduction = async (responsibleName: string) => {
  try {
    const selectedProducts = Array.from(selectedRawProducts.value)

    let ordersToExport: any[] = []

    if (selectedProducts.length === 0) {
      ordersToExport = rawFilteredOrders.value
    } else {
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

    if (exportMode.value === 'dispatch') {
      await exportDispatchOrder(ordersToExport, 'Producción (Resumen)')
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

onMounted(() => {
  fetchSummary()
})
</script>

<template>
  <div class="summary-view" :class="{ 'has-selection': selectedRawProducts.size > 0 }">

    <!-- HEADER -->
    <div class="header-section">
      <div class="header-top">
        <div class="header-content">
          <h1>
            Resumen de Producción
            <span v-if="isBackgroundLoading" class="refreshing-badge">
              <i class="fas fa-sync-alt fa-spin"></i> Actualizando...
            </span>
          </h1>
          <p>Control de pedidos y producción por destino</p>
        </div>
        <div class="header-actions">
          <button class="btn-history" @click="toggleHistoryPanel" :class="{ active: showHistory }">
            <i class="fas" :class="showHistory ? 'fa-arrow-left' : 'fa-history'"></i>
            {{ showHistory ? 'Volver' : 'Completados' }}
          </button>
          <button class="btn-refresh" @click="fetchSummary(false)" :disabled="isLoading" v-if="!showHistory">
            <i class="fas fa-sync-alt" :class="{ 'fa-spin': isLoading }"></i>
            Actualizar
          </button>
        </div>
      </div>

      <!-- Source filter pills -->
      <div class="source-filter-bar" v-if="!showHistory">
        <button
          v-for="src in [{ key: 'all', label: 'Todas', icon: 'fa-layer-group' }, { key: 'nicole', label: 'Nicole', icon: 'fa-birthday-cake' }, { key: 'sucree', label: 'Sucree', icon: 'fa-star' }]"
          :key="src.key"
          class="source-pill"
          :class="[`source-pill--${src.key}`, { active: sourceFilter === src.key }]"
          @click="handleSourceFilter(src.key as any)"
        >
          <i :class="`fas ${src.icon}`"></i>
          {{ src.label }}
        </button>
      </div>

      <!-- Bucket filter pills -->
      <div class="raw-filter-pills" v-if="!showHistory">
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

      <!-- Export actions -->
      <div class="raw-export-actions" v-if="!showHistory && rawOrders.length > 0">
        <button class="btn-export-prod delivery" :disabled="isExporting" @click="handleExportClick('dispatch')">
          <i class="fas" :class="isExporting && exportMode === 'dispatch' ? 'fa-spinner fa-spin' : 'fa-truck-loading'"></i>
          {{ selectedRawProducts.size > 0 ? `Entrega (${selectedRawProducts.size})` : 'Orden de Entrega' }}
        </button>
        <button class="btn-export-prod production" :disabled="isExporting" @click="handleExportClick('production')">
          <i class="fas" :class="isExporting && exportMode === 'production' ? 'fa-spinner fa-spin' : 'fa-bread-slice'"></i>
          {{ selectedRawProducts.size > 0 ? `Producción (${selectedRawProducts.size})` : 'Orden de Producción' }}
        </button>
      </div>
    </div>

    <!-- LOADING -->
    <div v-if="isLoading" class="loading-state">
      <span class="loader"></span>
      <p>Cargando producción...</p>
    </div>

    <!-- ERROR -->
    <div v-else-if="error" class="error-msg">
      <i class="fas fa-exclamation-triangle"></i>
      {{ error }}
      <button @click="fetchSummary(false)">Reintentar</button>
    </div>

    <!-- HISTORY VIEW -->
    <ProductionHistoryPanel v-else-if="showHistory" @close="toggleHistoryPanel" />

    <!-- MAIN: Destination Grid -->
    <div v-else class="content-wrapper">
      <div class="destination-grid" v-if="Object.keys(rawStatsByDestRoundCategory).length > 0">
        <div v-for="(rounds, destination) in rawStatsByDestRoundCategory" :key="destination" class="destination-card">

          <!-- Destination header -->
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
              <span class="dest-total">
                {{ Object.values(rounds).reduce((acc, cats) => acc + Object.values(cats).reduce((a2, prods) => a2 + Object.values(prods).reduce((a3, b3) => a3 + b3, 0), 0), 0) }} unids
              </span>
            </div>
          </div>

          <!-- Each round (despacho) -->
          <div v-for="(categories, roundLabel) in rounds" :key="roundLabel" class="round-section">
            <div v-if="roundLabel" class="round-badge-header">
              <i class="fas fa-clock"></i>
              <span>{{ roundLabel }}</span>
              <span class="round-total">
                {{ Object.values(categories).reduce((a, prods) => a + Object.values(prods).reduce((a2, b2) => a2 + b2, 0), 0) }} unids
              </span>
            </div>

            <!-- Each category (collapsible) -->
            <div v-for="(products, catName) in categories" :key="catName" class="cat-section">
              <button
                class="cat-header"
                :class="`cat--${catName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`"
                @click="toggleProductCategory(`${destination}|||${roundLabel}|||${catName}`)"
              >
                <span class="cat-name">
                  <i class="fas fa-chevron-right cat-chevron"
                    :class="{ open: !collapsedProductCategories.has(`${destination}|||${roundLabel}|||${catName}`) }">
                  </i>
                  {{ catName }}
                </span>
                <span class="cat-qty">{{ Object.values(products).reduce((a, b) => a + b, 0) }} unids</span>
              </button>

              <Transition name="cat-collapse">
                <table
                  v-if="!collapsedProductCategories.has(`${destination}|||${roundLabel}|||${catName}`)"
                  class="raw-table"
                >
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
                      <td class="col-name">{{ productName }}</td>
                      <td class="col-qty"><strong>{{ qty }}</strong></td>
                      <td class="col-qty pending-qty" v-if="totalByProduct[productName]">
                        <strong>{{ totalByProduct[productName] }}</strong>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </Transition>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="empty-raw">
        <i class="fas fa-folder-open"></i>
        <p>No hay pedidos para este periodo</p>
      </div>
    </div>

    <!-- FLOATING BATCH BAR -->
    <Transition name="slide-up">
      <div v-if="selectedRawProducts.size > 0" class="floating-batch-bar">
        <div class="batch-info">
          <span class="count">{{ selectedRawProducts.size }}</span>
          <span class="label">productos seleccionados</span>
        </div>
        <div class="batch-actions">
          <button class="btn-clear" @click="clearRawSelection">Cancelar</button>
          <button class="btn-process delivery" @click="handleExportClick('dispatch')" :disabled="isExporting">
            <i class="fas fa-truck-loading"></i> Entrega
          </button>
          <button class="btn-process production" @click="handleExportClick('production')" :disabled="isExporting">
            <i class="fas fa-bread-slice"></i> Producción
          </button>
          <button class="btn-process complete" @click="isBatchConfirmOpen = true" :disabled="isBatchProcessing">
            <i class="fas" :class="isBatchProcessing ? 'fa-spinner fa-spin' : 'fa-check'"></i>
            Marcar Producido
          </button>
        </div>
      </div>
    </Transition>

    <!-- BATCH COMPLETE CONFIRM MODAL -->
    <Transition name="modal-fade">
      <div v-if="isBatchConfirmOpen" class="modal-overlay" @click.self="isBatchConfirmOpen = false">
        <div class="modal-content batch-modal">
          <div class="modal-header">
            <i class="fas fa-check-circle"></i>
            <h2>Confirmar Producción</h2>
          </div>
          <p>Se marcará como producido:</p>
          <ul class="batch-summary">
            <li v-for="name in Array.from(selectedRawProducts).slice(0, 6)" :key="name">
              <strong>{{ name }}</strong>
              <span v-if="totalByProduct[name]">— {{ totalByProduct[name] }} unids pendientes</span>
            </li>
            <li v-if="selectedRawProducts.size > 6">... y {{ selectedRawProducts.size - 6 }} más</li>
          </ul>
          <div class="modal-actions centered">
            <button class="btn-cancel" @click="isBatchConfirmOpen = false">Cancelar</button>
            <ActionHoldButton
              label="MANTENER 2S PARA CONFIRMAR"
              :duration="2000"
              color="#2ecc71"
              @trigger="async () => { await batchCompleteSelected(); isBatchConfirmOpen = false }"
            />
          </div>
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
    padding-bottom: 7rem;
  }
}

.header-section {
  background: white;
  padding: 1rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  margin-bottom: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;

  @media (min-width: 768px) {
    padding: 1.25rem 2rem;
  }
}

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;

  .header-content {
    h1 {
      font-size: 1.4rem;
      font-weight: 800;
      color: #2c3e50;
      margin: 0 0 0.2rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;

      @media (min-width: 768px) {
        font-size: 1.8rem;
      }
    }

    p {
      margin: 0;
      font-size: 0.85rem;
      color: #64748b;
    }
  }

  .header-actions {
    display: flex;
    gap: 0.5rem;
    flex-shrink: 0;

    button {
      background: white;
      border: 1px solid #e1e8ed;
      padding: 0.6rem 1.2rem;
      border-radius: 8px;
      font-weight: 700;
      font-size: 0.9rem;
      color: #2c3e50;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.6rem;
      transition: all 0.2s;
      white-space: nowrap;

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

.source-filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.source-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.9rem;
  border-radius: 20px;
  border: 1.5px solid #e2e8f0;
  background: #f8fafc;
  color: #64748b;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: #f1f5f9;
  }

  &--all.active {
    background: #1e293b;
    border-color: #1e293b;
    color: white;
  }

  &--nicole {
    i { color: #7c3aed; }

    &.active {
      background: #7c3aed;
      border-color: #7c3aed;
      color: white;

      i { color: white; }
    }
  }

  &--sucree {
    i { color: #d97706; }

    &.active {
      background: #d97706;
      border-color: #d97706;
      color: white;

      i { color: white; }
    }
  }
}

.raw-filter-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;

  &::-webkit-scrollbar {
    display: none;
  }

  -ms-overflow-style: none;
  scrollbar-width: none;
}

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

.raw-export-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.btn-export-prod {
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

.content-wrapper {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
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
}

.round-section {
  & + .round-section {
    border-top: 2px dashed #e2e8f0;
  }

  .dest-table-container {
    padding: 0.5rem 1rem 1rem;
  }
}

.round-badge-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1rem;
  margin: 0;
  background: linear-gradient(135deg, #ede9fe, #f3e8ff);
  border-bottom: 1px solid #ddd6fe;
  font-size: 0.8rem;
  font-weight: 800;
  color: #7c3aed;
  text-transform: uppercase;
  letter-spacing: 0.5px;

  i {
    font-size: 0.75rem;
  }

  .round-total {
    margin-left: auto;
    font-size: 0.7rem;
    font-weight: 700;
    background: rgba(124, 58, 237, 0.12);
    padding: 2px 8px;
    border-radius: 10px;
    color: #6d28d9;
  }
}

// ── Category collapsible sections ──────────────────────────────────
.cat-section {
  border-bottom: 1px solid #f1f5f9;

  &:last-child { border-bottom: none; }
}

.cat-header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.55rem 0.9rem;
  border: none;
  cursor: pointer;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  transition: filter 0.15s;
  border-radius: 0;

  &:hover { filter: brightness(0.96); }

  .cat-name {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .cat-chevron {
    font-size: 0.65rem;
    transition: transform 0.2s;
    &.open { transform: rotate(90deg); }
  }

  .cat-qty {
    font-size: 0.72rem;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 10px;
    background: rgba(0,0,0,0.08);
  }

  // Colors per category
  &.cat--tortas           { background: #ede9fe; color: #5b21b6; }
  &.cat--tortas-porción   { background: #e0e7ff; color: #3730a3; }
  &.cat--joyitas          { background: #fce7f3; color: #9d174d; }
  &.cat--bollería         { background: #fef3c7; color: #92400e; }
  &.cat--galletería       { background: #ffedd5; color: #9a3412; }
  &.cat--siropes          { background: #ccfbf1; color: #134e4a; }
  &.cat--vegetales        { background: #dcfce7; color: #14532d; }
  &.cat--heladería        { background: #dbeafe; color: #1e3a5f; }
  &.cat--casa-mia         { background: #ffe4e6; color: #9f1239; }
  &.cat--otros            { background: #f1f5f9; color: #475569; }
}

// Collapse animation
.cat-collapse-enter-active,
.cat-collapse-leave-active {
  transition: all 0.22s ease;
  overflow: hidden;
}
.cat-collapse-enter-from,
.cat-collapse-leave-to {
  opacity: 0;
  max-height: 0;
}
.cat-collapse-enter-to,
.cat-collapse-leave-from {
  opacity: 1;
  max-height: 1000px;
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
    padding: 0.75rem 0.75rem;
    font-size: 0.9rem;
    color: #334155;
    border-bottom: 1px solid #f8fafc;
    font-weight: 500;
  }

  .col-name { flex: 1; }

  .col-sel {
    width: 32px;
  }

  .col-qty {
    text-align: right;
    width: 70px;

    strong {
      color: $color-info;
      font-weight: 800;
      font-size: 1rem;
    }
  }

  tr:last-child td {
    border-bottom: none;
  }

  tr:hover td {
    background: #fdfdfd;
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

.pending-qty {
  color: #e67e22;

  strong {
    color: #e67e22 !important;
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

.floating-batch-bar {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  width: 90%;
  max-width: 700px;
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
    gap: 0.5rem;
    flex-wrap: wrap;

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
      padding: 0.6rem 1rem;
      border-radius: 12px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      transition: all 0.2s;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      font-size: 0.85rem;

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

      &.complete {
        background: #059669;
        color: white;

        &:hover:not(:disabled) {
          background: #047857;
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
    position: relative;
    overflow: hidden;

    .modal-header {
      margin-bottom: 1.5rem;

      i {
        font-size: 3rem;
        color: #059669;
        margin-bottom: 0.5rem;
      }

      h2 {
        margin: 0;
        color: #2c3e50;
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
    max-height: 180px;
    overflow-y: auto;
    list-style: none;
    padding-left: 1rem;

    li {
      margin-bottom: 0.4rem;
      font-weight: 600;
      color: #475569;
      font-size: 0.9rem;

      span {
        font-weight: 400;
        color: #94a3b8;
      }
    }
  }

  .modal-actions.centered {
    justify-content: center;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
  }
}

.loading-state,
.error-msg {
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

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
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
  transform: translateX(-50%) translateY(100px);
  opacity: 0;
}
</style>
