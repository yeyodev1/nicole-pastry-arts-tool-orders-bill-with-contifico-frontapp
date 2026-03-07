<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import RawMaterialService from '@/services/raw-material.service'
import ProviderCategoryService from '@/services/provider-category.service'
import type { IProviderCategory } from '@/services/provider-category.service'

const props = defineProps<{ isOpen: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const materials = ref<any[]>([])
const categories = ref<IProviderCategory[]>([])
const isLoading = ref(false)
const searchQuery = ref('')
const activeCategory = ref('')
let searchTimeout: any = null

// Fetch when panel opens
watch(() => props.isOpen, async (open) => {
  if (!open) return
  if (materials.value.length > 0) return // already loaded
  await loadAll()
})

const loadAll = async () => {
  isLoading.value = true
  try {
    const [mats, cats] = await Promise.all([
      RawMaterialService.getRawMaterials(),
      ProviderCategoryService.getCategories()
    ])
    materials.value = mats
    categories.value = cats
  } finally {
    isLoading.value = false
  }
}

const handleSearchInput = () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(async () => {
    isLoading.value = true
    try {
      materials.value = await RawMaterialService.getRawMaterials(
        searchQuery.value || undefined,
        undefined,
        activeCategory.value || undefined
      )
    } finally {
      isLoading.value = false
    }
  }, 350)
}

const selectCategory = async (catName: string) => {
  activeCategory.value = catName
  isLoading.value = true
  try {
    materials.value = await RawMaterialService.getRawMaterials(
      searchQuery.value || undefined,
      undefined,
      catName || undefined
    )
  } finally {
    isLoading.value = false
  }
}

const clearAll = async () => {
  searchQuery.value = ''
  activeCategory.value = ''
  await loadAll()
}

const getDisplayUnit = (unit: string) => {
  if (unit === 'g') return 'kg'
  if (unit === 'ml') return 'lt'
  return unit
}

const getDisplayQty = (qty: number, unit: string) => {
  if (unit === 'g' || unit === 'ml') return (qty / 1000).toFixed(2)
  return qty
}

const stockClass = (m: any) => {
  if (m.quantity === 0) return 'stock-zero'
  if (m.minStock > 0 && m.quantity < m.minStock) return 'stock-low'
  return 'stock-ok'
}

const hasFilters = computed(() => searchQuery.value || activeCategory.value)
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <Transition name="fade">
      <div v-if="isOpen" class="panel-backdrop" @click="emit('close')" />
    </Transition>

    <!-- Panel -->
    <Transition name="slide">
      <div v-if="isOpen" class="search-panel" role="dialog" aria-label="Catálogo de productos">

        <!-- Header -->
        <div class="panel-header">
          <div class="panel-title">
            <i class="fas fa-boxes"></i>
            <div>
              <h2>Catálogo de Productos</h2>
              <p>{{ isLoading ? 'Cargando...' : `${materials.length} resultado(s)` }}</p>
            </div>
          </div>
          <button class="btn-close-panel" @click="emit('close')" aria-label="Cerrar">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <!-- Search -->
        <div class="panel-search">
          <div class="search-field">
            <i class="fas fa-search search-icon"></i>
            <input
              v-model="searchQuery"
              @input="handleSearchInput"
              placeholder="Buscar por nombre o código..."
              class="search-input"
              type="search"
              autofocus
            />
            <button v-if="hasFilters" class="btn-clear-search" @click="clearAll" title="Limpiar filtros">
              <i class="fas fa-times-circle"></i>
            </button>
          </div>
        </div>

        <!-- Category chips -->
        <div class="category-bar" v-if="categories.length > 0">
          <button
            class="cat-chip"
            :class="{ active: activeCategory === '' }"
            @click="selectCategory('')"
          >
            Todas
          </button>
          <button
            v-for="cat in categories"
            :key="cat._id"
            class="cat-chip"
            :class="{ active: activeCategory === cat.name }"
            @click="selectCategory(cat.name)"
          >
            {{ cat.name }}
            <span class="chip-count" v-if="cat.materialCount">{{ cat.materialCount }}</span>
          </button>
        </div>

        <!-- Results -->
        <div class="panel-body">
          <!-- Loading skeleton -->
          <div v-if="isLoading" class="skeleton-list">
            <div v-for="i in 6" :key="i" class="skeleton-row">
              <div class="sk sk-code"></div>
              <div class="sk-info">
                <div class="sk sk-name"></div>
                <div class="sk sk-sub"></div>
              </div>
              <div class="sk sk-stock"></div>
            </div>
          </div>

          <!-- Empty -->
          <div v-else-if="materials.length === 0" class="empty-results">
            <i class="fas fa-search"></i>
            <p>No se encontraron productos</p>
            <span>Intenta con otro nombre o categoría</span>
          </div>

          <!-- List -->
          <ul v-else class="product-list">
            <li
              v-for="m in materials"
              :key="m._id"
              class="product-row"
              :class="stockClass(m)"
            >
              <code class="prod-code">{{ m.code || '--' }}</code>
              <div class="prod-info">
                <span class="prod-name">{{ m.name }}</span>
                <div class="prod-meta">
                  <span class="prod-cat" v-if="m.category">
                    <i class="fas fa-tag"></i> {{ m.category }}
                  </span>
                  <span class="prod-provider" v-if="m.provider?.name">
                    <i class="fas fa-truck"></i> {{ m.provider.name }}
                  </span>
                </div>
              </div>
              <div class="prod-right">
                <div class="prod-stock" :class="stockClass(m)">
                  {{ getDisplayQty(m.quantity, m.unit) }}
                  <span class="prod-unit">{{ getDisplayUnit(m.unit) }}</span>
                </div>
                <div class="prod-cost">${{ m.cost?.toFixed(3) }}/{{ getDisplayUnit(m.unit) }}</div>
              </div>
            </li>
          </ul>
        </div>

      </div>
    </Transition>
  </Teleport>
