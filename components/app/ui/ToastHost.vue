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
        <span
          class="mt-1 h-2 w-2 rounded-full"
          :class="
            toast.type === 'success'
              ? 'bg-emerald-500'
              : toast.type === 'error'
                ? 'bg-rose-500'
                : toast.type === 'warning'
                  ? 'bg-amber-500'
                  : toast.type === 'info'
                    ? 'bg-sky-500'
                    : 'bg-stone-400'
          "
        ></span>
        <div class="flex-1 space-y-1">
          <p class="text-sm font-semibold text-stone-900">{{ toast.title }}</p>
          <p v-if="toast.description" class="text-xs text-stone-600">{{ toast.description }}</p>
        </div>
        <button
          type="button"
          class="text-stone-400 hover:text-stone-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 rounded"
          @click="dismissToast(toast.id)"
          :aria-label="t('common.close')"
        >
          ×
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useToast } from '~/composables/useToast'

const { t } = useI18n()
const { toasts, dismissToast } = useToast()
</script>
