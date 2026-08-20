<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router'
import AppSidebar from './components/AppSidebar.vue'
import ToastContainer from './components/ToastContainer.vue'
import SessionExpiredModal from './components/SessionExpiredModal.vue'
import DialogModal from './components/DialogModal.vue'
import UpdateBanner from './components/UpdateBanner.vue'
import PaymentNotice from './components/PaymentNotice.vue'

const route = useRoute()
</script>

<template>
  <div class="app-shell">
    <AppSidebar v-if="route.name !== 'login' && route.name !== 'kitchen-display'" />
    <div class="content-area" :class="{ 'full-width': route.name === 'login' || route.name === 'kitchen-display' }">
      <RouterView />
    </div>
    <ToastContainer />
    <DialogModal />
    <SessionExpiredModal />
    <UpdateBanner />
    <PaymentNotice />
  </div>
</template>

<style scoped>
/* Espacio para la barra fija de aviso de pago (PaymentNotice) */
.app-shell {
  padding-top: 40px;
  box-sizing: border-box;
  display: flex;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background-color: var(--color-background);
}

.content-area {
  flex: 1;
  min-width: 0;
  height: 100vh;
  height: 100dvh;
  overflow-y: auto;
  overflow-x: hidden;
}

.content-area.full-width {
  width: 100%;
}

@media (max-width: 1023px) {
  .content-area:not(.full-width) {
    padding-top: 52px;
  }
}
</style>
