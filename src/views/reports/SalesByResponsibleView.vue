<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AnalyticsService from '@/services/analytics.service'

const stats = ref<any[]>([])
const isLoading = ref(false)
const dateRange = ref({
  from: '',
  to: ''
})

// Initialize dates (First day of month - Today)
const initDates = () => {
  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)

  // Format YYYY-MM-DD
  const formatDate = (d: Date): string => d.toISOString().split('T')[0] ?? ''

  dateRange.value.from = formatDate(firstDay)
  dateRange.value.to = formatDate(now)
}

const fetchStats = async () => {
  isLoading.value = true
  try {
    const data = await AnalyticsService.getSalesByResponsible(dateRange.value.from, dateRange.value.to)
    stats.value = data.stats
  } catch (error) {
    console.error('Error fetching stats:', error)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  initDates()
  fetchStats()
})
</script>

<template>
  <div class="report-page">
    <main class="container">
      <h1 class="page-title">Ventas por Responsable</h1>
      
      <div class="filters-card">
        <div class="date-group">
          <div class="form-group">
            <label>Desde:</label>
            <input type="date" v-model="dateRange.from" @change="fetchStats" />
          </div>
          <div class="form-group">
            <label>Hasta:</label>
            <input type="date" v-model="dateRange.to" @change="fetchStats" />
          </div>
        </div>
        <button @click="fetchStats" class="btn-primary">Actualizar</button>
      </div>

      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <span>Calculando estadísticas...</span>
      </div>

      <div v-else class="results-grid">
        <!-- Summary Cards -->
         <div class="summary-card total">
            <h3>Venta Total (Periodo)</h3>
            <p class="value">${{stats.reduce((acc, curr) => acc + curr.totalSales, 0).toFixed(2)}}</p>
         </div>
         <div class="summary-card count">
            <h3>Total Pedidos</h3>
            <p class="value">{{stats.reduce((acc, curr) => acc + curr.count, 0)}}</p>
         </div>
      </div>

      <div v-if="!isLoading" class="table-container">
        <table>
          <thead>
            <tr>
              <th>Responsable</th>
              <th>Cantidad Pedidos</th>
              <th>Total Ventas</th>
              <th>% del Total</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="stat in stats" :key="stat._id">
               <td class="responsible-name">
                 <span class="avatar-circle">{{ stat._id.charAt(0) }}</span>
                 {{ stat._id }}
               </td>
               <td>{{ stat.count }}</td>
               <td class="amount">${{ stat.totalSales.toFixed(2) }}</td>
               <td>
                 {{
                  ((stat.totalSales / stats.reduce((acc, curr) => acc + curr.totalSales, 0)) * 100).toFixed(1)
                }}%
               </td>
            </tr>
            <tr v-if="stats.length === 0">
              <td colspan="4" class="empty-cell">No hay datos en este rango de fechas</td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>
  </div>
</template>

<style lang="scss" scoped>
.app-header {
  background-color: white;
  border-bottom: 1px solid $border-light;
  padding: 1rem 0;
  margin-bottom: 2rem;

  .container {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  h1 {
    margin: 0;
    font-family: $font-principal;
    color: $NICOLE-PURPLE;
    font-size: 1.5rem;
  }
}

.filters-card {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  border: 1px solid $border-light;
  margin-bottom: 2rem;
  display: flex;
  justify-content: space-between;
  align-items: end;

  .date-group {
    display: flex;
    gap: 1.5rem;

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;

      label {
        font-weight: 600;
        color: $text-light;
        font-size: 0.9rem;
      }

      input {
        padding: 0.75rem;
        border: 1px solid $border-light;
        border-radius: 8px;
        font-family: $font-secondary;
        color: $text-dark;
      }
    }
  }
}

.results-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.summary-card {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  border: 1px solid $border-light;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);

  h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1rem;
    color: $text-light;
    font-weight: 500;
  }

  .value {
    font-size: 2rem;
    font-weight: 700;
    color: $NICOLE-PURPLE;
    margin: 0;
  }
}

.table-container {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  border: 1px solid $border-light;
  overflow: hidden;

  table {
    width: 100%;
    border-collapse: collapse;

    thead {
      background: $gray-50;

      th {
        padding: 1rem;
        text-align: left;
        font-family: $font-secondary;
        font-weight: 600;
        color: $text-light;
        font-size: 0.9rem;
        border-bottom: 1px solid $border-light;
      }

      th:last-child {
        text-align: right;
      }
    }

    tbody {
      tr {
        border-bottom: 1px solid $border-light;

        &:last-child {
          border-bottom: none;
        }

        &:hover {
          background-color: $gray-50;
        }
      }

      td {
        padding: 1rem;
        font-size: 1rem;
        color: $text-dark;

        &.amount {
          font-weight: 600;
          color: $NICOLE-SECONDARY;
        }

        &:last-child {
          text-align: right;
        }
      }
    }
  }
}

.responsible-name {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-weight: 600;

  .avatar-circle {
    width: 32px;
    height: 32px;
    background: rgba($NICOLE-PURPLE, 0.1);
    color: $NICOLE-PURPLE;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.9rem;
    font-weight: 700;
  }
}

.btn-primary {
  background-color: $NICOLE-PURPLE;
  color: white;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  border: none;
  font-weight: 600;
  cursor: pointer;

  &:hover {
    background-color: $purple-hover;
  }
}

.btn-secondary {
  color: $NICOLE-PURPLE;
  text-decoration: none;
  font-weight: 500;

  &:hover {
    text-decoration: underline;
  }
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem;
  gap: 1rem;
  color: $text-light;

  .spinner {
    width: 30px;
    height: 30px;
    border: 3px solid rgba($NICOLE-PURPLE, 0.3);
    border-radius: 50%;
    border-top-color: $NICOLE-PURPLE;
    animation: spin 1s ease-in-out infinite;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.container {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1.5rem;
}

.empty-cell {
  text-align: center;
  padding: 2rem !important;
  color: $text-light;
}
</style>
