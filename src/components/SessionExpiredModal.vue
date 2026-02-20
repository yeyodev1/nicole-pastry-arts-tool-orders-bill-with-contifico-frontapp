<script setup lang="ts">
import { useSessionExpired } from '@/composables/useSessionExpired';

const { isSessionExpired, countdown, logoutNow } = useSessionExpired();
</script>

<template>
  <Teleport to="body">
    <div v-if="isSessionExpired" class="expiry-overlay">
      <div class="expiry-modal">
        <div class="icon-wrapper">
          <i class="fa-solid fa-hourglass-end"></i>
        </div>
        
        <h2>Sesión Expirada</h2>
        
        <p class="message">
          Tu sesión ha caducado por seguridad.<br>
          Serás redirigido al inicio de sesión en:
        </p>

        <div class="countdown-circle">
          <span class="seconds">{{ countdown }}</span>
        </div>

        <button class="btn-logout" @click="logoutNow">
          Cerrar Sesión Ahora
        </button>
      </div>
    </div>
  </Teleport>
</template>

<style lang="scss" scoped>
.expiry-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85); // Darker backdrop for focus
  backdrop-filter: blur(8px);
  z-index: 9999; // Topmost
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.3s ease;
}

.expiry-modal {
  background: white;
  width: 90%;
  max-width: 380px;
  border-radius: 24px;
  padding: 2.5rem 2rem;
  text-align: center;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  align-items: center;
  animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.icon-wrapper {
  width: 64px;
  height: 64px;
  background: #fff1f2;
  color: #e11d48;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.8rem;
  margin-bottom: 1.5rem;
  border: 1px solid #fecdd3;
}

h2 {
  font-size: 1.4rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 0.75rem;
}

.message {
  color: #6b7280;
  font-size: 0.95rem;
  line-height: 1.5;
  margin: 0 0 2rem;
}

.countdown-circle {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  border: 4px solid #e11d48;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 2rem;

  .seconds {
    font-size: 2.5rem;
    font-weight: 800;
    color: #e11d48;
    font-variant-numeric: tabular-nums;
  }
}

.btn-logout {
  background: #1f2937;
  color: white;
  border: none;
  padding: 0.9rem 1.5rem;
  border-radius: 12px;
  font-weight: 600;
  font-size: 0.95rem;
  cursor: pointer;
  width: 100%;
  transition: background 0.2s;

  &:hover {
    background: #111827;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }

  to {
    transform: translateY(0);
    opacity: 1;
  }
}
</style>
