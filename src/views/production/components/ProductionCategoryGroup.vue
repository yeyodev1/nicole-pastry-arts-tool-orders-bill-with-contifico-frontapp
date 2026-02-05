<script setup lang="ts">
import ProductionItemRow from './ProductionItemRow.vue'

interface OrderDetail {
  id: string
  quantity: number
  client: string
  delivery: string
  stage: string
}

interface Item {
  _id: string
  totalQuantity: number
  urgency: string
  category?: string
  orders: OrderDetail[]
  isExpanded?: boolean
  currentInput?: number
  mode?: 'all' | 'custom'
}

interface CategoryGroup {
  name: string
  items: Item[]
  isExpanded: boolean
  id: string
}

defineProps<{
  category: CategoryGroup
  urgencyType: string
  selectedIds?: Set<string>
}>()

const emit = defineEmits(['toggle-category', 'toggle-item', 'register-item', 'void-item', 'toggle-selection'])
// ... (transitions stay same)
const handleVoidItem = (item: any) => {
  emit('void-item', item)
}

const enter = (el: Element) => {
  const element = el as HTMLElement
  element.style.height = 'auto'
  const height = getComputedStyle(element).height
  element.style.height = '0'

  // Force reflow
  getComputedStyle(element).height

  requestAnimationFrame(() => {
    element.style.height = height
  })
}

const afterEnter = (el: Element) => {
  const element = el as HTMLElement
  element.style.height = 'auto'
}

const leave = (el: Element) => {
  const element = el as HTMLElement
  element.style.height = getComputedStyle(element).height

  // Force reflow
  getComputedStyle(element).height

  requestAnimationFrame(() => {
    element.style.height = '0'
  })
}
</script>

<template>
    <div class="category-group">
        <div class="category-header" @click="emit('toggle-category', category)">
<!-- ... (header stays same) -->
        </div>

        <Transition
            name="accordion"
            @enter="enter"
            @after-enter="afterEnter"
            @leave="leave"
        >
            <div v-show="category.isExpanded" class="category-items">
                <TransitionGroup name="list-fade">
                    <ProductionItemRow 
                        v-for="item in category.items" 
                        :key="item._id" 
                        :item="item"
                        :urgency-type="urgencyType"
                        :is-selected="selectedIds ? selectedIds.has(item._id) : false"
                        @toggle-expand="(itm) => emit('toggle-item', itm)"
                        @register="(itm) => emit('register-item', itm)"
                        @void-item="handleVoidItem"
                        @toggle-selection="(itm) => emit('toggle-selection', itm)"
                    />
                </TransitionGroup>
            </div>
        </Transition>
    </div>
</template>

<style lang="scss" scoped>
.category-group {
  margin-bottom: 1.5rem;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.02);
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.04);
}

.category-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  cursor: pointer;
  background: #8e44ad;
  transition: background 0.2s;
  user-select: none;

  .cat-title {
    display: flex;
    align-items: center;
    gap: 0.8rem;
    font-weight: 700;
    font-size: 1.1rem;
    color: white;

    i {
      color: white;
      font-size: 1rem;
    }
  }

  .cat-meta {
    display: flex;
    align-items: center;
    gap: 1rem;

    .cat-count {
      font-size: 0.85rem;
      color: white;
      font-weight: 600;
    }

    i {
      color: white;
      transition: transform 0.3s ease;

      &.rotated {
        transform: rotate(180deg);
      }
    }
  }
}

.category-items {
  border-top: 1px solid #f1f2f6;
  padding: 0.5rem;
  background: #fcfcfc;
}

/* List Transitions */
.list-fade-enter-active,
.list-fade-leave-active {
  transition: all 0.4s ease;
}

.list-fade-enter-from,
.list-fade-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

.list-fade-leave-active {
  position: absolute;
  width: calc(100% - 1rem);
  /* Maintain width during leave */
}

/* Move Transition */
.list-fade-move {
  transition: transform 0.4s ease;
}
</style>
