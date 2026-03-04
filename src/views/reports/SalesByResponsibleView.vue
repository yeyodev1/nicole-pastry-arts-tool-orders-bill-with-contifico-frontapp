<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import AnalyticsService from '@/services/analytics.service'
import GoalSettingsService from '@/services/goal-settings.service'
import CustomDatePicker from '@/components/ui/CustomDatePicker.vue'

// --- Role-based defaults (fallback when no individual override exists) ---
const MANAGER_ROLE = 'SALES_MANAGER'
const DEFAULT_SELLER_GOAL = 10000
const DEFAULT_MANAGER_GOAL = 7000

const sellerGoal = ref(DEFAULT_SELLER_GOAL)
const managerGoal = ref(DEFAULT_MANAGER_GOAL)
// Per-person overrides: keyed by stat._id (person's name from analytics)
const individualGoals = ref<Record<string, number>>({})

const showGoalEditor = ref(false)
const isSavingGoals = ref(false)
const goalSaveStatus = ref<'idle' | 'success' | 'error'>('idle')

const totalSales = ref(0)
const stats = ref<any[]>([])
const isLoading = ref(false)
const dateRange = ref({ from: '', to: '' })

/**
 * Returns the effective goal for a stat:
 * 1. Per-person override (if set)
 * 2. Role-based default (managerGoal / sellerGoal)
 */
const getIndividualGoal = (stat: any): number => {
  if (individualGoals.value[stat._id] !== undefined) {
    return individualGoals.value[stat._id]!
  }
  return stat.role?.toUpperCase() === MANAGER_ROLE ? managerGoal.value : sellerGoal.value
}

/** Makes sure every person in stats has a value in the editor draft. */
const buildEditorDraft = () => {
  stats.value.forEach((stat: any) => {
    if (individualGoals.value[stat._id] === undefined) {
      // Pre-populate with the role-based default so the input is never empty
      individualGoals.value[stat._id] =
        stat.role?.toUpperCase() === MANAGER_ROLE ? managerGoal.value : sellerGoal.value
    }
  })
}

/** Team goal = sum of effective goals for each real person in stats. */
const teamGoal = computed(() => {
  if (!stats.value.length) return sellerGoal.value + managerGoal.value
  return stats.value.reduce((acc: number, stat: any) => acc + getIndividualGoal(stat), 0)
})

const totalCommissions = computed(() =>
  stats.value.reduce((acc: number, curr: any) => acc + (curr.commission || 0), 0)
)

const isManager = computed(() => {
  const userInfoStr = localStorage.getItem('user_info')
  if (!userInfoStr) return false
  const user = JSON.parse(userInfoStr)
  const role = user.role?.toUpperCase() || ''
  return role === 'SALES_MANAGER' || role === 'ADMIN' || role === 'SALES'
})

const initDates = () => {
  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
  const formatDate = (d: Date): string => d.toISOString().split('T')[0] ?? ''
  dateRange.value.from = formatDate(firstDay)
  dateRange.value.to = formatDate(now)
}

const fetchStats = async () => {
  isLoading.value = true
  try {
    const data = await AnalyticsService.getSalesByResponsible(dateRange.value.from, dateRange.value.to)
    stats.value = data.stats
    totalSales.value = data.stats.reduce((acc: number, curr: any) => acc + curr.totalSales, 0)
  } catch (error) {
    console.error('Error fetching stats:', error)
  } finally {
    isLoading.value = false
  }
}

const saveGoals = async () => {
  isSavingGoals.value = true
  goalSaveStatus.value = 'idle'
  try {
    await GoalSettingsService.updateGoals({
      managerGoal: managerGoal.value,
      sellerGoal: sellerGoal.value,
      individualGoals: { ...individualGoals.value },
    })
    goalSaveStatus.value = 'success'
    setTimeout(() => { goalSaveStatus.value = 'idle' }, 2500)
  } catch {
    goalSaveStatus.value = 'error'
    setTimeout(() => { goalSaveStatus.value = 'idle' }, 3000)
  } finally {
    isSavingGoals.value = false
  }
}

const openEditor = () => {
  buildEditorDraft()
  showGoalEditor.value = true
}

