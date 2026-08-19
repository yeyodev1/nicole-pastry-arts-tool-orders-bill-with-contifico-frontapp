<script setup lang="ts">
defineProps<{
  unitCost: number
  displayUnit: string
  isMain: boolean
}>()

const formatCost = (val: number): string => {
  if (!val || val === 0) return '0.00'
  return parseFloat(val.toFixed(4)).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })
}
</script>

<template>
  <section class="modal-section">
    <div class="section-title"><i class="fas fa-dollar-sign"></i> Resumen de Costos</div>

    <div v-if="unitCost > 0" class="cost-summary">
      <div class="cost-result">
        <span class="cost-label">Costo Actual ({{ isMain ? 'Principal' : 'Referencia' }})</span>
        <span class="cost-value">${{ formatCost(unitCost) }}<span class="cost-unit">/{{ displayUnit }}</span></span>
      </div>
      <div class="cost-total-hint">
        <i class="fas fa-info-circle"></i>
        Este costo se utilizará para cálculos de inventario y despacho.
      </div>
    </div>
    <div v-else class="cost-summary cost-summary--empty">
      <div class="empty-message">
        <i class="fas fa-calculator"></i>
        <div class="text">
          <strong>Configuración pendiente</strong>
          <span>Asigna un proveedor principal con su precio para calcular el costo actual.</span>
        </div>
      </div>
    </div>
  </section>
</template>

<style lang="scss" scoped>
@use './section-styles' as *;

.cost-summary {
  background: #f5f3ff;
  border: 2px dashed rgba($NICOLE-PURPLE, 0.2);
  padding: 1.5rem;
  border-radius: 24px;

  .cost-label { font-size: 0.8rem; font-weight: 700; color: #64748b; display: block; margin-bottom: 0.25rem; }
  .cost-value { font-size: 2rem; font-weight: 950; color: $NICOLE-PURPLE; }
  .cost-unit { font-size: 1rem; color: #94a3b8; }
  .cost-total-hint { font-size: 0.85rem; font-weight: 600; color: #64748b; margin-top: 0.5rem; i { margin-right: 0.3rem; } }

  &--empty {
    background: #f8fafc;
    border-color: #e2e8f0;

    .empty-message {
      display: flex;
      align-items: center;
      gap: 1.25rem;
      color: #94a3b8;

      i { font-size: 2rem; opacity: 0.5; }

      .text {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;

        strong { color: #64748b; font-size: 0.95rem; }
        span { font-size: 0.85rem; line-height: 1.4; }
      }
    }
  }
}
</style>
