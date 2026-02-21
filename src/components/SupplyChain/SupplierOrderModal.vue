<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useToast } from '@/composables/useToast'
import CustomDatePicker from '@/components/ui/CustomDatePicker.vue'
import SupplierOrderService from '@/services/supplier-order.service'

const props = defineProps({
  isOpen: { type: Boolean, required: true },
  provider: { type: Object, default: null },
  allMaterials: { type: Array as () => any[], required: true },
  initialMaterialId: { type: String, default: '' },
  orderId: { type: String, default: null } // New prop for editing
})

const emit = defineEmits(['close', 'saved'])
const { success, error: showError } = useToast()

const deliveryDate = ref('')
const orderItems = ref<any[]>([])
const isSaving = ref(false)
const isSaved = ref(false)
const isLoadingDetails = ref(false)
const currentOrderId = ref<string | null>(null)

// Initialize form data when modal opens
watch(() => props.isOpen, async (newVal) => {
  if (newVal) {
    isSaved.value = false
    currentOrderId.value = props.orderId

    if (props.orderId) {
      // EDIT MODE: Fetch existing order
      isLoadingDetails.value = true
      try {
        const { order } = await SupplierOrderService.getOrderById(props.orderId)
        deliveryDate.value = order.deliveryDate.split('T')[0]

        // Map items from existing order
        orderItems.value = order.items.map((item: any) => {
          const baseQty = item.quantity || 0
          const displayQty = (item.unit === 'g' || item.unit === 'ml') ? baseQty / 1000 : baseQty

          return {
            _id: item.material?._id || item.material,
            name: item.name,
            unit: item.unit,
            currentStock: 0,
            orderQty: parseFloat(displayQty.toFixed(2))
          }
        })
        isSaved.value = true // Initial load - already saved
      } catch (err) {
        showError('No se pudo cargar el pedido para editar.')
      } finally {
        // Essential to delay a bit so skeletons are visible and watchers don't trigger immediately
        setTimeout(() => {
          isLoadingDetails.value = false
        }, 300)
      }
    } else if (props.provider) {
      // NEW MODE: Set default delivery date to tomorrow
      isLoadingDetails.value = true
      try {
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        deliveryDate.value = tomorrow.toISOString().split('T')[0] ?? ''

        // Filter materials for this provider
        const providerId = (props.provider as any)._id || props.provider
        const providerMaterials = props.allMaterials.filter(m => {
          const pId = (m as any).provider?._id || (m as any).provider
          return pId === providerId
        })

        // NEW: Fetch pending orders to show what's already on the way
        let pendingMap: Record<string, number> = {}
        const pendingData = await SupplierOrderService.getOrders({
          provider: providerId,
          status: 'PENDING',
          limit: 100
        })
        const sentData = await SupplierOrderService.getOrders({
          provider: providerId,
          status: 'SENT',
          limit: 100
        })

        const allPending = [...(pendingData.orders || []), ...(sentData.orders || [])]

        allPending.forEach((order: any) => {
          order.items.forEach((item: any) => {
            const mId = item.material?._id || item.material
            pendingMap[mId] = (pendingMap[mId] || 0) + item.quantity
          })
        })

        orderItems.value = providerMaterials.map((m: any) => {
          let suggestedQty = 0
          const current = m.quantity || 0
          const min = m.minStock || 0
          const max = m.maxStock || 0

          const pending = pendingMap[m._id] || 0

          if (max > 0) {
            suggestedQty = Math.max(0, max - (current + pending))
          } else if (min > 0) {
            suggestedQty = Math.max(0, (min * 2) - (current + pending))
          }

          const displayQty = (m.unit === 'g' || m.unit === 'ml') ? suggestedQty / 1000 : suggestedQty

          return {
            _id: m._id,
            name: m.name,
            unit: m.unit,
            currentStock: m.quantity,
            pendingStock: pending,
            suggested: displayQty,
            orderQty: displayQty > 0 ? parseFloat(displayQty.toFixed(2)) : 0
          }
        })
      } catch (err) {
        console.error('Error initializing new order:', err)
        showError('No se pudo inicializar el pedido.')
      } finally {
        setTimeout(() => {
          isLoadingDetails.value = false
        }, 300)
      }
    }
  } else {
    orderItems.value = []
    currentOrderId.value = null
  }
})

