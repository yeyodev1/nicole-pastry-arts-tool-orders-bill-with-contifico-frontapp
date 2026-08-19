<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import WarehouseService from '@/services/warehouse.service'

const props = defineProps<{
  form: any
  materialToEdit: any | null
  displayUnit: string
  stockStatus: { label: string; class: string }
  unitCost: number
}>()

const router = useRouter()

// Stock local por bodega (movimientos propios)
const localStock = ref<{ location: string; stock: number }[]>([])
const isLoadingStock = ref(false)

onMounted(async () => {
  if (!props.materialToEdit?._id) return
  isLoadingStock.value = true
  try {
    localStock.value = await WarehouseService.getStockByLocation(props.materialToEdit._id)
  } catch { /* silencioso */ }
  finally { isLoadingStock.value = false }
})

const goTo = (path: string) => router.push(path)
</script>

<template>
  <section class="modal-section">
    <div class="section-title"><i class="fas fa-warehouse"></i> Control de Stock</div>

    <div class="stock-status-bar" v-if="materialToEdit">
      <div class="status-indicator">
        <span class="label">Estado Actual:</span>
        <span class="badge" :class="stockStatus.class">{{ stockStatus.label }}</span>
      </div>
      <div class="stock-level">
        <span class="current">{{ form.quantity }} {{ displayUnit }}</span>
        <span class="label">en stock <span v-if="unitCost > 0">(${{ (form.quantity * unitCost).toFixed(2) }})</span></span>
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label><i class="fas fa-arrow-down"></i> Stock Mínimo (Alerta)</label>
        <input type="number" v-model.number="form.minStock" placeholder="0" />
        <span class="input-hint">Punto de re-orden</span>
      </div>
      <div class="form-group">
        <label><i class="fas fa-arrow-up"></i> Stock Máximo (Límite)</label>
        <input type="number" v-model.number="form.maxStock" placeholder="0" />
        <span class="input-hint">Capacidad o límite deseado</span>
      </div>
    </div>

    <!-- Stock por bodega (movimientos locales) -->
    <div v-if="materialToEdit" class="location-stock">
      <div class="location-title"><i class="fas fa-map-marker-alt"></i> Stock por bodega</div>
      <div v-if="isLoadingStock" class="loc-loading">Cargando...</div>
      <div v-else-if="localStock.length === 0" class="loc-empty">
        Sin movimientos por bodega aún — usa los ingresos/egresos para distribuir el stock.
      </div>
      <div v-else class="loc-chips">
        <span v-for="loc in localStock" :key="loc.location" class="loc-chip">
          <strong>{{ loc.location }}</strong> {{ loc.stock }} {{ displayUnit }}
        </span>
      </div>
    </div>

    <!-- Acciones rápidas: ingreso / egreso / préstamo -->
    <div v-if="materialToEdit" class="quick-actions">
      <button type="button" class="qa qa--in" @click="goTo('/supply-chain/warehouse')">
        <i class="fas fa-arrow-circle-down"></i> Registrar ingreso
      </button>
      <button type="button" class="qa qa--out" @click="goTo('/supply-chain/warehouse')">
        <i class="fas fa-arrow-circle-up"></i> Registrar egreso
      </button>
      <button type="button" class="qa qa--loan" @click="goTo('/supply-chain/loans')">
        <i class="fas fa-exchange-alt"></i> Prestar entre bodegas
      </button>
    </div>
  </section>
</template>

<style lang="scss" scoped>
@use './section-styles' as *;

.stock-status-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f8fafc;
  padding: 1.25rem;
  border-radius: 20px;
  margin-bottom: 1.5rem;
  border: 1px solid #f1f5f9;

  .badge {
    padding: 0.4rem 0.8rem;
    border-radius: 8px;
    font-weight: 900;
    font-size: 0.85rem;

    &.status-urgent { background: #fee2e2; color: #ef4444; }
    &.status-warning { background: #ffedd5; color: #f97316; }
    &.status-optimal { background: #dcfce7; color: #16a34a; }
    &.status-overstock { background: #dbeafe; color: #2563eb; }
  }

  .stock-level {
    text-align: right;
    .current { display: block; font-size: 1.5rem; font-weight: 900; color: #1e293b; }
    .label { font-size: 0.8rem; color: #64748b; }
  }
}

.location-stock {
  margin-top: 1.25rem;
  background: #f8fafc;
  border: 1px solid #f1f5f9;
  border-radius: 16px;
  padding: 1rem 1.25rem;

  .location-title {
    font-size: 0.72rem;
    font-weight: 800;
    color: #64748b;
    text-transform: uppercase;
    margin-bottom: 0.6rem;

    i { color: $NICOLE-PURPLE; margin-right: 0.3rem; }
  }

  .loc-loading, .loc-empty { font-size: 0.82rem; color: #94a3b8; }

  .loc-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .loc-chip {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 999px;
    padding: 0.3rem 0.8rem;
    font-size: 0.8rem;
    color: #334155;

    strong { color: $NICOLE-PURPLE; margin-right: 0.3rem; }
  }
}

.quick-actions {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
  margin-top: 1rem;

  .qa {
    flex: 1;
    min-width: 150px;
    border: none;
    border-radius: 12px;
    padding: 0.65rem 0.9rem;
    font-weight: 700;
    font-size: 0.8rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    transition: transform 0.15s ease;

    &:hover { transform: translateY(-1px); }

    &--in { background: #dcfce7; color: #15803d; }
    &--out { background: #ffedd5; color: #c2410c; }
    &--loan { background: #ede9fe; color: #6d28d9; }
  }
}
</style>
