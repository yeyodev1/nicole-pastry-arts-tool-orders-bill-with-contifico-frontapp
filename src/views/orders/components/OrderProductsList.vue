<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  products: any[],
  computedTotal: number
}>()
</script>

<template>
  <section class="card products-card">
    <h2>Productos</h2>
    <div class="table-wrapper">
       <table>
         <thead>
           <tr>
             <th>Producto</th>
             <th class="text-right">Precio Unit.</th>
             <th class="text-center">Cant.</th>
             <th class="text-right">Total</th>
           </tr>
         </thead>
         <tbody>
           <tr v-for="(item, idx) in products" :key="idx">
             <td>{{ item.name }}</td>
             <td class="text-right">${{ item.price.toFixed(2) }}</td>
             <td class="text-center">{{ item.quantity }}</td>
             <td class="text-right font-bold">${{ (item.price * item.quantity).toFixed(2) }}</td>
           </tr>
         </tbody>
         <tfoot>
           <tr>
             <td colspan="3" class="text-right label-total">Total:</td>
             <td class="text-right value-total">${{ computedTotal.toFixed(2) }}</td>
           </tr>
         </tfoot>
       </table>
    </div>
  </section>
</template>

<style lang="scss" scoped>
.card {
  background: white;
  border-radius: 12px;
  border: 1px solid $border-light;
  padding: 1.25rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.01);
  width: 100%;
  box-sizing: border-box;

  h2 {
    margin: 0 0 1rem 0;
    font-size: 1.1rem;
    color: $text-dark;
    font-weight: 700;
    padding-bottom: 0.5rem;
    border-bottom: 2px solid $gray-50;
  }
}

.table-wrapper {
  overflow-x: auto;
  border-radius: 8px;
  border: 1px solid $border-light;
  background: white;

  table {
    width: 100%;
    min-width: 500px;
    border-collapse: collapse;

    th {
      text-align: left;
      padding: 0.75rem;
      background: $gray-50;
      color: $text-dark;
      font-weight: 700;
      font-size: 0.8rem;
      text-transform: uppercase;
    }

    td {
      padding: 0.75rem;
      border-bottom: 1px solid $border-light;
      font-size: 0.9rem;
      color: $text-dark;
    }

    tfoot {
      background-color: $gray-50;

      td {
        border-top: 2px solid $border-light;
        padding: 1rem 0.75rem;
        font-weight: 700;
      }

      .value-total {
        font-size: 1.2rem;
        color: $NICOLE-PURPLE;
      }
    }
  }
}

.text-right {
  text-align: right;
}

.text-center {
  text-align: center;
}

.font-bold {
  font-weight: 700;
}
</style>