</template>

<style lang="scss" scoped>
// Transitions
.fade-enter-active, .fade-leave-active { transition: opacity 0.25s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.slide-enter-active { transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
.slide-leave-active { transition: transform 0.25s cubic-bezier(0.4, 0, 1, 1); }
.slide-enter-from, .slide-leave-to { transform: translateX(100%); }

// Backdrop
.panel-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(3px);
  z-index: 200;
}

// Panel
.search-panel {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  max-width: 480px;
  background: white;
  z-index: 201;
  display: flex;
  flex-direction: column;
  box-shadow: -20px 0 60px rgba(0, 0, 0, 0.15);
}

// Header
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem 1.5rem 1.25rem;
  border-bottom: 1px solid #f1f5f9;
  flex-shrink: 0;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 0.85rem;

  > i {
    font-size: 1.4rem;
    color: $NICOLE-PURPLE;
    background: rgba($NICOLE-PURPLE, 0.08);
    width: 44px;
    height: 44px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  h2 {
    font-size: 1.05rem;
    font-weight: 900;
    color: #1e293b;
    margin: 0;
  }

  p {
    font-size: 0.78rem;
    color: #94a3b8;
    font-weight: 600;
    margin: 0.15rem 0 0;
  }
}

.btn-close-panel {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  border: none;
  background: #f1f5f9;
  color: #64748b;
  font-size: 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  flex-shrink: 0;

  &:hover { background: #fee2e2; color: #ef4444; }
}

// Search
.panel-search {
  padding: 1rem 1.25rem 0.75rem;
  flex-shrink: 0;
}

.search-field {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 1rem;
  color: #94a3b8;
  font-size: 0.9rem;
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: 0.85rem 2.75rem 0.85rem 2.75rem;
  border: 2px solid #e2e8f0;
  border-radius: 14px;
  font-size: 0.95rem;
  font-weight: 600;
  background: #f8fafc;
  color: #1e293b;
  outline: none;
  transition: all 0.2s;

  &:focus {
    border-color: $NICOLE-PURPLE;
    background: white;
    box-shadow: 0 0 0 4px rgba($NICOLE-PURPLE, 0.08);
  }

  &::placeholder { color: #cbd5e1; font-weight: 500; }

  // Hide native clear button
  &::-webkit-search-cancel-button { display: none; }
}

.btn-clear-search {
  position: absolute;
  right: 0.75rem;
  background: none;
  border: none;
  color: #94a3b8;
  font-size: 1rem;
  cursor: pointer;
  padding: 0.25rem;
  display: flex;
  align-items: center;
  transition: color 0.15s;

  &:hover { color: #ef4444; }
}

// Category chips bar
.category-bar {
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem 1.25rem 0.75rem;
  overflow-x: auto;
  flex-shrink: 0;
  scrollbar-width: none;

  &::-webkit-scrollbar { display: none; }
}

.cat-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.9rem;
  border-radius: 99px;
  border: 1.5px solid #e2e8f0;
  background: white;
  color: #64748b;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
  flex-shrink: 0;

  &:hover { border-color: $NICOLE-PURPLE; color: $NICOLE-PURPLE; }

  &.active {
    background: $NICOLE-PURPLE;
    border-color: $NICOLE-PURPLE;
    color: white;

    .chip-count { background: rgba(white, 0.25); color: white; }
  }

  .chip-count {
    background: #f1f5f9;
    color: #94a3b8;
    font-size: 0.7rem;
    font-weight: 800;
    padding: 0.1rem 0.4rem;
    border-radius: 99px;
  }
}

// Body / scrollable list
.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem 0;
  border-top: 1px solid #f8fafc;
}

// Product list
.product-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.product-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem 1.25rem;
  border-bottom: 1px solid #f8fafc;
  transition: background 0.1s;
  cursor: default;

  &:hover { background: #fcfcfd; }

  &.stock-zero { background: #fff1f2; }
  &.stock-low { background: #fffbeb; }

  &:last-child { border-bottom: none; }
}

.prod-code {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.72rem;
  font-weight: 800;
  color: #64748b;
  background: #f1f5f9;
  padding: 0.3rem 0.5rem;
  border-radius: 7px;
  flex-shrink: 0;
  min-width: 52px;
  text-align: center;
}

.prod-info {
  flex: 1;
  min-width: 0;

  .prod-name {
    display: block;
    font-size: 0.9rem;
    font-weight: 700;
    color: #1e293b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .prod-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.2rem;
  }

  .prod-cat, .prod-provider {
    font-size: 0.72rem;
    font-weight: 600;
    color: #94a3b8;
    display: flex;
    align-items: center;
    gap: 0.25rem;

    i { font-size: 0.65rem; }
  }

  .prod-cat { color: $NICOLE-PURPLE; }
}

.prod-right {
  text-align: right;
  flex-shrink: 0;
}

.prod-stock {
  font-size: 0.9rem;
  font-weight: 900;
  color: #1e293b;
  font-family: 'JetBrains Mono', monospace;

  .prod-unit {
    font-size: 0.7rem;
    font-weight: 700;
    color: #94a3b8;
    margin-left: 2px;
  }

  &.stock-zero { color: #ef4444; }
  &.stock-low { color: #f97316; }
  &.stock-ok { color: #16a34a; }
}

.prod-cost {
  font-size: 0.72rem;
  font-weight: 700;
  color: #94a3b8;
  margin-top: 0.1rem;
}

// Loading skeleton
.skeleton-list {
  padding: 0.5rem 0;
}

.skeleton-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem 1.25rem;
  border-bottom: 1px solid #f8fafc;
}

.sk {
  background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
  border-radius: 6px;
  flex-shrink: 0;

  &-code  { width: 52px; height: 28px; border-radius: 7px; }
  &-name  { width: 140px; height: 14px; border-radius: 4px; margin-bottom: 6px; }
  &-sub   { width: 90px; height: 11px; border-radius: 4px; }
  &-stock { width: 52px; height: 32px; border-radius: 8px; margin-left: auto; }
}

.sk-info { flex: 1; }

@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

// Empty state
.empty-results {
  text-align: center;
  padding: 5rem 2rem;
  color: #94a3b8;

  i { font-size: 2.5rem; margin-bottom: 1rem; opacity: 0.3; display: block; }
  p { font-size: 1rem; font-weight: 700; color: #475569; margin: 0 0 0.35rem; }
  span { font-size: 0.85rem; font-weight: 500; }
}
</style>
