<template>
  <div :class="['animate-pulse rounded-lg bg-stone-200', heightClass]" role="presentation"></div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{ height?: 'sm' | 'md' | 'lg' }>(), { height: 'md' });

const heightClass = computed(() => {
  if (props.height === 'sm') return 'h-6';
  if (props.height === 'lg') return 'h-24';
  return 'h-10';
});
</script>
