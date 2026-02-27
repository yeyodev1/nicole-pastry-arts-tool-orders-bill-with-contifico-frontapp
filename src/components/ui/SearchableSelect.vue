<script setup lang="ts">
import { ref, computed, watch } from 'vue'

interface Option {
  value: string
  label: string
  subtitle?: string
}

const props = defineProps({
  modelValue: { type: String, default: '' },
  options: { type: Array as () => Option[], required: true },
  placeholder: { type: String, default: 'Seleccionar...' },
  label: { type: String, default: '' },
  disabled: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue'])

const isOpen = ref(false)
const searchQuery = ref('')
const dropdownRef = ref<HTMLElement | null>(null)

const selectedOption = computed(() => {
  return props.options.find(opt => opt.value === props.modelValue)
})

const filteredOptions = computed(() => {
  if (!searchQuery.value) return props.options

  const query = searchQuery.value.toLowerCase()
  return props.options.filter(opt =>
    opt.label.toLowerCase().includes(query) ||
    (opt.subtitle && opt.subtitle.toLowerCase().includes(query))
  )
})

const toggleDropdown = () => {
  if (props.disabled) return
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    searchQuery.value = ''
  }
}

const selectOption = (value: string) => {
  emit('update:modelValue', value)
  isOpen.value = false
  searchQuery.value = ''
}

const handleClickOutside = (event: MouseEvent) => {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
    isOpen.value = false
    searchQuery.value = ''
  }
}

watch(isOpen, (newVal) => {
  if (newVal) {
    document.addEventListener('click', handleClickOutside)
  } else {
    document.removeEventListener('click', handleClickOutside)
  }
})
</script>

<template>
  <div class="searchable-select" ref="dropdownRef">
    <div 
      class="select-trigger" 
      :class="{ open: isOpen, disabled: disabled }"
      @click="toggleDropdown"
    >
      <div class="selected-value">
        <i class="fa-solid fa-shield-halved icon"></i>
        <span v-if="selectedOption" class="text">{{ selectedOption.label }}</span>
        <span v-else class="placeholder">{{ placeholder }}</span>
      </div>
      <i class="fa-solid fa-chevron-down arrow" :class="{ rotate: isOpen }"></i>
    </div>

    <transition name="dropdown">
      <div v-if="isOpen" class="dropdown-menu">
        <div class="search-box">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="Buscar rol..."
            @click.stop
          />
        </div>
        
        <div class="options-list">
          <div 
            v-for="option in filteredOptions" 
            :key="option.value"
            class="option-item"
            :class="{ selected: option.value === modelValue }"
            @click="selectOption(option.value)"
          >
            <div class="option-content">
              <span class="option-label">{{ option.label }}</span>
              <span v-if="option.subtitle" class="option-subtitle">{{ option.subtitle }}</span>
            </div>
            <i v-if="option.value === modelValue" class="fa-solid fa-check check-icon"></i>
          </div>
          
          <div v-if="filteredOptions.length === 0" class="no-results">
            <i class="fas fa-search"></i>
            <span>No se encontraron resultados</span>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style lang="scss" scoped>
.searchable-select {
  position: relative;
  width: 100%;
}

.select-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  background: white;
  border: 2px solid #e2e8f0;
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  user-select: none;

  &:hover:not(.disabled) {
    border-color: $NICOLE-PURPLE;
    background: #fdfaff;
  }

  &.open {
    border-color: $NICOLE-PURPLE;
    background: white;
    box-shadow: 0 0 0 4px rgba($NICOLE-PURPLE, 0.1);
  }

  &.disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .selected-value {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex: 1;

    .icon {
      color: #94a3b8;
      font-size: 0.9rem;
    }

    .text {
      font-weight: 600;
      color: #1e293b;
    }

    .placeholder {
      color: #94a3b8;
      font-weight: 500;
    }
  }

  .arrow {
    color: #94a3b8;
    font-size: 0.85rem;
    transition: transform 0.2s;

    &.rotate {
      transform: rotate(180deg);
    }
  }
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  background: white;
  border-radius: 18px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05);
  border: 1px solid #e2e8f0;
  z-index: 1000;
  overflow: hidden;
  animation: dropdownSlide 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes dropdownSlide {
  from {
    opacity: 0;
    transform: translateY(-8px) scale(0.98);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.search-box {
  position: relative;
  padding: 0.75rem;
  border-bottom: 1px solid #f1f5f9;

  i {
    position: absolute;
    left: 1.5rem;
    top: 50%;
    transform: translateY(-50%);
    color: #94a3b8;
    font-size: 0.85rem;
  }

  input {
    width: 100%;
    padding: 0.65rem 0.75rem 0.65rem 2.25rem;
    border: 2px solid #f1f5f9;
    border-radius: 10px;
    font-size: 0.95rem;
    background: #f8fafc;
    transition: all 0.2s;

    &:focus {
      outline: none;
      border-color: $NICOLE-PURPLE;
      background: white;
    }
  }
}

.options-list {
  max-height: 300px;
  overflow-y: auto;
  padding: 0.5rem;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: #f8fafc;
    border-radius: 10px;
  }

  &::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 10px;

    &:hover {
      background: #94a3b8;
    }
  }
}

.option-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.85rem 1rem;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: #f8fafc;
  }

  &.selected {
    background: rgba($NICOLE-PURPLE, 0.1);

    .option-label {
      color: $NICOLE-PURPLE;
      font-weight: 700;
    }
  }

  .option-content {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    flex: 1;
  }

  .option-label {
    font-size: 0.95rem;
    font-weight: 600;
    color: #1e293b;
  }

  .option-subtitle {
    font-size: 0.8rem;
    color: #94a3b8;
    font-weight: 500;
  }

  .check-icon {
    color: $NICOLE-PURPLE;
    font-size: 0.9rem;
  }
}

.no-results {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 2rem;
  color: #94a3b8;
  font-weight: 500;

  i {
    font-size: 2rem;
    opacity: 0.3;
  }
}

// Transition
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.dropdown-enter-from {
  opacity: 0;
  transform: translateY(-10px) scale(0.95);
}

.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}
</style>
