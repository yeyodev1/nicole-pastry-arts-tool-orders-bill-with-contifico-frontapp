<script setup lang="ts">
import ActionHoldButton from '@/components/common/ActionHoldButton.vue';

const props = defineProps<{
  isOpen: boolean
  count: number
  skippedCount?: number
}>()


const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm'): void
}>()
</script>

<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="emit('close')">
    <div class="modal-content">
      <div class="icon-wrapper">
         <i class="fas fa-file-invoice-dollar"></i>
      </div>
      
      <h3>Reintentar {{ count }} Facturas</h3>
      
      <p class="description">
        ¿Verificaste si los datos son correctos?
      </p>
      
      <div v-if="skippedCount && skippedCount > 0" class="warning-box">
         <i class="fas fa-exclamation-triangle"></i>
         <p><strong>Atención:</strong> {{ skippedCount }} ordenes fueron omitidas por falta de RUC/Email.</p>
      </div>

      <p class="sub-description">
        Esta acción enviará {{ count }} facturas al SRI en segundo plano.
      </p>


      <div class="actions">
        <button class="btn-cancel" @click="emit('close')">Cancelar</button>
        <div class="hold-btn-wrapper">
            <ActionHoldButton 
                :duration="2000" 
                color="#8b5cf6" 
                label="MANTÉN 2S PARA ENVIAR"
                @trigger="emit('confirm')"
            />
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  z-index: 2000;
  display: flex;
  justify-content: center;
  align-items: center;
  animation: fadeIn 0.2s ease;
}

.modal-content {
  background: white;
  padding: 2rem;
  border-radius: 20px;
  width: 90%;
  max-width: 400px;
  text-align: center;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  animation: scaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.icon-wrapper {
  width: 60px;
  height: 60px;
  background: #f3e8ff;
  color: #8b5cf6;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  margin: 0 auto 1.5rem;
}

h3 {
  margin: 0 0 1rem;
  color: #1e293b;
  font-size: 1.25rem;
  font-weight: 700;
}

.description {
  color: #475569;
  margin-bottom: 0.5rem;
  font-size: 1rem;
  font-weight: 500;
}

.sub-description {
  color: #94a3b8;
  font-size: 0.85rem;
  margin-bottom: 2rem;
  line-height: 1.4;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.btn-cancel {
  background: transparent;
  border: none;
  color: #64748b;
  font-weight: 600;
  padding: 0.75rem;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s;

  &:hover {
    background: #f1f5f9;
    color: #334155;
  }
}

.hold-btn-wrapper {
  height: 48px;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

@keyframes scaleUp {
  from {
    transform: scale(0.9);
    opacity: 0;
  }

  to {
    transform: scale(1);
    opacity: 1;
  }
}

.warning-box {
  background: #ffffff;
  border: 1px solid #fecaca;
  background-color: #fef2f2;
  color: #b91c1c;
  padding: 0.75rem;
  border-radius: 8px;
  font-size: 0.9rem;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  text-align: left;

  i {
    color: #dc2626;
  }

  p {
    margin: 0;
  }
}
</style>
