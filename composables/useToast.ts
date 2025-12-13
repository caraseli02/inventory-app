import { readonly, ref } from 'vue'
import type { Toast, ToastType } from '../components/ui/toastTypes'

const toasts = ref<Toast[]>([])
const DEFAULT_TOAST_DURATION_MS = 3200
const MAX_TOASTS = 5

export const useToast = () => {
  const dismissToast = (id: string) => {
    toasts.value = toasts.value.filter((toast) => toast.id !== id)
  }

  const showToast = (type: ToastType, title: string, description?: string, duration: number = DEFAULT_TOAST_DURATION_MS) => {
    const id = `toast-${Date.now()}-${Math.random()}`
    let currentToasts = [...toasts.value, { id, type, title, description, duration }]

    // Limit toast count to prevent UI overflow
    if (currentToasts.length > MAX_TOASTS) {
      currentToasts = currentToasts.slice(-MAX_TOASTS)
    }

    toasts.value = currentToasts

    if (duration > 0) {
      setTimeout(() => dismissToast(id), duration)
    }
  }

  return {
    toasts: readonly(toasts),
    showToast,
    dismissToast,
  }
}
