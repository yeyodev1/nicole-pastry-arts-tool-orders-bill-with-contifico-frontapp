<script setup lang="ts">
import type { Product } from '@/types/order'
import { useProductImage } from '@/composables/useProductImage'
import { computed, ref } from 'vue'

const props = defineProps<{
  product: Product
  // Indica si el producto está bloqueado por la restricción de mezcla de marcas
  isBlocked?: boolean
}>()

const emit = defineEmits<{
  (e: 'add', product: Product): void
}>()

const { imageSrc, isLoading } = useProductImage(props.product.imagen)

const isDelivery = computed(() => {
  return props.product.nombre.toLowerCase().includes('delivery')
})

const manualPrice = ref<number | string>('')

// Etiqueta de marca según la fuente del producto
const brandLabel = computed(() => {
  if (props.product.source === 'sucree') return 'Sucree'
  if (props.product.source === 'nicole') return 'Nicole'
  return null // Si no tiene fuente (catálogo único), no mostrar badge
})

const handleAdd = () => {
  // Si está bloqueado, el componente padre (OrderProductSelector) maneja el aviso
  if (props.isBlocked) {
    emit('add', props.product)
    return
  }

  if (isDelivery.value) {
    const priceToUse = Number(manualPrice.value) || 0
    emit('add', {
      ...props.product,
      pvp1: priceToUse.toString()
    })
  } else {
    emit('add', props.product)
  }
}
</script>

<template>
  <div class="product-card" :class="{ 'is-blocked': isBlocked }">
    <!-- Badge de marca (solo si hay múltiples fuentes) -->
    <div v-if="brandLabel" class="brand-badge" :class="product.source">
      {{ brandLabel }}
    </div>

    <div class="product-image" :class="{ 'is-loading': isLoading }">
      <img
        :src="imageSrc"
        :alt="product.nombre"
      />
      <div v-if="isLoading" class="loading-overlay">
        <span class="spinner-sm"></span>
      </div>
      <!-- Overlay de bloqueo cuando la marca no coincide con el carrito -->
      <div v-if="isBlocked" class="blocked-overlay">
        <i class="fa-solid fa-lock"></i>
      </div>
    </div>

    <div class="product-content">
      <div class="product-info">
        <h3>{{ product.nombre }}</h3>
        <p class="description">{{ product.descripcion || 'Deliciosas creaciones de Nicole Pastry Arts' }}</p>
      </div>
      <div class="product-actions">
        <div v-if="isDelivery && !isBlocked" class="manual-price-container">
          <span class="currency">$</span>
          <input
            type="number"
            v-model="manualPrice"
            placeholder="0.00"
            step="0.01"
            class="manual-price-input"
            @click.stop
          />
        </div>
        <span v-else class="price">${{ parseFloat(product.pvp1 || '0').toFixed(2) }}</span>

        <button
          @click="handleAdd"
          class="btn-add"
          :class="{ 'btn-blocked': isBlocked }"
          :title="isBlocked ? 'No se puede mezclar con el carrito actual' : 'Agregar al carrito'"
        >
          <i v-if="isBlocked" class="fa-solid fa-lock"></i>
          <span v-else>Agregar</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.product-card {
  background: white;
  border: 1px solid $border-light;
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.02);
  position: relative;

  &:hover:not(.is-blocked) {
    border-color: $NICOLE-PURPLE;
    transform: translateY(-4px);
    box-shadow: 0 12px 20px rgba(0, 0, 0, 0.08);
  }

  // Estado bloqueado: opacidad reducida, sin hover effect
  &.is-blocked {
    opacity: 0.45;
    filter: grayscale(30%);
    cursor: not-allowed;
  }
}

// Badge de marca en la esquina superior
.brand-badge {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 2;
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  pointer-events: none;

  // Nicole: morado
  &.nicole {
    background: rgba($NICOLE-PURPLE, 0.9);
    color: white;
  }

  // Sucree: ámbar/dorado
  &.sucree {
    background: rgba(#f59e0b, 0.9);
    color: white;
  }
}

.product-image {
  width: 100%;
  height: 140px;
  background: $gray-100;
  position: relative;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &.is-loading img {
    opacity: 0.5;
  }

  .loading-overlay {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .spinner-sm {
    width: 20px;
    height: 20px;
    border: 2px solid rgba($NICOLE-PURPLE, 0.3);
    border-radius: 50%;
    border-top-color: $NICOLE-PURPLE;
    animation: spin 1s ease-in-out infinite;
  }

  // Overlay de candado cuando está bloqueado
  .blocked-overlay {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.5);

    i {
      font-size: 1.5rem;
      color: #94a3b8;
    }
  }
}

.product-content {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  gap: 1rem;
}

.product-info {
  flex-grow: 1;

  h3 {
    font-size: 1rem;
    margin: 0 0 0.5rem 0;
    color: $text-dark;
    font-weight: 600;
    line-height: 1.3;
  }

  .description {
    font-size: 0.85rem;
    color: $text-light;
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
}

.product-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid $gray-100;
  padding-top: 0.75rem;
  margin-top: auto;

  .price {
    font-weight: 700;
    color: $NICOLE-SECONDARY;
    font-size: 1.1rem;
  }

  .manual-price-container {
    display: flex;
    align-items: center;
    background: #fdf2f8;
    border: 1px dashed $NICOLE-PURPLE;
    border-radius: 6px;
    padding: 0 0.5rem;
    width: 80px;

    .currency {
      font-weight: 600;
      color: $NICOLE-PURPLE;
      font-size: 0.9rem;
      margin-right: 2px;
    }

    .manual-price-input {
      width: 100%;
      border: none;
      background: transparent;
      font-weight: 700;
      color: $NICOLE-SECONDARY;
      font-size: 1rem;
      padding: 0.25rem 0;
      outline: none;
      text-align: right;

      &::placeholder {
        color: rgba($NICOLE-SECONDARY, 0.4);
        font-weight: 400;
      }

      &::-webkit-inner-spin-button,
      &::-webkit-outer-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }
    }
  }

  .btn-add {
    background: $gray-50;
    border: 1px solid $gray-200;
    color: $text-dark;
    font-weight: 600;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.85rem;
    transition: all 0.2s;

    &:hover:not(.btn-blocked) {
      background: $NICOLE-PURPLE;
      border-color: $NICOLE-PURPLE;
      color: white;
    }

    // Botón bloqueado: gris, cursor no-drop
    &.btn-blocked {
      background: #f1f5f9;
      border-color: #e2e8f0;
      color: #94a3b8;
      cursor: not-allowed;
      padding: 0.5rem 0.75rem;
    }
  }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
