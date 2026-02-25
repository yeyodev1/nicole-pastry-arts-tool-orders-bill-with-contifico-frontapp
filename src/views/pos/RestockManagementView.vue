<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue';
import { useRouter } from 'vue-router';
import { posRestockService, type WeeklyObjectives } from '@/services/pos-restock.service';
import RestockProductSearchModal from './components/RestockProductSearchModal.vue';
import RestockDeleteModal from './components/RestockDeleteModal.vue';
import SearchableSelect from '@/components/ui/SearchableSelect.vue';
import { useToast } from '@/composables/useToast';

// --- Interfaces ---
interface ProductConfig {
  productName: string;
  unit: string;
  contificoId: string; // Needed for edit/delete
  category: string;
  isGeneral: boolean;
  requiresMinimum: boolean;
  objectives: WeeklyObjectives;
}

// --- State ---
const router = useRouter();
const branch = ref('San Marino');
const branches = ['San Marino', 'Mall del Sol', 'Centro de Producción'];
const branchOptions = computed(() => branches.map(b => ({ value: b, label: b })));
const products = ref<ProductConfig[]>([]);
const isLoading = ref(false);
const showModal = ref(false);
const showDeleteModal = ref(false);
const editingProduct = ref<ProductConfig | null>(null);
const productToDelete = ref<ProductConfig | null>(null);
const { success, error: showError, info } = useToast();

const weekDays = [
  { key: 'monday', label: 'Lun' },
  { key: 'tuesday', label: 'Mar' },
  { key: 'wednesday', label: 'Mié' },
  { key: 'thursday', label: 'Jue' },
  { key: 'friday', label: 'Vie' },
  { key: 'saturday', label: 'Sáb' },
  { key: 'sunday', label: 'Dom' },
];

// --- Fetch Logic ---
const fetchConfiguration = async () => {
  isLoading.value = true;
  try {
    const data = await posRestockService.getRestockConfiguration(branch.value);
    // Ensure we map the ID correctly if available in service response, defaulting to mock if strictly needed
    // Assuming data has contificoId or id
    products.value = data.map((p: any) => ({
      productName: p.productName,
      unit: p.unit,
      contificoId: p.contificoId || p.id || '', // Ensure we have an ID
      category: p.category || 'General',
      isGeneral: p.isGeneral || false,
      requiresMinimum: p.requiresMinimum || false,
      objectives: p.objectives || { monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0, saturday: 0, sunday: 0 },
    }));

    if (products.value.length === 0) {
      info('No hay configuraciones encontradas. Crea la primera.');
    }
  } catch (error) {
    console.error('Error fetching config:', error);
    showError('Error cargando configuración');
  } finally {
    isLoading.value = false;
  }
};

const openAddModal = () => {
  editingProduct.value = null;
  showModal.value = true;
};

const handleEdit = (product: ProductConfig) => {
  editingProduct.value = product;
  showModal.value = true;
};

const initiateDelete = (product: ProductConfig) => {
  productToDelete.value = product;
  showDeleteModal.value = true;
};

const confirmDelete = async () => {
  if (!productToDelete.value) return;

  try {
    await posRestockService.deleteObjective(branch.value, productToDelete.value.productName);
    success('Configuración de restock eliminada exitosamente');
    showDeleteModal.value = false;
    productToDelete.value = null;
    fetchConfiguration();
  } catch (error) {
    console.error('Error deleting:', error);
    showError('Error al eliminar configuración');
  }
};

const handleNotification = (n: { message: string, type: 'success' | 'error' | 'info' }) => {
  if (n.type === 'success') success(n.message);
  else if (n.type === 'error') showError(n.message);
  else info(n.message);
};

const goBack = () => {
  router.push({ name: 'pos-shipments' });
}

onMounted(() => {
  fetchConfiguration();
});

watch(branch, () => {
  fetchConfiguration();
});
</script>

