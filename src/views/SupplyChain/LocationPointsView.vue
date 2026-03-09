<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import WarehouseSettingsService, { type WarehousePoint } from '@/services/warehouse-settings.service'

// ─── State ────────────────────────────────────────────────────────────────────

const receptionPoints = ref<WarehousePoint[]>([])
const dispatchPoints  = ref<WarehousePoint[]>([])
const savedSnapshot   = ref('')
const isLoading       = ref(false)
const isSaving        = ref(false)
const toast           = ref<{ message: string; type: 'success' | 'error' } | null>(null)

const newReception = ref('')
const newDispatch  = ref('')

// ─── Derived ──────────────────────────────────────────────────────────────────

const isDirty = computed(() => {
  const current = JSON.stringify({ r: receptionPoints.value, d: dispatchPoints.value })
  return current !== savedSnapshot.value
})

const activeReception = computed(() => receptionPoints.value.filter(p => p.isActive).length)
const activeDispatch  = computed(() => dispatchPoints.value.filter(p => p.isActive).length)

// ─── API ──────────────────────────────────────────────────────────────────────

const snapshot = () => {
  savedSnapshot.value = JSON.stringify({ r: receptionPoints.value, d: dispatchPoints.value })
}

const load = async () => {
  isLoading.value = true
  try {
    const data = await WarehouseSettingsService.getSettings()
    receptionPoints.value = data.receptionPoints
    dispatchPoints.value  = data.dispatchPoints
    snapshot()
  } catch {
    showToast('Error al cargar configuración', 'error')
  } finally {
    isLoading.value = false
  }
}

const save = async () => {
  isSaving.value = true
  try {
    const data = await WarehouseSettingsService.updateSettings({
      receptionPoints: receptionPoints.value,
      dispatchPoints:  dispatchPoints.value
    })
    receptionPoints.value = data.receptionPoints
    dispatchPoints.value  = data.dispatchPoints
    snapshot()
    showToast('Cambios guardados correctamente')
  } catch {
    showToast('Error al guardar', 'error')
  } finally {
    isSaving.value = false
  }
}

const discard = () => {
  const snap = JSON.parse(savedSnapshot.value)
  receptionPoints.value = snap.r
  dispatchPoints.value  = snap.d
}

// ─── Mutations ────────────────────────────────────────────────────────────────

const addReception = () => {
  const name = newReception.value.trim()
  if (!name) return
  receptionPoints.value.push({ name, isActive: true })
  newReception.value = ''
}

const addDispatch = () => {
  const name = newDispatch.value.trim()
  if (!name) return
  dispatchPoints.value.push({ name, isActive: true })
  newDispatch.value = ''
}

const removeReception = (i: number) => { receptionPoints.value.splice(i, 1) }
const removeDispatch  = (i: number) => { dispatchPoints.value.splice(i, 1) }

// ─── Toast ────────────────────────────────────────────────────────────────────

const showToast = (message: string, type: 'success' | 'error' = 'success') => {
  toast.value = { message, type }
  setTimeout(() => { toast.value = null }, 3000)
}

onMounted(load)
</script>

