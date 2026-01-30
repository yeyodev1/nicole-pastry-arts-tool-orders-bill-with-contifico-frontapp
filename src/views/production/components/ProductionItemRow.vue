<script setup lang="ts">
import ActionHoldButton from '@/components/common/ActionHoldButton.vue'
import { parseECTDate } from '@/utils/dateUtils'

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

const props = defineProps<{
  item: Item
  urgencyType: string // 'delayed' | 'today' | 'tomorrow' | 'future'
}>()

const emit = defineEmits(['register', 'toggle-expand', 'void-item'])

const formatDisplayDate = (dateString: string) => {
  if (!dateString) return '-'
  const date = parseECTDate(dateString)

  // Check if it's a date-only order (stored as 00:00 UTC)
  // Our parseECTDate handles this by making it 00:00 in local-like components
  const isMidnight = date.getHours() === 0 && date.getMinutes() === 0

  const options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  }

  // If order has a specific hour, show it. If not, don't show "00:00"
  if (!isMidnight) {
    options.hour = '2-digit'
    options.minute = '2-digit'
    options.hour12 = true
  }

  return new Intl.DateTimeFormat('es-EC', options).format(date).toUpperCase()
}

const formatClient = (clientName: string) => {
  const parts = clientName.split(' ')
  return parts.slice(0, 2).join(' ')
}

const handleVoidTrigger = () => {
  console.log('ProductionItemRow: Void trigger activated for item', props.item._id)
  emit('void-item', props.item)
}

const setMode = (mode: 'all' | 'custom') => {
  // Direct mutation of prop object is generally discouraged/anti-pattern if strict, 
  // but common in Vue for this kind of "list item state" when not using a store. 
  // For specific refactor speed, we will emit update or just mutate if it's the pattern.
  // The user code was mutating `item.mode`. We will replicate that or emit.
  // Let's mutate for now to stay consistent with previous logic, 
  // but ideally we should emit 'update:item'.
  props.item.mode = mode
  if (mode === 'all') {
    props.item.currentInput = props.item.totalQuantity
  } else {
    props.item.currentInput = undefined
  }
}

const validateInput = () => {
  if (props.item.currentInput && props.item.currentInput > props.item.totalQuantity) {
    props.item.currentInput = props.item.totalQuantity
  }
  if (props.item.currentInput && props.item.currentInput < 0) {
    props.item.currentInput = undefined
  }
}

const triggerRegister = () => {
  emit('register', props.item)
}

const toggleExpand = () => {
  emit('toggle-expand', props.item)
}
</script>

<template>
    <div class="list-row" :class="{ expanded: item.isExpanded }">
        <div class="row-main">
            <!-- Left: Info -->
            <div class="info-col" @click="toggleExpand">
                <div class="urgency-tag" :class="urgencyType">
                    <i class="far fa-clock"></i>
                    {{ formatDisplayDate(item.urgency) }}
                </div>
                <h3 class="product-name">{{ item._id }}</h3>
                <button class="btn-expand-mobile" @click.stop="toggleExpand">
                    <i class="fas fa-chevron-down" :class="{ rotated: item.isExpanded }"></i>
                </button>
            </div>

            <!-- Center: Stats -->
            <div class="stats-col">
                <span class="qty-total">{{ item.totalQuantity }}</span>
                <span class="qty-label">PENDIENTES</span>
            </div>

            <!-- Right: Action -->
            <div class="action-col">
                <!-- Void Button (Left side of actions) -->
                 <div class="void-btn-wrapper" v-if="urgencyType === 'delayed'">
                    <ActionHoldButton 
                        label="Anular" 
                        color="#c0392b"
                        :hold-duration="1500"
                        @trigger="handleVoidTrigger"
                    />
                </div>

                <div class="mode-toggles">
                    <button 
                        class="mode-btn" 
                        :class="{ active: item.mode === 'all' }"
                        @click.stop="setMode('all')"
                    >
                        TODO
                    </button>
                    <button 
                        class="mode-btn" 
                        :class="{ active: item.mode === 'custom' }"
                        @click.stop="setMode('custom')"
                    >
                        MANUAL
                    </button>
                </div>

                <div class="input-wrapper" v-if="item.mode === 'custom'">
                    <input 
                        type="number" 
                        v-model="item.currentInput" 
                        placeholder="#"
                        min="1"
                        :max="item.totalQuantity"
                        class="qty-input"
                        @click.stop
                        @input="validateInput"
                    />
                </div>
                <div class="all-mode-label" v-else>
                    {{ item.totalQuantity }} Unid.
                </div>

                <div class="hold-btn-wrapper">
                    <ActionHoldButton 
                        v-if="urgencyType === 'today' || urgencyType === 'delayed'"
                        label="Completar" 
                        :duration="1200"
                        :color="urgencyType === 'today' || urgencyType === 'delayed' ? '#e74c3c' : '#2ecc71'"
                        :disabled="!item.currentInput"
                        @trigger="triggerRegister"
                    />
                    <div v-else class="view-only-badge">
                        Solo Visualización
                    </div>
                </div>

            </div>
        </div>

        <!-- Details Drawer -->
        <div v-if="item.isExpanded" class="row-details">
            <h4>Detalle de Pedidos</h4>
            <div class="orders-list">
                <div v-for="order in item.orders" :key="order.id" class="order-pill">
                    <b>{{ formatClient(order.client) }}</b>
                    <span>x{{ order.quantity }}</span> ({{ formatDisplayDate(order.delivery) }})
                </div>
            </div>
        </div>
    </div>