<template>
  <div class="management-page">
    <div class="container">
      <header class="header">
          <div class="header-left">
            <button class="btn-back" @click="goBack">
                <i class="fa-solid fa-arrow-left"></i>
            </button>
            <div class="title-group">
                <h1>Configuración de Stock</h1>
                <p>Gestiona los objetivos de producción diarios por sucursal.</p>
            </div>
          </div>
          
          <div class="header-controls">
                <button class="btn-add" @click="openAddModal">
                    <i class="fa-solid fa-plus"></i> Agregar Producto
                </button>
                <div class="branch-selector-wrap">
                  <SearchableSelect
                    v-model="branch"
                    :options="branchOptions"
                    placeholder="Seleccionar sucursal..."
                  />
                </div>
           </div>
       </header>

       <!-- Active branch context banner -->
       <div class="context-banner" :class="branch.toLowerCase().replace(/\s+/g, '-')">
         <div class="context-icon"><i class="fa-solid fa-store"></i></div>
         <div class="context-text">
           <span class="context-label">Estás configurando</span>
           <span class="context-branch">{{ branch }}</span>
         </div>
         <div class="context-tag">ACTIVO</div>
       </div>

       <RestockProductSearchModal 
            v-if="showModal"
            :is-open="showModal" 
            v-model:branch="branch"
            :initial-product="editingProduct ? {
              id: editingProduct.contificoId,
              nombre: editingProduct.productName,
              unidad: editingProduct.unit,
              isGeneral: editingProduct.isGeneral,
              requiresMinimum: editingProduct.requiresMinimum
            } as any : undefined"
            :initial-objectives="editingProduct?.objectives"
            @close="showModal = false"
            @success="fetchConfiguration"
            @notify="handleNotification"
       />

       <RestockDeleteModal
            v-if="showDeleteModal && productToDelete"
            :is-open="showDeleteModal"
            :product-name="productToDelete.productName"
            @close="showDeleteModal = false"
            @confirm="confirmDelete"
       />

      <div v-if="isLoading" class="loading">
          <div class="spinner"></div>
          Cargando configuración...
      </div>

      <div v-else class="content-card">
          <div class="table-responsive">
              <table class="config-table">
                  <thead>
                      <tr>
                          <th class="col-product">Producto</th>
                          <th v-for="day in weekDays" :key="day.key" class="col-day">{{ day.label }}</th>
                          <th class="col-actions">Acciones</th>
                      </tr>
                  </thead>
                  <tbody>
                      <tr v-for="product in products" :key="product.productName">
                          <td class="cell-product">
                              <div class="name-row">
                                <span class="name">{{ product.productName }}</span>
                                <span v-if="product.isGeneral" class="general-badge">SUMINISTRO</span>
                                <span class="dest-badge" :class="product.category.toLowerCase()">{{ product.category }}</span>
                              </div>
                              <span class="unit">{{ product.unit }}</span>
                          </td>
                           <td v-for="day in weekDays" :key="day.key" class="cell-value">
                               <template v-if="!product.isGeneral || product.requiresMinimum">
                                 <span :class="{ 'zero': product.objectives[day.key as keyof WeeklyObjectives] === 0 }">
                                   {{ product.objectives[day.key as keyof WeeklyObjectives] }}
                                 </span>
                               </template>
                               <span v-else class="na-placeholder">-</span>
                           </td>
                          <td class="cell-actions">
                              <button class="btn-icon edit" @click="handleEdit(product)" title="Editar">
                                <i class="fa-solid fa-pen"></i>
                              </button>
                              <button class="btn-icon delete" @click="initiateDelete(product)" title="Eliminar">
                                <i class="fa-solid fa-trash"></i>
                              </button>
                          </td>
                      </tr>
                  </tbody>
              </table>
          </div>
      </div>
    </div>
    

  </div>
</template>

<style lang="scss" scoped>
$primary-color: #A855F7;
$text-color: #1e293b;
$bg-light: #f8fafc;
$border-color: #e2e8f0;
$danger-color: #ef4444;

.management-page {
  min-height: 100vh;
  background-color: $bg-light;
  padding: 2rem;
  font-family: 'Inter', sans-serif;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  flex-wrap: wrap;
  gap: 1rem;

  .header-left {
    display: flex;
    align-items: center;
    gap: 1rem;

    .btn-back {
      background: white;
      border: 1px solid $border-color;
      width: 40px;
      height: 40px;
      border-radius: 8px;
      cursor: pointer;
      color: #64748b;
      transition: all 0.2s;

      &:hover {
        background: #f1f5f9;
        color: $text-color;
      }
    }

    .title-group {
      h1 {
        margin: 0;
        font-size: 1.5rem;
        color: $text-color;
      }

      p {
        margin: 4px 0 0 0;
        color: #64748b;
        font-size: 0.9rem;
      }
    }
  }

  .header-controls {
    display: flex;
    gap: 1rem;
    align-items: center;

    .branch-selector-wrap {
      width: 220px;
    }

    .btn-add {
      background: $primary-color;
      border: none;
      color: white;
      padding: 0 1.2rem;
      height: 42px;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      transition: all 0.2s;
      white-space: nowrap;

      &:hover {
        background: darken($primary-color, 5%);
      }
    }
  }
}