const getDisplayUnit = (unit: string) => {
  if (unit === 'g') return 'kg'
  if (unit === 'ml') return 'L'
  return unit
}

const getDisplayQuantity = (quantity: number, unit: string) => {
  if (unit === 'g' || unit === 'ml') return (quantity / 1000).toFixed(2)
  return quantity.toFixed(2)
}

const generatedMessage = computed(() => {
  if (!props.provider || orderItems.value.length === 0) return ''

  const today = new Intl.DateTimeFormat('es-EC', { dateStyle: 'short' }).format(new Date())
  const delivery = deliveryDate.value ? new Date(deliveryDate.value + 'T12:00:00') : null
  const deliveryStr = delivery ? new Intl.DateTimeFormat('es-EC', { dateStyle: 'long' }).format(delivery) : 'Pendiente'

  let text = `📦 *PEDIDO DE MATERIAL — Nicole Pastry Arts*\n\n`
  text += `📅 *Fecha de pedido:* ${today}\n`
  text += `🚚 *Fecha requerida:* ${deliveryStr}\n\n`
  text += `Proveedor: *${props.provider.name || 'S/N'}*\n\n`
  text += `Por favor confirmar disponibilidad y enviarnos lo siguiente:\n\n`

  let hasItems = false
  let count = 1
  orderItems.value.forEach((item) => {
    if (item.orderQty > 0) {
      hasItems = true
      text += `${count}. *${item.name}* → ${item.orderQty} ${getDisplayUnit(item.unit)}\n`
      count++
    }
  })

  if (!hasItems) return 'Seleccione cantidades para generar el mensaje.'

  text += `\n_Nicole Pastry Arts — Departamento de Compras_`
  return text
})

const saveOrder = async () => {
  isSaving.value = true
  const userStr = localStorage.getItem('user_info')
  const user = userStr ? JSON.parse(userStr) : null

  if (!user || !user._id) {
    showError('Error de sesión: Usuario no encontrado.')
    isSaving.value = false
    return
  }

  const orderData = {
    provider: (props.provider as any)._id || props.provider,
    items: orderItems.value
      .filter(i => i.orderQty > 0)
      .map(i => {
        // Convert back to base units (g/ml) for database if necessary
        const baseQty = (i.unit === 'g' || i.unit === 'ml') ? i.orderQty * 1000 : i.orderQty
        return {
          material: i._id,
          name: i.name,
          quantity: parseFloat(baseQty.toFixed(2)),
          unit: i.unit
        }
      }),
    deliveryDate: deliveryDate.value,
    user: user._id,
    whatsappMessage: generatedMessage.value,
    status: 'PENDING'
  }

  try {
    if (currentOrderId.value) {
      await SupplierOrderService.updateOrder(currentOrderId.value, orderData)
      success('Pedido actualizado con éxito.')
    } else {
      const { order } = await SupplierOrderService.createOrder(orderData)
      currentOrderId.value = order._id
      success('Pedido generado y guardado en historial.')
    }
    isSaved.value = true
    emit('saved')
  } catch (err) {
    showError('Error al guardar el pedido.')
  } finally {
    isSaving.value = false
  }
}

const copyToClipboard = () => {
  navigator.clipboard.writeText(generatedMessage.value)
  success('Mensaje copiado al portapapeles. ¡Listo para pegar en WhatsApp!')
}

// Simple WhatsApp formatter for preview
const formatWhatsApp = (text: string) => {
  if (!text) return ''
  // 1. Bolding: *text* -> <b>text</b>
  let formatted = text.replace(/\*(.*?)\*/g, '<b>$1</b>')
  // 2. Italics: _text_ -> <i>$1</i>
  formatted = formatted.replace(/_(.*?)_/g, '<i>$1</i>')
  return formatted
}

// Detection of changes to allow "Re-saving"
watch([deliveryDate, orderItems], () => {
  if (isSaved.value && props.isOpen && !isLoadingDetails.value) {
    isSaved.value = false
  }
}, { deep: true })
</script>

