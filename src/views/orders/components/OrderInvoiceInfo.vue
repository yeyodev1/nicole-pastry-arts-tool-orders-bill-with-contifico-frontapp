<script setup lang="ts">
import { computed } from 'vue'
import { useToast } from '@/composables/useToast'

const props = defineProps<{
  invoiceStatus: string,
  invoiceNeeded: boolean,
  invoiceData: any,
  generatedInvoice?: any,
  authStatus?: string | null,
  isAuthLoading?: boolean,
  isPollingAuth?: boolean,
  invoiceSentToSriAt?: string | null,
}>()

const emit = defineEmits(['open-invoice-modal', 'open-payment-modal', 'generate-invoice', 'view-invoice', 'trigger-auth', 'refresh-auth', 'regenerate-invoice'])
const { error: showError } = useToast()

const isInvoiceDataComplete = computed(() => {
  const d = props.invoiceData || {}
  return d.ruc?.trim() && d.businessName?.trim() && d.email?.trim() && d.address?.trim()
})

const handleGenerateClick = () => {
  if (!isInvoiceDataComplete.value) {
    showError('Faltan datos de facturación (RUC, Razón Social, Email o Dirección). Edítalos primero.')
    return
  }
  emit('generate-invoice')
}

const authStatusConfig = computed(() => {
  switch (props.authStatus) {
    case 'Autorizado':
      return {
        icon: 'fa-check-circle',
        label: 'Autorizado por el SRI',
        detail: null,
        cls: 'auth--ok',
        canRetry: false,
        canReenviar: false,
      }
    case 'Enviado SRI':
      return {
        icon: 'fa-clock',
        label: 'Enviado al SRI — procesando',
        detail: 'El SRI está procesando el documento. Esto puede tomar unos minutos.',
        cls: 'auth--pending',
        canRetry: false,
        canReenviar: false,
      }
    case 'Firmado':
      return {
        icon: 'fa-pen-nib',
        label: 'Firmado — pendiente de autorización SRI',
        detail: 'El documento está firmado pero aún no autorizado. Puedes reenviar manualmente al SRI.',
        cls: 'auth--signed',
        canRetry: false,
        canReenviar: true,
      }
    case 'No Firmado':
      return {
        icon: 'fa-exclamation-circle',
        label: 'No firmado — error de firma',
        detail: 'El documento no pudo firmarse. Intenta reenviar o contacta soporte de Contífico.',
        cls: 'auth--error',
        canRetry: true,
        canReenviar: true,
      }
    default:
      return {
        icon: 'fa-question-circle',
        label: 'Estado SRI no verificado',
        detail: 'No se pudo obtener el estado de autorización. Haz clic en actualizar o reenvía al SRI.',
        cls: 'auth--unknown',
        canRetry: false,
        canReenviar: true,
      }
  }
})

// Factura con datos incorrectos: subtotal_12 = 0 pero iva > 0.
// Esto ocurre cuando la factura fue creada con el bug del campo subtotal_12 hardcoded a 0.
// Estas facturas NUNCA serán autorizadas por el SRI — necesitan regenerarse.
const isBrokenInvoice = computed(() => {
  const info = props.generatedInvoice
  if (!info) return false
  const sub12 = parseFloat(info.subtotal_12 ?? '0')
  const sub0  = parseFloat(info.subtotal_0  ?? '0')
  const iva   = parseFloat(info.iva          ?? '0')
  // Si no hay base gravable (subtotal_12 = 0) pero sí hay IVA → datos incoherentes
  return sub12 === 0 && sub0 === 0 && iva > 0
})

// Si la factura lleva más de 1 hora firmada sin ser aprobada por el SRI,
// es probable que el tipo de persona esté incorrecto.
const sriSignedTooLong = computed(() => {
  if (props.authStatus !== 'Firmado') return false
  if (!props.invoiceSentToSriAt) return false
  const sentAt = new Date(props.invoiceSentToSriAt).getTime()
  const diffMs = Date.now() - sentAt
  return diffMs > 60 * 60 * 1000 // más de 1 hora
})
</script>

