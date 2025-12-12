<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import i18next from 'i18next'

const isOffline = ref(typeof navigator !== 'undefined' ? !navigator.onLine : false)

const handleOnline = () => (isOffline.value = false)
const handleOffline = () => (isOffline.value = true)

onMounted(() => {
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
})

onBeforeUnmount(() => {
  window.removeEventListener('online', handleOnline)
  window.removeEventListener('offline', handleOffline)
})
</script>

<template>
  <div
    v-if="isOffline"
    class="fixed bottom-4 left-1/2 -translate-x-1/2 bg-red-50 border border-red-200 text-red-900 px-4 py-3 rounded-lg shadow-sm flex items-center gap-3 z-50 animate-in slide-in-from-bottom-5"
  >
    <div class="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
    <div class="text-sm font-medium">
      {{ i18next.t('offline.mode') }}
      <span class="block text-xs text-red-700">{{ i18next.t('offline.limitedFunctionality') }}</span>
    </div>
  </div>
</template>