onMounted(async () => {
  initDates()
  try {
    const goals = await GoalSettingsService.getGoals()
    managerGoal.value = goals.managerGoal
    sellerGoal.value = goals.sellerGoal
    individualGoals.value = { ...goals.individualGoals }
  } catch {
    // Defaults already set via ref initialization
  }
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
          <div class="form-group custom-datepicker-group">
            <CustomDatePicker
              v-model="dateRange.from"
              label="Desde"
              @update:modelValue="fetchStats"
            />
          </div>
          <div class="form-group custom-datepicker-group">
            <CustomDatePicker
              v-model="dateRange.to"
              label="Hasta"
              @update:modelValue="fetchStats"
            />
          </div>
        </div>
        <button @click="fetchStats" class="btn-primary">Actualizar</button>
      </div>

      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <span>Calculando estadísticas...</span>
      </div>

      <!-- Goal Editor Panel -->
      <div v-if="showGoalEditor" class="goal-editor-panel">
        <div class="goal-editor-header">
          <div class="editor-title">
            <i class="fas fa-sliders-h"></i>
            <span>Configurar Metas Individuales</span>
          </div>
          <button class="btn-close-editor" @click="showGoalEditor = false">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <!-- Role defaults -->
        <div class="editor-section-label">Metas por defecto (por rol)</div>
        <div class="goal-editor-fields">
          <div class="goal-field">
            <label><i class="fas fa-user-tie"></i> Jefe de Ventas (default)</label>
            <div class="input-prefix">
              <span>$</span>
              <input type="number" v-model.number="managerGoal" min="0" step="500" />
            </div>
          </div>
          <div class="goal-field">
            <label><i class="fas fa-user"></i> Vendedor (default)</label>
            <div class="input-prefix">
              <span>$</span>
              <input type="number" v-model.number="sellerGoal" min="0" step="500" />
            </div>
          </div>
        </div>

        <!-- Per-person overrides -->
        <div class="editor-section-label" style="margin-top: 1.25rem;">
          <span>Meta por persona</span>
          <span class="section-hint">Sobreescribe el default para cada vendedor</span>
        </div>
        <div class="person-goals-list">
          <div v-for="stat in stats" :key="stat._id" class="person-goal-row">
            <div class="person-info">
              <span class="person-avatar">{{ stat._id.charAt(0) }}</span>
              <div>
                <span class="person-name">{{ stat._id }}</span>
                <span class="person-role-chip" :class="stat.role.toLowerCase()">{{ stat.role }}</span>
              </div>
            </div>
            <div class="input-prefix person-input">
              <span>$</span>
              <input
                type="number"
                :value="individualGoals[stat._id]"
                @input="individualGoals[stat._id] = Number(($event.target as HTMLInputElement).value)"
                min="0"
                step="500"
              />
            </div>
          </div>
        </div>

        <!-- Footer: computed total + save -->
        <div class="editor-footer">
          <div class="goal-total-preview">
            <span class="preview-label">Meta Total del Equipo</span>
            <span class="computed-total">${{ teamGoal.toLocaleString() }}</span>
          </div>
          <button
            class="btn-save-goals"
            :class="{ saving: isSavingGoals, saved: goalSaveStatus === 'success', error: goalSaveStatus === 'error' }"
            :disabled="isSavingGoals"
            @click="saveGoals"
          >
            <i v-if="isSavingGoals" class="fas fa-spinner fa-spin"></i>
            <i v-else-if="goalSaveStatus === 'success'" class="fas fa-check"></i>
            <i v-else-if="goalSaveStatus === 'error'" class="fas fa-times"></i>
            <i v-else class="fas fa-save"></i>
            <span v-if="isSavingGoals">Guardando...</span>
            <span v-else-if="goalSaveStatus === 'success'">¡Guardado!</span>
            <span v-else-if="goalSaveStatus === 'error'">Error al guardar</span>
            <span v-else>Guardar cambios</span>
          </button>
        </div>
      </div>

      <div v-else class="results-grid">
        <!-- Goal Progress Card -->
        <div class="summary-card goal-card">
          <div class="goal-header">
            <h3>Meta del Equipo</h3>
            <div class="goal-header-right">
              <span class="goal-value">${{ teamGoal.toLocaleString() }}</span>
              <button class="btn-edit-goal" @click="openEditor" title="Editar metas">
                <i class="fas fa-pen"></i>
              </button>
            </div>
          </div>
          <div class="progress-container">
            <div
              class="progress-bar"
              :style="{ width: Math.min((totalSales / teamGoal) * 100, 100) + '%' }"
              :class="{ 'success': totalSales >= teamGoal }"
            ></div>
          </div>
          <div class="goal-details">
            <span>Progreso: <strong>{{ ((totalSales / teamGoal) * 100).toFixed(1) }}%</strong></span>
            <span>Faltante: <strong>${{ Math.max(teamGoal - totalSales, 0).toLocaleString() }}</strong></span>
          </div>
          <div class="goal-breakdown">
            <span class="breakdown-item">
              <i class="fas fa-user-tie"></i>
              Jefe de Ventas: <strong>${{ managerGoal.toLocaleString() }}</strong>
            </span>
            <span class="breakdown-sep">+</span>
            <span class="breakdown-item">
              <i class="fas fa-users"></i>
              Vendedores: <strong>${{ (teamGoal - managerGoal).toLocaleString() }}</strong>
            </span>
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
          <span class="tier">$0-$10k: <strong>2%</strong></span>
          <span class="tier">$10k-$13k: <strong>3%</strong></span>
          <span class="tier">>$13k: <strong>6%</strong></span>
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
              <th>Meta Individual</th>
              <th>Progreso</th>
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
              <td class="individual-goal">
                ${{ getIndividualGoal(stat).toLocaleString() }}
              </td>
              <td class="progress-cell">
                <div class="mini-progress-wrap">
                  <div class="mini-progress-bar">
                    <div
                      class="mini-progress-fill"
                      :style="{ width: Math.min((stat.totalSales / getIndividualGoal(stat)) * 100, 100) + '%' }"
                      :class="{ 'done': stat.totalSales >= getIndividualGoal(stat) }"
                    ></div>
                  </div>
                  <span class="mini-progress-pct">
                    {{ ((stat.totalSales / getIndividualGoal(stat)) * 100).toFixed(0) }}%
                  </span>
                </div>
              </td>
              <td class="commission-cell">
                <span v-if="stat.commission > 0" class="commission-value">
                  ${{ stat.commission.toLocaleString(undefined, { minimumFractionDigits: 2 }) }}
                </span>
                <span v-else class="no-commission">-</span>
              </td>
            </tr>
            <tr v-if="stats.length === 0">
              <td colspan="7" class="empty-cell">No hay datos en este rango de fechas</td>
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
    align-items: flex-end;

    .form-group.custom-datepicker-group {
      // CustomDatePicker controls its own width nicely
      width: 200px;

      @media(max-width: 500px) {
        width: 100%;
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
    grid-column: span 2;
    gap: 0.75rem;

    @media(max-width: 768px) {
      grid-column: span 1;
    }

    .goal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;

      h3 {
        margin: 0;
      }

      .goal-header-right {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .goal-value {
        font-weight: 700;
        color: $text-dark;
        font-size: 1.1rem;
      }

      .btn-edit-goal {
        background: rgba($NICOLE-PURPLE, 0.08);
        border: 1px solid rgba($NICOLE-PURPLE, 0.2);
        color: $NICOLE-PURPLE;
        border-radius: 6px;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 0.75rem;
        transition: all 0.2s ease;

        &:hover {
          background: rgba($NICOLE-PURPLE, 0.15);
          transform: scale(1.05);
        }
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
        background: linear-gradient(90deg, #22c55e, #16a34a);
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

    .goal-breakdown {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding-top: 0.5rem;
      border-top: 1px dashed $border-light;
      font-size: 0.8rem;
      color: $text-light;
      flex-wrap: wrap;

      .breakdown-item {
        display: flex;
        align-items: center;
        gap: 0.35rem;

        i {
          color: $NICOLE-PURPLE;
          font-size: 0.75rem;
        }

        strong {
          color: $text-dark;
        }
      }

      .breakdown-sep {
        font-weight: 700;
        color: $text-light;
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

// --- Goal Editor Panel ---
.goal-editor-panel {
  background: white;
  border: 1px solid rgba($NICOLE-PURPLE, 0.2);
  border-radius: 14px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  box-shadow: 0 4px 24px rgba($NICOLE-PURPLE, 0.09);

  .goal-editor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;

    .editor-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-weight: 700;
      color: $NICOLE-PURPLE;
      font-size: 0.95rem;

      i {
        font-size: 1rem;
      }
    }

    .btn-close-editor {
      background: $gray-50;
      border: 1px solid $border-light;
      color: $text-light;
      border-radius: 6px;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 0.8rem;
      transition: all 0.2s;

      &:hover {
        background: #fee2e2;
        border-color: #fca5a5;
        color: #dc2626;
      }
    }
  }

  .editor-section-label {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.8rem;
    font-weight: 700;
    color: $text-light;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 0.75rem;

    .section-hint {
      font-size: 0.78rem;
      font-weight: 400;
      text-transform: none;
      letter-spacing: 0;
      color: $text-light;
      font-style: italic;
    }
  }

  .goal-editor-fields {
    display: flex;
    gap: 1.5rem;
    flex-wrap: wrap;
    align-items: flex-end;
    padding-bottom: 1.25rem;
    border-bottom: 1px dashed $border-light;
  }

  .goal-field {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;

    label {
      font-size: 0.85rem;
      font-weight: 600;
      color: $text-light;
      display: flex;
      align-items: center;
      gap: 0.35rem;

      i {
        color: $NICOLE-PURPLE;
      }
    }
  }

  .input-prefix {
    display: flex;
    align-items: center;
    border: 1px solid $border-light;
    border-radius: 8px;
    overflow: hidden;
    transition: border-color 0.2s;

    &:focus-within {
      border-color: $NICOLE-PURPLE;
      box-shadow: 0 0 0 3px rgba($NICOLE-PURPLE, 0.1);
    }

    span {
      padding: 0.6rem 0.75rem;
      background: $gray-50;
      color: $text-light;
      font-weight: 600;
      font-size: 0.95rem;
      border-right: 1px solid $border-light;
    }

    input {
      border: none;
      outline: none;
      padding: 0.6rem 0.75rem;
      font-family: $font-secondary;
      font-size: 0.95rem;
      color: $text-dark;
      width: 120px;
      background: white;
    }
  }

  // Per-person list
  .person-goals-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1.25rem;
  }

  .person-goal-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    border-radius: 10px;
    background: $gray-50;
    border: 1px solid $border-light;
    transition: border-color 0.2s;

    &:hover {
      border-color: rgba($NICOLE-PURPLE, 0.2);
    }

    .person-info {
      display: flex;
      align-items: center;
      gap: 0.75rem;

      .person-avatar {
        width: 36px;
        height: 36px;
        background: rgba($NICOLE-PURPLE, 0.12);
        color: $NICOLE-PURPLE;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 800;
        font-size: 0.95rem;
        flex-shrink: 0;
      }

      .person-name {
        font-weight: 700;
        color: $text-dark;
        font-size: 0.95rem;
        display: block;
      }

      .person-role-chip {
        font-size: 0.7rem;
        font-weight: 700;
        text-transform: uppercase;
        padding: 0.15rem 0.5rem;
        border-radius: 100px;
        margin-top: 0.15rem;
        display: inline-block;

        &.sales_manager {
          background: #eff6ff;
          color: #2563eb;
        }

        &.sales_rep {
          background: #f0fdf4;
          color: #16a34a;
        }
      }
    }

    .person-input {
      input {
        width: 100px;
      }
    }
  }

  // Footer with total + save
  .editor-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 1.25rem;
    border-top: 1px solid $border-light;
    flex-wrap: wrap;
    gap: 1rem;

    .goal-total-preview {
      display: flex;
      flex-direction: column;

      .preview-label {
        font-size: 0.8rem;
        font-weight: 600;
        color: $text-light;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .computed-total {
        font-size: 1.75rem;
        font-weight: 800;
        color: $NICOLE-PURPLE;
        line-height: 1.2;
      }
    }

    .btn-save-goals {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1.5rem;
      border-radius: 10px;
      border: none;
      font-weight: 700;
      font-size: 0.95rem;
      cursor: pointer;
      transition: all 0.25s ease;
      background: $NICOLE-PURPLE;
      color: white;

      &:hover:not(:disabled) {
        background: $purple-hover;
        transform: translateY(-1px);
        box-shadow: 0 6px 16px rgba($NICOLE-PURPLE, 0.3);
      }

      &:disabled {
        opacity: 0.7;
        cursor: not-allowed;
      }

      &.saved {
        background: #16a34a;
      }

      &.error {
        background: #dc2626;
      }
    }
  }
}

// --- Per-row progress cell ---
.individual-goal {
  font-weight: 600;
  color: $text-light;
  font-size: 0.9rem;
}

.progress-cell {
  min-width: 120px;
}

.mini-progress-wrap {
  display: flex;
  align-items: center;
  gap: 0.5rem;

  .mini-progress-bar {
    flex: 1;
    height: 6px;
    background: #f1f5f9;
    border-radius: 4px;
    overflow: hidden;

    .mini-progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #a855f7, $NICOLE-PURPLE);
      border-radius: 4px;
      transition: width 0.5s ease;

      &.done {
        background: linear-gradient(90deg, #22c55e, #16a34a);
      }
    }
  }

  .mini-progress-pct {
    font-size: 0.78rem;
    font-weight: 700;
    color: $text-light;
    white-space: nowrap;
  }
}
</style>
