<script setup lang="ts">
import { ref, onMounted } from 'vue'
import RawMaterialService from '@/services/raw-material.service'

const props = defineProps<{
  material: any | null
}>()

const isLoading = ref(false)
const contifico = ref<{ linked: boolean; source?: string; total?: number; data: { bodega: string; cantidad: number }[] } | null>(null)

onMounted(async () => {
  if (!props.material?._id || !props.material?.fromContifico) return
  isLoading.value = true
  try {
    contifico.value = await RawMaterialService.getContificoStock(props.material._id)
  } catch { /* silencioso */ }
  finally { isLoading.value = false }
})
</script>

<template>
  <section class="modal-section" v-if="material">
    <div class="section-title"><i class="fas fa-link"></i> Contífico</div>

    <div v-if="!material.fromContifico" class="ctf-card ctf-card--unlinked">
      <i class="fas fa-unlink"></i>
      <div>
        <strong>No vinculado a Contífico</strong>
        <span>Este material fue creado manualmente en la app.</span>
      </div>
    </div>

    <div v-else class="ctf-card">
      <div class="ctf-head">
        <span class="ctf-badge">
          <i class="fas fa-check-circle"></i>
          Sincronizado con Contífico {{ material.contificoSource === 'sucree' ? 'Sucree' : 'Nicole' }}
        </span>
        <code v-if="material.code" class="ctf-code">{{ material.code }}</code>
      </div>

      <div class="ctf-stock">
        <div class="ctf-stock-title">Stock por bodega en Contífico (en vivo)</div>
        <div v-if="isLoading" class="ctf-loading"><i class="fas fa-spinner fa-spin"></i> Consultando Contífico...</div>
        <template v-else-if="contifico?.linked">
          <div v-if="contifico.data.length === 0" class="ctf-empty">Sin stock registrado en bodegas de Contífico.</div>
          <div v-else class="ctf-bodegas">
            <div v-for="b in contifico.data" :key="b.bodega" class="ctf-bodega" :class="{ 'ctf-bodega--zero': b.cantidad <= 0 }">
              <i class="fas fa-warehouse"></i>
              <span class="b-name">{{ b.bodega }}</span>
              <span class="b-qty">{{ b.cantidad }}</span>
            </div>
          </div>
          <div v-if="contifico.data.length" class="ctf-total">
            Total en Contífico: <strong>{{ contifico.total }}</strong>
          </div>
        </template>
        <div v-else class="ctf-empty">No se pudo consultar el stock en Contífico.</div>
      </div>
    </div>
  </section>
</template>

<style lang="scss" scoped>
@use './section-styles' as *;

.ctf-card {
  background: #f5f3ff;
  border: 1px solid rgba($NICOLE-PURPLE, 0.15);
  border-radius: 20px;
  padding: 1.25rem;

  &--unlinked {
    background: #f8fafc;
    border-color: #e2e8f0;
    display: flex;
    align-items: center;
    gap: 1rem;
    color: #94a3b8;

    i { font-size: 1.5rem; opacity: 0.5; }

    div {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      strong { color: #64748b; font-size: 0.92rem; }
      span { font-size: 0.82rem; }
    }
  }
}

.ctf-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.ctf-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: #ede9fe;
  color: #6d28d9;
  border-radius: 999px;
  padding: 0.35rem 0.8rem;
  font-size: 0.78rem;
  font-weight: 800;

  i { color: #16a34a; }
}

.ctf-code {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 0.25rem 0.6rem;
  font-size: 0.8rem;
  color: #475569;
}

.ctf-stock-title {
  font-size: 0.72rem;
  font-weight: 800;
  color: #6d28d9;
  text-transform: uppercase;
  margin-bottom: 0.6rem;
}

.ctf-loading, .ctf-empty { font-size: 0.82rem; color: #94a3b8; }

.ctf-bodegas {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.ctf-bodega {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  background: white;
  border: 1px solid #ede9fe;
  border-radius: 12px;
  padding: 0.5rem 0.8rem;
  font-size: 0.85rem;

  i { color: $NICOLE-PURPLE; opacity: 0.6; font-size: 0.75rem; }
  .b-name { flex: 1; color: #334155; font-weight: 600; }
  .b-qty { font-weight: 900; color: #1e293b; }

  &--zero { opacity: 0.55; .b-qty { color: #94a3b8; } }
}

.ctf-total {
  margin-top: 0.7rem;
  font-size: 0.82rem;
  color: #64748b;
  text-align: right;

  strong { color: $NICOLE-PURPLE; font-size: 1rem; }
}
</style>
