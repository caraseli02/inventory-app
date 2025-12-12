<script setup lang="ts">
import { computed } from 'vue'
import Button from './Button.vue'

const props = withDefaults(
  defineProps<{
    title: string
    onBack: () => void
    onClose?: () => void
    variant?: 'default' | 'compact'
  }>(),
  { variant: 'default' }
)

const textClass = computed(() =>
  props.variant === 'compact'
    ? 'text-stone-700 text-center text-xs font-medium'
    : 'text-stone-900 text-center text-base font-semibold'
)
</script>

<template>
  <div class="flex items-center justify-between p-4 border-b border-white/50">
    <Button
      variant="ghost"
      size="icon"
      class="h-10 w-10 text-stone-700 hover:text-stone-900 hover:bg-white/30"
      @click="props.onBack"
    >
      <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </Button>
    <p :class="textClass">
      {{ props.title }}
    </p>
    <Button
      variant="ghost"
      size="icon"
      class="h-10 w-10 text-stone-700 hover:text-stone-900 hover:bg-white/30"
      @click="props.onClose ?? props.onBack"
    >
      <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </Button>
  </div>
</template>
