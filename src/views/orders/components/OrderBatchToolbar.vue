<script setup lang="ts">



const props = defineProps<{
  selectedCount: number
  isProcessing: boolean
}>()

const emit = defineEmits<{
  (e: 'clear'): void
  (e: 'retry'): void
}>()
</script>

<template>
  <div class="batch-action-bar">
    <div class="batch-info">
      <span class="count">{{ selectedCount }} seleccionados</span>
      <button class="btn-text-clear" @click="emit('clear')">Cancelar</button>
    </div>
    
    <button class="btn-batch-primary" @click="emit('retry')" :disabled="isProcessing">
      <i class="fas fa-rotate-right" :class="{ 'fa-spin': isProcessing }"></i>
      {{ isProcessing ? 'Procesando...' : `Reintentar (${selectedCount})` }}
    </button>
  </div>
</template>

<style lang="scss" scoped>
.batch-action-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #7c3aed; // Nicole Purple (Using hardcode or variable if available globally)
  color: white;
  padding: 0.75rem 1.25rem;
  border-radius: 12px;
  margin-bottom: 1rem;
  animation: slideDown 0.3s ease;

  .batch-info {
    display: flex;
    align-items: center;
    gap: 1rem;

    .count {
      font-weight: 700;
      font-size: 0.95rem;
    }

    .btn-text-clear {
      background: transparent;
      border: none;
      color: rgba(255, 255, 255, 0.8);
      cursor: pointer;
      font-size: 0.85rem;
      text-decoration: underline;

      &:hover {
        color: white;
      }
    }
  }

  .btn-batch-primary {
    background: white;
    color: #7c3aed;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: transform 0.1s;

    &:active {
      transform: scale(0.98);
    }

    &:disabled {
      opacity: 0.8;
      cursor: not-allowed;
    }
  }
}

@keyframes slideDown {
  from {
    transform: translateY(-10px);
    opacity: 0;
  }

  to {
    transform: translateY(0);
    opacity: 1;
  }
}
</style>