<template>
  <div class="lp-view">

    <!-- Toast -->
    <Teleport to="body">
      <Transition name="toast">
        <div v-if="toast" :class="['lp-toast', toast.type]">
          <i :class="toast.type === 'success' ? 'fas fa-check-circle' : 'fas fa-exclamation-circle'"></i>
          {{ toast.message }}
        </div>
      </Transition>
    </Teleport>

    <!-- ── Header ────────────────────────────────────────────────────────── -->
    <div class="lp-header">
      <div class="lp-header__left">
        <div class="header-icon">
          <i class="fas fa-location-dot"></i>
        </div>
        <div>
          <h1>Puntos de Bodega</h1>
          <p>Define dónde se reciben los insumos y a qué destinos se despachan</p>
        </div>
      </div>

      <div class="lp-header__stats">
        <div class="stat-chip green">
          <i class="fas fa-box-open"></i>
          <span>{{ activeReception }} recepción</span>
        </div>
        <div class="stat-chip red">
          <i class="fas fa-truck-loading"></i>
          <span>{{ activeDispatch }} despacho</span>
        </div>
      </div>
    </div>

    <!-- ── Loading ────────────────────────────────────────────────────────── -->
    <div v-if="isLoading" class="lp-loading">
      <i class="fas fa-spinner fa-spin"></i>
      <span>Cargando configuración…</span>
    </div>

    <!-- ── Grid ──────────────────────────────────────────────────────────── -->
    <div v-else class="lp-grid">

      <!-- ── RECEPCIÓN ─────────────────────────────────────────────────── -->
      <div class="panel panel--reception">
        <div class="panel__header">
          <div class="panel__icon">
            <i class="fas fa-box-open"></i>
          </div>
          <div class="panel__info">
            <h2>Puntos de Recepción</h2>
            <p>Bodegas o locales donde <strong>ingresan materiales</strong></p>
          </div>
          <div class="panel__count">
            <span class="count-num">{{ receptionPoints.length }}</span>
            <span class="count-label">{{ receptionPoints.length === 1 ? 'punto' : 'puntos' }}</span>
          </div>
        </div>

        <div class="panel__body">
          <!-- Empty state -->
          <div v-if="receptionPoints.length === 0" class="empty-state">
            <div class="empty-state__icon">
              <i class="fas fa-warehouse"></i>
            </div>
            <p>Aún no hay puntos de recepción.</p>
            <span>Agrega el primero en el campo de abajo.</span>
          </div>

          <!-- List -->
          <div v-else class="point-list">
            <div
              v-for="(pt, i) in receptionPoints"
              :key="pt._id || i"
              class="point-item"
              :class="{ 'point-item--inactive': !pt.isActive }"
            >
              <div class="point-item__index">{{ i + 1 }}</div>

              <div class="point-item__body">
                <span class="point-item__name">{{ pt.name }}</span>
                <span v-if="!pt.isActive" class="point-item__tag">inactivo</span>
              </div>

              <label class="toggle" :title="pt.isActive ? 'Desactivar' : 'Activar'">
                <input type="checkbox" v-model="pt.isActive" />
                <span class="toggle__track"></span>
              </label>

              <button class="btn-del" @click="removeReception(i)" title="Eliminar">
                <i class="fas fa-trash-alt"></i>
              </button>
            </div>
          </div>
        </div>

        <!-- Add -->
        <div class="panel__footer">
          <div class="add-row">
            <i class="fas fa-plus add-row__icon"></i>
            <input
              v-model="newReception"
              type="text"
              class="add-row__input"
              placeholder="Nombre del punto, ej: Bodega Central"
              @keydown.enter="addReception"
            />
            <button
              class="add-row__btn add-row__btn--reception"
              :disabled="!newReception.trim()"
              @click="addReception"
            >
              Agregar
            </button>
          </div>
        </div>
      </div>

      <!-- ── DESPACHO ──────────────────────────────────────────────────── -->
      <div class="panel panel--dispatch">
        <div class="panel__header">
          <div class="panel__icon">
            <i class="fas fa-truck-loading"></i>
          </div>
          <div class="panel__info">
            <h2>Puntos de Despacho</h2>
            <p>Destinos a los que <strong>salen materiales</strong></p>
          </div>
          <div class="panel__count">
            <span class="count-num">{{ dispatchPoints.length }}</span>
            <span class="count-label">{{ dispatchPoints.length === 1 ? 'punto' : 'puntos' }}</span>
          </div>
        </div>

        <div class="panel__body">
          <!-- Empty state -->
          <div v-if="dispatchPoints.length === 0" class="empty-state">
            <div class="empty-state__icon">
              <i class="fas fa-truck"></i>
            </div>
            <p>Aún no hay puntos de despacho.</p>
            <span>Agrega el primero en el campo de abajo.</span>
          </div>

          <!-- List -->
          <div v-else class="point-list">
            <div
              v-for="(pt, i) in dispatchPoints"
              :key="pt._id || i"
              class="point-item"
              :class="{ 'point-item--inactive': !pt.isActive }"
            >
              <div class="point-item__index">{{ i + 1 }}</div>

              <div class="point-item__body">
                <span class="point-item__name">{{ pt.name }}</span>
                <span v-if="!pt.isActive" class="point-item__tag">inactivo</span>
              </div>

              <label class="toggle" :title="pt.isActive ? 'Desactivar' : 'Activar'">
                <input type="checkbox" v-model="pt.isActive" />
                <span class="toggle__track"></span>
              </label>

              <button class="btn-del" @click="removeDispatch(i)" title="Eliminar">
                <i class="fas fa-trash-alt"></i>
              </button>
            </div>
          </div>
        </div>

        <!-- Add -->
        <div class="panel__footer">
          <div class="add-row">
            <i class="fas fa-plus add-row__icon"></i>
            <input
              v-model="newDispatch"
              type="text"
              class="add-row__input"
              placeholder="Nombre del destino, ej: Nicole - San Marino"
              @keydown.enter="addDispatch"
            />
            <button
              class="add-row__btn add-row__btn--dispatch"
              :disabled="!newDispatch.trim()"
              @click="addDispatch"
            >
              Agregar
            </button>
          </div>
        </div>
      </div>

    </div>

    <!-- ── Save bar ────────────────────────────────────────────────────────── -->
    <Transition name="save-bar">
      <div v-if="isDirty && !isLoading" class="save-bar">
        <div class="save-bar__dot"></div>
        <span class="save-bar__label">Tienes cambios sin guardar</span>
        <div class="save-bar__actions">
          <button class="btn-discard" @click="discard">Descartar</button>
          <button class="btn-save" :disabled="isSaving" @click="save">
            <i :class="isSaving ? 'fas fa-spinner fa-spin' : 'fas fa-save'"></i>
            {{ isSaving ? 'Guardando…' : 'Guardar cambios' }}
          </button>
        </div>
      </div>
    </Transition>

  </div>