</template>

<style lang="scss" scoped>
$color-urgent: #e74c3c;
$color-delayed: #c0392b;
$color-info: #3498db;

.list-row {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
  border: 1px solid rgba(0, 0, 0, 0.04);
  overflow: hidden;
  transition: all 0.2s;
  margin-bottom: 0.8rem;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 15px rgba(0, 0, 0, 0.06);
  }

  .row-main {
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;

    @media (min-width: 768px) {
      flex-direction: row;
      align-items: center;
      gap: 1rem;
    }
  }

  .info-col {
    width: 100%;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    position: relative;

    @media (min-width: 768px) {
      flex: 1;
      width: auto;
    }

    .urgency-tag {
      display: inline-flex;
      align-self: flex-start;
      align-items: center;
      gap: 4px;
      font-size: 0.75rem;
      font-weight: 800;
      padding: 4px 10px;
      border-radius: 6px;
      margin-bottom: 8px;
      text-transform: uppercase;

      &.delayed {
        color: $color-delayed;
        background: rgba($color-delayed, 0.1);
      }

      &.today {
        color: $color-urgent;
        background: rgba($color-urgent, 0.1);
      }

      &.tomorrow {
        color: #d35400;
        background: rgba(#d35400, 0.1);
      }

      &.future {
        color: $color-info;
        background: rgba($color-info, 0.1);
      }
    }

    .product-name {
      margin: 0;
      font-size: 1.2rem;
      font-weight: 800;
      color: #1e293b;
      line-height: 1.4;
      padding-right: 40px;

      @media (min-width: 768px) {
        font-size: 1.05rem;
        padding-right: 0;
      }
    }

    .btn-expand-mobile {
      display: block;
      position: absolute;
      right: 0;
      top: 50%;
      transform: translateY(-50%);
      background: #f1f5f9;
      border: none;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      color: #64748b;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.3s;

      @media (min-width: 768px) {
        display: none;
      }

      i {
        transition: transform 0.3s;

        &.rotated {
          transform: rotate(180deg);
        }
      }

      &:active {
        background: #e2e8f0;
      }
    }
  }

  .stats-col {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #f8fafc;
    padding: 0.75rem 1.25rem;
    border-radius: 12px;
    width: 100%;

    @media (min-width: 768px) {
      flex-direction: column;
      justify-content: center;
      width: 100px;
      min-width: 100px;
      padding: 0 1.25rem;
      background: transparent;
      border-right: 1px solid #f1f2f6;
      border-left: 1px solid #f1f2f6;
      border-radius: 0;
    }

    .qty-total {
      font-size: 1.75rem;
      font-weight: 950;
      color: #0f172a;
      line-height: 1;

      @media (min-width: 768px) {
        font-size: 1.5rem;
      }
    }

    .qty-label {
      font-size: 0.7rem;
      color: #64748b;
      font-weight: 800;
      letter-spacing: 1px;
      text-transform: uppercase;

      @media (min-width: 768px) {
        font-size: 0.6rem;
        margin-top: 4px;
      }
    }
  }

  .action-col {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
    width: 100%;

    @media (min-width: 768px) {
      flex-wrap: nowrap;
      width: auto;
      margin-left: auto;
      gap: 0.8rem;
    }

    .void-btn-wrapper {
      width: auto;
      min-width: 100px;
    }

    .mode-toggles {
      display: flex;
      background: #f1f5f9;
      padding: 4px;
      border-radius: 12px;
      flex: 1;

      @media (min-width: 768px) {
        flex: none;
        padding: 3px;
        border-radius: 8px;
        margin-right: 0.5rem;
      }

      .mode-btn {
        flex: 1;
        border: none;
        background: transparent;
        padding: 10px;
        font-size: 0.75rem;
        font-weight: 800;
        color: #64748b;
        cursor: pointer;
        border-radius: 8px;
        transition: all 0.2s;
        text-transform: uppercase;

        @media (min-width: 768px) {
          padding: 6px 10px;
          font-size: 0.7rem;
          border-radius: 6px;
        }

        &.active {
          background: white;
          color: #1e293b;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }
      }
    }

    .input-wrapper {
      width: 100px;

      @media (min-width: 768px) {
        width: 80px;
      }

      .qty-input {
        width: 100%;
        padding: 0.75rem;
        border: 2px solid #e2e8f0;
        border-radius: 12px;
        font-size: 1.5rem;
        font-weight: 900;
        text-align: center;
        transition: all 0.2s;
        color: #0f172a;
        background: #f8fafc;

        @media (min-width: 768px) {
          padding: 0.5rem;
          border-radius: 8px;
          font-size: 1.2rem;
          background: white;
        }

        &:focus {
          outline: none;
          background: white;
          border-color: #3b82f6;
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
        }
      }
    }

    .all-mode-label {
      flex: 1;
      font-size: 1.1rem;
      font-weight: 900;
      color: #059669;
      background: #ecfdf5;
      border-radius: 12px;
      padding: 0.75rem;
      text-align: center;
      border: 1px solid #d1fae5;

      @media (min-width: 768px) {
        flex: none;
        font-size: 1rem;
        border-radius: 8px;
        padding: 0.5rem 1rem;
        border: none;
      }
    }

    .hold-btn-wrapper {
      width: 100%;
      min-height: 50px;

      @media (min-width: 768px) {
        width: 140px;
        min-height: auto;
      }
    }

    .view-only-badge {
      font-size: 0.8rem;
      color: #94a3b8;
      background: #f1f5f9;
      padding: 12px;
      border-radius: 12px;
      text-align: center;
      font-weight: 700;
      width: 100%;

      @media (min-width: 768px) {
        font-size: 0.7rem;
        padding: 6px 8px;
        border-radius: 6px;
      }
    }
  }
}

.row-details {
  background: #f8fafc;
  padding: 1.25rem;
  border-top: 1px solid #f1f5f9;

  @media (min-width: 768px) {
    padding: 1rem 1.5rem;
  }

  h4 {
    margin: 0 0 1rem 0;
    font-size: 0.8rem;
    text-transform: uppercase;
    color: #64748b;
    font-weight: 800;
    letter-spacing: 1px;
  }

  .orders-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;

    @media (min-width: 768px) {
      flex-direction: row;
      flex-wrap: wrap;
      gap: 0.6rem;
    }

    .order-pill {
      background: white;
      border: 1px solid #e2e8f0;
      padding: 10px 14px;
      border-radius: 10px;
      font-size: 0.9rem;
      color: #334155;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
      display: flex;
      justify-content: space-between;
      align-items: center;

      @media (min-width: 768px) {
        padding: 6px 12px;
        border-radius: 8px;
        font-size: 0.85rem;
        justify-content: flex-start;
      }

      span {
        color: #0f172a;
        margin-left: 8px;
        font-weight: 800;
        background: #f1f5f9;
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 0.85rem;

        @media (min-width: 768px) {
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 0.8rem;
        }
      }

      b {
        font-weight: 700;
        color: #1e293b;
      }
    }
  }
}
</style>
