<template>
  <label class="flex flex-col gap-1 text-sm text-stone-700">
    <span v-if="label" class="font-semibold">{{ label }}</span>
    <Input
      v-bind="$attrs"
      :type="type"
      :model-value="modelValue"
      :placeholder="placeholder"
      class="h-11"
      @input="handleInput"
    />
  </label>
</template>

<script setup lang="ts">
import Input from '@/components/ui/Input.vue'

withDefaults(
  defineProps<{
    modelValue: string | number
    label?: string
    placeholder?: string
    type?: string
  }>(),
  {
    type: 'text',
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number): void
}>()

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.value)
}
</script>
