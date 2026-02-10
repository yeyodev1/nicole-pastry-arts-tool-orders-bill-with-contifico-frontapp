<script setup lang="ts">
import { RouterView, useRoute, useRouter } from 'vue-router'
import NavBar from './components/NavBar.vue'
import ProductionNavBar from './components/ProductionNavBar.vue'
import SupplyChainNavBar from './components/SupplyChain/SupplyChainNavBar.vue'
import ToastContainer from './components/ToastContainer.vue'
import { onMounted, onUnmounted } from 'vue'

const route = useRoute()
const router = useRouter()

const handleTokenExpired = () => {
  localStorage.removeItem('access_token')
  localStorage.removeItem('user_info')
  router.push('/login')
}

onMounted(() => {
  window.addEventListener('auth:token-expired', handleTokenExpired)
})

onUnmounted(() => {
  window.removeEventListener('auth:token-expired', handleTokenExpired)
})
</script>

<template>
  <div class="app-layout">
    <ProductionNavBar v-if="route.meta.role === 'production'" />
    <SupplyChainNavBar v-else-if="route.meta.role === 'SUPPLY_CHAIN_MANAGER'" />
    <NavBar v-else-if="route.name !== 'login'" />
    <RouterView />
    <ToastContainer />
  </div>
</template>

<style scoped>
.app-layout {
  min-height: 100vh;
  background-color: var(--color-background);
}
</style>
