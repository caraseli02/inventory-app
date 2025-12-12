<template>
  <div class="min-h-screen bg-gradient-to-br from-stone-100 to-stone-200 p-4 lg:p-8">
    <PageHeader
      :title="t('home.viewInventory.title')"
      :description="t('home.viewInventory.description')"
      :eyebrow="t('home.viewInventory.badge')"
      @back="emit('back')"
    />

    <div class="grid gap-4 lg:grid-cols-[320px_1fr]">
      <CardPanel :title="t('inventory.filters')" :description="t('inventory.quickSearch')" aria-label="filters">
        <div class="space-y-3">
          <BaseInput v-model="search" :placeholder="t('inventory.searchPlaceholder')" />
          <p class="text-xs text-stone-500">{{ t('inventory.total', { count: products.value?.length || 0 }) }}</p>
        </div>
      </CardPanel>

      <CardPanel :title="t('inventory.listTitle')" :description="t('inventory.listSubtitle')" aria-label="inventory list">
        <div v-if="query.isFetching.value" class="space-y-3">
          <SkeletonBlock height="lg" />
          <SkeletonBlock height="lg" />
        </div>
        <div v-else>
          <div class="overflow-x-auto">
            <table class="min-w-full text-left text-sm">
              <thead class="text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th class="py-2 pr-2">{{ t('product.name') }}</th>
                  <th class="py-2 pr-2">{{ t('product.category') }}</th>
                  <th class="py-2 pr-2">{{ t('product.stock') }}</th>
                  <th class="py-2 pr-2">{{ t('product.price') }}</th>
                  <th class="py-2 pr-2 text-right">{{ t('inventory.actions') }}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-stone-100">
                <tr v-for="product in filtered" :key="product.id" class="align-middle">
                  <td class="py-3 pr-2 font-semibold text-stone-900">{{ product.fields.Name }}</td>
                  <td class="py-3 pr-2 text-stone-600">{{ product.fields.Category || '—' }}</td>
                  <td class="py-3 pr-2 text-stone-800">
                    {{ product.fields['Current Stock Level'] ?? 0 }}
                    <span v-if="product.fields['Min Stock Level'] != null" class="text-xs text-stone-500">
                      / {{ product.fields['Min Stock Level'] }}
                    </span>
                  </td>
                  <td class="py-3 pr-2 text-stone-800">€{{ (product.fields.Price ?? 0).toFixed(2) }}</td>
                  <td class="py-3 pr-2 text-right">
                    <div class="inline-flex items-center gap-2">
                      <BaseButton
                        variant="secondary"
                        class="h-8 px-3"
                        :disabled="adjustMutation.isPending.value"
                        @click="quickAdjust(product, 1)"
                      >
                        {{ t('inventory.addOne') }}
                      </BaseButton>
                      <BaseButton
                        variant="ghost"
                        class="h-8 px-3"
                        :disabled="adjustMutation.isPending.value"
                        @click="quickAdjust(product, -1)"
                      >
                        {{ t('inventory.removeOne') }}
                      </BaseButton>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <EmptyState
            v-if="!filtered.length && !query.isFetching.value"
            :title="t('inventory.noResults')"
            :description="t('inventory.tryFilters')"
          />
        </div>
      </CardPanel>
    </div>
    <ToastHost />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { addStockMovement, getAllProducts } from '../../lib/api';
import type { Product } from '../../types';
import PageHeader from '../components/ui/PageHeader.vue';
import CardPanel from '../components/ui/CardPanel.vue';
import BaseInput from '../components/ui/BaseInput.vue';
import BaseButton from '../components/ui/BaseButton.vue';
import SkeletonBlock from '../components/ui/SkeletonBlock.vue';
import EmptyState from '../components/ui/EmptyState.vue';
import ToastHost from '../components/ui/ToastHost.vue';
import { useToast } from '../composables/useToast';

const emit = defineEmits<{ (e: 'back'): void }>();
const { t } = useI18n();
const { showToast } = useToast();
const queryClient = useQueryClient();

const search = ref('');

const query = useQuery({
  queryKey: ['vue', 'inventory', 'all'],
  queryFn: () => getAllProducts(),
});

const products = computed(() => query.data.value || []);
const filtered = computed(() => {
  const term = search.value.toLowerCase();
  if (!term) return products.value;
  return products.value.filter((product) =>
    product.fields.Name.toLowerCase().includes(term) ||
    (product.fields.Barcode && product.fields.Barcode.toLowerCase().includes(term))
  );
});

const adjustMutation = useMutation({
  mutationFn: async ({ product, delta }: { product: Product; delta: number }) => {
    const type = delta > 0 ? 'IN' : 'OUT';
    const quantity = Math.abs(delta);
    await addStockMovement(product.id, quantity, type);
    queryClient.setQueryData<Product[]>(['vue', 'inventory', 'all'], (current = []) =>
      current.map((p) =>
        p.id === product.id
          ? {
              ...p,
              fields: {
                ...p.fields,
                'Current Stock Level': (p.fields['Current Stock Level'] ?? 0) + delta,
              },
            }
          : p
      )
    );
  },
  onSuccess: () => {
    showToast('success', t('toast.stockUpdated'), t('toast.stockUpdatedMessage'));
  },
  onError: (err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    showToast('error', t('toast.updateFailed'), message);
  },
});

const quickAdjust = (product: Product, delta: number) => {
  const current = product.fields['Current Stock Level'] ?? 0;
  if (delta < 0 && current + delta < 0) {
    showToast('error', t('product.insufficientStock'), t('product.cannotRemove'));
    return;
  }
  adjustMutation.mutate({ product, delta });
};
</script>
