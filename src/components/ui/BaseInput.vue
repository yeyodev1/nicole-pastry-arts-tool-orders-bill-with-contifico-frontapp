<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  modelValue: string | number
  label?: string
  type?: string
  placeholder?: string
  disabled?: boolean
  step?: string
  hint?: string
}>()

const emit = defineEmits(['update:modelValue'])

const inputValue = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})
</script>

<template>
  <div class="base-input-wrapper">
    <label v-if="label" class="input-label">{{ label }}</label>
    <div class="input-container">
        <input 
        v-model="inputValue"
        :type="type || 'text'"
        :placeholder="placeholder"
        :disabled="disabled"
        :step="step"
        class="base-input"
        />
    </div>
    <small v-if="hint" class="input-hint">{{ hint }}</small>
  </div>
</template>

<style lang="scss" scoped>
.base-input-wrapper {
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

.base-input {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid $border-light;
  border-radius: 8px;
  /* More rounded premium feel */
  font-size: 1rem;
  transition: all 0.2s ease;
  background: #fff;
  color: $text-dark;

  &::placeholder {
    color: rgba($text-dark, 0.4);
  }

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

.input-hint {
  display: block;
  font-size: 0.8rem;
  color: $text-light;
  margin-top: 0.35rem;
}
</style>
