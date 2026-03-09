<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps({
  isOpen: { type: Boolean, required: true },
  providers: { type: Array as () => any[], required: true }
})

const emit = defineEmits(['close', 'select'])

const search = ref('')

const filtered = computed(() => {
  if (!search.value.trim()) return props.providers
  const q = search.value.toLowerCase()
  return props.providers.filter(p => p.name.toLowerCase().includes(q))
})
</script>

<template>
  <Teleport to="body">
    <transition name="modal-bounce">
      <div v-if="isOpen" class="modal-overlay" @click.self="$emit('close')">
        <div class="modal-content select-provider-modal">
          <div class="modal-header">
            <div class="header-info">
              <h2><i class="fas fa-truck"></i> Seleccionar Proveedor</h2>
              <p>El material quedará asociado al proveedor que elijas</p>
            </div>
            <button class="btn-close" @click="$emit('close')">&times;</button>
          </div>

          <div class="modal-body">
            <div class="search-wrap">
              <i class="fas fa-search"></i>
              <input
                v-model="search"
                placeholder="Buscar proveedor..."
                autofocus
              />
            </div>

            <div class="providers-list">
              <button
                v-for="p in filtered"
                :key="p._id"
                class="provider-card"
                @click="$emit('select', p)"
              >
                <div class="provider-avatar">{{ p.name.charAt(0) }}</div>
                <div class="provider-info">
                  <span class="name">{{ p.name }}</span>
                  <span class="meta" v-if="p.ruc">RUC: {{ p.ruc }}</span>
                  <span class="meta" v-else-if="p.phone">{{ p.phone }}</span>
                </div>
                <i class="fas fa-chevron-right arrow"></i>
              </button>

              <div v-if="filtered.length === 0" class="empty-state">
                <i class="fas fa-search"></i>
                <p>No se encontraron proveedores</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<style lang="scss" scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.4);
  backdrop-filter: blur(8px);
  display: flex;
  justify-content: center;
  align-items: flex-end;
  z-index: 2000;
  padding: 0;

  @media (min-width: 640px) {
    align-items: center;
    padding: 1rem;
  }
}

.select-provider-modal {
  background: white;
  width: 100%;
  max-width: 560px;
  max-height: 80vh;
  border-radius: 28px 28px 0 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 -25px 50px -12px rgba(0, 0, 0, 0.15);

  @media (min-width: 640px) {
    border-radius: 36px;
    max-height: 75vh;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15);
  }
}

.modal-bounce-enter-active {
  transition: opacity 0.35s ease-out;
  .select-provider-modal { transition: all 0.45s cubic-bezier(0.34, 1.56, 0.64, 1); }
}
.modal-bounce-leave-active {
  transition: opacity 0.25s ease-in;
  .select-provider-modal { transition: all 0.25s ease-in; }
}
.modal-bounce-enter-from {
  opacity: 0;
  .select-provider-modal {
    transform: translateY(100%);
    @media (min-width: 640px) { transform: translateY(24px) scale(0.92); }
  }
}
.modal-bounce-leave-to {
  opacity: 0;
  .select-provider-modal {
    transform: translateY(100%);
    @media (min-width: 640px) { transform: translateY(16px) scale(0.96); }
  }
}

.modal-header {
  padding: 1.5rem;
  border-bottom: 1px solid #f1f5f9;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-shrink: 0;

  @media (min-width: 640px) {
    padding: 2rem 2.5rem;
    align-items: center;
  }

  .header-info {
    flex: 1;
    padding-right: 1rem;

    h2 {
      font-size: 1.2rem;
      font-weight: 900;
      color: #1e293b;
      margin: 0;
      letter-spacing: -0.02em;
      display: flex;
      align-items: center;
      gap: 0.6rem;

      i { color: $NICOLE-PURPLE; font-size: 1rem; }

      @media (min-width: 640px) {
        font-size: 1.5rem;
      }
    }

    p {
      font-size: 0.85rem;
      font-weight: 500;
      color: #94a3b8;
      margin: 0.35rem 0 0;
    }
  }

  .btn-close {
    background: #f1f5f9;
    border: none;
    width: 36px;
    height: 36px;
    border-radius: 12px;
    color: #64748b;
    cursor: pointer;
    font-size: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    flex-shrink: 0;

    @media (min-width: 640px) {
      width: 44px;
      height: 44px;
      border-radius: 14px;
    }

    &:active { transform: scale(0.95); }

    @media (hover: hover) {
      &:hover {
        background: #fee2e2;
        color: #ef4444;
      }
    }
  }
}

.modal-body {
  padding: 1.25rem 1.5rem;
  overflow-y: auto;
  flex: 1;

  @media (min-width: 640px) {
    padding: 1.5rem 2.5rem 2rem;
  }
}

.search-wrap {
  position: relative;
  margin-bottom: 1.25rem;

  i {
    position: absolute;
    left: 1rem;
    top: 50%;
    transform: translateY(-50%);
    color: #94a3b8;
    font-size: 0.9rem;
  }

  input {
    width: 100%;
    padding: 0.85rem 1rem 0.85rem 2.6rem;
    border: 2px solid #e2e8f0;
    border-radius: 14px;
    font-size: 0.95rem;
    font-weight: 600;
    background: #f8fafc;
    transition: all 0.2s;

    &:focus {
      outline: none;
      border-color: $NICOLE-PURPLE;
      background: white;
      box-shadow: 0 0 0 4px rgba($NICOLE-PURPLE, 0.1);
    }
  }
}

.providers-list {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.provider-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border: 2px solid #f1f5f9;
  border-radius: 18px;
  background: white;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s;
  width: 100%;

  &:active { transform: scale(0.99); }

  @media (hover: hover) {
    &:hover {
      border-color: $NICOLE-PURPLE;
      background: rgba($NICOLE-PURPLE, 0.03);

      .arrow { color: $NICOLE-PURPLE; }
      .provider-avatar { background: $NICOLE-PURPLE; }
    }
  }
}

.provider-avatar {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: #e2e8f0;
  color: #475569;
  font-size: 1.2rem;
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.2s, color 0.2s;

  .provider-card:hover & {
    color: white;
  }
}

.provider-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;

  .name {
    font-size: 0.95rem;
    font-weight: 800;
    color: #1e293b;
    line-height: 1.2;
  }

  .meta {
    font-size: 0.78rem;
    font-weight: 600;
    color: #94a3b8;
  }
}

.arrow {
  color: #cbd5e1;
  font-size: 0.85rem;
  flex-shrink: 0;
  transition: color 0.2s;
}

.empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: #94a3b8;

  i {
    font-size: 2rem;
    margin-bottom: 0.75rem;
    display: block;
    opacity: 0.3;
  }

  p {
    font-size: 0.95rem;
    font-weight: 600;
  }
}
</style>
