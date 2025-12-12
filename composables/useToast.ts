import { readonly, ref } from 'vue'
import type { Toast, ToastType } from '../components/ui/toastTypes'

const toasts = ref<Toast[]>([])

export const useToast = () => {
  const showToast = (type: ToastType, title: string, description?: string, duration?: number) => {
    const id = `toast-${Date.now()}-${Math.random()}`
    toasts.value = [...toasts.value, { id, type, title, description, duration }]
  }

  const dismissToast = (id: string) => {
    toasts.value = toasts.value.filter((toast) => toast.id !== id)
  }

  return {
    toasts: readonly(toasts),
    showToast,
    dismissToast,
  }
}
