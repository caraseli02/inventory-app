<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '../utils/cn'

const props = withDefaults(
  defineProps<{
    modelValue?: boolean
    disabled?: boolean
    className?: string
    id?: string
  }>(),
  { modelValue: false }
)

const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

const checked = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})
</script>

<template>
  <label class="inline-flex items-center gap-2">
    <input
      :id="props.id"
      v-model="checked"
      type="checkbox"
      :disabled="props.disabled"
      :class="cn('h-4 w-4 rounded border-stone-300 text-primary focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed', props.className)"
    />
    <slot />
  </label>
</template>
