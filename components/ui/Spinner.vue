<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '../utils/cn'

const props = withDefaults(
  defineProps<{
    size?: 'sm' | 'md' | 'lg'
    className?: string
    label?: string
  }>(),
  { size: 'md' }
)

const sizeClasses: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'h-6 w-6 border-2',
  md: 'h-10 w-10 border-4',
  lg: 'h-16 w-16 border-4',
}

const spinnerClass = computed(() => cn('animate-spin rounded-full border-stone-200 border-t-stone-700', sizeClasses[props.size], props.className))
</script>

<template>
  <div class="flex flex-col items-center gap-2">
    <div :class="spinnerClass" />
    <p v-if="props.label" class="text-stone-900 text-sm font-medium">{{ props.label }}</p>
  </div>
</template>
