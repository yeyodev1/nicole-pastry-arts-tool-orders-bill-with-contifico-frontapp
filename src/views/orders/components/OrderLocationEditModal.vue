<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import ProductionSettingsService from '@/services/production-settings.service'

const props = defineProps<{
  isOpen: boolean
  currentValue: string
  title: string
  type: 'branch' | 'exitPoint' | 'deliveryAddress' | 'googleMapsLink'
}>()

const emit = defineEmits(['close', 'save'])

const destinations = ref<string[]>([])
const selectedValue = ref('')
const isLoading = ref(false)

const isTextInput = computed(() => 
  props.type === 'deliveryAddress' || props.type === 'googleMapsLink'
)

const fetchDestinations = async () => {
  if (isTextInput.value) return
  isLoading.value = true
  try {
    const settings = await ProductionSettingsService.getSettings()
    destinations.value = settings.destinations.map(d => d.name)
  } catch (error) {
    console.error('Error fetching destinations:', error)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchDestinations()
  selectedValue.value = props.currentValue
})

const handleSave = () => {
  emit('save', { type: props.type, value: selectedValue.value })
}
</script>

<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="emit('close')">
    <div class="modal-content">
      <header class="modal-header">
        <h3>{{ title }}</h3>
        <button class="btn-close" @click="emit('close')">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </header>

      <div class="modal-body">
        <p class="hint">Actualiza la información logística para este pedido:</p>
        
        <div v-if="isLoading" class="loading-state">
          <div class="spinner"></div>
          <span>Cargando opciones...</span>
        </div>

        <div v-else-if="isTextInput" class="text-input-container">
          <label class="input-label">Nuevo valor:</label>
          <textarea 
            v-if="type === 'deliveryAddress'"
            v-model="selectedValue"
            class="styled-textarea"
            placeholder="Introduce la dirección completa..."
            rows="4"
          ></textarea>
          <input 
            v-else
            v-model="selectedValue"
            type="url"
            class="styled-input"
            placeholder="https://maps.google.com/..."
          />
        </div>

        <div v-else class="options-grid">
          <label 
            v-for="dest in destinations" 
            :key="dest" 
            class="option-card"
            :class="{ 
              active: selectedValue === dest, 
              'is-current': props.currentValue === dest 
            }"
          >
            <input 
              type="radio" 
              name="destination" 
              :value="dest" 
              v-model="selectedValue" 
            />
            <div class="option-info">
              <i class="fa-solid fa-location-dot"></i>
              <div class="name-wrapper">
                <span class="dest-name">{{ dest }}</span>
                <span v-if="props.currentValue === dest" class="current-badge">Actual</span>
              </div>
            </div>
            <i v-if="selectedValue === dest" class="fa-solid fa-circle-check check-icon"></i>
          </label>
        </div>
      </div>

      <footer class="modal-footer">
        <button class="btn-secondary" @click="emit('close')">Cancelar</button>
        <button class="btn-primary" :disabled="!selectedValue" @click="handleSave">
          Confirmar Cambio
        </button>
      </footer>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-content {
  background: white;
  border-radius: 20px;
  width: 100%;
  max-width: 500px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: modalIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes modalIn {
  from { opacity: 0; transform: scale(0.95) translateY(10px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

.modal-header {
  padding: 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #f1f5f9;

  h3 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 800;
    color: #1e293b;
    font-family: $font-principal;
  }

  .btn-close {
    background: #f1f5f9;
    border: none;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #64748b;
    cursor: pointer;
    transition: all 0.2s;

    &:hover { background: #e2e8f0; color: #1e293b; }
  }
}

.modal-body {
  padding: 1.5rem;
  max-height: 60vh;
  overflow-y: auto;

  .hint {
    color: #64748b;
    font-size: 0.9rem;
    margin-bottom: 1.5rem;
  }
}

.text-input-container {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;

  .input-label {
    font-weight: 700;
    font-size: 0.9rem;
    color: #334155;
  }

  .styled-input, .styled-textarea {
    width: 100%;
    padding: 1rem;
    border: 2px solid #e2e8f0;
    border-radius: 12px;
    font-family: $font-principal;
    font-size: 1rem;
    color: #1e293b;
    transition: all 0.2s;

    &:focus {
      outline: none;
      border-color: $NICOLE-PURPLE;
      box-shadow: 0 0 0 4px rgba($NICOLE-PURPLE, 0.1);
    }
  }

  .styled-textarea {
    resize: none;
  }
}

.options-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
}

.option-card {
  position: relative;
  border: 2px solid #f1f5f9;
  border-radius: 12px;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: space-between;

  &:hover {
    border-color: #e2e8f0;
    background: #f8fafc;
  }

  &.active {
    border-color: $NICOLE-PURPLE;
    background: rgba($NICOLE-PURPLE, 0.03);
    box-shadow: 0 4px 12px rgba($NICOLE-PURPLE, 0.1);
    
    .option-info {
      color: $NICOLE-PURPLE;
      i { color: $NICOLE-PURPLE; }
    }
  }

  &.is-current {
    background-color: #f8fafc;
    border-style: dashed;
  }

  input { display: none; }

  .option-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-weight: 700;
    color: #475569;
    font-size: 1rem;

    .name-wrapper {
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
    }

    .current-badge {
      font-size: 0.65rem;
      color: #64748b;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      line-height: 1;
    }

    i {
      color: #94a3b8;
      font-size: 1.1rem;
    }
  }

  .check-icon {
    color: $NICOLE-PURPLE;
    font-size: 1.2rem;
  }
}

.modal-footer {
  padding: 1.5rem;
  border-top: 1px solid #f1f5f9;
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  background: #f8fafc;

  button {
    padding: 0.75rem 1.5rem;
    border-radius: 10px;
    font-weight: 700;
    font-size: 0.95rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-secondary {
    background: white;
    border: 1px solid #e2e8f0;
    color: #64748b;
    &:hover { background: #f1f5f9; }
  }

  .btn-primary {
    background: $NICOLE-PURPLE;
    border: none;
    color: white;
    box-shadow: 0 4px 12px rgba($NICOLE-PURPLE, 0.3);
    
    &:hover { transform: translateY(-1px); box-shadow: 0 6px 15px rgba($NICOLE-PURPLE, 0.4); }
    &:disabled { background: #cbd5e1; box-shadow: none; cursor: not-allowed; transform: none; }
  }
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2rem;
  color: #64748b;

  .spinner {
    width: 30px;
    height: 30px;
    border: 3px solid #f1f5f9;
    border-top-color: $NICOLE-PURPLE;
    border-radius: 50%;
    animation: spin 0.8s infinite linear;
  }
}

@keyframes spin { to { transform: rotate(360deg); } }
</style>
