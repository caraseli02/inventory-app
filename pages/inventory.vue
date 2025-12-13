<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from '#app'
import { useI18n } from 'vue-i18n'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { addStockMovement, getAllProducts } from '@/lib/api'
import { logger } from '@/lib/logger'
import type { Product } from '@/types'
import PageHeader from '~/components/app/ui/PageHeader.vue'
import CardPanel from '~/components/app/ui/CardPanel.vue'
import BaseInput from '~/components/app/ui/BaseInput.vue'
import BaseButton from '~/components/app/ui/BaseButton.vue'
import SkeletonBlock from '~/components/app/ui/SkeletonBlock.vue'
import EmptyState from '~/components/app/ui/EmptyState.vue'
import ToastHost from '~/components/app/ui/ToastHost.vue'
import Table from '@/components/ui/Table.vue'
import TableHeader from '@/components/ui/TableHeader.vue'
import TableBody from '@/components/ui/TableBody.vue'
import TableRow from '@/components/ui/TableRow.vue'
import TableHead from '@/components/ui/TableHead.vue'
import TableCell from '@/components/ui/TableCell.vue'
import { useToast } from '~/composables/useToast'

const router = useRouter()
const goBack = () => router.push('/')

const { t } = useI18n()
const { showToast } = useToast()
const queryClient = useQueryClient()

const search = ref('')

const query = useQuery({
  queryKey: ['inventory', 'all'],
  queryFn: () => getAllProducts(),
})

const products = computed(() => query.data.value || [])

watch(
  () => query.error.value,
  (err) => {
    if (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('Failed to load inventory', { errorMessage: message })
      showToast('error', t('toast.loadFailed'), message)
    }
  }
)
const filtered = computed(() => {
  const term = search.value.toLowerCase()
  if (!term) return products.value
  return products.value.filter(
    (product) =>
      product.fields.Name.toLowerCase().includes(term) ||
      (product.fields.Barcode && product.fields.Barcode.toLowerCase().includes(term))
  )
})

const adjustMutation = useMutation({
  mutationFn: async ({ product, delta }: { product: Product; delta: number }) => {
    const type = delta > 0 ? 'IN' : 'OUT'
    const quantity = Math.abs(delta)
    await addStockMovement(product.id, quantity, type)
    return { productId: product.id, delta }
  },
  onMutate: async ({ product, delta }) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: ['inventory', 'all'] })

    // Snapshot previous value for rollback
    const previousProducts = queryClient.getQueryData<Product[]>(['inventory', 'all'])

    // Optimistically update
    queryClient.setQueryData<Product[]>(['inventory', 'all'], (current = []) =>
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
    )

    return { previousProducts }
  },
  onError: (err, variables, context) => {
    // Rollback to previous state
    if (context?.previousProducts) {
      queryClient.setQueryData(['inventory', 'all'], context.previousProducts)
    }
    const message = err instanceof Error ? err.message : String(err)
    logger.error('Stock adjustment failed', {
      productId: variables.product.id,
      delta: variables.delta,
      error: message,
    })
    showToast('error', t('toast.updateFailed'), message)
  },
  onSuccess: () => {
    showToast('success', t('toast.stockUpdated'), t('toast.stockUpdatedMessage'))
  },
})

const quickAdjust = (product: Product, delta: number) => {
  const current = product.fields['Current Stock Level'] ?? 0
  if (delta < 0 && current + delta < 0) {
    showToast('error', t('product.insufficientStock'), t('product.cannotRemove'))
    return
  }
  adjustMutation.mutate({ product, delta })
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-stone-100 to-stone-200 p-4 lg:p-8">
    <PageHeader
      :title="t('home.viewInventory.title')"
      :description="t('home.viewInventory.description')"
      :eyebrow="t('home.viewInventory.badge')"
      @back="goBack"
    />

    <div class="grid gap-4 lg:grid-cols-[320px_1fr]">
      <CardPanel :title="t('inventory.filters')" :description="t('inventory.quickSearch')" aria-label="filters">
        <div class="space-y-3">
          <BaseInput v-model="search" :placeholder="t('inventory.searchPlaceholder')" />
          <p class="text-xs text-stone-500">{{ t('inventory.total', { count: products.length }) }}</p>
        </div>
      </CardPanel>

      <CardPanel :title="t('inventory.listTitle')" :description="t('inventory.listSubtitle')" aria-label="inventory list">
        <div v-if="query.isFetching.value" class="space-y-3">
          <SkeletonBlock height="lg" />
          <SkeletonBlock height="lg" />
        </div>
        <div v-else-if="query.error.value" class="p-6 text-center">
          <p class="text-rose-600 font-semibold">{{ t('inventory.failedToLoad') }}</p>
          <p class="text-sm text-stone-500 mt-2">{{ query.error.value instanceof Error ? query.error.value.message : String(query.error.value) }}</p>
          <BaseButton variant="secondary" class="mt-4" @click="query.refetch()">
            {{ t('inventory.tryAgain') }}
          </BaseButton>
        </div>
        <div v-else>
          <Table>
            <TableHeader class="text-xs uppercase tracking-wide text-stone-500">
              <TableRow>
                <TableHead class="py-2 pr-2">{{ t('product.name') }}</TableHead>
                <TableHead class="py-2 pr-2">{{ t('product.category') }}</TableHead>
                <TableHead class="py-2 pr-2">{{ t('product.stock') }}</TableHead>
                <TableHead class="py-2 pr-2">{{ t('product.price') }}</TableHead>
                <TableHead class="py-2 pr-2 text-right">{{ t('inventory.actions') }}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="product in filtered" :key="product.id" class="align-middle">
                <TableCell class="py-3 pr-2 font-semibold text-stone-900">{{ product.fields.Name }}</TableCell>
                <TableCell class="py-3 pr-2 text-stone-600">{{ product.fields.Category || '—' }}</TableCell>
                <TableCell class="py-3 pr-2 text-stone-800">
                  {{ product.fields['Current Stock Level'] ?? 0 }}
                  <span v-if="product.fields['Min Stock Level'] != null" class="text-xs text-stone-500">
                    / {{ product.fields['Min Stock Level'] }}
                  </span>
                </TableCell>
                <TableCell class="py-3 pr-2 text-stone-800">€{{ (product.fields.Price ?? 0).toFixed(2) }}</TableCell>
                <TableCell class="py-3 pr-2 text-right">
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
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
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
