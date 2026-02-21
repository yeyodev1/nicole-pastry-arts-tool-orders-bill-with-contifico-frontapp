<script setup lang="ts">
import { computed } from 'vue'
import POSLocationBanner from './POSLocationBanner.vue'
import SearchableSelect from '@/components/ui/SearchableSelect.vue'

const props = defineProps({
  selectedBranch: {
    type: String,
    required: true,
  },
  branches: {
    type: Array as () => string[],
    required: true,
  },
  hasPendingDispatches: {
    type: Boolean,
    default: false,
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
  isExporting: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits<{
  (e: 'update:selectedBranch', value: string): void
  (e: 'open-restock'): void
  (e: 'open-bulk'): void
  (e: 'export'): void
  (e: 'refresh'): void
}>()

const branchOptions = computed(() =>
  props.branches.map(b => ({ value: b, label: b }))
)
</script>

<template>
  <div class="page-header">
    <div class="title-group">
      <h1><i class="fa-solid fa-store"></i> Gestión de Sucursal</h1>
      <POSLocationBanner
        :selectedBranch="selectedBranch"
        @open-restock="emit('open-restock')"
      />
    </div>

    <div class="controls">
      <Transition name="bulk-btn">
        <button v-if="hasPendingDispatches" class="btn-bulk" @click="emit('open-bulk')">
          <i class="fa-solid fa-boxes-stacked"></i> Recepción Masiva
        </button>
      </Transition>

      <div class="separator"></div>

      <div class="branch-selector-group">
        <span class="selector-label">Estás en:</span>
        <div class="branch-selector-wrap">
          <SearchableSelect
            :modelValue="selectedBranch"
            :options="branchOptions"
            placeholder="Seleccionar sucursal..."
            @update:modelValue="emit('update:selectedBranch', $event)"
          />
        </div>
      </div>

      <button class="btn-refresh" title="Actualizar" @click="emit('refresh')">
        <i class="fa-solid fa-arrows-rotate" :class="{ 'fa-spin': isLoading }"></i>
      </button>

      <div class="separator"></div>

      <button class="btn-export-dispatch" :class="{ 'is-loading': isExporting }" @click="emit('export')">
        <i :class="isExporting ? 'fas fa-spinner fa-spin' : 'fas fa-file-excel'"></i>
        {{ isExporting ? 'Exportando...' : 'Exportar Reporte' }}
      </button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
$tablet: 768px;

@mixin from-tablet {
  @media (min-width: #{$tablet}) {
    @content;
  }
}

.page-header {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 1.5rem 0 1rem;
  width: 100%;

  @include from-tablet {
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    padding: 2rem 0 1rem;
  }
}

.title-group {
  flex: 1 1 auto;
  min-width: 0;

  h1 {
    font-family: $font-principal;
    color: $NICOLE-PURPLE;
    margin: 0;
    font-size: 1.4rem;
    line-height: 1.2;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;

    @include from-tablet {
      font-size: 1.8rem;
      flex-wrap: nowrap;
    }
  }
}

.controls {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;

  @include from-tablet {
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: center;
    justify-content: flex-start;
    gap: 0.5rem;
    width: 100%;
  }
}

.btn-export-dispatch {
  background: #F0FDF4;
  color: #16A34A;
  border: 1px solid #DCFCE7;
  padding: 0.8rem 1.2rem;
  border-radius: 8px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: all 0.2s;
  width: 100%;
  font-size: 0.95rem;

  @include from-tablet {
    width: auto;
    padding: 0.6rem 1.2rem;
    font-size: 0.85rem;
    margin-left: auto;
  }

  &:hover {
    background: #DCFCE7;
    border-color: #BBF7D0;
    transform: translateY(-1px);
  }

  &.is-loading {
    cursor: wait;
    opacity: 0.85;
  }
}

.btn-bulk {
  background: $NICOLE-SECONDARY;
  color: white;
  border: none;
  padding: 0.8rem 1rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  box-shadow: 0 4px 10px rgba($NICOLE-SECONDARY, 0.2);
  transition: all 0.2s;
  width: 100%;
  font-size: 0.95rem;

  @include from-tablet {
    width: auto;
    padding: 0.6rem 1.2rem;
    font-size: 0.9rem;
  }

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 14px rgba($NICOLE-SECONDARY, 0.3);
  }
}

/* Recepción Masiva transition */
.bulk-btn-enter-active,
.bulk-btn-leave-active {
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.bulk-btn-enter-from,
.bulk-btn-leave-to {
  opacity: 0;
  transform: translateX(-12px) scale(0.95);
  max-width: 0;
  padding-inline: 0;
  margin-inline: 0;
}

.bulk-btn-enter-to,
.bulk-btn-leave-from {
  opacity: 1;
  transform: translateX(0) scale(1);
}


.separator {
  display: none;
  width: 1px;
  height: 24px;
  background: $border-light;
  margin: 0 0.25rem;

  @include from-tablet {
    display: block;
  }
}

.branch-selector-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;

  @include from-tablet {
    width: auto;
  }

  .selector-label {
    font-size: 0.75rem;
    font-weight: 800;
    color: #64748B;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    white-space: nowrap;
    display: none;

    @include from-tablet {
      display: block;
    }
  }
}

.branch-selector-wrap {
  flex: 1;

  @include from-tablet {
    width: 220px;
    flex: none;
  }
}

.btn-refresh {
  background: white;
  border: 1px solid $border-light;
  width: 100%;
  height: 44px;
  border-radius: 8px;
  cursor: pointer;
  color: $text-light;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.03);

  @include from-tablet {
    width: 40px;
    height: 40px;
  }

  &:hover {
    color: $NICOLE-PURPLE;
    border-color: $NICOLE-PURPLE;
  }

  i {
    transition: transform 0.5s ease;
  }

  &:hover i {
    transform: rotate(180deg);
  }
}
</style>
