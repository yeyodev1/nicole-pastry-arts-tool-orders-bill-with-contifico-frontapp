<script setup lang="ts">
import { computed } from 'vue'
import SearchableSelect from '@/components/ui/SearchableSelect.vue'

const props = defineProps<{
  form: any
  providers: any[]
  displayUnit: string
}>()

const providerOptions = computed(() =>
  props.providers.map(p => ({ value: p._id, label: p.name }))
)

const addProvider = () => {
  if (props.form.providers.length < 3) {
    props.form.providers.push({
      provider: '',
      price: 0,
      isMain: props.form.providers.length === 0,
    })
  }
}

const removeProvider = (index: number | string) => {
  const i = Number(index)
  const removed = props.form.providers.splice(i, 1)[0]
  if (removed && removed.isMain && props.form.providers.length > 0) {
    props.form.providers[0].isMain = true
  }
}

const setMainProvider = (index: number | string) => {
  const target = Number(index)
  props.form.providers.forEach((p: any, i: number) => {
    p.isMain = i === target
  })
}
</script>

<template>
  <section class="modal-section">
    <div class="section-title-row">
      <div class="section-title"><i class="fas fa-truck"></i> Lista de Proveedores (Máx. 3)</div>
      <button
        v-if="form.providers.length < 3"
        @click="addProvider"
        class="btn-add-provider"
        type="button"
      >
        <i class="fas fa-plus"></i> Añadir
      </button>
    </div>

    <div class="providers-list">
      <div v-if="form.providers.length === 0" class="empty-providers">
        No hay proveedores asociados. Añada uno para definir el costo.
      </div>
      <div v-for="(p, index) in form.providers" :key="index" class="provider-row">
        <div class="p-main-check">
          <input
            type="radio"
            :checked="p.isMain"
            @change="setMainProvider(index)"
            name="main_provider"
            :id="'main_' + index"
          />
          <label :for="'main_' + index" title="Marcar como principal">
            <i class="fas fa-star" :class="{ 'active': p.isMain }"></i>
          </label>
        </div>
        <div class="p-select">
          <SearchableSelect
            v-model="p.provider"
            :options="providerOptions"
            placeholder="Proveedor..."
          />
        </div>
        <div class="p-price">
          <div class="price-input-wrapper">
            <span class="currency">$</span>
            <input type="number" v-model.number="p.price" step="0.0001" placeholder="0.00" />
            <span class="unit">/{{ displayUnit }}</span>
          </div>
        </div>
        <div class="p-actions">
          <button @click="removeProvider(index)" class="btn-remove-p" type="button">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style lang="scss" scoped>
@use './section-styles' as *;

.providers-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 1rem;
}

.provider-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: #f8fafc;
  padding: 0.75rem 1rem;
  border-radius: 18px;
  border: 1px solid #f1f5f9;
  transition: all 0.2s;

  &:hover { border-color: #e2e8f0; background: white; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }

  .p-main-check {
    input { display: none; }
    label { cursor: pointer; font-size: 1.25rem; color: #cbd5e1; transition: all 0.2s; i.active { color: #f59e0b; } }
  }
  .p-select { flex: 2; min-width: 0; }
  .p-price { flex: 1.5; }

  .price-input-wrapper {
    display: flex;
    align-items: center;
    background: white;
    border: 2px solid #f1f5f9;
    border-radius: 12px;
    padding: 0 0.75rem;

    &:focus-within { border-color: $NICOLE-PURPLE; }
    .currency { color: #94a3b8; font-weight: 700; margin-right: 0.4rem; }
    input { border: none; padding: 0.6rem 0; width: 100%; font-weight: 700; background: transparent; &:focus { outline: none; } }
    .unit { font-size: 0.75rem; color: #94a3b8; font-weight: 600; margin-left: 0.4rem; }
  }

  .btn-remove-p {
    background: #fee2e2;
    border: none;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    color: #ef4444;
    cursor: pointer;
    transition: all 0.2s;
    &:hover { background: #ef4444; color: white; }
  }
}

.btn-add-provider {
  background: $NICOLE-PURPLE;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 12px;
  font-weight: 800;
  font-size: 0.8rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.empty-providers {
  padding: 2rem;
  text-align: center;
  background: #f8fafc;
  border: 2px dashed #e2e8f0;
  border-radius: 20px;
  color: #94a3b8;
  font-size: 0.9rem;
  font-weight: 600;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;

  &::before {
    content: '\f0d1';
    font-family: 'Font Awesome 5 Free';
    font-weight: 900;
    font-size: 1.5rem;
    opacity: 0.5;
  }
}
</style>
