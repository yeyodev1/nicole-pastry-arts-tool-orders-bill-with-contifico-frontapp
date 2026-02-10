<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import RawMaterialService from '@/services/raw-material.service'
import { useToast } from '@/composables/useToast'

const { error: showError } = useToast()

const materials = ref<any[]>([])
const isLoading = ref(false)
const expandedSections = ref({
  low: true,
  warning: true,
  optimal: false
})

const fetchData = async () => {
  isLoading.value = true
  try {
    materials.value = await RawMaterialService.getRawMaterials()
  } catch (err) {
    showError('Error al cargar datos de inventario')
  } finally {
    isLoading.value = false
  }
}

const getDisplayUnit = (unit: string) => {
  if (unit === 'g') return 'kg'
  if (unit === 'ml') return 'L'
  return unit
}

const getDisplayQuantity = (quantity: number, unit: string) => {
  if (unit === 'g' || unit === 'ml') return (quantity / 1000).toFixed(2)
  return quantity.toFixed(2)
}

type Status = 'low' | 'warning' | 'optimal'

const getStockStatus = (m: any): Status => {
  if (!m.minStock) return 'optimal'
  if (m.quantity < m.minStock) return 'low'
  if (m.quantity < m.minStock * 1.5) return 'warning'
  return 'optimal'
}

const itemsByStatus = computed(() => {
  const groups: Record<Status, any[]> = { low: [], warning: [], optimal: [] }
  materials.value.forEach(m => {
    const status = getStockStatus(m)
    groups[status].push(m)
  })
  return groups
})

const stats = computed(() => ({
  total: materials.value.length,
  low: itemsByStatus.value.low.length,
  warning: itemsByStatus.value.warning.length,
  optimal: itemsByStatus.value.optimal.length
}))

const toggleSection = (section: 'low' | 'warning' | 'optimal') => {
  expandedSections.value[section] = !expandedSections.value[section]
}

onMounted(fetchData)
</script>

