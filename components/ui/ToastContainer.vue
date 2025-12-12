<script setup lang="ts">
import ToastItem from './ToastItem.vue'
import type { Toast } from './toastTypes'

const props = defineProps<{ toasts: Toast[]; onDismiss: (id: string) => void }>()
</script>

<template>
  <div v-if="props.toasts.length" class="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
    <div v-for="toast in props.toasts" :key="toast.id" class="pointer-events-auto">
      <ToastItem :toast="toast" :on-dismiss="props.onDismiss" />
    </div>
  </div>
</template>
