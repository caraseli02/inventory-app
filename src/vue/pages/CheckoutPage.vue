<template>
  <div class="min-h-screen bg-gradient-to-br from-stone-100 to-stone-200 p-4 lg:p-8">
    <PageHeader
      :title="t('home.checkoutMode.title')"
      :description="t('home.checkoutMode.description')"
      :eyebrow="t('home.checkoutMode.badgeTablet')"
      @back="emit('back')"
    />
    <div class="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
      <CardPanel :title="t('scanner.title')" :description="t('scanner.subtitle')" aria-label="checkout scanner">
        <div class="space-y-4">
          <ScannerFrame scanner-id="vue-checkout" @scan="handleScan" />
          <form class="flex gap-2" @submit.prevent="handleManualSubmit">
            <BaseInput v-model="manualCode" :placeholder="t('scanner.manualEntry')" class="flex-1" />
            <BaseButton type="submit" :disabled="manualCode.trim().length < 3">{{ t('scanner.addButton') }}</BaseButton>
          </form>
        </div>
      </CardPanel>

      <CardPanel :title="t('cart.title')" :description="t('cart.subtitle')" aria-label="cart">
        <div class="flex flex-col gap-3">
          <div class="flex items-center justify-between text-sm text-stone-600">
            <span>{{ t('cart.items', { count: itemCount }) }}</span>
            <span class="font-semibold text-stone-900">€{{ total.toFixed(2) }}</span>
          </div>

          <div v-if="lookupQuery.isFetching.value" class="p-3 border rounded-lg border-stone-200 bg-stone-50">
            {{ t('loading.checkout') }}
          </div>
          <div v-if="lookupQuery.error.value" class="p-3 border rounded-lg border-rose-100 text-rose-700 text-sm">
            {{ t('toast.lookupFailed') }}
          </div>

          <ul class="divide-y divide-stone-100" aria-live="polite">
            <li v-for="(item, index) in cart" :key="item.product.id" class="py-3 flex items-start gap-3">
              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-stone-900">{{ item.product.fields.Name }}</p>
                <p class="text-xs text-stone-500">{{ item.product.fields.Barcode }}</p>
                <p class="text-xs text-stone-500">
                  {{ t('product.stock') }}: {{ item.product.fields['Current Stock Level'] ?? 0 }} ·
                  {{ t('product.price') }} €{{ (item.product.fields.Price ?? 0).toFixed(2) }}
                </p>
                <p v-if="item.status" class="text-xs text-rose-600">{{ item.status }}</p>
              </div>
              <div class="flex items-center gap-2">
                <BaseButton variant="ghost" class="h-9 w-9" @click="updateQuantity(index, -1)">−</BaseButton>
                <span class="w-8 text-center font-semibold">{{ item.quantity }}</span>
                <BaseButton variant="ghost" class="h-9 w-9" @click="updateQuantity(index, 1)">+</BaseButton>
              </div>
            </li>
          </ul>

          <EmptyState
            v-if="cart.length === 0"
            :title="t('cart.empty')"
            :description="t('scanner.startHint')"
          >
            <template #icon>🛒</template>
          </EmptyState>

          <div class="flex items-center justify-end gap-3">
            <BaseButton variant="ghost" @click="resetCart" :disabled="cart.length === 0">{{ t('cart.clear') }}</BaseButton>
            <BaseButton
              :disabled="cart.length === 0 || checkoutMutation.isPending.value"
              @click="checkout"
            >
              {{ checkoutMutation.isPending.value ? t('loading.checkout') : t('cart.checkout') }}
            </BaseButton>
          </div>
        </div>
      </CardPanel>
    </div>
    <ToastHost />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMutation, useQuery } from '@tanstack/vue-query';
import { addStockMovement, getProductByBarcode } from '../../lib/api';
import type { Product } from '../../types';
import PageHeader from '../components/ui/PageHeader.vue';
import CardPanel from '../components/ui/CardPanel.vue';
import BaseButton from '../components/ui/BaseButton.vue';
import BaseInput from '../components/ui/BaseInput.vue';
import EmptyState from '../components/ui/EmptyState.vue';
import ScannerFrame from '../components/scanner/ScannerFrame.vue';
import ToastHost from '../components/ui/ToastHost.vue';
import { useToast } from '../composables/useToast';

const emit = defineEmits<{ (e: 'back'): void }>();
const { t } = useI18n();
const { showToast } = useToast();

interface CartEntry {
  product: Product;
  quantity: number;
  status?: string;
}

const cart = ref<CartEntry[]>([]);
const scannedCode = ref<string | null>(null);
const manualCode = ref('');

const lookupQuery = useQuery({
  queryKey: computed(() => ['vue', 'checkout', scannedCode.value]),
  queryFn: () => getProductByBarcode(scannedCode.value || ''),
  enabled: computed(() => Boolean(scannedCode.value)),
  retry: 0,
});

watch(
  () => lookupQuery.data.value,
  (product) => {
    if (product) {
      addItem(product);
      scannedCode.value = null;
    }
  }
);

const itemCount = computed(() => cart.value.reduce((sum, item) => sum + item.quantity, 0));
const total = computed(() =>
  cart.value.reduce((sum, item) => sum + (item.product.fields.Price ?? 0) * item.quantity, 0)
);

const handleScan = (code: string) => {
  scannedCode.value = code;
  manualCode.value = code;
};

const handleManualSubmit = () => {
  if (manualCode.value.trim().length >= 3) {
    scannedCode.value = manualCode.value.trim();
  }
};

const addItem = (product: Product) => {
  const available = product.fields['Current Stock Level'] ?? 0;
  if (available < 1) {
    showToast('error', t('product.insufficientStock'), t('cart.noStock'));
    return;
  }

  const existingIndex = cart.value.findIndex((entry) => entry.product.id === product.id);
  if (existingIndex >= 0) {
    const entry = cart.value[existingIndex];
    if (entry.quantity + 1 > available) {
      cart.value[existingIndex] = { ...entry, status: t('product.insufficientStock') };
      return;
    }
    cart.value[existingIndex] = { ...entry, quantity: entry.quantity + 1, status: undefined };
  } else {
    cart.value.push({ product, quantity: 1 });
  }
  showToast('success', t('toast.addedToCart'), product.fields.Name);
};

const updateQuantity = (index: number, delta: number) => {
  const entry = cart.value[index];
  if (!entry) return;
  const available = entry.product.fields['Current Stock Level'] ?? 0;
  const newQuantity = entry.quantity + delta;
  if (newQuantity <= 0) {
    cart.value.splice(index, 1);
    return;
  }
  if (delta > 0 && newQuantity > available) {
    cart.value[index] = { ...entry, status: t('product.insufficientStock') };
    return;
  }
  cart.value[index] = { ...entry, quantity: newQuantity, status: undefined };
};

const checkoutMutation = useMutation({
  mutationFn: async () => {
    for (const entry of cart.value) {
      await addStockMovement(entry.product.id, entry.quantity, 'OUT');
    }
  },
  onSuccess: () => {
    showToast('success', t('toast.checkoutComplete'), t('toast.checkoutCompleteMessage'));
    cart.value = [];
  },
  onError: (err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    showToast('error', t('toast.updateFailed'), message);
  },
});

const checkout = () => {
  if (cart.value.length === 0) return;
  checkoutMutation.mutate();
};

const resetCart = () => {
  cart.value = [];
};
</script>