.context-banner {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: white;
  border: 1.5px solid #e2e8f0;
  border-left: 6px solid $primary-color;
  border-radius: 12px;
  padding: 0.9rem 1.25rem;
  margin-bottom: 1.5rem;
  animation: slideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1);

  &.san-marino {
    border-left-color: #A855F7;

    .context-icon {
      background: rgba(#A855F7, 0.1);
      color: #A855F7;
    }
  }

  &.mall-del-sol {
    border-left-color: #3B82F6;

    .context-icon {
      background: rgba(#3B82F6, 0.1);
      color: #3B82F6;
    }
  }

  &.centro-de-producción {
    border-left-color: #F59E0B;

    .context-icon {
      background: rgba(#F59E0B, 0.1);
      color: #F59E0B;
    }
  }
}

.context-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: rgba($primary-color, 0.08);
  color: $primary-color;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  flex-shrink: 0;
}

.context-text {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.context-label {
  font-size: 0.72rem;
  font-weight: 800;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 1px;
  line-height: 1;
  margin-bottom: 3px;
}

.context-branch {
  font-size: 1.1rem;
  font-weight: 900;
  color: #0f172a;
  line-height: 1;
}

.context-tag {
  font-size: 0.65rem;
  font-weight: 900;
  color: #16a34a;
  background: #dcfce7;
  padding: 3px 8px;
  border-radius: 20px;
  border: 1px solid #bbf7d0;
  letter-spacing: 1px;
  text-transform: uppercase;
}

@keyframes slideDown {
  from {
    transform: translateY(-8px);
    opacity: 0;
  }

  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.content-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.02);
  border: 1px solid $border-color;
  overflow: hidden;
}

.table-responsive {
  overflow-x: auto;
}

.config-table {
  width: 100%;
  border-collapse: collapse;

  th,
  td {
    padding: 1rem;
    text-align: left;
    border-bottom: 1px solid $border-color;
  }

  th {
    background: #f8fafc;
    font-weight: 600;
    color: #64748b;
    font-size: 0.85rem;
    text-transform: uppercase;

    &.col-day {
      text-align: center;
      width: 80px;
    }

    &.col-actions {
      text-align: right;
      width: 100px;
    }
  }

  .cell-product {
    display: flex;
    flex-direction: column;

    .name-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .name {
      font-weight: 600;
      color: $text-color;
    }

    .general-badge {
      font-size: 0.6rem;
      font-weight: 800;
      background: #EEF2FF;
      color: #6366F1;
      padding: 1px 5px;
      border-radius: 4px;
      letter-spacing: 0.5px;
    }

    .dest-badge {
      font-size: 0.6rem;
      font-weight: 800;
      padding: 1px 5px;
      border-radius: 4px;
      letter-spacing: 0.5px;
      text-transform: uppercase;

      &.producción {
        background: rgba(#A855F7, 0.1);
        color: #A855F7;
      }

      &.bodega {
        background: rgba(#16a34a, 0.1);
        color: #16a34a;
      }
    }

    .unit {
      font-size: 0.75rem;
      color: #94a3b8;
      background: #f1f5f9;
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      margin-top: 4px;
      width: fit-content;
    }
  }

  .cell-value {
    text-align: center;
    font-weight: 600;
    color: $text-color;

    .zero {
      color: #cbd5e1;
      font-weight: 400;
    }

    .na-placeholder {
      color: #cbd5e1;
      font-weight: 400;
      opacity: 0.6;
    }
  }

  .cell-actions {
    text-align: right;
    white-space: nowrap;

    .btn-icon {
      background: transparent;
      border: none;
      width: 32px;
      height: 32px;
      border-radius: 6px;
      cursor: pointer;
      color: #64748b;
      transition: all 0.2s;
      margin-left: 0.25rem;

      &:hover {
        background: #f1f5f9;
        color: $primary-color;
      }

      &.delete:hover {
        background: #fef2f2;
        color: $danger-color;
      }
    }
  }

  tbody tr:hover {
    background: #fcfcfc;
  }
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4rem;
  color: #94a3b8;
  gap: 1rem;

  .spinner {
    width: 30px;
    height: 30px;
    border: 3px solid #e2e8f0;
    border-top-color: $primary-color;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 640px) {
  .management-page {
    padding: 1rem;
  }

  .header {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;

    .header-left {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;
    }

    .header-controls {
      flex-direction: column;
      width: 100%;

      .btn-add,
      .branch-selector-wrap {
        width: 100%;
        box-sizing: border-box;
      }
    }
  }

  .config-table {
    font-size: 0.9rem;

    th,
    td {
      padding: 0.75rem 0.5rem;
    }

    .cell-product .unit {
      font-size: 0.7rem;
    }
  }
}
</style>