<template>
  <div class="inventory-summary">
    <div class="header">
      <div class="title">
        <h1>Centro de Control de Inventario</h1>
        <p>Monitoreo predictivo de stock y reabastecimiento</p>
      </div>
      <button class="btn-refresh" @click="fetchData" :disabled="isLoading">
        <i class="fas fa-sync-alt" :class="{ 'fa-spin': isLoading }"></i>
        <span>Sincronizar Stock</span>
      </button>
    </div>

    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <span>Calculando niveles de inventario...</span>
    </div>

    <div v-else class="dashboard">
      <!-- Stats Overview -->
      <div class="summary-cards">
        <div class="glass-card stat-item low" @click="toggleSection('low')">
          <div class="icon-box"><i class="fas fa-skull-crossbones"></i></div>
          <div class="content">
            <span class="value">{{ stats.low }}</span>
            <span class="desc">Críticos (Pedir Ya)</span>
          </div>
          <div class="indicator" :class="{ active: expandedSections.low }"></div>
        </div>

        <div class="glass-card stat-item warning" @click="toggleSection('warning')">
          <div class="icon-box"><i class="fas fa-tachometer-alt"></i></div>
          <div class="content">
            <span class="value">{{ stats.warning }}</span>
            <span class="desc">Alerta Stock Próximo</span>
          </div>
          <div class="indicator" :class="{ active: expandedSections.warning }"></div>
        </div>

        <div class="glass-card stat-item optimal" @click="toggleSection('optimal')">
          <div class="icon-box"><i class="fas fa-shield-alt"></i></div>
          <div class="content">
            <span class="value">{{ stats.optimal }}</span>
            <span class="desc">Niveles Óptimos</span>
          </div>
          <div class="indicator" :class="{ active: expandedSections.optimal }"></div>
        </div>
      </div>

      <!-- Accordion Sections -->
      <div class="accordion-layout">
        
        <!-- SECTION: CRITICAL -->
        <div class="accordion-group low" :class="{ open: expandedSections.low }">
          <button class="accordion-header" @click="toggleSection('low')">
            <div class="title-group">
               <i class="fas fa-exclamation-circle main-icon"></i>
               <h2>URGENTE: ABAJO DEL MÍNIMO</h2>
               <span class="count-badge">{{ stats.low }}</span>
            </div>
            <i class="fas fa-chevron-down arrow"></i>
          </button>
          
          <div class="accordion-content">
            <div v-if="itemsByStatus.low.length === 0" class="empty-msg">
              <i class="fas fa-check-double"></i> No hay insumos críticos por el momento.
            </div>
            <div v-else class="grid-display">
              <div v-for="m in itemsByStatus.low" :key="m._id" class="inv-card style-low">
                <div class="header-card">
                   <div class="meta">
                      <span class="cat">{{ m.category }}</span>
                      <h3 class="name">{{ m.name }}</h3>
                   </div>
                   <div class="status-dot shine"></div>
                </div>
                <div class="progress-container">
                   <div class="progress-info">
                      <span>Stock Actual</span>
                      <span class="val">{{ getDisplayQuantity(m.quantity, m.unit) }} {{ getDisplayUnit(m.unit) }}</span>
                   </div>
                   <div class="progress-bar-bg">
                      <div class="progress-bar-fill" :style="{ width: Math.min((m.quantity / (m.minStock || 1)) * 100, 100) + '%' }"></div>
                   </div>
                   <div class="min-line">Mínimo sugerido: {{ getDisplayQuantity(m.minStock, m.unit) }}{{ getDisplayUnit(m.unit) }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- SECTION: WARNING -->
        <div class="accordion-group warning" :class="{ open: expandedSections.warning }">
          <button class="accordion-header" @click="toggleSection('warning')">
            <div class="title-group">
               <i class="fas fa-history main-icon"></i>
               <h2>ALERTA: REABASTECIMIENTO PRÓXIMO</h2>
               <span class="count-badge">{{ stats.warning }}</span>
            </div>
            <i class="fas fa-chevron-down arrow"></i>
          </button>
          
          <div class="accordion-content">
            <div v-if="itemsByStatus.warning.length === 0" class="empty-msg">
              No hay alertas de reabastecimiento.
            </div>
            <div v-else class="grid-display">
              <div v-for="m in itemsByStatus.warning" :key="m._id" class="inv-card style-warning">
                 <div class="header-card">
                   <div class="meta">
                      <span class="cat">{{ m.category }}</span>
                      <h3 class="name">{{ m.name }}</h3>
                   </div>
                </div>
                <div class="stock-details">
                   <div class="metric">
                      <span class="lab">Actual</span>
                      <span class="qty">{{ getDisplayQuantity(m.quantity, m.unit) }}</span>
                   </div>
                   <div class="separator"><i class="fas fa-arrow-right"></i></div>
                   <div class="metric">
                      <span class="lab">Mínimo x1.5</span>
                      <span class="qty">{{ getDisplayQuantity(m.minStock * 1.5, m.unit) }}</span>
                   </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- SECTION: OPTIMAL -->
        <div class="accordion-group optimal" :class="{ open: expandedSections.optimal }">
          <button class="accordion-header" @click="toggleSection('optimal')">
            <div class="title-group">
               <i class="fas fa-shield-alt main-icon"></i>
               <h2>INVENTARIO ÓPTIMO</h2>
               <span class="count-badge">{{ stats.optimal }}</span>
            </div>
            <i class="fas fa-chevron-down arrow"></i>
          </button>
          
          <div class="accordion-content">
            <div class="items-bubble-cloud">
               <div v-for="m in itemsByStatus.optimal" :key="m._id" class="bubble-item">
                 <span class="n">{{ m.name }}</span>
                 <span class="q">{{ getDisplayQuantity(m.quantity, m.unit) }}{{ getDisplayUnit(m.unit) }}</span>
               </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.inventory-summary {
  padding: 3rem 2rem;
  max-width: 1300px;
  margin: 0 auto;
  min-height: 100vh;
  background-color: #f8fafc;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 3.5rem;

  h1 {
    font-size: 2.5rem;
    font-weight: 800;
    color: #1e1b4b;
    margin: 0;
    letter-spacing: -1px;
    background: linear-gradient(135deg, #1e1b4b 0%, #4338ca 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  p {
    font-size: 1.1rem;
    color: #64748b;
    margin-top: 0.5rem;
    font-weight: 500;
  }
}

.btn-refresh {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.85rem 1.75rem;
  background: white;
  border-radius: 14px;
  border: 1px solid #e2e8f0;
  color: #4338ca;
  font-weight: 700;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  i {
    font-size: 1rem;
  }

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    background: #4338ca;
    color: white;
    border-color: #4338ca;
  }
}

/* Stats Dashboard */
.summary-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2rem;
  margin-bottom: 4rem;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
}

