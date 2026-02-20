<script setup lang="ts">
import { RouterView, useRoute, useRouter } from 'vue-router'
import NavBar from './components/NavBar.vue'
import ProductionNavBar from './components/ProductionNavBar.vue'
import SupplyChainNavBar from './components/SupplyChain/SupplyChainNavBar.vue'
import ToastContainer from './components/ToastContainer.vue'
import SessionExpiredModal from './components/SessionExpiredModal.vue'

const route = useRoute()
const router = useRouter()
</script>

<template>
  <div class="app-layout">
    <ProductionNavBar v-if="route.meta.role === 'production'" />
    <SupplyChainNavBar v-else-if="route.meta.role === 'SUPPLY_CHAIN_MANAGER'" />
    <NavBar v-else-if="route.name !== 'login'" />
    <RouterView />
    <ToastContainer />
    <SessionExpiredModal />
  </div>
</template>

<style scoped>
.app-layout {
  min-height: 100vh;
  background-color: var(--color-background);
}
</style>
