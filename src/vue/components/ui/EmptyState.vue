<template>
  <div class="flex flex-col items-center justify-center text-center text-stone-500 gap-2 py-8">
    <div class="h-12 w-12 rounded-full bg-stone-100 text-stone-400 flex items-center justify-center text-xl" aria-hidden="true">
      <slot name="icon">🛈</slot>
    </div>
    <p class="text-sm font-medium">{{ title }}</p>
    <p v-if="description" class="text-sm text-stone-400 max-w-md">{{ description }}</p>
    <div v-if="$slots.actions" class="mt-3"><slot name="actions" /></div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ title: string; description?: string }>();
</script>
