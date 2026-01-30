<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import ProductionService from '@/services/production.service'

interface ReportStats {
  kpis: {
    totalOrders: number
    dispatchedCount: number
    completedProductionCount: number
    dispatchRate: number
    productionRate: number
  }
  byDestination: Record<string, number>
  byStatus: Record<string, number>
}

const stats = ref<ReportStats | null>(null)
const isLoading = ref(true)
const range = ref<'today' | 'week'>('today')

const fetchReports = async () => {
  try {
    isLoading.value = true
    const data = await ProductionService.getReports(range.value)
    stats.value = data
  } catch (error) {
    console.error(error)
  } finally {
    isLoading.value = false
  }
}

watch(range, () => {
  fetchReports()
})

onMounted(() => {
  fetchReports()
})

// Helper calculations for "charts"
const getWidth = (val: number, total: number) => {
  if (!total) return '0%'
  return `${(val / total) * 100}%`
}
</script>

<template>
  <div class="reports-view">
    <div class="header">
      <div class="title-box">
        <h1>Reportes de Operación</h1>
        <p>Métricas y KPIs de Producción y Despacho</p>
      </div>
      
      <div class="range-switch">
        <router-link to="/production/orders" class="btn-nav">
          <i class="fas fa-list"></i> Ver Lista
        </router-link>
        <div class="separator"></div>
        <button 
          :class="{ active: range === 'today' }" 
          @click="range = 'today'"
        >
          Hoy
        </button>
        <button 
          :class="{ active: range === 'week' }" 
          @click="range = 'week'"
        >
          Semana
        </button>
      </div>
    </div>

    <div v-if="isLoading" class="loading">
      <div class="loader"></div>
    </div>
    
    <div v-else-if="stats" class="dashboard">
      <!-- KPI Cards -->
      <div class="kpi-row">
        <div class="kpi-card">
          <div class="icon-wrap blue"><i class="fas fa-clipboard-list"></i></div>
          <div class="data">
            <span class="value">{{ stats.kpis.totalOrders }}</span>
            <span class="label">Órdenes Totales</span>
          </div>
        </div>

        <div class="kpi-card">
          <div class="icon-wrap green"><i class="fas fa-check-circle"></i></div>
          <div class="data">
            <span class="value">{{ stats.kpis.productionRate }}%</span>
            <span class="label">Producción Completada</span>
          </div>
        </div>

        <div class="kpi-card">
          <div class="icon-wrap orange"><i class="fas fa-truck-loading"></i></div>
          <div class="data">
            <span class="value">{{ stats.kpis.dispatchRate }}%</span>
            <span class="label">Efectividad Despacho</span>
          </div>
        </div>
      </div>

      <div class="charts-row">
        <!-- Destination Breakdown -->
        <div class="chart-card">
          <h3>Distribución por Destino</h3>
          <div class="bar-chart">
            <div class="bar-row" v-for="(count, dest) in stats.byDestination" :key="dest">
              <div class="bar-label">
                <span>{{ dest }}</span>
                <span class="bar-val">{{ count }}</span>
              </div>
              <div class="bar-track">
                <div class="bar-fill" :style="{ width: getWidth(count, stats.kpis.totalOrders) }"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Dispatch Status -->
        <div class="chart-card">
          <h3>Estado de Envíos</h3>
          <div class="status-list">
            <div class="status-item sent">
              <span class="dot"></span>
              <span class="text">Enviados</span>
              <span class="num">{{ stats.byStatus.SENT }}</span>
            </div>
            <div class="status-item partial">
              <span class="dot"></span>
              <span class="text">Parcial</span>
              <span class="num">{{ stats.byStatus.PARTIAL }}</span>
            </div>
            <div class="status-item pending">
              <span class="dot"></span>
              <span class="text">No Enviado</span>
              <span class="num">{{ stats.byStatus.NOT_SENT }}</span>
            </div>
            <div class="status-item problem">
              <span class="dot"></span>
              <span class="text">Exceso / Problema</span>
              <span class="num">{{ stats.byStatus.PROBLEM }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
$font-stack: 'Inter', system-ui, sans-serif;

.reports-view {
  padding: 1.5rem;
  background-color: #f8f9fa;
  min-height: 100vh;
  font-family: $font-stack;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  flex-wrap: wrap;
  gap: 1rem;

  div.title-box {
    min-width: 280px;
  }

  h1 {
    font-size: 1.5rem;
    color: #2c3e50;
    margin: 0;
    font-weight: 700;
  }

  p {
    color: #7f8c8d;
    margin: 0.2rem 0 0 0;
    font-size: 0.9rem;
  }

  .range-switch {
    background: #e1e8ed;
    padding: 4px;
    border-radius: 8px;
    display: flex;
    gap: 4px;
    flex-wrap: wrap;

    button {
      border: none;
      background: transparent;
      padding: 0.4rem 0.8rem;
      border-radius: 6px;
      font-weight: 600;
      color: #7f8c8d;
      cursor: pointer;
      font-size: 0.85rem;
      transition: all 0.2s;
      flex: 1;
      white-space: nowrap;

      &.active {
        background: white;
        color: #2c3e50;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
      }
    }

    .separator {
      width: 1px;
      background: #ccc;
      margin: 0 4px;
      display: none; // Hide separator on small screens if wrapping occurs

      @media (min-width: 768px) {
        display: block;
      }
    }

    .btn-nav {
      text-decoration: none;
      color: #8e44ad;
      font-weight: 700;
      font-size: 0.85rem;
      padding: 0.4rem 0.8rem;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
      white-space: nowrap;

      &:hover {
        background: rgba(142, 68, 173, 0.1);
        border-radius: 6px;
      }
    }

    .btn-primary {
      background: #8e44ad;
      color: white;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      font-weight: 700;
      font-size: 0.85rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
      margin-right: 4px;
      box-shadow: 0 2px 5px rgba(142, 68, 173, 0.2);
      white-space: nowrap;

      &:hover {
        background: #9b59b6;
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(142, 68, 173, 0.3);
      }
    }
  }

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: stretch;

    .range-switch {
      overflow-x: auto;
      justify-content: space-between;
    }

    .title-box {
      text-align: center;
    }
  }
}