</template>

<style lang="scss" scoped>
.lp-view {
  width: 100%;
  min-height: 100vh;
  background: #f8fafc;
  box-sizing: border-box;
  padding-bottom: 5.5rem;
}

// ─── Header ───────────────────────────────────────────────────────────────────

.lp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1.25rem;
  padding: 2rem 2rem 1.5rem;
  background: white;
  border-bottom: 1px solid #e2e8f0;

  @media (min-width: 768px) { padding: 2rem 2.5rem 1.5rem; }

  &__left {
    display: flex;
    align-items: center;
    gap: 1rem;

    h1 {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.4px;

      @media (min-width: 640px) { font-size: 1.75rem; }
    }

    p {
      margin: 0.2rem 0 0;
      color: #64748b;
      font-size: 0.875rem;
      font-weight: 500;
    }
  }

  &__stats {
    display: flex;
    gap: 0.6rem;
    flex-wrap: wrap;
  }
}

.header-icon {
  width: 48px;
  height: 48px;
  background: rgba($NICOLE-PURPLE, 0.1);
  color: $NICOLE-PURPLE;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  flex-shrink: 0;
}

.stat-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.45rem 0.9rem;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 700;

  i { font-size: 0.75rem; }

  &.green { background: rgba(#059669, 0.1); color: #047857; }
  &.red   { background: rgba(#dc2626, 0.09); color: #b91c1c; }
}

// ─── Loading ──────────────────────────────────────────────────────────────────

.lp-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 5rem;
  color: #94a3b8;
  font-size: 0.95rem;
}

// ─── Grid ─────────────────────────────────────────────────────────────────────

.lp-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
  padding: 1.75rem 2rem;

  @media (min-width: 768px) {
    padding: 1.75rem 2.5rem;
    grid-template-columns: 1fr 1fr;
  }
}

// ─── Panel ────────────────────────────────────────────────────────────────────

.panel {
  background: white;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);

  &__header {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.4rem 1.5rem;
    border-bottom: 1px solid #f1f5f9;
  }

  &__icon {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.1rem;
    flex-shrink: 0;
  }

  &__info {
    flex: 1;
    min-width: 0;

    h2 {
      margin: 0;
      font-size: 1rem;
      font-weight: 800;
      color: #0f172a;
    }

    p {
      margin: 0.2rem 0 0;
      font-size: 0.8rem;
      color: #64748b;

      strong { color: #475569; font-weight: 700; }
    }
  }

  &__count {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
  }

  &__body {
    flex: 1;
    overflow-y: auto;
    max-height: 420px;
  }

  &__footer {
    border-top: 1px solid #f1f5f9;
    padding: 1rem 1.25rem;
    background: #fafbfd;
  }

  &--reception {
    .panel__icon { background: rgba(#059669, 0.1); color: #059669; }
    .count-num   { color: #059669; }
  }

  &--dispatch {
    .panel__icon { background: rgba(#dc2626, 0.1); color: #dc2626; }
    .count-num   { color: #dc2626; }
  }
}

.count-num {
  font-size: 1.6rem;
  font-weight: 900;
  line-height: 1;
}

.count-label {
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #94a3b8;
  margin-top: 0.1rem;
}

// ─── Empty state ──────────────────────────────────────────────────────────────

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 2rem;
  text-align: center;
  gap: 0.4rem;

  &__icon {
    width: 56px;
    height: 56px;
    background: #f1f5f9;
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.4rem;
    color: #94a3b8;
    margin-bottom: 0.6rem;
  }

  p {
    margin: 0;
    font-size: 0.9rem;
    font-weight: 700;
    color: #475569;
  }

  span {
    font-size: 0.8rem;
    color: #94a3b8;
    font-weight: 500;
  }
}

// ─── Point list ───────────────────────────────────────────────────────────────

.point-list {
  padding: 0.5rem 0;
}

.point-item {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.85rem 1.4rem;
  border-bottom: 1px solid #f8fafc;
  transition: background 0.12s;

  &:last-child { border-bottom: none; }
  &:hover { background: #fafbfd; }

  &--inactive {
    .point-item__name { color: #94a3b8; text-decoration: line-through; }
    .point-item__index { opacity: 0.4; }
  }

  &__index {
    width: 22px;
    height: 22px;
    background: #f1f5f9;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.72rem;
    font-weight: 800;
    color: #94a3b8;
    flex-shrink: 0;
  }

  &__body {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    min-width: 0;
  }

  &__name {
    font-size: 0.9rem;
    font-weight: 600;
    color: #1e293b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__tag {
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    color: #94a3b8;
    background: #f1f5f9;
    padding: 0.15rem 0.5rem;
    border-radius: 999px;
    flex-shrink: 0;
  }
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

.toggle {
  position: relative;
  display: flex;
  cursor: pointer;
  flex-shrink: 0;

  input { position: absolute; opacity: 0; width: 0; height: 0; }

  &__track {
    width: 36px;
    height: 20px;
    background: #e2e8f0;
    border-radius: 100px;
    transition: background 0.2s;
    position: relative;

    &::after {
      content: '';
      position: absolute;
      top: 3px;
      left: 3px;
      width: 14px;
      height: 14px;
      background: white;
      border-radius: 50%;
      box-shadow: 0 1px 3px rgba(0,0,0,0.2);
      transition: transform 0.2s;
    }
  }

  input:checked + .toggle__track {
    background: #059669;
    &::after { transform: translateX(16px); }
  }
}

// ─── Delete button ─────────────────────────────────────────────────────────────

.btn-del {
  background: none;
  border: none;
  cursor: pointer;
  color: #cbd5e1;
  font-size: 0.78rem;
  padding: 0.4rem;
  border-radius: 6px;
  flex-shrink: 0;
  line-height: 1;
  transition: color 0.15s, background 0.15s;

  &:hover { color: #ef4444; background: rgba(#ef4444, 0.08); }
}

// ─── Add row ──────────────────────────────────────────────────────────────────

.add-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  background: white;
  border: 1.5px solid #e2e8f0;
  border-radius: 10px;
  padding: 0 0.75rem 0 0.6rem;
  transition: border-color 0.2s, box-shadow 0.2s;

  &:focus-within {
    border-color: $NICOLE-PURPLE;
    box-shadow: 0 0 0 3px rgba($NICOLE-PURPLE, 0.08);
  }

  &__icon {
    color: #cbd5e1;
    font-size: 0.8rem;
    flex-shrink: 0;
  }

  &__input {
    flex: 1;
    border: none;
    outline: none;
    padding: 0.7rem 0;
    font-size: 0.875rem;
    font-weight: 500;
    color: #1e293b;
    background: transparent;

    &::placeholder { color: #94a3b8; font-weight: 400; }
  }

  &__btn {
    flex-shrink: 0;
    padding: 0.45rem 0.95rem;
    border: none;
    border-radius: 7px;
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
    color: white;
    transition: opacity 0.2s, transform 0.1s;

    &--reception { background: #059669; }
    &--dispatch  { background: #dc2626; }

    &:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
    &:disabled { opacity: 0.35; cursor: not-allowed; transform: none; }
  }
}

// ─── Save bar ─────────────────────────────────────────────────────────────────

.save-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 2rem;
  background: #0f172a;
  border-top: 1px solid rgba(255,255,255,0.08);
  z-index: 200;
  flex-wrap: wrap;

  @media (min-width: 768px) { padding: 1rem 2.5rem; }
  @media (min-width: 1024px) { left: 220px; }

  &__dot {
    width: 8px;
    height: 8px;
    background: #fbbf24;
    border-radius: 50%;
    flex-shrink: 0;
    animation: pulse-dot 1.8s ease-in-out infinite;
  }

  &__label {
    flex: 1;
    font-size: 0.875rem;
    font-weight: 600;
    color: #e2e8f0;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.5; transform: scale(0.75); }
}

.btn-discard {
  background: transparent;
  border: 1px solid rgba(255,255,255,0.15);
  color: #94a3b8;
  padding: 0.55rem 1rem;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;

  &:hover { border-color: rgba(255,255,255,0.3); color: #e2e8f0; }
}

.btn-save {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.6rem 1.25rem;
  background: $NICOLE-PURPLE;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  transition: opacity 0.2s;

  &:disabled { opacity: 0.6; cursor: not-allowed; }
  &:not(:disabled):hover { opacity: 0.88; }
}

// ─── Transitions ──────────────────────────────────────────────────────────────

.save-bar-enter-active,
.save-bar-leave-active { transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1); }
.save-bar-enter-from,
.save-bar-leave-to     { transform: translateY(100%); }

.lp-toast {
  position: fixed;
  bottom: 5rem;
  left: 50%;
  transform: translateX(-50%);
  padding: 0.75rem 1.25rem;
  border-radius: 10px;
  font-size: 0.88rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  z-index: 9999;
  box-shadow: 0 4px 24px rgba(0,0,0,0.2);
  white-space: nowrap;

  &.success { background: #059669; color: white; }
  &.error   { background: #dc2626; color: white; }
}

.toast-enter-active, .toast-leave-active { transition: all 0.3s; }
.toast-enter-from, .toast-leave-to       { opacity: 0; transform: translate(-50%, 0.75rem); }
</style>