.glass-card {
  position: relative;
  background: white;
  border-radius: 24px;
  padding: 1.75rem;
  display: flex;
  align-items: center;
  gap: 1.5rem;
  border: 1px solid #f1f5f9;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
  cursor: pointer;
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  overflow: hidden;

  &:hover {
    transform: translateY(-8px) scale(1.02);
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  }

  .icon-box {
    width: 4rem;
    height: 4rem;
    border-radius: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
  }

  .content {
    display: flex;
    flex-direction: column;

    .value {
      font-size: 2.25rem;
      font-weight: 900;
      line-height: 1;
      margin-bottom: 0.25rem;
    }

    .desc {
      font-size: 0.85rem;
      font-weight: 700;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
  }

  .indicator {
    position: absolute;
    bottom: 0;
    left: 0;
    height: 4px;
    width: 0;
    transition: width 0.6s ease;

    &.active {
      width: 100%;
    }
  }

  &.low {
    .icon-box {
      background: #fee2e2;
      color: #ef4444;
    }

    .value {
      color: #ef4444;
    }

    .indicator {
      background: #ef4444;
    }
  }

  &.warning {
    .icon-box {
      background: #fef3c7;
      color: #d97706;
    }

    .value {
      color: #d97706;
    }

    .indicator {
      background: #d97706;
    }
  }

  &.optimal {
    .icon-box {
      background: #dcfce7;
      color: #10b981;
    }

    .value {
      color: #10b981;
    }

    .indicator {
      background: #10b981;
    }
  }
}

/* Accordion Engine */
.accordion-layout {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.accordion-group {
  background: white;
  border-radius: 20px;
  border: 1px solid #f1f5f9;
  overflow: hidden;
  transition: all 0.3s ease;

  .accordion-header {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem 2rem;
    background: white;
    border: none;
    cursor: pointer;
    text-align: left;
    transition: background 0.3s;

    &:hover {
      background: #f8fafc;
    }

    .title-group {
      display: flex;
      align-items: center;
      gap: 1.25rem;

      .main-icon {
        font-size: 1.25rem;
      }

      h2 {
        margin: 0;
        font-size: 1.15rem;
        font-weight: 800;
        letter-spacing: 0.5px;
      }

      .count-badge {
        padding: 0.25rem 0.75rem;
        border-radius: 99px;
        font-size: 0.8rem;
        font-weight: 800;
      }
    }

    .arrow {
      font-size: 1rem;
      color: #94a3b8;
      transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    }
  }

  .accordion-content {
    max-height: 0;
    transition: max-height 0.4s cubic-bezier(1, 0, 0, 1);
    padding: 0 2rem;
    opacity: 0;
    overflow: hidden;
  }

  &.open {
    box-shadow: 0 12px 20px -5px rgba(0, 0, 0, 0.08);

    .accordion-content {
      max-height: 2000px;
      padding-bottom: 2.5rem;
      opacity: 1;
    }

    .arrow {
      transform: rotate(180deg);
    }
  }

  // Branding Sections
  &.low {
    border-left: 6px solid #ef4444;

    .main-icon,
    h2 {
      color: #ef4444;
    }

    .count-badge {
      background: #fee2e2;
      color: #ef4444;
    }
  }

  &.warning {
    border-left: 6px solid #f59e0b;

    .main-icon,
    h2 {
      color: #b45309;
    }

    .count-badge {
      background: #fef3c7;
      color: #b45309;
    }
  }

  &.optimal {
    border-left: 6px solid #10b981;

    .main-icon,
    h2 {
      color: #047857;
    }

    .count-badge {
      background: #dcfce7;
      color: #047857;
    }
  }
}

/* Inventory Cards (Inside Accordion) */
.grid-display {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.5rem;
}

.inv-card {
  background: #f8fafc;
  border-radius: 18px;
  padding: 1.5rem;
  border: 1px solid #f1f5f9;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;

  .header-card {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;

    .cat {
      font-size: 0.7rem;
      font-weight: 800;
      text-transform: uppercase;
      color: #94a3b8;
      letter-spacing: 1px;
    }

    .name {
      margin: 0.25rem 0 0;
      font-size: 1.15rem;
      font-weight: 700;
      color: #1e293b;
    }
  }

  .status-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
  }

  &.style-low {
    background: #fffafa;
    border: 1px solid #fee2e2;

    .status-dot {
      background: #ef4444;
    }
  }

  &.style-warning {
    background: #fffcf0;
    border: 1px solid #fef3c7;

    .status-dot {
      background: #f59e0b;
    }
  }
}

/* Progress Mechanism */
.progress-container {
  .progress-info {
    display: flex;
    justify-content: space-between;
    font-size: 0.9rem;
    font-weight: 700;
    margin-bottom: 0.4rem;
    color: #64748b;

    .val {
      color: #1e293b;
      font-size: 1.1rem;
    }
  }

  .progress-bar-bg {
    height: 10px;
    background: #e2e8f0;
    border-radius: 20px;
    overflow: hidden;
  }

  .progress-bar-fill {
    height: 100%;
    background: #ef4444;
    border-radius: 20px;
  }

  .min-line {
    font-size: 0.75rem;
    font-weight: 700;
    color: #94a3b8;
    margin-top: 0.5rem;
    text-align: right;
  }
}

.stock-details {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: white;
  padding: 1rem;
  border-radius: 12px;

  .metric {
    display: flex;
    flex-direction: column;

    .lab {
      font-size: 0.7rem;
      font-weight: 800;
      color: #94a3b8;
      text-transform: uppercase;
    }

    .qty {
      font-size: 1.15rem;
      font-weight: 800;
      color: #1e293b;
    }
  }

  .separator {
    color: #cbd5e1;
  }
}

/* Cloud Bubbles */
.items-bubble-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.bubble-item {
  background: white;
  border: 1px solid #e2e8f0;
  padding: 0.6rem 1.25rem;
  border-radius: 99px;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  transition: all 0.2s;

  &:hover {
    background: #10b981;
    color: white;
    border-color: #10b981;

    .q {
      color: rgba(255, 255, 255, 0.8);
    }
  }

  .n {
    font-weight: 700;
    font-size: 0.9rem;
  }

  .q {
    font-size: 0.85rem;
    font-weight: 600;
    color: #10b981;
  }
}

/* Loading state animations */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 8rem;
  gap: 1.5rem;
  color: #64748b;
  font-weight: 600;

  .spinner {
    width: 3.5rem;
    height: 3.5rem;
    border: 5px solid #e2e8f0;
    border-top-color: #4338ca;
    border-radius: 50%;
    animation: spin 1s cubic-bezier(0.53, 0.21, 0.29, 0.67) infinite;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.shine {
  animation: shine-pulse 2s infinite;
}

@keyframes shine-pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4);
  }

  70% {
    box-shadow: 0 0 0 10px rgba(239, 68, 68, 0);
  }

  100% {
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
  }
}

.empty-msg {
  text-align: center;
  padding: 3rem;
  color: #94a3b8;
  font-weight: 600;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: center;

  i {
    font-size: 3rem;
    opacity: 0.3;
  }
}
</style>
