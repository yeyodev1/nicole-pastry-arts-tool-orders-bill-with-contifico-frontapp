<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

// ── Configuración (editar aquí para ajustar o quitar el aviso) ────────────
// Fecha límite: hoy jueves 20 de agosto de 2026, 10:00 (Ecuador, UTC-5)
const DEADLINE = new Date('2026-08-20T10:00:00-05:00')
const PHONE_DISPLAY = '+593 99 525 4965'
const PHONE_WA = '593995254965'
// Tiempo que el modal permanece oculto tras confirmar (vuelve a aparecer después)
const SNOOZE_MS = 2 * 60 * 1000
const STORAGE_KEY = 'payment_notice_confirmed_at'
// ──────────────────────────────────────────────────────────────────────────

const route = useRoute()
const now = ref(Date.now())
const snoozedUntil = ref<number>(Number(localStorage.getItem(STORAGE_KEY) || 0) + SNOOZE_MS)
let timer: number | undefined

const remainingMs = computed(() => Math.max(0, DEADLINE.getTime() - now.value))
const expired = computed(() => remainingMs.value === 0)

const pad = (n: number) => String(n).padStart(2, '0')
const countdown = computed(() => {
  const total = Math.floor(remainingMs.value / 1000)
  const d = Math.floor(total / 86400)
  const h = Math.floor((total % 86400) / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return { d, h: pad(h), m: pad(m), s: pad(s) }
})

// Tras vencer el plazo el modal es permanente (bloqueo real de acceso)
const showModal = computed(() => expired.value || now.value >= snoozedUntil.value)

const waLink = computed(() => {
  const text = encodeURIComponent(
    'Hola, escribo desde el sistema de pedidos Nicole Pastry Arts respecto a la factura pendiente / transferencia mensual.',
  )
  return `https://wa.me/${PHONE_WA}?text=${text}`
})

const confirm = () => {
  const ts = Date.now()
  localStorage.setItem(STORAGE_KEY, String(ts))
  snoozedUntil.value = ts + SNOOZE_MS
}

// Al cambiar de vista, el modal vuelve a aparecer siempre
watch(
  () => route.fullPath,
  () => {
    snoozedUntil.value = 0
  },
)

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
  <!-- Barra fija superior: siempre visible, no se puede cerrar -->
  <div class="payment-bar" role="alert">
    <i class="fa-solid fa-triangle-exclamation"></i>
    <span>
      <strong>AVISO DE PAGO:</strong> este sistema está vinculado a la transferencia mensual.
      Existe una factura pendiente de cancelación. <strong>Se perderá el acceso HOY a las 10:00 AM.</strong>
      <template v-if="!expired">
        Restan: <strong>{{ countdown.d }}d {{ countdown.h }}:{{ countdown.m }}:{{ countdown.s }}</strong>
      </template>
      <template v-else><strong>PLAZO VENCIDO — ACCESO SUSPENDIDO</strong></template>
      · Contacto: <a :href="waLink" target="_blank" rel="noopener">{{ PHONE_DISPLAY }}</a>
    </span>
  </div>

  <!-- Modal bloqueante -->
  <Transition name="pn-fade">
    <div v-if="showModal" class="payment-overlay" role="dialog" aria-modal="true">
      <div class="payment-modal" :class="{ expired }">
        <div class="pn-header">
          <i class="fa-solid fa-file-invoice-dollar"></i>
          <h2>{{ expired ? 'Acceso suspendido' : 'Factura pendiente de pago' }}</h2>
        </div>

        <p class="pn-lead">
          A partir de ahora, el acceso a este sistema está <strong>vinculado a la transferencia mensual</strong>.
          Actualmente existe una <strong>factura pendiente que debe ser cancelada</strong>.
          De no regularizarse, <strong>se perderá el acceso al sistema HOY a las 10:00 AM</strong>.
        </p>

        <div class="pn-countdown">
          <span class="pn-countdown-label">
            {{ expired ? 'El plazo de pago ha vencido — acceso suspendido' : 'Tiempo restante antes de perder el acceso' }}
          </span>
          <div v-if="!expired" class="pn-digits">
            <div><b>{{ countdown.d }}</b><small>días</small></div>
            <div><b>{{ countdown.h }}</b><small>horas</small></div>
            <div><b>{{ countdown.m }}</b><small>min</small></div>
            <div><b>{{ countdown.s }}</b><small>seg</small></div>
          </div>
          <div v-else class="pn-expired-text">Hoy, 10:00 AM</div>
          <span class="pn-deadline">Fecha límite: HOY jueves 20 de agosto de 2026, 10:00 AM</span>
        </div>

        <p class="pn-contact">
          Para cualquier consulta o para coordinar el pago, comuníquese al
          <a :href="waLink" target="_blank" rel="noopener">
            <i class="fa-brands fa-whatsapp"></i> {{ PHONE_DISPLAY }}
          </a>
        </p>

        <button v-if="!expired" class="pn-confirm" @click="confirm">
          <i class="fa-solid fa-building-columns"></i>
          Confirmo que voy a enviar la transferencia
        </button>
        <span class="pn-note">
          {{ expired ? 'El acceso permanecerá suspendido hasta confirmar la recepción del pago.' : '' }}
          Este aviso volverá a mostrarse hasta que se confirme la recepción del pago.
        </span>
      </div>
    </div>
  </Transition>
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
  padding: 0.55rem 1rem;
  background: repeating-linear-gradient(
    135deg,
    #b91c1c 0 14px,
    #991b1b 14px 28px
  );
  color: #fff;
  font-size: 0.85rem;
  line-height: 1.3;
  text-align: center;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.35);
  animation: pn-blink 1.4s ease-in-out infinite;

  i {
    font-size: 1rem;
    flex-shrink: 0;
  }

  a {
    color: #fde68a;
    font-weight: 700;
    text-decoration: underline;
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

.payment-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(15, 23, 42, 0.88);
  backdrop-filter: blur(6px);
}

