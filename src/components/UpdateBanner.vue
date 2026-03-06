<script setup lang="ts">
import { useRegisterSW } from 'virtual:pwa-register/vue'

const { needRefresh, updateServiceWorker } = useRegisterSW({
  onRegisterError(error) {
    console.error('SW registration error:', error)
  },
})

const update = () => updateServiceWorker(true)
const dismiss = () => { needRefresh.value = false }
</script>

<template>
  <Transition name="banner-slide">
    <div v-if="needRefresh" class="update-banner" role="alert">
      <div class="banner-icon">
        <i class="fa-solid fa-rotate"></i>
      </div>
      <div class="banner-text">
        <strong>¡Nueva versión disponible!</strong>
        <span>Se publicaron mejoras. Recarga para verlas.</span>
      </div>
      <div class="banner-actions">
        <button class="btn-update" @click="update">
          <i class="fa-solid fa-arrow-rotate-right"></i>
          Actualizar ahora
        </button>
        <button class="btn-dismiss" @click="dismiss" title="Recordar después">
          <i class="fa-solid fa-times"></i>
        </button>
      </div>
    </div>
  </Transition>
</template>

<style lang="scss" scoped>
.update-banner {
  position: fixed;
  bottom: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 1rem;
  background: #0f172a;
  color: white;
  padding: 0.9rem 1.1rem 0.9rem 1rem;
  border-radius: 14px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.28), 0 0 0 1px rgba(255, 255, 255, 0.06);
  z-index: 9999;
  max-width: calc(100vw - 2rem);
  width: max-content;

  @media (max-width: 520px) {
    flex-direction: column;
    align-items: flex-start;
    width: calc(100vw - 2rem);
    bottom: 1rem;
  }
}

.banner-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: rgba($NICOLE-PURPLE, 0.25);
  border: 1px solid rgba($NICOLE-PURPLE, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  i {
    font-size: 0.95rem;
    color: #c4b5fd;
  }
}

.banner-text {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;

  strong {
    font-size: 0.88rem;
    font-weight: 800;
    color: white;
    line-height: 1.2;
  }

  span {
    font-size: 0.75rem;
    color: #94a3b8;
    line-height: 1.3;
  }
}

.banner-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;

  @media (max-width: 520px) {
    width: 100%;
    .btn-update { flex: 1; justify-content: center; }
  }
}

.btn-update {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  background: $NICOLE-PURPLE;
  color: white;
  border: none;
  font-weight: 700;
  font-size: 0.82rem;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s, transform 0.15s;

  i { font-size: 0.78rem; }

  &:hover {
    background: lighten($NICOLE-PURPLE, 6%);
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
}

.btn-dismiss {
  width: 30px;
  height: 30px;
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #64748b;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  transition: background 0.15s, color 0.15s;
  flex-shrink: 0;

  &:hover {
    background: rgba(255, 255, 255, 0.12);
    color: #94a3b8;
  }
}

// ── Slide-up transition ───────────────────────────────────
.banner-slide-enter-active {
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}
.banner-slide-leave-active {
  transition: all 0.2s ease-in;
}
.banner-slide-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(20px);
}
.banner-slide-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(12px);
}
</style>
