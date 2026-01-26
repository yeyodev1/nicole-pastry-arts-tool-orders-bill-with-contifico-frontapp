<script setup lang="ts">
import { computed } from 'vue'
import type { CartItem } from '@/types/order'

const props = defineProps<{
  cart: CartItem[]
  isSubmitting: boolean
}>()

const emit = defineEmits<{
  (e: 'remove', index: number): void
  (e: 'update-quantity', index: number, change: number): void
  (e: 'submit'): void
}>()

const cartTotal = computed(() => {
  return props.cart.reduce((total, item) => total + (item.price * item.quantity), 0)
})

const cartSubtotal = computed(() => cartTotal.value)

const cartIVA = computed(() => {
  return props.cart.reduce((totalIVA, item) => {
    // Check if item is Delivery (0% IVA)
    const isDelivery = item.name.toLowerCase().includes('delivery')

    if (isDelivery) {
      return totalIVA // No IVA
    } else {
      return totalIVA + (item.price * item.quantity * 0.15)
    }
  }, 0)
})

const finalTotal = computed(() => cartSubtotal.value + cartIVA.value)

const onDecrease = (item: CartItem, index: number) => {
  if (item.quantity > 1) {
    emit('update-quantity', index, -1)
  } else {
    emit('remove', index)
  }
}
</script>

<template>
  <div class="card cart-card">
    <h2>Detalle del Pedido</h2>
    <div class="cart-items">
      <div v-for="(item, index) in cart" :key="index" class="cart-item">
        <div class="item-details">
          <span class="item-name">{{ item.name }}</span>
          <span class="item-price">${{ item.price.toFixed(2) }}</span>
        </div>
        <div class="item-controls">
          <button @click="onDecrease(item, index)">-</button>
          <span>{{ item.quantity }}</span>
          <button @click="emit('update-quantity', index, 1)">+</button>
        </div>
      </div>
      <div v-if="cart.length === 0" class="empty-cart">
        No hay items en el pedido
      </div>
    </div>

    <div class="totals">
      <div class="total-row">
        <span>Subtotal:</span>
        <span>${{ cartSubtotal.toFixed(2) }}</span>
      </div>
      <div class="total-row">
        <span>IVA (15% est):</span>
        <span>${{ cartIVA.toFixed(2) }}</span>
      </div>
      <div class="total-row final">
        <span>Total:</span>
        <span>${{ finalTotal.toFixed(2) }}</span>
      </div>
    </div>

    <button 
      class="btn-submit" 
      @click="emit('submit')" 
      :disabled="cart.length === 0 || isSubmitting"
    >
      {{ isSubmitting ? 'Procesando...' : 'Generar Pedido' }}
    </button>
  </div>
</template>

<style lang="scss" scoped>
.card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  border: 1px solid $border-light;
  margin-bottom: 1.5rem;

  h2 {
    font-family: $font-principal;
    font-size: 1.25rem;
    color: $NICOLE-SECONDARY;
    margin-top: 0;
    border-bottom: 1px solid $border-light;
    padding-bottom: 0.5rem;
    margin-bottom: 1rem;
  }
}

.cart-items {
  margin-bottom: 1.5rem;
  max-height: 300px;
  overflow-y: auto;
}

.cart-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 0;
  border-bottom: 1px solid $border-light;

  .item-details {
    flex: 1;

    .item-name {
      display: block;
      font-size: 0.9rem;
      font-weight: 500;
    }

    .item-price {
      font-size: 0.85rem;
      color: $text-light;
    }
  }

  .item-controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;

    button {
      width: 24px;
      height: 24px;
      border: 1px solid $border-light;
      background: white;
      border-radius: 4px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;

      &:hover {
        background: $gray-100;
      }
    }

    span {
      font-weight: 600;
      min-width: 20px;
      text-align: center;
    }
  }
}

.totals {
  border-top: 2px solid $border-light;
  padding-top: 1rem;
  margin-bottom: 1.5rem;

  .total-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.5rem;
    font-size: 0.9rem;
    color: $text-light;

    &.final {
      font-size: 1.1rem;
      font-weight: 700;
      color: $text-dark;
      margin-top: 0.5rem;
    }
  }
}

.btn-submit {
  width: 100%;
  background: $NICOLE-PURPLE;
  color: white;
  border: none;
  padding: 1rem;
  border-radius: 8px;
  font-weight: 700;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    background: $purple-dark;
    transform: translateY(-2px);
  }

  &:disabled {
    background: $gray-400;
    cursor: not-allowed;
  }
}
</style>
