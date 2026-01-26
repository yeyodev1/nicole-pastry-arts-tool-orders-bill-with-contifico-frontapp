<script setup lang="ts">
import { computed } from 'vue'

interface Option {
  value: string | number
  label: string
}

const props = defineProps<{
  modelValue: string | number
  label?: string
  options: Option[]
  disabled?: boolean
  placeholder?: string
}>()

const emit = defineEmits(['update:modelValue'])

const selectedValue = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})
</script>

<template>
  <div class="base-select-wrapper">
    <label v-if="label" class="input-label">{{ label }}</label>
    <div class="select-container">
        <select 
            v-model="selectedValue"
            :disabled="disabled"
            class="base-select"
        >
            <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
            <option v-for="opt in options" :key="opt.value" :value="opt.value">
                {{ opt.label }}
            </option>
        </select>
        <!-- Adding a custom chevron icon could be here, but using native select for reliability for now -->
    </div>
  </div>
</template>

<style lang="scss" scoped>
.base-select-wrapper {
  margin-bottom: 1rem;
  width: 100%;
}

.input-label {
  display: block;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
  font-weight: 500;
  color: $text-dark;
}

.base-select {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid $border-light;
  border-radius: 8px;
  font-size: 1rem;
  background-color: #fff;
  transition: all 0.2s ease;
  cursor: pointer;
  color: $text-dark;
  appearance: none; // Reset native appearance to style properly later if needed, but keeping simple for now
  /* Re-adding arrow manually if appearance is none */
  background-image: url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%236d6d6d%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4l128-128c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E");
  background-repeat: no-repeat;
  background-position: right 1rem center;
  background-size: 0.65em auto;
  padding-right: 2.5rem;

  &:focus {
    outline: none;
    border-color: $NICOLE-PURPLE;
    box-shadow: 0 0 0 3px rgba($NICOLE-PURPLE, 0.1);
  }

  &:disabled {
    background-color: #f8f9fa;
    cursor: not-allowed;
    color: $text-light;
  }
}
</style>
