import { ref, readonly } from 'vue'

export type DialogType = 'alert' | 'confirm' | 'prompt'
export type DialogVariant = 'info' | 'warning' | 'error' | 'success'

export interface DialogOptions {
  title?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: DialogVariant
  placeholder?: string
  defaultValue?: string
}

interface DialogItem {
  id: string
  type: DialogType
  message: string
  options: DialogOptions
  resolve: (value: any) => void
}

const queue = ref<DialogItem[]>([])

export function useDialog() {
  const open = (type: DialogType, message: string, options: DialogOptions = {}): Promise<any> => {
    return new Promise(resolve => {
      queue.value.push({
        id: Date.now().toString() + Math.random().toString(36),
        type,
        message,
        options,
        resolve
      })
    })
  }

  const respond = (value: any) => {
    if (queue.value.length === 0) return
    const item = queue.value[0]
    queue.value.splice(0, 1)
    item.resolve(value)
  }

  return {
    queue: readonly(queue),
    alert: (message: string, options?: DialogOptions) =>
      open('alert', message, options),
    confirm: (message: string, options?: DialogOptions) =>
      open('confirm', message, options),
    prompt: (message: string, options?: DialogOptions) =>
      open('prompt', message, options),
    respond
  }
}