<template>
  <Teleport to="body">
    <transition name="modal-bounce">
      <div v-if="isOpen" class="modal-overlay" @click.self="$emit('close')">
        <div class="modal-content pro-modal">
          <div class="modal-header">
            <div class="header-info">
              <h2>{{ orderId ? 'Editar Pedido' : 'Generar Pedido' }}</h2>
              <p class="provider-subtitle">{{ (provider as any)?.name }}</p>
            </div>
            <button class="btn-close" @click="$emit('close')">&times;</button>
          </div>

          <div class="modal-body">
            <!-- Date Config -->
        <div class="config-section">
          <div v-if="isLoadingDetails" class="skeleton skeleton-label" style="width: 150px; height: 16px; margin-bottom: 8px;"></div>
          <CustomDatePicker
            v-if="!isLoadingDetails"
            v-model="deliveryDate"
            label="Fecha Requerida de Entrega"
            placeholder="Seleccione fecha de entrega"
            :min-date="new Date().toISOString().split('T')[0]"
          />
          <div v-else class="skeleton skeleton-input" style="height: 45px; border-radius: 12px;"></div>
        </div>

            <div class="section-divider"></div>
            <div class="section-title">Insumos del Proveedor</div>
            
            <div class="items-list">
              <!-- SKELETON ITEMS -->
              <template v-if="isLoadingDetails">
                <div v-for="i in 3" :key="'skel-' + i" class="item-row skeleton-row">
                  <div class="item-info">
                    <div class="skeleton" style="width: 140px; height: 18px; margin-bottom: 6px;"></div>
                    <div class="skeleton" style="width: 80px; height: 12px;"></div>
                  </div>
                  <div class="skeleton" style="width: 100px; height: 35px; border-radius: 8px;"></div>
                </div>
              </template>

              <div 
                v-else
                v-for="item in orderItems" 
                :key="item._id" 
                class="item-row" 
                :class="{
                  'highlight': item.orderQty > 0,
                  'initial-focus': item._id === initialMaterialId,
                  'is-saved': isSaved
                }"
              >
                <div class="item-info">
                  <span class="name">{{ item.name }}</span>
                  <div class="stock-info">
                    <span class="stock" v-if="item.currentStock > 0">Stock: {{ getDisplayQuantity(item.currentStock, item.unit) }} {{ getDisplayUnit(item.unit) }}</span>
                    <span class="pending-stock" v-if="item.pendingStock > 0">
                      <i class="fas fa-truck-ramp-box"></i> Pedido solicitado: {{ getDisplayQuantity(item.pendingStock, item.unit) }} {{ getDisplayUnit(item.unit) }}
                    </span>
                  </div>
                </div>
                <div class="item-action">
                  <div class="input-wrapper">
                    <input type="number" v-model.number="item.orderQty" step="0.1" min="0" />
                    <span class="unit">{{ getDisplayUnit(item.unit) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="section-divider"></div>
            <div class="section-title">Vista Previa del Mensaje</div>
            <div v-if="isLoadingDetails" class="skeleton skeleton-preview" style="height: 150px; border-radius: 16px;"></div>
            <div v-else class="message-preview-container">
              <div class="message-preview" :class="{ 'is-saved': isSaved }">
                <div class="message-text" v-html="formatWhatsApp(generatedMessage)"></div>
                <div class="bubble-footer">
                  <span class="time">{{ new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}</span>
                  <span v-if="isSaved" class="checks">
                    <i class="fas fa-check-double"></i>
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn-cancel" @click="$emit('close')">Cerrar</button>
            <button 
              v-if="!isSaved"
              class="btn-save" 
              @click="saveOrder"
              :disabled="isSaving || !orderItems.some(i => i.orderQty > 0)"
            >
              <i class="fas" :class="isSaving ? 'fa-spinner fa-spin' : 'fa-save'"></i>
              {{ isSaving ? 'Guardando...' : (currentOrderId ? 'Actualizar Pedido' : 'Generar Pedido') }}
            </button>
            <button 
              v-else
              class="btn-copy" 
              @click="copyToClipboard"
            >
              <i class="fab fa-whatsapp"></i> COPIAR MENSAJE
            </button>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<style lang="scss" scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(8px);
  display: flex;
  justify-content: center;
  align-items: flex-end; // Bottom sheet behavior by default (mobile)
  z-index: 2100;
  padding: 0;

  @media (min-width: 640px) {
    align-items: center;
    padding: 1rem;
  }
}

.pro-modal {
  background: white;
  width: 100%;
  max-width: 650px;
  max-height: 90vh;
  border-radius: 28px 28px 0 0; // Top corners rounded for bottom sheet
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 -10px 25px -5px rgba(0, 0, 0, 0.1);
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);

  @media (min-width: 640px) {
    border-radius: 32px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  }
}

.modal-header {
  padding: 1.5rem 2rem;
  border-bottom: 1px solid #f1f5f9;
  display: flex;
  justify-content: space-between;
  align-items: center;

  h2 {
    font-size: 1.5rem;
    font-weight: 800;
    color: #1e293b;
    margin: 0;
  }

  .provider-subtitle {
    font-size: 0.9rem;
    font-weight: 700;
    color: $NICOLE-PURPLE;
    margin: 0.25rem 0 0;
    text-transform: uppercase;
  }

  .btn-close {
    background: #f1f5f9;
    border: none;
    width: 36px;
    height: 36px;
    border-radius: 12px;
    color: #64748b;
    cursor: pointer;
    font-size: 1.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;

    &:hover {
      background: #fee2e2;
      color: #ef4444;
    }
  }
}

.modal-body {
  padding: 2rem;
  overflow-y: auto;
  flex: 1;
}

.section-title {
  font-size: 0.75rem;
  font-weight: 800;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 1rem;
}

.section-divider {
  height: 1px;
  background: #f1f5f9;
  margin: 1.5rem 0;
}

.config-section {
  width: 90%;

  @media (min-width: 640px) {
    width: 60%; // Even more compact on desktop
    margin: 0; // Reset to left align
  }

  .form-group {
    label {
      display: block;
      font-size: 0.85rem;
      font-weight: 700;
      color: #475569;
      margin-bottom: 0.5rem;
    }

    input {
      width: 100%;
      padding: 0.75rem;
      border-radius: 12px;
      border: 2px solid #f1f5f9;
      font-size: 1rem;
      font-weight: 600;

      &:focus {
        border-color: $NICOLE-PURPLE;
        outline: none;
      }
    }
  }
}

.items-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.item-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: #f8fafc;
  border-radius: 16px;
  border: 1px solid #f1f5f9;
  transition: all 0.2s;

  &.highlight {
    background: white;
    border-color: rgba($NICOLE-PURPLE, 0.3);
    box-shadow: 0 4px 6px -1px rgba($NICOLE-PURPLE, 0.05);
  }

  &.initial-focus {
    border-color: #10b981;
    background: #f0fdf4;
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
  }

  .item-info {
    display: flex;
    flex-direction: column;

    .name {
      font-weight: 700;
      color: #1e293b;
      font-size: 1rem;
    }

    .stock-info {
      display: flex;
      gap: 0.75rem;
      align-items: center;
    }

    .stock,
    .pending-stock {
      font-size: 0.75rem;
      font-weight: 600;
    }

    .stock {
      color: #94a3b8;
    }

    .pending-stock {
      color: #f59e0b;
      display: flex;
      align-items: center;
      gap: 4px;
    }
  }

  .item-action {
    .input-wrapper {
      position: relative;
      display: flex;
      align-items: center;

      input {
        width: 100px;
        padding: 0.5rem 2.5rem 0.5rem 0.75rem;
        border-radius: 10px;
        border: 2px solid #e2e8f0;
        font-weight: 700;
        text-align: right;

        &:focus {
          border-color: $NICOLE-PURPLE;
          outline: none;
        }
      }

      .unit {
        position: absolute;
        right: 0.75rem;
        font-size: 0.7rem;
        font-weight: 800;
        color: #94a3b8;
        text-transform: uppercase;
      }
    }
  }
}

