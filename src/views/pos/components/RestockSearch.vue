<script setup lang="ts">
import type { PropType } from 'vue';
import type { RestockProduct } from '@/views/pos/composables/useRestockModal';

const props = defineProps({
  query: { type: String, required: true },
  results: { type: Array as PropType<RestockProduct[]>, default: () => [] },
  isLoading: { type: Boolean, default: false }
});

const emit = defineEmits(['update:query', 'select']);

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  emit('update:query', target.value);
};
</script>

<template>
  <div class="search-container">
    <div class="search-box">
      <i class="fa-solid fa-search search-icon"></i>
      <input 
        type="text" 
        :value="query"
        @input="handleInput"
        placeholder="Buscar producto..."
        class="search-input"
        autofocus
      />
      <i v-if="isLoading" class="fa-solid fa-spinner fa-spin loading-icon"></i>
    </div>

    <div v-if="results.length > 0" class="results-list">
      <div 
        v-for="product in results" 
        :key="product.id" 
        class="result-item"
        @click="emit('select', product)"
      >
        <span class="product-name">{{ product.nombre }}</span>
        <span class="product-category" v-if="product.categoria_nombre">{{ product.categoria_nombre }}</span>
      </div>
    </div>

    <div v-else-if="query.length >= 3 && !isLoading" class="no-results">
      <p>No se encontraron productos</p>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.search-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;

  .search-icon {
    position: absolute;
    left: 1rem;
    color: $text-light;
    pointer-events: none;
  }

  .loading-icon {
    position: absolute;
    right: 1rem;
    color: $NICOLE-PRIMARY;
  }

  .search-input {
    width: 100%;
    padding: 0.875rem 1rem 0.875rem 2.75rem;
    border: 1px solid $border-light;
    border-radius: 12px;
    font-size: 1rem;
    color: $text-dark;
    background-color: $background-light;
    transition: all 0.2s ease;

    &:focus {
      outline: none;
      border-color: $NICOLE-PRIMARY;
      box-shadow: 0 0 0 3px rgba($NICOLE-PRIMARY, 0.1);
    }

    &::placeholder {
      color: lighten($text-light, 20%);
    }
  }
}

.results-list {
  display: flex;
  flex-direction: column;
  border: 1px solid $border-light;
  border-radius: 12px;
  overflow: hidden;
  max-height: 300px;
  overflow-y: auto;
  background: white;
}

.result-item {
  padding: 0.75rem 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid $border-light;
  cursor: pointer;
  transition: background-color 0.2s;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background-color: $gray-50;
  }

  .product-name {
    font-weight: 500;
    color: $text-dark;
  }

  .product-category {
    font-size: 0.75rem;
    color: $text-light;
    background: $gray-100;
    padding: 0.25rem 0.5rem;
    border-radius: 6px;
  }
}

.no-results {
  text-align: center;
  padding: 2rem;
  color: $text-light;
  font-size: 0.9rem;
}
</style>
