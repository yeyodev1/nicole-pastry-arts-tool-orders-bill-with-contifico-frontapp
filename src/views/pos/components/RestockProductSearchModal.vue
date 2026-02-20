<script setup lang="ts">
import { type PropType, computed } from 'vue';
import type { RestockProduct } from '@/views/pos/composables/useRestockModal';
import RestockConfig from './RestockConfig.vue';
import type { WeeklyObjectives } from '@/services/pos-restock.service';

const props = defineProps({
  isOpen: { type: Boolean, required: true },
  branch: { type: String, required: true },
  initialProduct: { type: Object as PropType<RestockProduct>, default: null },
  initialObjectives: { type: Object as PropType<WeeklyObjectives>, default: null }
});

const emit = defineEmits(['close', 'success', 'update:branch', 'notify']);

const branches = ['San Marino', 'Mall del Sol', 'Centro de Producción'];

const selectedBranch = computed({
  get: () => props.branch,
  set: (val) => emit('update:branch', val)
});

const handleSuccess = () => {
  emit('success');
  emit('notify', { message: 'Configuración guardada correctamente', type: 'success' });
  handleClose();
};

const handleClose = () => {
  emit('close');
};
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen" class="modal-backdrop" @click.self="handleClose">
      <div class="modal-card">
        <header class="modal-header">
          <div class="header-left">
             <h3>Configurar Restock</h3>
             <div class="branch-select-wrapper">
                <i class="fa-solid fa-store"></i>
                <select v-model="selectedBranch">
                  <option v-for="b in branches" :key="b" :value="b">{{ b }}</option>
                </select>
             </div>
          </div>
          <button class="close-btn" @click="handleClose" aria-label="Cerrar">&times;</button>
        </header>

        <div class="modal-body">
          <RestockConfig 
            :branch="branch"
            :initial-product="initialProduct"
            :initial-objectives="initialObjectives"
            @success="handleSuccess"
            @close="handleClose"
          />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style lang="scss" scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10000;
  padding: 1rem;
  box-sizing: border-box;
}

.modal-card {
  background-color: white;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  margin: auto;
}

.modal-header {
  padding: 1rem 1.5rem;
  border-bottom: 1px solid $border-light;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;

  .header-left {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;

    h3 {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 600;
      color: $text-dark;
    }
  }

  .branch-select-wrapper {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: #f8fafc;
    padding: 0.25rem 0.5rem;
    border-radius: 6px;
    border: 1px solid $border-light;
    width: fit-content;

    i {
      font-size: 0.8rem;
      color: $text-light;
    }

    select {
      border: none;
      background: transparent;
      font-size: 0.85rem;
      color: $text-dark;
      font-weight: 500;
      outline: none;
      cursor: pointer;
      padding-right: 1rem;
    }
  }

  .close-btn {
    background: transparent;
    border: none;
    font-size: 1.75rem;
    line-height: 1;
    color: $text-light;
    cursor: pointer;
    padding: 0;
    transition: color 0.2s;

    &:hover {
      color: $text-dark;
    }
  }
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  min-height: 300px;
}
</style>

