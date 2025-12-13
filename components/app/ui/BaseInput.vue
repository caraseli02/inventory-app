<template>
  <label class="flex flex-col gap-1 text-sm text-stone-700">
    <span v-if="label" class="font-semibold">{{ label }}</span>
    <input
      v-bind="$attrs"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      class="h-11 rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 placeholder:text-stone-400 focus:border-stone-900 focus:ring-2 focus:ring-stone-900/15"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
  </label>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue: string | number;
    label?: string;
    placeholder?: string;
    type?: string;
  }>(),
  {
    type: 'text',
  }
);

defineEmits<{
  (e: 'update:modelValue', value: string | number): void;
}>();
</script>