.message-preview-container {
  background-color: #efeae2;
  background-image: url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png");
  padding: 2rem 1rem;
  border-radius: 20px;
  display: flex;
  flex-direction: column;
  border: 1px solid #e2e8f0;
}

.message-preview {
  background: #e7ffdb;
  padding: 0.8rem 1rem;
  border-radius: 12px 0 12px 12px;
  position: relative;
  box-shadow: 0 1px 0.5px rgba(0, 0, 0, 0.13);
  max-width: 95%;
  align-self: flex-end;
  margin-right: 10px;

  &::before {
    content: "";
    position: absolute;
    top: 0;
    right: -10px;
    width: 20px;
    height: 15px;
    background: #e7ffdb;
    clip-path: polygon(0 0, 0% 100%, 100% 0);
  }

  .message-text {
    margin: 0;
    white-space: pre-wrap;
    font-size: 0.85rem;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #111b21;
    line-height: 1.45;

    :deep(b) {
      font-weight: 700;
    }

    :deep(i) {
      font-style: italic;
    }
  }

  .bubble-footer {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 4px;
    margin-top: 4px;
    font-size: 0.65rem;
    color: #667781;

    .checks {
      color: #53bdeb;
      font-size: 0.75rem;
    }
  }

  &.is-saved {
    border: none; // Override previous border if any
  }
}