.payment-modal {
  width: 100%;
  max-width: 560px;
  background: #fff;
  border-radius: 18px;
  border: 4px solid #dc2626;
  padding: 1.75rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
  text-align: center;
  box-shadow: 0 0 0 8px rgba(220, 38, 38, 0.25), 0 30px 80px rgba(0, 0, 0, 0.5);
  animation: pn-shake 0.6s ease-in-out;
  max-height: calc(100dvh - 2rem);
  overflow-y: auto;

  &.expired {
    border-color: #7f1d1d;
  }
}

@keyframes pn-shake {
  0%,
  100% {
    transform: translateX(0);
  }
  20%,
  60% {
    transform: translateX(-8px);
  }
  40%,
  80% {
    transform: translateX(8px);
  }
}

.pn-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;

  i {
    font-size: 2.6rem;
    color: #dc2626;
  }

  h2 {
    margin: 0;
    font-size: 1.45rem;
    font-weight: 800;
    color: #7f1d1d;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }
}

.pn-lead {
  margin: 0;
  font-size: 1rem;
  color: #1f2937;
  line-height: 1.5;

  strong {
    color: #b91c1c;
  }
}

.pn-countdown {
  background: #fef2f2;
  border: 2px dashed #dc2626;
  border-radius: 14px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.pn-countdown-label {
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #991b1b;
}

.pn-digits {
  display: flex;
  justify-content: center;
  gap: 0.75rem;

  div {
    display: flex;
    flex-direction: column;
    min-width: 64px;
    background: #7f1d1d;
    color: #fff;
    border-radius: 10px;
    padding: 0.5rem 0.25rem;

    b {
      font-size: 1.8rem;
      font-variant-numeric: tabular-nums;
      line-height: 1;
    }

    small {
      font-size: 0.65rem;
      text-transform: uppercase;
      opacity: 0.8;
      margin-top: 0.25rem;
    }
  }
}

.pn-expired-text {
  font-size: 1.4rem;
  font-weight: 800;
  color: #7f1d1d;
}

.pn-deadline {
  font-size: 0.8rem;
  color: #7f1d1d;
}

.pn-contact {
  margin: 0;
  font-size: 0.95rem;
  color: #374151;

  a {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    margin-top: 0.35rem;
    font-weight: 800;
    font-size: 1.1rem;
    color: #15803d;
    text-decoration: none;

    i {
      font-size: 1.3rem;
    }
  }
}

.pn-confirm {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.95rem 1rem;
  border: none;
  border-radius: 12px;
  background: #dc2626;
  color: #fff;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: #b91c1c;
  }
}

.pn-note {
  font-size: 0.75rem;
  color: #6b7280;
}

.pn-fade-enter-active,
.pn-fade-leave-active {
  transition: opacity 0.25s;
}

.pn-fade-enter-from,
.pn-fade-leave-to {
  opacity: 0;
}

@media (max-width: 520px) {
  .payment-bar {
    font-size: 0.75rem;
  }

  .pn-digits div {
    min-width: 52px;

    b {
      font-size: 1.4rem;
    }
  }
}
</style>
