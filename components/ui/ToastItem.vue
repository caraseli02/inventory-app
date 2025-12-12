<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { cn } from '../utils/cn'
import type { Toast } from './toastTypes'

const props = defineProps<{ toast: Toast; onDismiss: (id: string) => void }>()
const isLeaving = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

const dismiss = () => {
  isLeaving.value = true
  setTimeout(() => props.onDismiss(props.toast.id), 300)
}

const startTimer = () => {
  timer = setTimeout(dismiss, props.toast.duration ?? 3000)
}

onMounted(startTimer)
onBeforeUnmount(() => timer && clearTimeout(timer))

const styles: Record<Toast['type'], string> = {
  success: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  error: 'bg-red-50 border-red-200 text-red-900',
  warning: 'bg-amber-50 border-amber-200 text-amber-900',
  info: 'bg-blue-50 border-blue-200 text-blue-900',
}

const iconPaths: Record<Toast['type'], string> = {
  success: 'M20 6L9 17l-5-5',
  error: 'M18 6L6 18M6 6l12 12',
  warning: 'M12 9v4m0 4h.01m-.01-12L4 19h16L12 5z',
  info: 'M13 16h-1v-4h-1m1-4h.01',
}

const iconViewBox = computed(() => (props.toast.type === 'warning' ? '0 0 24 24' : '0 0 24 24'))
</script>

<template>
  <div
    :class="cn(
      'flex items-start gap-3 p-4 rounded-lg border-2 shadow-lg transition-all duration-300 min-w-[320px] max-w-md',
      styles[props.toast.type],
      isLeaving ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'
    )"
  >
    <div class="h-5 w-5 mt-0.5" aria-hidden="true">
      <svg :viewBox="iconViewBox" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path :d="iconPaths[props.toast.type]" />
      </svg>
    </div>
    <div class="flex-1 min-w-0">
      <p class="font-semibold text-sm">{{ props.toast.title }}</p>
      <p v-if="props.toast.description" class="text-xs mt-1 opacity-90">{{ props.toast.description }}</p>
    </div>
    <button
      class="shrink-0 opacity-70 hover:opacity-100 transition-opacity"
      type="button"
      @click="dismiss"
    >
      <span aria-hidden="true">×</span>
      <span class="sr-only">Dismiss</span>
    </button>
  </div>
</template>