.kpi-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;

  .kpi-card {
    background: white;
    padding: 1.5rem;
    border-radius: 12px;
    display: flex;
    align-items: center;
    gap: 1rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);

    .icon-wrap {
      width: 50px;
      height: 50px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem;

      &.blue {
        background: #ebf5fb;
        color: #3498db;
      }

      &.green {
        background: #eafaf1;
        color: #2ecc71;
      }

      &.orange {
        background: #fef5e7;
        color: #f39c12;
      }
    }

    .data {
      display: flex;
      flex-direction: column;

      .value {
        font-size: 1.8rem;
        font-weight: 800;
        color: #2c3e50;
        line-height: 1;
      }

      .label {
        font-size: 0.75rem;
        color: #95a5a6;
        font-weight: 600;
        text-transform: uppercase;
        margin-top: 4px;
      }
    }
  }
}

.charts-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;

  .chart-card {
    background: white;
    padding: 1.5rem;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);

    h3 {
      margin: 0 0 1.5rem 0;
      font-size: 1rem;
      color: #2c3e50;
    }
  }
}

.bar-chart {
  display: flex;
  flex-direction: column;
  gap: 1rem;

  .bar-row {
    .bar-label {
      display: flex;
      justify-content: space-between;
      font-size: 0.85rem;
      font-weight: 600;
      color: #34495e;
      margin-bottom: 4px;
    }

    .bar-track {
      background: #f1f2f6;
      height: 8px;
      border-radius: 4px;
      overflow: hidden;

      .bar-fill {
        background: #3498db;
        height: 100%;
        border-radius: 4px;
        transition: width 0.5s ease-out;
      }
    }
  }
}

.status-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;

  .status-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.5rem;
    border-radius: 8px;

    .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }

    .text {
      flex: 1;
      font-size: 0.9rem;
      font-weight: 600;
      color: #34495e;
    }

    .num {
      font-weight: 700;
      color: #2c3e50;
    }

    &.sent .dot {
      background: #2ecc71;
    }

    &.partial .dot {
      background: #f1c40f;
    }

    &.pending .dot {
      background: #ecf0f1;
      border: 1px solid #bdc3c7;
    }

    &.problem .dot {
      background: #e74c3c;
    }
  }
}

.loading {
  display: flex;
  justify-content: center;
  padding: 4rem;

  .loader {
    /* Spinner styles similar to other views */
    width: 30px;
    height: 30px;
    border: 3px solid #eee;
    border-top-color: #3498db;
    border-radius: 50%;
    animation: spin 1s infinite linear;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
