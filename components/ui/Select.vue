<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '../utils/cn'

const props = defineProps<{
  modelValue?: string | number
  disabled?: boolean
  className?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [string | number | undefined] }>()

const value = computed({
  get: () => props.modelValue,
  set: (val: string | number | undefined) => emit('update:modelValue', val),
})
</script>

<template>
  <select
    v-model="value"
    :disabled="props.disabled"
    :class="cn('flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50', props.className)"
  >
    <slot />
  </select>
</template>