.modal-footer {
  padding: 1.5rem 2rem;
  background: #f8fafc;
  border-top: 1px solid #f1f5f9;
  display: flex;
  justify-content: flex-end;
  gap: 1rem;

  button {
    height: 50px;
    padding: 0 1.5rem;
    border-radius: 14px;
    font-weight: 800;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-cancel {
    background: white;
    border: 2px solid #e2e8f0;
    color: #64748b;

    &:hover {
      background: #f1f5f9;
    }
  }

  .btn-save {
    background: $NICOLE-PURPLE;
    border: none;
    color: white;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    box-shadow: 0 4px 12px rgba($NICOLE-PURPLE, 0.3);

    &:hover {
      background: darken($NICOLE-PURPLE, 5%);
      transform: translateY(-2px);
      box-shadow: 0 8px 15px rgba($NICOLE-PURPLE, 0.4);
    }

    &:disabled {
      background: #cbd5e1;
      color: #94a3b8;
      box-shadow: none;
      cursor: not-allowed;
      transform: none;
    }
  }

  .btn-copy {
    background: #25d366; // WhatsApp color
    border: none;
    color: white;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    box-shadow: 0 4px 12px rgba(37, 211, 102, 0.3);

    i {
      font-size: 1.25rem;
    }

    &:hover {
      background: #128c7e;
      transform: translateY(-2px);
      box-shadow: 0 8px 15px rgba(37, 211, 102, 0.4);
    }

    &:disabled {
      background: #cbd5e1;
      color: #94a3b8;
      box-shadow: none;
      cursor: not-allowed;
      transform: none;
    }
  }
}

.item-row.is-saved {
  opacity: 0.7;
  border-left: 4px solid #25d366;
}

.message-preview.is-saved {
  border-color: #25d366;
  background: #f0fdf4;
}

// Premium Modal Transition
.modal-bounce-enter-active {
  transition: all 0.4s ease-out;

  .pro-modal {
    transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
}

.modal-bounce-leave-active {
  transition: all 0.3s ease-in;

  .pro-modal {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
}

.modal-bounce-enter-from {
  opacity: 0;
  backdrop-filter: blur(0);

  .pro-modal {
    transform: translateY(100%);
    opacity: 0;

    @media (min-width: 640px) {
      transform: translateY(30px) scale(0.9);
    }
  }
}

.modal-bounce-leave-to {
  opacity: 0;
  backdrop-filter: blur(0);

  .pro-modal {
    transform: translateY(100%);
    opacity: 0;

    @media (min-width: 640px) {
      transform: translateY(20px) scale(0.95);
    }
  }
}

// Skeleton Loading
.skeleton {
  background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
}

@keyframes skeleton-loading {
  0% {
    background-position: 200% 0;
  }

  100% {
    background-position: -200% 0;
  }
}

.skeleton-row {
  opacity: 0.8;
  pointer-events: none;
}
</style>
