<script setup lang="ts">
import { ref, computed } from 'vue'
import HoldConfirmButton from '@/components/ui/HoldConfirmButton.vue'

const props = defineProps({
  isOpen: { type: Boolean, required: true },
  categories: { type: Array as () => any[], required: true },
  itemsCountByCategory: { type: Object as () => Record<string, number>, required: true }
})

const emit = defineEmits(['close', 'delete', 'create'])

const showAddModal = ref(false)
const newCategoryName = ref('')
const selectedCategoryToDelete = ref<any>(null)
const reassignToCategory = ref('')
const step = ref('list') // list | delete

const categoriesToReassign = computed(() => {
  return props.categories.filter(c => c._id !== selectedCategoryToDelete.value?._id)
})

const itemsCountForSelected = computed(() => {
  if (!selectedCategoryToDelete.value) return 0
  return props.itemsCountByCategory[selectedCategoryToDelete.value.name] || 0
})

const handleClose = () => {
  step.value = 'list'
  selectedCategoryToDelete.value = null
  reassignToCategory.value = ''
  newCategoryName.value = ''
  showAddModal.value = false
  emit('close')
}

const openAddModal = () => {
  newCategoryName.value = ''
  showAddModal.value = true
}

const startDelete = (category: any) => {
  selectedCategoryToDelete.value = category
  const count = props.itemsCountByCategory[category.name] || 0
  if (count > 0) {
    step.value = 'delete'
  } else {
    // Immediate delete if empty? No, user said all deletes should be long press.
    // I'll show the delete view even if empty to allow the user to hold confirm.
    step.value = 'delete'
  }
}

const confirmDelete = () => {
  emit('delete', {
    categoryId: selectedCategoryToDelete.value._id,
    reassignId: reassignToCategory.value || null
  })
  step.value = 'list'
  selectedCategoryToDelete.value = null
}

const handleCreate = () => {
  if (newCategoryName.value.trim()) {
    emit('create', newCategoryName.value.trim())
    newCategoryName.value = ''
    showAddModal.value = false
  }
}
</script>

<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="handleClose">
    <div class="modal-content">
      <div class="modal-header">
        <div class="title-area">
          <h3>Categorías</h3>
          <p v-if="step === 'list'">{{ categories.length }} categorías registradas</p>
        </div>
        <button class="btn-close" @click="handleClose">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <div class="modal-body">
        <template v-if="step === 'list'">
          <div class="categories-list">
            <div v-if="categories.length === 0" class="empty-list">
              <i class="fas fa-tags"></i>
              <p>No hay categorías registradas.</p>
            </div>
            
            <div v-for="cat in categories" :key="cat._id" class="category-item">
              <div class="item-info">
                <span class="name">{{ cat.name }}</span>
                <span class="count">{{ itemsCountByCategory[cat.name] || 0 }} ítems</span>
              </div>
              <button class="btn-delete" @click="startDelete(cat)" title="Eliminar">
                <i class="fas fa-trash-alt"></i>
              </button>
            </div>
          </div>
        </template>

        <template v-else-if="step === 'delete'">
          <div class="delete-step">
            <div class="warning-box" v-if="selectedCategoryToDelete">
              <i class="fas fa-exclamation-circle"></i>
              <p v-if="itemsCountForSelected > 0">
                La categoría <strong>{{ selectedCategoryToDelete.name }}</strong> tiene 
                <strong>{{ itemsCountForSelected }}</strong> ítems asignados.
              </p>
              <p v-else>
                ¿Estás seguro de eliminar la categoría <strong>{{ selectedCategoryToDelete.name }}</strong>?
              </p>
            </div>

            <div class="form-group" v-if="selectedCategoryToDelete && itemsCountForSelected > 0">
              <label>Reasignar ítems a:</label>
              <div class="select-wrapper">
                <select v-model="reassignToCategory">
                  <option value="">(Sin Categoría)</option>
                  <option v-for="cat in categoriesToReassign" :key="cat._id" :value="cat.name">
                    {{ cat.name }}
                  </option>
                </select>
                <i class="fas fa-chevron-down"></i>
              </div>
            </div>

            <div class="action-buttons flex-column">
              <HoldConfirmButton 
                label="MANTÉN PARA ELIMINAR"
                color="#EF4444"
                :hold-time="1200"
                @confirmed="confirmDelete"
              />
              <button class="btn-ghost" @click="step = 'list'">Cancelar</button>
            </div>
          </div>
        </template>
      </div>

      <div class="modal-footer" v-if="step === 'list'">
        <button class="btn-add" @click="openAddModal">
          <i class="fas fa-plus"></i>
          Agregar Categoría
        </button>
      </div>
    </div>

    <!-- Secondary Simplified Modal for Adding Category -->
    <Transition name="sub-modal">
      <div v-if="showAddModal" class="sub-modal-overlay" @click.self="showAddModal = false">
        <div class="sub-modal-card">
          <div class="sub-header">
            <h4>Nueva Categoría</h4>
            <p>Escribe el nombre de la sección</p>
          </div>
          <div class="sub-body">
            <input 
              v-model="newCategoryName" 
              placeholder="Ej. Lácteos" 
              ref="addInput"
              autofocus
            />
          </div>
          <div class="sub-footer">
            <button class="btn-ghost-sm" @click="showAddModal = false">Cancelar</button>
            <HoldConfirmButton 
              label="MANTÉN PARA CREAR"
              :disabled="!newCategoryName.trim()"
              :hold-time="1200"
              @confirmed="handleCreate"
            />
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style lang="scss" scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.4);
  backdrop-filter: blur(8px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
  padding: 1rem;
}

