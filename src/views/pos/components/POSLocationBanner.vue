<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps({
  selectedBranch: {
    type: String,
    required: true,
  },
})

const emit = defineEmits<{
  (e: 'open-restock'): void
}>()

const isGlobal = computed(() => props.selectedBranch === 'Todas las sucursales')
const bannerClass = computed(() => props.selectedBranch.toLowerCase().replace(/\s+/g, '-'))
const displayName = computed(() => (isGlobal.value ? 'Global (Todas)' : props.selectedBranch))
</script>

<template>
  <div class="location-banner" :class="bannerClass">
    <div class="banner-icon"><i class="fa-solid fa-location-dot"></i></div>
    <div class="banner-text">
      <span class="label">Operando en</span>
      <span class="branch-name">{{ displayName }}</span>
    </div>
    <div class="banner-tag">{{ isGlobal ? 'REPORTES' : 'ACTIVO' }}</div>
    <button
      v-if="!isGlobal"
      class="btn-restock-inline"
      :title="'Cerrar caja de ' + selectedBranch"
      @click="emit('open-restock')"
    >
      <i class="fa-solid fa-clipboard-check"></i>
      <span>Cierre Caja</span>
    </button>
  </div>
</template>

<style lang="scss" scoped>
.location-banner {
  margin-top: 1.25rem;
  display: inline-flex;
  align-items: center;
  gap: 1.5rem;
  background: #F8FAFC;
  padding: 1rem 2rem;
  border-radius: 20px;
  border-left: 8px solid $NICOLE-PURPLE;
  animation: pulseIn 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
  position: relative;
  overflow: hidden;

  &.mall-del-sol {
    border-left-color: #3B82F6;

    .banner-icon {
      background: rgba(#3B82F6, 0.1);

      i {
        color: #3B82F6;
      }
    }
  }

  &.san-marino {
    border-left-color: #A855F7;

    .banner-icon {
      background: rgba(#A855F7, 0.1);

      i {
        color: #A855F7;
      }
    }
  }

  &.centro-de-producción {
    border-left-color: #F59E0B;

    .banner-icon {
      background: rgba(#F59E0B, 0.1);

      i {
        color: #F59E0B;
      }
    }
  }

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
    transform: translateX(-100%);
    animation: shine 3s infinite;
  }
}

.banner-icon {
  position: relative;
  z-index: 1;
  width: 48px;
  height: 48px;
  background: white;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);

  i {
    font-size: 1.5rem;
    color: $NICOLE-PURPLE;
  }
}

.banner-text {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;

  .label {
    font-size: 0.75rem;
    font-weight: 800;
    color: #64748B;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    margin-bottom: 2px;
  }

  .branch-name {
    font-size: 1.6rem;
    font-weight: 900;
    color: #0F172A;
    line-height: 1;
  }
}

.banner-tag {
  position: relative;
  z-index: 1;
  font-size: 0.7rem;
  background: #E2E8F0;
  color: #475569;
  padding: 0.2rem 0.7rem;
  border-radius: 20px;
  font-weight: 900;
  margin-left: 1rem;
  letter-spacing: 1px;
}

.btn-restock-inline {
  position: relative;
  z-index: 1;
  background: rgba(255, 255, 255, 0.15);
  color: #1E293B;
  border: 1.5px solid rgba(0, 0, 0, 0.12);
  padding: 0.5rem 1rem;
  border-radius: 10px;
  font-weight: 800;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  margin-left: auto;

  &:hover {
    background: rgba(255, 255, 255, 0.35);
    border-color: rgba(0, 0, 0, 0.2);
    transform: translateY(-1px);
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
  }
}

@keyframes pulseIn {
  from {
    transform: scale(0.95);
    opacity: 0;
  }

  to {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes shine {
  0% {
    transform: translateX(-100%);
  }

  20%,
  100% {
    transform: translateX(100%);
  }
}
</style>
