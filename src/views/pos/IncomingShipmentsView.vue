<script setup lang="ts">
import { ref, onMounted } from 'vue'
import POSService, { type IncomingDispatch } from '@/services/pos.service'
import ReceptionModal from './components/ReceptionModal.vue'
import BulkReceptionModal from './components/BulkReceptionModal.vue'
import ToastNotification from '@/components/ToastNotification.vue'

const isLoading = ref(false)
const dispatches = ref<IncomingDispatch[]>([])
const selectedBranch = ref('Mall del Sol') // Default per user context
const branches = ['San Marino', 'Mall del Sol', 'Centro de Producción']

// Modal States
const showReceptionModal = ref(false)
const showBulkModal = ref(false) // New state for bulk modal
const selectedDispatch = ref<any>(null)
const selectedOrderId = ref('')

// Toast
const toast = ref<{ show: boolean; message: string; type: 'success' | 'error' | 'info' }>({ show: false, message: '', type: 'success' })

const fetchDispatches = async () => {
  isLoading.value = true
  try {
    const data = await POSService.getIncomingDispatches(selectedBranch.value)
    dispatches.value = data
  } catch (error) {
    console.error('Error fetching dispatches:', error)
    toast.value = { show: true, message: 'Error cargando envíos', type: 'error' }
  } finally {
    isLoading.value = false
  }
}

const openReceptionModal = (item: IncomingDispatch) => {
  selectedDispatch.value = item.dispatch
  selectedOrderId.value = item.orderId
  showReceptionModal.value = true
}

const handleReceptionConfirm = async (payload: any) => {
  try {
    await POSService.confirmReception(payload.orderId, payload.dispatchId, payload.data)

    toast.value = { show: true, message: 'Recepción registrada exitosamente', type: 'success' }
    showReceptionModal.value = false
    fetchDispatches() // Refresh list
  } catch (error) {
    console.error('Error confirming reception:', error)
    toast.value = { show: true, message: 'Error al registrar recepción', type: 'error' }
  }
}

const handleBulkSuccess = () => {
  toast.value = { show: true, message: 'Recepción Masiva Completada', type: 'success' };
  showBulkModal.value = false;
  fetchDispatches();
}

onMounted(() => {
  fetchDispatches()
})
</script>

<template>
  <div class="pos-reception-page">
    <main class="container">
      <div class="page-header">
        <div class="title-group">
            <h1><i class="fa-solid fa-truck-ramp-box"></i> Recepción de Pedidos</h1>
            <p class="subtitle">Gestiona la llegada de productos a tu sucursal</p>
        </div>
        
        <div class="controls">
            <button class="btn-bulk" @click="showBulkModal = true">
                <i class="fa-solid fa-boxes-stacked"></i> Recepción Masiva
            </button>

            <div class="separator"></div>

            <div class="branch-selector">
                <i class="fa-solid fa-store"></i>
                <select v-model="selectedBranch" @change="fetchDispatches">
                    <option v-for="branch in branches" :key="branch" :value="branch">
                        {{ branch }}
                    </option>
                </select>
            </div>
            <button class="btn-refresh" @click="fetchDispatches" title="Actualizar">
                <i class="fa-solid fa-arrows-rotate"></i>
            </button>
        </div>
      </div>

      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <span>Buscando envíos entrantes...</span>
      </div>

      <div class="divider" v-if="!isLoading && dispatches.length > 0">
        <span>Detalle Individual por Orden</span>
      </div>

      <div v-if="!isLoading" class="shipments-grid">
         <div v-if="dispatches.length === 0" class="empty-state">
            <i class="fa-regular fa-folder-open"></i>
            <h3>Todo al día en {{ selectedBranch }}</h3>
            <p>No hay envíos pendientes de recepción.</p>
         </div>

         <div 
            v-else 
            v-for="(item, index) in dispatches" 
            :key="item.dispatch._id || index" 
            class="shipment-card"
            :class="item.dispatch.receptionStatus"
         >
            <div class="card-header">
                <div class="status-indicator">
                    <i v-if="item.dispatch.receptionStatus === 'RECEIVED'" class="fa-solid fa-check-circle"></i>
                    <i v-else-if="item.dispatch.receptionStatus === 'PROBLEM'" class="fa-solid fa-triangle-exclamation"></i>
                    <i v-else class="fa-solid fa-clock"></i>
                    <span>{{ item.dispatch.receptionStatus === 'RECEIVED' ? 'Completado' : (item.dispatch.receptionStatus === 'PROBLEM' ? 'Con Novedad' : 'En Tránsito') }}</span>
                </div>
                <span class="date">{{ new Date(item.dispatch.reportedAt).toLocaleDateString() }}</span>
            </div>
            
            <div class="card-body">
                <div class="info-row highlight">
                    <span class="label"><i class="fa-solid fa-hashtag"></i> Orden</span>
                    <span class="value">#{{ item.orderNumber || 'N/A' }}</span>
                </div>
                <div class="info-row">
                     <span class="label"><i class="fa-solid fa-user"></i> Cliente</span>
                     <span class="value">{{ item.customerName }}</span>
                </div>
                
                <div class="items-preview">
                    <div class="preview-header">
                        <i class="fa-solid fa-box-open"></i> Contenido ({{ item.dispatch.items.length }})
                    </div>
                    <div class="preview-content">
                        <span v-for="(p, i) in item.dispatch.items.slice(0, 3)" :key="p.productId">
                            {{ p.quantitySent }} {{ p.name }}<span v-if="i < item.dispatch.items.length - 1">, </span>
                        </span>
                        <span v-if="item.dispatch.items.length > 3" class="more-items">
                            +{{ item.dispatch.items.length - 3 }} más
                        </span>
                    </div>
                </div>
            </div>

            <div class="card-actions">
                <button 
                    class="btn-receive" 
                    :class="item.dispatch.receptionStatus"
                    @click="openReceptionModal(item)"
                >
                    <i class="fa-solid fa-clipboard-check"></i>
                    {{ item.dispatch.receptionStatus === 'RECEIVED' ? 'Ver Detalles' : 'Verificar y Recibir' }}
                </button>
            </div>
         </div>
      </div>
    </main>

    <ReceptionModal
        :is-open="showReceptionModal"
        :dispatch="selectedDispatch"
        :order-id="selectedOrderId"
        @close="showReceptionModal = false"
        @confirm="handleReceptionConfirm"
    />

    <BulkReceptionModal
        :is-open="showBulkModal"
        :dispatches="dispatches"
        @close="showBulkModal = false"
        @success="handleBulkSuccess"
    />

    <ToastNotification 
      :show="toast.show" 
      :message="toast.message" 
      :type="toast.type"
      @close="toast.show = false"
    />
  </div>
