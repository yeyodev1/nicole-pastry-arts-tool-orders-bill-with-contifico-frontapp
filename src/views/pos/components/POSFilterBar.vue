<script setup lang="ts">
import CustomDatePicker from '@/components/ui/CustomDatePicker.vue'

export type POSFilterMode = 'yesterday' | 'today' | 'tomorrow' | 'all' | 'custom'

const props = defineProps({
  filterMode: {
    type: String as () => POSFilterMode,
    required: true,
  },
  customDate: {
    type: String,
    required: true,
  },
  searchQuery: {
    type: String,
    required: true,
  },
  showDatePicker: {
    type: Boolean,
    required: true,
  }
});

const emit = defineEmits<{
  (e: 'update:filterMode', value: POSFilterMode): void
  (e: 'update:customDate', value: string): void
  (e: 'update:searchQuery', value: string): void
  (e: 'search'): void
}>()
</script>

<template>
  <div class="pos-filter-bar">
    <!-- Search Row -->
    <div class="search-section">
      <div class="search-wrapper">
        <i class="fa-solid fa-magnifying-glass"></i>
        <input 
          type="text" 
          :value="searchQuery"
          @input="emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
          placeholder="Buscar Cliente o # Orden..."
          @keyup.enter="emit('search')"
        />
      </div>
    </div>

    <!-- Date Filters Row -->
    <div class="filters-section">
      <div class="quick-filters">
          <button 
            class="filter-pill" 
            :class="{ active: filterMode === 'yesterday' }"
            @click="emit('update:filterMode', 'yesterday')"
          >
            Ayer
          </button>
          <button 
            class="filter-pill" 
            :class="{ active: filterMode === 'today' }"
            @click="emit('update:filterMode', 'today')"
          >
            Hoy
          </button>
          <button 
            class="filter-pill" 
            :class="{ active: filterMode === 'tomorrow' }"
            @click="emit('update:filterMode', 'tomorrow')"
          >
            Mañana
          </button>
          <button 
            class="filter-pill" 
            :class="{ active: filterMode === 'all' }"
            @click="emit('update:filterMode', 'all')"
          >
            Ver Todo
          </button>
          <button 
            class="filter-pill" 
            :class="{ active: filterMode === 'custom' }"
            @click="emit('update:filterMode', 'custom')"
          >
            <i class="fa-solid fa-calendar-days"></i> Fecha...
          </button>
      </div>
    </div>

    <!-- Date Picker (Conditional) -->
    <transition name="fade-slide">
      <div class="datepicker-section" v-if="showDatePicker">
        <div class="date-picker-container">
            <CustomDatePicker 
              :model-value="customDate" 
              @update:model-value="emit('update:customDate', $event)"
              placeholder="Seleccionar Fecha Específica"
            />
        </div>
      </div>
    </transition>
  </div>
</template>

<style lang="scss" scoped>
.pos-filter-bar {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  background: white;
  padding: 1rem;
  border-radius: 16px;
  border: 1px solid #E2E8F0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
  margin-bottom: 2rem;
  width: 100%;
  box-sizing: border-box;

  // Search Section - Always full width on mobile
  .search-section {
    width: 100%;

    .search-wrapper {
      position: relative;
      width: 100%;

      i {
        position: absolute;
        left: 14px;
        top: 50%;
        transform: translateY(-50%);
        color: #94A3B8;
        font-size: 0.9rem;
      }

      input {
        width: 100%;
        padding: 0.8rem 1rem 0.8rem 2.6rem;
        border-radius: 12px;
        border: 1px solid #E2E8F0;
        background: #F8FAFC;
        font-size: 0.95rem;
        transition: all 0.2s;
        box-sizing: border-box;
        outline: none;

        &:focus {
          background: white;
          border-color: $NICOLE-PURPLE;
          box-shadow: 0 0 0 4px rgba($NICOLE-PURPLE, 0.1);
        }

        &::placeholder {
          color: #94A3B8;
        }
      }
    }
  }

  // Filters Section - Horizontal Scroll on Mobile
  .filters-section {
    width: 100%;
    margin: 0 -1rem; // Bleed effect for scroll
    padding: 0 1rem;
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;

    &::-webkit-scrollbar {
      display: none;
    }

    .quick-filters {
      display: flex;
      gap: 0.5rem;
      width: max-content;
      padding-bottom: 0.2rem;

      .filter-pill {
        flex: 0 0 auto;
        padding: 0.6rem 1rem;
        border-radius: 20px;
        border: 1px solid #E2E8F0;
        background: white;
        color: #64748B;
        font-weight: 700;
        font-size: 0.8rem;
        cursor: pointer;
        white-space: nowrap;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 0.4rem;

        &:active {
          transform: scale(0.95);
        }

        &.active {
          background: $NICOLE-PURPLE;
          color: white;
          border-color: $NICOLE-PURPLE;
          box-shadow: 0 4px 10px rgba($NICOLE-PURPLE, 0.2);
        }
      }
    }
  }

  .datepicker-section {
    width: 100%;
    padding-top: 0.8rem;
    border-top: 1px solid #F1F5F9;

    .date-picker-container {
      width: 100%;
      max-width: 100%;
    }
  }
}

// Tablet and Desktop Optimizations
@media (min-width: 768px) {
  .pos-filter-bar {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    padding: 1.2rem;
    gap: 1.5rem;

    .search-section {
      flex: 1;
      min-width: 300px;
    }

    .filters-section {
      width: auto;
      margin: 0;
      padding: 0;
      overflow: visible;

      .quick-filters {
        width: auto;
        gap: 0.6rem;

        .filter-pill {
          font-size: 0.85rem;
          padding: 0.6rem 1.2rem;
        }
      }
    }

    .datepicker-section {
      width: 100%;
      margin-top: 0.5rem;
    }
  }
}

// Transitions
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.3s ease;
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
