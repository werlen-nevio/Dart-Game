import { defineStore } from 'pinia'
import { ref } from 'vue'
import { Toast } from '@/types'

export const useToastStore = defineStore('toast', () => {
  const toasts = ref<Toast[]>([])

  function show(type: Toast['type'], message: string, duration = 5000) {
    const id = `${Date.now()}-${Math.random()}`
    const toast: Toast = { id, type, message, duration }

    toasts.value.push(toast)

    if (duration > 0) {
      setTimeout(() => {
        remove(id)
      }, duration)
    }
  }

  function remove(id: string) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  function success(message: string, duration?: number) {
    show('success', message, duration)
  }

  function error(message: string, duration?: number) {
    show('error', message, duration)
  }

  function info(message: string, duration?: number) {
    show('info', message, duration)
  }

  function warning(message: string, duration?: number) {
    show('warning', message, duration)
  }

  return {
    toasts,
    show,
    remove,
    success,
    error,
    info,
    warning,
  }
})
