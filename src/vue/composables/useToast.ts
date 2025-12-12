import { computed, ref } from 'vue';

export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  variant: ToastVariant;
  title: string;
  description?: string;
  duration?: number;
}

const toasts = ref<ToastItem[]>([]);
let counter = 0;

export const useToast = () => {
  const removeToast = (id: number) => {
    toasts.value = toasts.value.filter((toast) => toast.id !== id);
  };

  const showToast = (
    variant: ToastVariant,
    title: string,
    description?: string,
    duration = 3200
  ) => {
    const id = ++counter;
    toasts.value.push({ id, variant, title, description, duration });

    if (duration > 0) {
      setTimeout(() => removeToast(id), duration);
    }
  };

  return {
    toasts: computed(() => toasts.value),
    showToast,
    removeToast,
  };
};
