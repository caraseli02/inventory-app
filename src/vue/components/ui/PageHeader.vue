<template>
  <header class="flex items-center gap-3 pb-4">
    <BaseButton variant="ghost" class="h-10 w-10" :aria-label="t('common.back')" @click="$emit('back')">
      ←
    </BaseButton>
    <div class="flex-1 min-w-0">
      <p v-if="eyebrow" class="text-[11px] uppercase tracking-[0.2em] text-stone-400 font-semibold">{{ eyebrow }}</p>
      <h1 class="text-2xl font-semibold text-stone-900 truncate">{{ title }}</h1>
      <p v-if="description" class="text-sm text-stone-500">{{ description }}</p>
    </div>
    <slot name="actions" />
  </header>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import BaseButton from './BaseButton.vue';

defineProps<{
  title: string;
  description?: string;
  eyebrow?: string;
}>();

defineEmits<{ (e: 'back'): void }>();

const { t } = useI18n();
</script>
