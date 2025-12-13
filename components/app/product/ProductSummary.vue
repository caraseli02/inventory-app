<template>
  <CardPanel :title="product.fields.Name" :description="product.fields.Category" :aria-label="product.fields.Name">
    <div class="grid gap-2 text-sm text-stone-700">
      <div class="flex items-center justify-between">
        <span class="text-stone-500">{{ t('product.barcode') }}</span>
        <span class="font-semibold">{{ product.fields.Barcode || t('scanner.manualEntry') }}</span>
      </div>
      <div class="flex items-center justify-between">
        <span class="text-stone-500">{{ t('product.stock') }}</span>
        <span class="font-semibold">{{ product.fields['Current Stock Level'] ?? 0 }}</span>
      </div>
      <div class="flex items-center justify-between">
        <span class="text-stone-500">{{ t('product.price') }}</span>
        <span class="font-semibold">€{{ (product.fields.Price ?? 0).toFixed(2) }}</span>
      </div>
    </div>
    <div class="mt-4 flex justify-end">
      <BaseButton variant="secondary" @click="$emit('reset')">{{ t('scanner.scanNew') }}</BaseButton>
    </div>
  </CardPanel>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { Product } from '@/types';
import BaseButton from '../ui/BaseButton.vue';
import CardPanel from '../ui/CardPanel.vue';

defineProps<{ product: Product }>();

defineEmits<{ (e: 'reset'): void }>();

const { t } = useI18n();
</script>