</template>

<style lang="scss" scoped>
@use 'sass:color';

/* Define Breakpoints */
$tablet: 768px;
$desktop: 1024px;

@mixin from-tablet {
  @media (min-width: #{$tablet}) {
    @content;
  }
}

.pos-reception-page {
  padding-bottom: 2rem;
  min-height: 100vh;
  background-color: $background-light;
  width: 100vw;
  overflow-x: hidden;
  /* Prevent horizontal scroll on body */
}

.container {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
  box-sizing: border-box;

  @include from-tablet {
    padding: 0 1.5rem;
  }
}

/* Page Header - Mobile First Structure */
.page-header {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 1.5rem 0;
  width: 100%;

  @include from-tablet {
    flex-direction: row;
    flex-wrap: wrap;
    /* Essential for avoiding breakage */
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    padding: 2rem 0;
  }

  .title-group {
    /* Allow resizing */
    flex: 1 1 auto;
    min-width: 0;
    /* flexbox fix for truncation if needed */

    h1 {
      font-family: $font-principal;
      color: $NICOLE-PURPLE;
      margin: 0;
      font-size: 1.4rem;
      /* Safe Mobile Size */
      line-height: 1.2;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
      /* Icons and text wrap */

      @include from-tablet {
        font-size: 1.8rem;
        flex-wrap: nowrap;
      }
    }

    .subtitle {
      margin: 0.3rem 0 0 0;
      color: $text-light;
      font-size: 0.85rem;
      line-height: 1.4;

      @include from-tablet {
        font-size: 0.9rem;
      }
    }
  }

  .controls {
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
    width: 100%;
    /* On mobile, controls stack nicely. */

    @include from-tablet {
      width: auto;
      flex-direction: row;
      flex-wrap: wrap;
      /* Wrap buttons if screen is tight tablet */
      align-items: center;
      justify-content: flex-end;
    }
  }

  /* Component Styles in Header */
  .btn-bulk {
    background: $NICOLE-SECONDARY;
    color: white;
    border: none;
    padding: 0.8rem 1rem;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    box-shadow: 0 4px 10px rgba($NICOLE-SECONDARY, 0.2);
    transition: all 0.2s;
    width: 100%;
    /* Full width mobile */
    font-size: 0.95rem;

    @include from-tablet {
      width: auto;
      padding: 0.6rem 1.2rem;
      font-size: 0.9rem;
    }

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 14px rgba($NICOLE-SECONDARY, 0.3);
    }
  }

  .separator {
    display: none;
    width: 1px;
    height: 24px;
    background: $border-light;
    margin: 0 0.5rem;

    @include from-tablet {
      display: block;
    }
  }

  .branch-selector {
    position: relative;
    display: flex;
    align-items: center;
    background: white;
    border-radius: 8px;
    padding: 0 0.8rem;
    border: 1px solid $border-light;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.03);
    width: 100%;

    @include from-tablet {
      width: auto;
      min-width: 180px;
    }

    i {
      color: $NICOLE-PURPLE;
      margin-right: 0.5rem;
    }

    select {
      border: none;
      padding: 0.8rem 0.5rem;
      font-family: $font-secondary;
      font-size: 0.95rem;
      color: $text-dark;
      background: transparent;
      cursor: pointer;
      outline: none;
      width: 100%;
      appearance: none;
      /* Remove default arrow to style better if needed, but basic select is fine */

      @include from-tablet {
        padding: 0.6rem 0.5rem;
      }
    }
  }

  .btn-refresh {
    background: white;
    border: 1px solid $border-light;
    width: 100%;
    height: 44px;
    /* Touchable area */
    border-radius: 8px;
    cursor: pointer;
    color: $text-light;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.03);

    @include from-tablet {
      width: 40px;
      height: 40px;
    }

    &:hover {
      color: $NICOLE-PURPLE;
      border-color: $NICOLE-PURPLE;
      transform: rotate(180deg);
    }
  }
}