.modal-content {
  background: white;
  border-radius: 32px;
  width: 100%;
  max-width: 440px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  max-height: 85vh;
  animation: modalIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes modalIn {
  from {
    opacity: 0;
    transform: translateY(40px) scale(0.95);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.modal-header {
  padding: 2rem 2rem 1rem;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;

  .title-area {
    h3 {
      margin: 0;
      color: #0f172a;
      font-size: 1.5rem;
      font-weight: 900;
      letter-spacing: -0.02em;
    }

    p {
      margin: 0.25rem 0 0;
      color: #64748b;
      font-size: 0.9rem;
      font-weight: 500;
    }
  }

  .btn-close {
    background: #f1f5f9;
    border: none;
    width: 36px;
    height: 36px;
    border-radius: 12px;
    color: #64748b;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;

    &:hover {
      background: #e2e8f0;
      color: #0f172a;
      transform: rotate(90deg);
    }
  }
}

.modal-body {
  padding: 1.5rem 2rem;
  overflow-y: auto;
}

.categories-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;

  .empty-list {
    padding: 4rem 1rem;
    text-align: center;
    color: #94a3b8;

    i {
      font-size: 3rem;
      margin-bottom: 1rem;
      opacity: 0.3;
    }

    p {
      font-size: 1rem;
      font-weight: 500;
    }
  }

  .category-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.5rem;
    background: #f8fafc;
    border-radius: 20px;
    border: 2px solid #f1f5f9;
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);

    &:hover {
      border-color: $NICOLE-PURPLE;
      background: white;
      transform: translateX(4px);
      box-shadow: 0 10px 20px rgba($NICOLE-PURPLE, 0.05);
    }

    .item-info {
      display: flex;
      flex-direction: column;

      .name {
        font-weight: 800;
        color: #1e293b;
        font-size: 1.05rem;
      }

      .count {
        font-size: 0.8rem;
        color: #94a3b8;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
    }

    .btn-delete {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      color: #94a3b8;
      width: 36px;
      height: 36px;
      border-radius: 10px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;

      &:hover {
        background: #fee2e2;
        color: #ef4444;
        border-color: #fecaca;
      }
    }
  }
}

.delete-step {
  .warning-box {
    background: #fff7ed;
    border: 2px solid #ffedd5;
    padding: 1.25rem;
    border-radius: 20px;
    display: flex;
    gap: 1rem;
    margin-bottom: 2rem;

    i {
      color: #f97316;
      font-size: 1.5rem;
    }

    p {
      margin: 0;
      color: #9a3412;
      font-size: 0.95rem;
      line-height: 1.5;
      font-weight: 500;

      strong {
        font-weight: 900;
      }
    }
  }

  .form-group {
    margin-bottom: 2.5rem;

    label {
      display: block;
      margin-bottom: 0.75rem;
      font-weight: 800;
      color: #475569;
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .select-wrapper {
      position: relative;

      select {
        width: 100%;
        padding: 1rem 1.25rem;
        background: #f8fafc;
        border: 2px solid #f1f5f9;
        border-radius: 16px;
        appearance: none;
        color: #1e293b;
        font-weight: 700;
        font-size: 1rem;
        cursor: pointer;
        transition: all 0.2s;

        &:focus {
          outline: none;
          border-color: $NICOLE-PURPLE;
          background: white;
        }
      }

      i {
        position: absolute;
        right: 1.25rem;
        top: 50%;
        transform: translateY(-50%);
        color: #64748b;
        pointer-events: none;
      }
    }
  }

  .action-buttons {
    display: flex;
    gap: 1rem;

    &.flex-column {
      flex-direction: column;
    }

    .btn-ghost {
      background: #f1f5f9;
      color: #64748b;
      border: none;
      padding: 1rem;
      border-radius: 16px;
      font-weight: 800;
      cursor: pointer;
    }
  }
}

.modal-footer {
  padding: 1.5rem 2rem 2.5rem;

  .btn-add {
    width: 100%;
    padding: 1.1rem;
    background: $NICOLE-PURPLE;
    color: white;
    border: none;
    border-radius: 20px;
    font-weight: 900;
    font-size: 1.05rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.8rem;
    cursor: pointer;
    box-shadow: 0 10px 25px rgba($NICOLE-PURPLE, 0.25);
    transition: all 0.3s;

    &:hover {
      background: darken($NICOLE-PURPLE, 5%);
      transform: translateY(-2px);
      box-shadow: 0 15px 30px rgba($NICOLE-PURPLE, 0.35);
    }
  }
}

/* Secondary Sub-Modal */
.sub-modal-overlay {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.4);
  backdrop-filter: blur(4px);
  z-index: 2010;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 1.5rem;
}

.sub-modal-card {
  background: white;
  width: 100%;
  max-width: 360px;
  border-radius: 28px;
  padding: 2rem;
  box-shadow: 0 30px 60px -12px rgba(0, 0, 0, 0.3);

  .sub-header {
    text-align: center;
    margin-bottom: 2rem;

    h4 {
      margin: 0;
      color: #0f172a;
      font-size: 1.25rem;
      font-weight: 900;
    }

    p {
      margin: 0.4rem 0 0;
      color: #64748b;
      font-size: 0.9rem;
      font-weight: 500;
    }
  }

  .sub-body {
    margin-bottom: 2rem;

    input {
      width: 100%;
      padding: 1.1rem;
      border: 2px solid #f1f5f9;
      border-radius: 18px;
      font-size: 1.1rem;
      background: #f8fafc;
      font-weight: 600;
      text-align: center;
      transition: all 0.2s;

      &:focus {
        outline: none;
        border-color: $NICOLE-PURPLE;
        background: white;
        box-shadow: 0 0 0 4px rgba($NICOLE-PURPLE, 0.1);
      }
    }
  }

  .sub-footer {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;

    .btn-ghost-sm {
      background: #f8fafc;
      color: #94a3b8;
      border: none;
      padding: 0.9rem;
      border-radius: 14px;
      font-weight: 700;
      cursor: pointer;
    }

    .hold-confirm-btn {
      width: 100%;
    }
  }
}

/* Animations */
.sub-modal-enter-active,
.sub-modal-leave-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.sub-modal-enter-from,
.sub-modal-leave-to {
  opacity: 0;
  transform: scale(0.9);
}
</style>
