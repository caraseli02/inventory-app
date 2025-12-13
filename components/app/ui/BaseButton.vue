<template>
  <button
    :type="type"
    :disabled="disabled"
    :class="classes"
    v-bind="$attrs"
  >
    <span class="flex items-center gap-2 justify-center">
      <slot />
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    type?: 'button' | 'submit' | 'reset';
    variant?: 'primary' | 'secondary' | 'ghost';
    fullWidth?: boolean;
    disabled?: boolean;
  }>(),
  {
    type: 'button',
    variant: 'primary',
    fullWidth: false,
    disabled: false,
  }
);

const classes = computed(() => {
  const base =
    'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';
  const variant =
    props.variant === 'secondary'
      ? 'bg-white border border-stone-300 text-stone-800 hover:bg-stone-50 focus-visible:outline-stone-900'
      : props.variant === 'ghost'
        ? 'bg-transparent text-stone-700 hover:bg-stone-100 focus-visible:outline-stone-900'
        : 'bg-stone-900 text-white hover:bg-stone-800 focus-visible:outline-stone-900 shadow-sm';
  const disabled = props.disabled ? 'opacity-60 cursor-not-allowed' : '';
  const width = props.fullWidth ? 'w-full' : '';
  return [base, variant, disabled, width].join(' ');
});
</script>
