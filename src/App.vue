<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router'
import NavBar from './components/NavBar.vue'
import ProductionNavBar from './components/ProductionNavBar.vue'

const route = useRoute()
</script>

<template>
  <div class="app-layout">
    <ProductionNavBar v-if="route.meta.role === 'production'" />
    <NavBar v-else-if="route.name !== 'login'" />
    <RouterView />
  </div>
</template>

<style scoped>
.app-layout {
  min-height: 100vh;
  background-color: var(--color-background);
}
</style>
