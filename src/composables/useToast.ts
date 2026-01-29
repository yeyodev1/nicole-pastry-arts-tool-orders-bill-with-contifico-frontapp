import { ref, readonly } from 'vue'

interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
  duration?: number
}

const state = ref<Toast[]>([])

export function useToast() {
  const add = (message: string, type: 'success' | 'error' | 'info' = 'info', duration = 3000) => {
    const id = Date.now().toString() + Math.random().toString()
    state.value.push({ id, message, type, duration })

    if (duration > 0) {
      setTimeout(() => {
        remove(id)
      }, duration)
    }
  }

  const remove = (id: string) => {
    state.value = state.value.filter(t => t.id !== id)
  }

  return {
    toasts: readonly(state),
    add,
    remove,
    success: (msg: string, duration?: number) => add(msg, 'success', duration),
    error: (msg: string, duration?: number) => add(msg, 'error', duration),
    info: (msg: string, duration?: number) => add(msg, 'info', duration)
  }
}
