<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import AnalyticsService from '@/services/analytics.service'

const monthlyGoal = ref(0)
const totalSales = ref(0)

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
    monthlyGoal.value = data.monthlyGoal || 10000
    // Calculate total explicitly for progress bar
    totalSales.value = data.stats.reduce((acc: number, curr: any) => acc + curr.totalSales, 0)
  } catch (error) {
    console.error('Error fetching stats:', error)
  } finally {
    isLoading.value = false
  }
}

const totalCommissions = computed(() => {
  return stats.value.reduce((acc: number, curr: any) => acc + (curr.commission || 0), 0)
})

const isManager = computed(() => {
  const userInfoStr = localStorage.getItem('user_info')
  if (!userInfoStr) return false
  const user = JSON.parse(userInfoStr)
  const role = user.role?.toUpperCase() || ''
  return role === 'SALES_MANAGER' || role === 'ADMIN' || role === 'SALES'
})

onMounted(() => {
  initDates()
  fetchStats()
})
</script>

<template>
  <div class="report-page">
    <main class="container">
      <div class="page-header">
        <h1 class="page-title">Ventas & Comisiones</h1>
        <router-link v-if="isManager" to="/admin/users" class="btn-config">
          <i class="fa-solid fa-users-gear"></i>
          Gestionar Equipo
        </router-link>
      </div>
      
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
        <!-- Goal Progress Card -->
        <div class="summary-card goal-card">
          <div class="goal-header">
            <h3>Objetivo Mensual</h3>
            <span class="goal-value">${{ monthlyGoal.toLocaleString() }}</span>
          </div>
          <div class="progress-container">
             <div 
               class="progress-bar" 
               :style="{ width: Math.min((totalSales / monthlyGoal) * 100, 100) + '%' }"
               :class="{ 'success': totalSales >= monthlyGoal }"
             ></div>
          </div>
          <div class="goal-details">
             <span>Progreso: <strong>{{ ((totalSales / monthlyGoal) * 100).toFixed(1) }}%</strong></span>
             <span>Faltante: <strong>${{ Math.max(monthlyGoal - totalSales, 0).toLocaleString() }}</strong></span>
          </div>
        </div>

        <!-- Summary Cards -->
         <div class="summary-card total">
            <h3>Venta Total</h3>
            <p class="value">${{ totalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</p>
         </div>

         <div class="summary-card commission">
            <h3>Comisión Total Estimada</h3>
            <p class="value total-commission">${{ totalCommissions.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</p>
         </div>

         <div class="summary-card count">
            <h3>Total Pedidos</h3>
            <p class="value">{{stats.reduce((acc, curr) => acc + curr.count, 0)}}</p>
         </div>
      </div>

      <!-- Tiers Explanation (New UX) -->
      <div class="commission-info-bar">
        <div class="info-item">
          <i class="fas fa-info-circle"></i>
          <span><strong>REGLAS DE COMISIÓN:</strong></span>
          <span class="tier">$10k-$13k: <strong>5%</strong></span>
          <span class="tier">$13k-$16k: <strong>10%</strong></span>
          <span class="tier">>$16k: <strong>15%</strong></span>
        </div>
      </div>

      <div v-if="!isLoading" class="table-container">
        <table>
          <thead>
            <tr>
              <th>Responsable</th>
              <th>Rol</th>
              <th>Pedidos</th>
              <th>Total Ventas</th>
              <th>% del Total</th>
              <th>Comisión</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="stat in stats" :key="stat._id">
               <td class="responsible-name">
                 <span class="avatar-circle">{{ stat._id.charAt(0) }}</span>
                 {{ stat._id }}
               </td>
               <td>
                 <span class="role-badge" :class="stat.role.toLowerCase()">{{ stat.role }}</span>
               </td>
               <td>{{ stat.count }}</td>
               <td class="amount">${{ stat.totalSales.toLocaleString(undefined, { minimumFractionDigits: 2 }) }}</td>
               <td class="percentage">
                 {{
                  totalSales > 0
                    ? ((stat.totalSales / totalSales) * 100).toFixed(1)
                    : '0.0'
                }}%
               </td>
               <td class="commission-cell">
                 <span v-if="stat.commission > 0" class="commission-value">
                   ${{ stat.commission.toLocaleString(undefined, { minimumFractionDigits: 2 }) }}
                 </span>
                 <span v-else class="no-commission">-</span>
               </td>
            </tr>
            <tr v-if="stats.length === 0">
              <td colspan="6" class="empty-cell">No hay datos en este rango de fechas</td>
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

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.btn-config {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background-color: white;
  color: $NICOLE-PURPLE;
  padding: 0.6rem 1.2rem;
  border-radius: 8px;
  border: 1px solid rgba($NICOLE-PURPLE, 0.2);
  font-weight: 600;
  text-decoration: none;
  font-size: 0.9rem;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);

  &:hover {
    background-color: rgba($NICOLE-PURPLE, 0.03);
    border-color: $NICOLE-PURPLE;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  i {
    font-size: 1rem;
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
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); // Wider cards
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.commission-info-bar {
  background: #fdf2f8;
  border: 1px solid #fbcfe8;
  border-radius: 8px;
  padding: 0.75rem 1.25rem;
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;

  .info-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
    color: $NICOLE-PURPLE;
    font-size: 0.9rem;

    i {
      font-size: 1.1rem;
    }

    .tier {
      background: white;
      padding: 0.2rem 0.6rem;
      border-radius: 6px;
      border: 1px solid #f9a8d4;
      font-family: monospaced;
    }
  }
}

.summary-card {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  border: 1px solid $border-light;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  justify-content: center;

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

  &.commission {
    border-left: 4px solid #f59e0b; // Amber highlight for commission

    .total-commission {
      color: #b45309;
    }
  }

  /* Goal Card Specifics */
  &.goal-card {
    grid-column: span 2; // Make goal card wider if desired or keep regular
    gap: 0.8rem;

    @media(max-width: 768px) {
      grid-column: span 1;
    }

    .goal-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;

      h3 {
        margin: 0;
      }

      .goal-value {
        font-weight: 700;
        color: $text-dark;
        font-size: 1.1rem;
      }
    }

    .progress-container {
      height: 12px;
      background: #f1f5f9;
      border-radius: 6px;
      overflow: hidden;
      width: 100%;
    }

    .progress-bar {
      height: 100%;
      background: linear-gradient(90deg, #a855f7, $NICOLE-PURPLE);
      border-radius: 6px;
      transition: width 0.6s ease;

      &.success {
        background: #22c55e; // Green if reached
      }
    }

    .goal-details {
      display: flex;
      justify-content: space-between;
      font-size: 0.9rem;
      color: $text-light;

      strong {
        color: $text-dark;
      }
    }
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

        &.commission-cell {
          text-align: right;
          font-weight: 700;

          .commission-value {
            color: #b45309;
            background: #fef3c7;
            padding: 0.25rem 0.5rem;
            border-radius: 6px;
          }

          .no-commission {
            color: $text-light;
            font-weight: 400;
          }
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

.role-badge {
  padding: 0.25rem 0.6rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;

  &.digital {
    background: #e0f2fe;
    color: #0369a1;
  }

  &.comercial {
    background: #f0fdf4;
    color: #15803d;
  }

  &.vendedor {
    background: #f3f4f6;
    color: #4b5563;
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