<template>
  <div class="invoice-card">
    <!-- Header -->
    <div class="inv-header">
      <div class="inv-header-icon">
        <i class="fas fa-file-invoice-dollar"></i>
      </div>
      <div>
        <h2>Facturación</h2>
        <p v-if="invoiceStatus === 'PROCESSED'" class="inv-status-tag inv-status-tag--done">
          <i class="fas fa-check-circle"></i> Factura generada
        </p>
        <p v-else-if="invoiceNeeded" class="inv-status-tag inv-status-tag--pending">
          <i class="fas fa-clock"></i> Pendiente de facturar
        </p>
        <p v-else class="inv-status-tag inv-status-tag--none">
          <i class="fas fa-minus-circle"></i> Sin factura
        </p>
      </div>
    </div>

    <!-- SRI Auth Banner (when already processed) — siempre visible -->
    <div v-if="invoiceStatus === 'PROCESSED'" class="auth-banner"
      :class="isAuthLoading ? 'auth-banner--loading' : `auth-banner--${authStatusConfig!.cls.replace('auth--', '')}`"
    >
      <template v-if="isAuthLoading">
        <i class="fas fa-spinner fa-spin"></i>
        <div class="auth-banner-text">
          <strong>Verificando estado con el SRI...</strong>
        </div>
      </template>
      <template v-else>
        <i class="fas" :class="authStatusConfig!.icon"></i>
        <div class="auth-banner-text">
          <strong>{{ authStatusConfig!.label }}</strong>
          <span v-if="authStatusConfig!.detail">{{ authStatusConfig!.detail }}</span>
        </div>
        <div class="auth-banner-actions">
          <button
            class="auth-refresh-btn"
            @click="$emit('refresh-auth')"
            :disabled="isAuthLoading"
            title="Actualizar estado"
          >
            <i class="fas fa-sync-alt"></i>
          </button>
        </div>
      </template>
    </div>

    <!-- Alerta crítica: factura con subtotal_12=0 — NUNCA se autorizará, requiere regeneración -->
    <div v-if="invoiceStatus === 'PROCESSED' && isBrokenInvoice" class="broken-invoice-alert">
      <i class="fas fa-triangle-exclamation"></i>
      <div class="broken-invoice-text">
        <strong>Factura con valores incorrectos — no se autorizará</strong>
        <span>La factura fue creada con <code>base imponible = 0</code>. El SRI la rechazará siempre. Debe regenerarse para corregir los valores.</span>
        <button class="broken-regen-btn" @click="$emit('regenerate-invoice')">
          <i class="fas fa-rotate-right"></i> Regenerar Factura ahora
        </button>
      </div>
    </div>

    <!-- Acciones SRI: reenviar / regenerar — zona de acción clara cuando no está autorizado -->
    <div
      v-if="invoiceStatus === 'PROCESSED' && !isAuthLoading && authStatusConfig!.cls !== 'auth--ok'"
      class="sri-actions-bar"
    >
      <button
        v-if="!isBrokenInvoice && (authStatusConfig!.canRetry || authStatusConfig!.canReenviar)"
        class="sri-action-btn sri-action-btn--send"
        @click="$emit('trigger-auth')"
      >
        <i class="fas fa-paper-plane"></i>
        Reenviar al SRI
      </button>
      <button
        v-if="!isBrokenInvoice && (sriSignedTooLong || authStatusConfig!.cls === 'auth--error')"
        class="sri-action-btn sri-action-btn--regen"
        @click="$emit('regenerate-invoice')"
      >
        <i class="fas fa-rotate-right"></i>
        Regenerar Factura
      </button>
    </div>

    <!-- Advertencia: firmado por más de 1 hora sin aprobación del SRI -->
    <div v-if="sriSignedTooLong" class="sri-timeout-warning">
      <i class="fas fa-triangle-exclamation"></i>
      <div class="sri-timeout-text">
        <strong>La factura lleva más de 1 hora sin aprobación del SRI</strong>
        <span>
          Esto puede indicar que el <strong>tipo de persona</strong> (Natural / Jurídica) está
          incorrecto. Verifica los datos de facturación y comunícate con el SRI o soporte de
          Contífico si el problema persiste.
        </span>
        <button class="sri-timeout-edit" @click="$emit('open-invoice-modal')">
          <i class="fas fa-pen"></i> Editar datos de facturación
        </button>
      </div>
    </div>

    <!-- Invoice Data Fields -->
    <div v-if="invoiceNeeded && invoiceData" class="inv-fields">
      <div v-if="invoiceData.personType" class="inv-field">
        <span class="inv-field-label"><i class="fas fa-user-tag"></i> Tipo de Persona</span>
        <span class="inv-field-value inv-type-badge" :class="invoiceData.personType">
          {{ invoiceData.personType === 'juridica' ? 'Persona Jurídica' : 'Persona Natural' }}
        </span>
      </div>
      <div class="inv-field">
        <span class="inv-field-label"><i class="fas fa-building"></i> Razón Social</span>
        <span class="inv-field-value">{{ invoiceData.businessName }}</span>
      </div>
      <div class="inv-field">
        <span class="inv-field-label"><i class="fas fa-id-card"></i> RUC / CI</span>
        <span class="inv-field-value">{{ invoiceData.ruc }}</span>
      </div>
      <div class="inv-field">
        <span class="inv-field-label"><i class="fas fa-envelope"></i> Email</span>
        <span class="inv-field-value">{{ invoiceData.email }}</span>
      </div>
      <div class="inv-field">
        <span class="inv-field-label"><i class="fas fa-map-marker-alt"></i> Dirección</span>
        <span class="inv-field-value">{{ invoiceData.address }}</span>
      </div>
    </div>
    <div v-else-if="!invoiceNeeded" class="inv-empty">
      <i class="fas fa-file-slash"></i>
      <p>Este pedido no requiere factura electrónica.</p>
    </div>

    <!-- Actions -->
    <div class="inv-actions">
      <!-- PROCESSED state -->
      <template v-if="invoiceStatus === 'PROCESSED'">
        <button class="inv-btn inv-btn--primary" @click="$emit('open-payment-modal')">
          <i class="fas fa-hand-holding-usd"></i>
          Registrar Cobro
        </button>
        <button class="inv-btn inv-btn--outline" @click="$emit('view-invoice')">
          <i class="fas fa-file-pdf"></i>
          Ver Factura PDF
        </button>
      </template>

      <!-- NOT YET PROCESSED state -->
      <template v-else>
        <button
          v-if="invoiceNeeded"
          class="inv-btn inv-btn--generate"
          :class="{ 'inv-btn--disabled': !isInvoiceDataComplete }"
          @click="handleGenerateClick"
        >
          <i class="fas fa-file-invoice-dollar"></i>
          Generar Factura Electrónica
        </button>
        <button class="inv-btn inv-btn--outline" @click="$emit('open-invoice-modal')">
          <i class="fas fa-pen"></i>
          {{ invoiceNeeded ? 'Editar datos' : 'Agregar datos de factura' }}
        </button>
        <p v-if="invoiceNeeded && !isInvoiceDataComplete" class="inv-warning">
          <i class="fas fa-exclamation-triangle"></i>
          Completa todos los datos antes de generar.
        </p>
      </template>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.invoice-card {
  background: white;
  border-radius: 14px;
  border: 1px solid $border-light;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  overflow: hidden;
  width: 100%;
  box-sizing: border-box;
}

