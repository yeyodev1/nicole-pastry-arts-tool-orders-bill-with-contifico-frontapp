<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  auditLog?: Array<{
    user: string
    action: string
    at: string
    details?: string
  }>
  createdBy?: string
  updatedBy?: string
  createdAt?: string
  responsible?: string
}>()

const sortedLogs = computed(() => {
  const logs = props.auditLog ? [...props.auditLog] : []
  
  // If no creation log exists but we have createdAt/responsible, add a virtual one
  const hasCreationLog = logs.some(l => l.action.includes('Creado'))
  if (!hasCreationLog && props.createdAt) {
    logs.push({
      user: props.createdBy || props.responsible || 'Sistema',
      action: 'Pedido Creado (Histórico)',
      at: props.createdAt,
      details: 'Registro recuperado de la fecha de creación original.'
    })
  }

  return logs.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
})

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString('es-EC', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getActionIcon = (action: string) => {
  if (action.includes('Creado')) return 'fa-plus-circle'
  if (action.includes('Actualizado')) return 'fa-pen'
  if (action.includes('Pago')) return 'fa-money-bill-wave'
  if (action.includes('Devuelto')) return 'fa-rotate-left'
  return 'fa-circle-info'
}

const getActionClass = (action: string) => {
  if (action.includes('Creado')) return 'action-create'
  if (action.includes('Actualizado')) return 'action-update'
  if (action.includes('Pago')) return 'action-payment'
  if (action.includes('Devuelto')) return 'action-return'
  return ''
}
</script>

<template>
  <div class="audit-timeline-card card">
    <div class="card-header">
      <h3><i class="fa-solid fa-clock-rotate-left"></i> Vida de la Orden (Auditoría)</h3>
      <div class="audit-summary" v-if="createdBy">
        <span class="badge create-badge">Responsable: {{ createdBy }}</span>
        <span class="badge update-badge" v-if="updatedBy && updatedBy !== createdBy">Editado por: {{ updatedBy }}</span>
      </div>
    </div>

    <div class="timeline-container">
      <div v-if="!sortedLogs.length" class="empty-audit">
        <div class="empty-state">
          <i class="fa-solid fa-clipboard-question"></i>
          <p>La auditoría detallada comenzó a registrarse el 12 de Marzo. Para este pedido previo, no hay un historial detallado disponible.</p>
        </div>
      </div>

      <div v-else class="timeline">
        <div v-for="(log, index) in sortedLogs" :key="index" class="timeline-item">
          <div class="timeline-marker" :class="getActionClass(log.action)">
            <i class="fa-solid" :class="getActionIcon(log.action)"></i>
          </div>
          <div class="timeline-content">
            <div class="timeline-header">
              <span class="action-name">{{ log.action }}</span>
              <span class="action-at">{{ formatDate(log.at) }}</span>
            </div>
            <div class="action-user">
              <i class="fa-solid fa-user"></i> {{ log.user }}
            </div>
            <p v-if="log.details" class="action-details">{{ log.details }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.audit-timeline-card {
  margin-top: 2rem;
  background: white;
  border-radius: 12px;
  overflow: hidden;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #f1f5f9;

  h3 {
    margin: 0;
    font-size: 1.1rem;
    color: #1e293b;
    display: flex;
    align-items: center;
    gap: 0.5rem;

    i {
      color: #6366f1;
    }
  }
}

.audit-summary {
  display: flex;
  gap: 0.5rem;

  .badge {
    font-size: 0.75rem;
    padding: 0.25rem 0.6rem;
    border-radius: 9999px;
    font-weight: 600;

    &.create-badge {
      background: #f0fdf4;
      color: #166534;
      border: 1px solid #dcfce7;
    }

    &.update-badge {
      background: #eff6ff;
      color: #1e40af;
      border: 1px solid #dbeafe;
    }
  }
}

.timeline-container {
  padding: 1.5rem;
}

.empty-audit {
  text-align: center;
  color: #64748b;
  padding: 2rem;
  font-style: italic;
}

.timeline {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    left: 20px;
    top: 0;
    bottom: 0;
    width: 2px;
    background: #f1f5f9;
  }
}

.timeline-item {
  display: flex;
  gap: 1.5rem;
  position: relative;
}

.timeline-marker {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: white;
  border: 2px solid #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
  flex-shrink: 0;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);

  i {
    font-size: 0.9rem;
    color: #64748b;
  }

  &.action-create {
    border-color: #22c55e;
    i { color: #22c55e; }
  }

  &.action-update {
    border-color: #3b82f6;
    i { color: #3b82f6; }
  }

  &.action-payment {
    border-color: #eab308;
    i { color: #eab308; }
  }

  &.action-return {
    border-color: #f97316;
    i { color: #f97316; }
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 1rem;

  i {
    font-size: 2.5rem;
    color: #cbd5e1;
  }

  p {
    max-width: 300px;
    margin: 0;
    line-height: 1.5;
  }
}

.timeline-content {
  flex: 1;
  background: #f8fafc;
  padding: 1.25rem;
  border-radius: 12px;
  border: 1px solid #f1f5f9;

  .timeline-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;

    .action-name {
      font-weight: 700;
      color: #1e293b;
      font-size: 0.95rem;
    }

    .action-at {
      font-size: 0.8rem;
      color: #94a3b8;
    }
  }

  .action-user {
    font-size: 0.85rem;
    color: #475569;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-bottom: 0.4rem;

    i {
      font-size: 0.75rem;
      opacity: 0.7;
    }
  }

  .action-details {
    margin: 0;
    font-size: 0.85rem;
    color: #64748b;
    line-height: 1.4;
  }
}
</style>
