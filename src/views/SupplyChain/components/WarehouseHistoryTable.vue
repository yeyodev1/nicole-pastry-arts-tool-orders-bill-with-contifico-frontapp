<script setup lang="ts">
import { ref } from 'vue'
import WarehouseFilters from '@/components/SupplyChain/WarehouseFilters.vue'
import type { RawMaterial, Movement } from '@/types/warehouse'

const props = defineProps({
  materials: {
    type: Array as () => RawMaterial[],
    required: true
  },
  movements: {
    type: Array as () => Movement[],
    required: true
  },
  isLoading: {
    type: Boolean,
    required: true
  },
  currentPage: {
    type: Number,
    required: true
  },
  totalPages: {
    type: Number,
    required: true
  },
  totalInValue: {
    type: Number,
    required: true
  },
  activeFilters: {
    type: Object as () => any,
    required: true
  }
})

const emit = defineEmits(['filter', 'page-change'])

const getDisplayUnit = (unit: string) => {
  if (unit === 'g') return 'kg'
  if (unit === 'ml') return 'L'
  return unit
}

const getDisplayQuantity = (quantity: number, unit: string) => {
  if (unit === 'g' || unit === 'ml') return (quantity / 1000).toFixed(2)
  return quantity.toFixed(2)
}

const getMovementValue = (m: any) => {
  if (!m.rawMaterial || !m.rawMaterial.quantity || !m.rawMaterial.cost) return 0
  const unitCost = m.rawMaterial.cost
  return m.quantity * unitCost
}

const formatDate = (date: string | undefined) => {
  if (!date) return '-'
  return new Intl.DateTimeFormat('es-EC', {
    timeZone: 'America/Guayaquil',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(date))
}

const handleFilter = (filters: any) => {
  emit('filter', filters)
}

const changePage = (page: number) => {
  emit('page-change', page)
}
</script>

<template>
  <div class="movements-tab">
    <WarehouseFilters 
      :materials="materials"
      :initialFilters="activeFilters"
      @filter="handleFilter"
    />

    <div v-if="isLoading" class="loading-container">
      <div class="spinner"></div>
      <p>Cargando movimientos...</p>
    </div>
    
    <div v-else class="table-responsive">
      <table class="table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Tipo</th>
            <th>Materia Prima</th>
            <th class="text-right">Cantidad</th>
            <th class="text-right">Valor ($)</th>
            <th>Origen / Destino</th>
            <th>Responsable</th>
            <th>Usuario</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="movements.length === 0">
            <td colspan="8" class="text-center">No hay movimientos registrados.</td>
          </tr>
          <tr v-for="m in movements" :key="m._id">
            <td>{{ formatDate(m.date || m.createdAt) }}</td>
            <td>
              <span class="badge" :class="{
                'badge-in': m.type === 'IN',
                'badge-out': m.type === 'OUT',
                'badge-loss': m.type === 'LOSS'
              }">
                {{ m.type === 'IN' ? 'ENTRADA' : m.type === 'OUT' ? 'SALIDA' : 'BAJA' }}
              </span>
            </td>
            <td>{{ m.rawMaterial?.name || 'Desconocido' }}</td>
            <td class="text-right fw-600">
              {{ getDisplayQuantity(m.quantity, m.rawMaterial?.unit) }} <span class="unit-text">{{ getDisplayUnit(m.rawMaterial?.unit) }}</span>
            </td>
            <td class="text-right money-cell" :class="{ 'in-value': m.type === 'IN', 'loss-value': m.type === 'LOSS' }">
              <span v-if="m.type === 'IN'">+ ${{ getMovementValue(m).toFixed(2) }}</span>
              <span v-else-if="m.type === 'LOSS'">- ${{ getMovementValue(m).toFixed(2) }}</span>
              <span v-else class="text-muted">- ${{ getMovementValue(m).toFixed(2) }}</span>
            </td>
            <td>
              <span v-if="m.type === 'IN'">{{ m.provider?.name || '-' }}</span>
              <span v-else-if="m.type === 'LOSS'">Pérdida Directa</span>
              <span v-else>{{ m.entity || '-' }}</span>
            </td>
            <td>
              <span class="responsible-tag">
                <i class="fas fa-user-tag"></i> {{ m.responsible || '-' }}
              </span>
            </td>
            <td>{{ m.user?.name || 'Sistema' }}</td>
          </tr>
        </tbody>
        <tfoot v-if="movements.length > 0">
          <tr class="summary-row">
            <td colspan="4" class="text-right">Total Valor que Entró (Recepciones):</td>
            <td class="text-right total-value">${{ totalInValue.toFixed(2) }}</td>
            <td colspan="3"></td>
          </tr>
        </tfoot>
      </table>
      
      <div class="pagination" v-if="totalPages > 1">
         <button :disabled="currentPage === 1" @click="changePage(currentPage - 1)">Anterior</button>
         <span>Página {{ currentPage }} de {{ totalPages }}</span>
         <button :disabled="currentPage === totalPages" @click="changePage(currentPage + 1)">Siguiente</button>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  color: $text-light;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba($NICOLE-PURPLE, 0.2);
  border-top-color: $NICOLE-PURPLE;
  border-radius: 50%;
  animation: spin 1s infinite linear;
  margin-bottom: 1rem;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.table-responsive {
  overflow-x: auto;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  border: 1px solid $border-light;
}

.table {
  width: 100%;
  border-collapse: collapse;

  th,
  td {
    padding: 1rem;
    text-align: left;
    border-bottom: 1px solid $border-light;
  }

  th {
    background: $gray-50;
    font-weight: 600;
    color: $text-light;
    font-size: 0.9rem;
  }
}

.badge {
  padding: 0.25rem 0.6rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 700;
}

.badge-in {
  background: #e6fffa;
  color: #047857;
}

.badge-out {
  background: #fff5f5;
  color: #c53030;
}

.badge-loss {
  background: #fef2f2;
  color: #991b1b;
  border: 1px solid #fee2e2;
}

.text-right {
  text-align: right !important;
}

.fw-600 {
  font-weight: 600;
}

.unit-text {
  font-size: 0.8rem;
  color: $text-light;
  margin-left: 2px;
  text-transform: lowercase;
}

.money-cell {
  font-weight: 500;
  font-size: 0.95rem;

  &.in-value {
    color: #047857;
    font-weight: 700;
  }

  &.loss-value {
    color: #991b1b;
    font-weight: 600;
  }
}

.responsible-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: #475569;
  background: #f1f5f9;
  padding: 0.2rem 0.6rem;
  border-radius: 6px;

  i {
    font-size: 0.75rem;
    color: $NICOLE-PURPLE;
  }
}

.summary-row {
  background-color: $gray-50;

  td {
    padding: 1.25rem 1.5rem !important;
    font-weight: 700;
    color: $text-dark;
    border-top: 2px solid $border-light;
  }

  .total-value {
    color: #047857;
    font-size: 1.15rem;
    border-top: 2px solid $NICOLE-PURPLE;
  }
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border-top: 1px solid $border-light;

  button {
    padding: 0.5rem 1rem;
    border: 1px solid $border-light;
    background: white;
    border-radius: 6px;
    cursor: pointer;

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    &:not(:disabled):hover {
      background: $gray-50;
    }
  }
}
</style>
