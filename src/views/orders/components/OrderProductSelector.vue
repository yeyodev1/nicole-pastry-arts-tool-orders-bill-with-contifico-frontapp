<script setup lang="ts">
import { ref, onMounted } from 'vue'
import ProductService from '@/services/product.service'
import OrderProductCard from './OrderProductCard.vue'
import type { Product } from '@/types/order'
import { getOfficialName } from '@/services/productMapping.service'

const emit = defineEmits<{
  (e: 'add-to-cart', product: Product): void
}>()

// State
const isLoading = ref(false)
const searchTerm = ref('')
const products = ref<Product[]>([])
const currentPage = ref(1)
const hasMore = ref(true)
const pageSize = 20

// Logic
const fetchProducts = async (isNewSearch = true) => {
  if (isNewSearch) {
    currentPage.value = 1
    products.value = []
    hasMore.value = true
  }

  if (!hasMore.value) return

  isLoading.value = true
  try {
    // Apply mapping to search term (e.g. "Tarta Vasca" -> "Tarta de Queso")
    const query = getOfficialName(searchTerm.value)

    const data = await ProductService.getProducts({
      filtro: query,
      page: currentPage.value,
      limit: pageSize
    })

    if (data.length < pageSize) {
      hasMore.value = false
    }

    if (isNewSearch) {
      products.value = data as Product[]
    } else {
      products.value = [...products.value, ...data as Product[]]
    }

    currentPage.value++
  } catch (e) {
    console.error(e)
  } finally {
    isLoading.value = false
  }
}

const handleSearch = () => {
  fetchProducts(true)
}

const loadMore = () => {
  fetchProducts(false)
}

onMounted(() => {
  fetchProducts(true)
})
</script>

<template>
  <section class="products-section">
    <div class="search-bar">
      <input 
        v-model="searchTerm" 
        @keyup.enter="handleSearch"
        placeholder="Buscar productos..." 
        type="text" 
      />
      <button @click="handleSearch" class="btn-search">Buscar</button>
    </div>

    <div class="products-container-scroll">
      <div class="products-grid">
        <OrderProductCard 
          v-for="product in products" 
          :key="product.id" 
          :product="product"
          @add="emit('add-to-cart', $event)"
        />
      </div>
      
      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <span>Cargando productos...</span>
      </div>

      <div v-if="!isLoading && products.length > 0 && hasMore" class="load-more-container">
        <button @click="loadMore" class="btn-secondary">Cargar más productos</button>
      </div>

      <div v-if="!isLoading && products.length === 0" class="empty-state">
        No se encontraron productos.
      </div>
    </div>
  </section>
</template>

<style lang="scss" scoped>
.search-bar {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;

  input {
    flex: 1;
    padding: 0.75rem 1rem;
    border: 1px solid $border-light;
    border-radius: 8px;
    font-family: $font-secondary;

    &:focus {
      outline: none;
      border-color: $NICOLE-PURPLE;
    }
  }

  .btn-search {
    background: $NICOLE-PURPLE;
    color: white;
    border: none;
    padding: 0 1.5rem;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;

    &:hover {
      background: $purple-hover;
    }
  }
}

.products-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 1rem;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: $text-light;
  gap: 1rem;

  .spinner {
    width: 30px;
    height: 30px;
    border: 3px solid rgba($NICOLE-PURPLE, 0.3);
    border-radius: 50%;
    border-top-color: $NICOLE-PURPLE;
    animation: spin 1s ease-in-out infinite;
  }
}

.load-more-container {
  display: flex;
  justify-content: center;
  padding: 1.5rem 0;

  button {
    background: $gray-100;
    border: 1px solid $border-light;
    padding: 0.75rem 2rem;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 500;
    color: $NICOLE-PURPLE;
    transition: all 0.2s;

    &:hover {
      background: $NICOLE-PURPLE;
      color: white;
    }
  }
}
</style>