/* Divider */
.divider {
  display: flex;
  align-items: center;
  text-align: center;
  margin: 1.5rem 0;
  color: $text-light;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 1px;
  font-weight: 700;
  width: 100%;

  &::before,
  &::after {
    content: '';
    flex: 1;
    border-bottom: 2px dashed $border-light;
  }

  span {
    padding: 0 0.8rem;
    background: $background-light;
    font-size: 0.75rem;

    @include from-tablet {
      padding: 0 1rem;
      font-size: 0.85rem;
    }
  }
}

/* Shipments Grid - Defensive Responsive Grid */
.shipments-grid {
  display: grid;
  /* 1 column strictly on mobile to prevent overflow */
  grid-template-columns: 1fr;
  gap: 1rem;
  width: 100%;

  @include from-tablet {
    /* 
      Use auto-fill with a conservative minmax.
      300px is a good balance for tablets. 
      If container is 768px -> 2 columns (300px each + gap) fits comfortably.
    */
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1.5rem;
  }
}

.shipment-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
  /* Border solid transparent to avoid layout shift if adding border later */
  border: 1px solid transparent;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: all 0.2s ease;
  position: relative;
  /* Ensure card itself doesn't overflow container */
  max-width: 100%;

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.08);
  }

  &.PENDING {
    border-top: 4px solid $warning;
  }

  &.RECEIVED {
    border-top: 4px solid $success;
  }

  &.PROBLEM {
    border-top: 4px solid $error;
  }
}

.card-header {
  padding: 0.8rem 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid $border-light;
  background: #fafbfc;
  flex-wrap: wrap;
  /* Safeguard for small screens */
  gap: 0.5rem;

  .status-indicator {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.8rem;
    font-weight: 700;

    i {
      font-size: 0.9rem;
    }
  }

  .date {
    font-size: 0.75rem;
    color: $text-light;
    font-weight: 500;
  }
}

.shipment-card.PENDING .status-indicator {
  color: $warning;
}

.shipment-card.RECEIVED .status-indicator {
  color: $success;
}

.shipment-card.PROBLEM .status-indicator {
  color: $error;
}

.card-body {
  padding: 1rem;
  flex: 1;

  .info-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.6rem;
    font-size: 0.9rem;
    flex-wrap: wrap;
    /* Allow text to wrap if very long */

    .label {
      color: $text-light;
      font-size: 0.8rem;
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .value {
      font-weight: 600;
      color: $text-dark;
      text-align: right;
    }

    &.highlight .value {
      color: $NICOLE-PURPLE;
    }
  }

  .items-preview {
    margin-top: 1rem;
    background: $gray-50;
    padding: 0.8rem;
    border-radius: 8px;

    .preview-header {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: $text-light;
      margin-bottom: 0.4rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .preview-content {
      font-size: 0.85rem;
      color: $text-dark;
      line-height: 1.4;
    }

    .more-items {
      color: $text-light;
      font-size: 0.75rem;
      font-style: italic;
    }
  }
}

.card-actions {
  padding: 0.8rem 1rem;
  border-top: 1px solid $border-light;
  background: white;
}

.btn-receive {
  width: 100%;
  background: $NICOLE-PURPLE;
  color: white;
  border: none;
  padding: 0.8rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  box-shadow: 0 4px 10px rgba($NICOLE-PURPLE, 0.2);

  &:hover {
    background: $purple-hover;
    box-shadow: 0 6px 15px rgba($NICOLE-PURPLE, 0.3);
  }

  &.RECEIVED {
    background: white;
    color: $success;
    border: 1px solid $success;
    box-shadow: none;

    &:hover {
      background: $gray-50;
    }
  }
}

/* Empty & Loading States */
.loading-state,
.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: 3rem 1rem;
  color: $text-light;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
  width: 100%;

  i {
    font-size: 2.5rem;
    margin-bottom: 1rem;
    color: $gray-300;
  }

  h3 {
    margin: 0.5rem 0;
    color: $text-dark;
    font-family: $font-principal;
    font-size: 1.2rem;
  }

  p {
    font-size: 0.9rem;
    margin: 0;
  }
}

.loading-state .spinner {
  margin: 0 auto 1.5rem;
  width: 35px;
  height: 35px;
  border: 3px solid rgba($NICOLE-PURPLE, 0.2);
  border-top-color: $NICOLE-PURPLE;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