/* Header */
.inv-header {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 1.25rem 1.25rem 1rem;
  border-bottom: 1px solid #f1f5f9;

  h2 {
    margin: 0 0 0.2rem;
    font-size: 1rem;
    font-weight: 800;
    color: $text-dark;
    letter-spacing: -0.2px;
  }
}

.inv-header-icon {
  width: 42px;
  height: 42px;
  border-radius: 10px;
  background: rgba($NICOLE-PURPLE, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  color: $NICOLE-PURPLE;
  font-size: 1.15rem;
  flex-shrink: 0;
}

.inv-status-tag {
  margin: 0;
  font-size: 0.75rem;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;

  &--done    { color: #059669; }
  &--pending { color: #d97706; }
  &--none    { color: #94a3b8; }
}

/* Auth Banner */
.auth-banner {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid transparent;

  &--loading  { background: #f8fafc; color: #64748b; border-bottom-color: #f1f5f9; }
  &--ok       { background: #f0fdf4; color: #065f46; border-bottom-color: #bbf7d0; }
  &--pending  { background: #fffbeb; color: #92400e; border-bottom-color: #fde68a; }
  &--signed   { background: #fff7ed; color: #9a3412; border-bottom-color: #fed7aa; }
  &--error    { background: #fef2f2; color: #991b1b; border-bottom-color: #fecaca; }
  &--unknown  { background: #f8fafc; color: #475569; border-bottom-color: #e2e8f0; }

  > i { font-size: 0.95rem; margin-top: 0.15rem; flex-shrink: 0; }
}

.auth-banner-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;

  strong { font-size: 0.82rem; font-weight: 700; line-height: 1.3; }
  span   { font-size: 0.76rem; font-weight: 500; opacity: 0.85; line-height: 1.4; }
}

/* Fields */
.inv-fields {
  padding: 0.75rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.inv-field {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.75rem;
  padding: 0.55rem 0;
  border-bottom: 1px dashed #f1f5f9;

  &:last-child { border-bottom: none; }
}

.inv-field-label {
  font-size: 0.78rem;
  color: #94a3b8;
  font-weight: 600;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  i { font-size: 0.7rem; }
}

.inv-field-value {
  font-size: 0.9rem;
  font-weight: 600;
  color: #1e293b;
  text-align: right;
  word-break: break-word;
}

/* Empty */
.inv-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1.5rem 1.25rem;
  color: #94a3b8;
  text-align: center;
  i { font-size: 1.5rem; opacity: 0.4; }
  p { margin: 0; font-size: 0.85rem; }
}

/* Actions */
.inv-actions {
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  border-top: 1px solid #f1f5f9;
  background: #fafbfc;
}

.inv-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.75rem 1rem;
  border-radius: 10px;
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.18s;
  line-height: 1;

  i { font-size: 0.9rem; }

  &--primary {
    background: $NICOLE-PURPLE;
    color: white;
    &:hover { opacity: 0.88; }
  }

  &--generate {
    background: $NICOLE-PURPLE;
    color: white;
    font-size: 0.95rem;
    padding: 0.9rem 1rem;
    &:hover { opacity: 0.88; }
  }

  &--outline {
    background: white;
    border-color: $border-light;
    color: $text-dark;
    &:hover { border-color: $NICOLE-PURPLE; color: $NICOLE-PURPLE; background: rgba($NICOLE-PURPLE, 0.04); }
  }

  &--authorize {
    background: #f0fdf4;
    border-color: #059669;
    color: #059669;
    &:hover { background: #059669; color: white; }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
  }

  &--regenerate {
    background: #fff7ed;
    border-color: #f97316;
    color: #c2410c;
    &:hover { background: #f97316; color: white; }
  }
}

/* Barra de acciones SRI — zona naranja/roja clara cuando la factura NO está autorizada */
.sri-actions-bar {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  background: #fffbeb;
  border-bottom: 1px solid #fde68a;
}

.sri-action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  padding: 0.65rem 0.75rem;
  border-radius: 9px;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.18s;
  line-height: 1;

  i { font-size: 0.8rem; }

  &--send {
    background: #fff;
    border-color: #d97706;
    color: #92400e;
    &:hover { background: #d97706; color: white; border-color: #d97706; }
  }

  &--regen {
    background: #fff;
    border-color: #ef4444;
    color: #991b1b;
    &:hover { background: #ef4444; color: white; border-color: #ef4444; }
  }
}

.auth-banner-actions {
  display: flex;
  align-items: center;
  margin-left: auto;
}

.inv-btn--disabled {
  background: #e2e8f0 !important;
  color: #94a3b8 !important;
  border-color: transparent !important;
  cursor: not-allowed;
  opacity: 1;
}

.inv-warning {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.78rem;
  font-weight: 600;
  color: #d97706;
  i { font-size: 0.75rem; }
}

.inv-note {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.78rem;
  font-weight: 500;
  color: #64748b;
  i { font-size: 0.75rem; color: #94a3b8; }
}

.inv-polling {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.65rem 1rem;
  background: #fffbeb;
  border-radius: 10px;
  font-size: 0.85rem;
  font-weight: 600;
  color: #92400e;
  border: 1px solid #fde68a;
  i { animation: spin 1s linear infinite; }
}

@keyframes spin { to { transform: rotate(360deg); } }

.auth-refresh-btn {
  margin-left: auto;
  background: none;
  border: none;
  cursor: pointer;
  color: inherit;
  opacity: 0.7;
  padding: 0.1rem 0.3rem;
  border-radius: 4px;
  font-size: 0.75rem;
  transition: opacity 0.15s;
  &:hover { opacity: 1; }
  &:disabled { cursor: not-allowed; opacity: 0.3; }
}

// Badge de tipo de persona
.inv-type-badge {
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-size: 0.78rem;
  font-weight: 700;

  &.natural {
    background: #eff6ff;
    color: #1d4ed8;
  }

  &.juridica {
    background: #f0fdf4;
    color: #166534;
  }
}

// Alerta de factura rota (subtotal_12 = 0, iva > 0)
.broken-invoice-alert {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.875rem 1.25rem;
  background: #fef2f2;
  border-bottom: 2px solid #fca5a5;
  color: #991b1b;

  > i {
    font-size: 1.1rem;
    margin-top: 0.1rem;
    flex-shrink: 0;
    color: #ef4444;
  }

  .broken-invoice-text {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;

    strong { font-size: 0.84rem; font-weight: 800; }
    span   { font-size: 0.76rem; font-weight: 500; line-height: 1.5; opacity: 0.9; }
    code   { background: rgba(239,68,68,0.12); padding: 0.1rem 0.3rem; border-radius: 3px; font-size: 0.75rem; }
  }

  .broken-regen-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    margin-top: 0.4rem;
    background: #ef4444;
    color: white;
    border: none;
    padding: 0.45rem 0.9rem;
    border-radius: 7px;
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
    width: fit-content;
    transition: background 0.15s;

    &:hover { background: #dc2626; }
  }
}

// Advertencia de SRI tardío
.sri-timeout-warning {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.875rem 1.25rem;
  background: #fff7ed;
  border-bottom: 1px solid #fed7aa;
  color: #92400e;

  > i {
    font-size: 1rem;
    margin-top: 0.1rem;
    flex-shrink: 0;
    color: #f97316;
  }

  .sri-timeout-text {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;

    strong {
      font-size: 0.82rem;
      font-weight: 800;
      line-height: 1.3;
    }

    span {
      font-size: 0.76rem;
      font-weight: 500;
      line-height: 1.5;
      opacity: 0.9;
    }

    .sri-timeout-edit {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      margin-top: 0.4rem;
      background: #f97316;
      color: white;
      border: none;
      padding: 0.4rem 0.8rem;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 700;
      cursor: pointer;
      width: fit-content;
      transition: background 0.15s;

      &:hover { background: #ea6c0a; }
    }
  }
}
</style>
