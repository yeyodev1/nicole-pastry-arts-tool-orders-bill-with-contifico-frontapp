<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

// ── Configuración (editar aquí para ajustar o quitar el aviso) ────────────
// Fecha límite: lunes 31 de agosto de 2026, 10:00 (Ecuador, UTC-5)
const DEADLINE = new Date('2026-08-31T10:00:00-05:00')
const DEADLINE_LABEL = 'lunes 31 de agosto'
const PHONE_DISPLAY = '+593 99 525 4965'
const PHONE_WA = '593995254965'
// Para retirar el aviso una vez confirmado el pago: poner en false y desplegar
const ACTIVE = true
// ──────────────────────────────────────────────────────────────────────────

const now = ref(Date.now())
let timer: number | undefined

const remainingMs = computed(() => DEADLINE.getTime() - now.value)
const expired = computed(() => remainingMs.value <= 0)

const pad = (n: number) => String(n).padStart(2, '0')
const countdown = computed(() => {
  const total = Math.max(0, Math.floor(remainingMs.value / 1000))
  return {
    d: Math.floor(total / 86400),
    h: pad(Math.floor((total % 86400) / 3600)),
    m: pad(Math.floor((total % 3600) / 60)),
    s: pad(total % 60),
  }
})

// Días transcurridos desde el vencimiento (cuenta día a día)
const overdueDays = computed(() => Math.floor(-remainingMs.value / 86400000) + 1)

const waLink = computed(() => {
  const text = encodeURIComponent(
    'Hola, envío el comprobante de la transferencia mensual del sistema de pedidos Nicole Pastry Arts.',
  )
  return `https://wa.me/${PHONE_WA}?text=${text}`
})

onMounted(() => {
  timer = window.setInterval(() => {
    now.value = Date.now()
  }, 1000)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <!-- Barra fija superior: siempre visible, no bloquea la app, no se puede cerrar -->
  <div v-if="ACTIVE" class="payment-bar" :class="{ expired }" role="alert">
    <i class="fa-solid fa-triangle-exclamation"></i>
    <span class="pb-text">
      <strong>AVISO DE PAGO:</strong>
      <template v-if="!expired">
        factura pendiente de cancelación. Plazo hasta el <strong>{{ DEADLINE_LABEL }}, 10:00 AM</strong>
        · Restan
        <strong class="pb-count">{{ countdown.d }}d {{ countdown.h }}:{{ countdown.m }}:{{ countdown.s }}</strong>
      </template>
      <template v-else>
        <strong>PLAZO VENCIDO</strong> — día {{ overdueDays }} de retraso. Envíe el comprobante de la transferencia para retirar este aviso.
      </template>
      · Comprobante por WhatsApp:
      <a :href="waLink" target="_blank" rel="noopener">
        <i class="fa-brands fa-whatsapp"></i> {{ PHONE_DISPLAY }}
      </a>
    </span>
  </div>
</template>

<style lang="scss" scoped>
.payment-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100000;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  min-height: 40px;
  padding: 0.45rem 1rem;
  background: repeating-linear-gradient(135deg, #b91c1c 0 14px, #991b1b 14px 28px);
  color: #fff;
  font-size: 0.85rem;
  line-height: 1.3;
  text-align: center;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.35);
  animation: pn-blink 1.4s ease-in-out infinite;

  &.expired {
    background: repeating-linear-gradient(135deg, #7f1d1d 0 14px, #450a0a 14px 28px);
    animation-duration: 0.9s;
  }

  > i {
    font-size: 1rem;
    flex-shrink: 0;
  }

  a {
    color: #fde68a;
    font-weight: 700;
    text-decoration: underline;
    white-space: nowrap;
  }

  .pb-count {
    font-variant-numeric: tabular-nums;
  }
}

@keyframes pn-blink {
  0%,
  100% {
    filter: brightness(1);
  }
  50% {
    filter: brightness(1.35);
  }
}

@media (max-width: 520px) {
  .payment-bar {
    font-size: 0.72rem;
    padding: 0.35rem 0.6rem;
  }
}
</style>
