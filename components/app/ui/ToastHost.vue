<template>
  <div class="fixed top-4 inset-x-0 flex flex-col gap-3 items-center pointer-events-none z-[2000]">
    <div
      v-for="toast in toasts"
      :key="toast.id"
      class="pointer-events-auto w-[320px] rounded-xl shadow-lg border bg-white/90 backdrop-blur px-4 py-3"
      role="status"
      :aria-label="toast.title"
    >
      <div class="flex items-start gap-3">
        <span class="mt-1 h-2 w-2 rounded-full" :class="toastColorClass(toast.type)"></span>
        <div class="flex-1 space-y-1">
          <p class="text-sm font-semibold text-stone-900">{{ toast.title }}</p>
          <p v-if="toast.description" class="text-xs text-stone-600">{{ toast.description }}</p>
        </div>
        <BaseButton
          variant="ghost"
          class="h-6 w-6 p-0 min-w-0 text-stone-400 hover:text-stone-700"
          @click="dismissToast(toast.id)"
          :aria-label="t('common.close')"
        >
          ×
        </BaseButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useToast } from '~/composables/useToast'
import BaseButton from '~/components/app/ui/BaseButton.vue'

const { t } = useI18n()
const { toasts, dismissToast } = useToast()

const TOAST_COLOR_MAP: Record<string, string> = {
  success: 'bg-emerald-500',
  error: 'bg-rose-500',
  warning: 'bg-amber-500',
  info: 'bg-sky-500',
}

function toastColorClass(type: string): string {
  return TOAST_COLOR_MAP[type] || 'bg-stone-400'
}
</script>
