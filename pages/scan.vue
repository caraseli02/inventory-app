<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from '#app'
import { useI18n } from 'vue-i18n'
import { useQuery } from '@tanstack/vue-query'
import { getProductByBarcode } from '@/lib/api'
import { logger } from '@/lib/logger'
import PageHeader from '~/components/app/ui/PageHeader.vue'
import CardPanel from '~/components/app/ui/CardPanel.vue'
import BaseButton from '~/components/app/ui/BaseButton.vue'
import BaseInput from '~/components/app/ui/BaseInput.vue'
import ProductSummary from '~/components/app/product/ProductSummary.vue'
import ProductCreatePanel from '~/components/app/product/ProductCreatePanel.vue'
import EmptyState from '~/components/app/ui/EmptyState.vue'
import SkeletonBlock from '~/components/app/ui/SkeletonBlock.vue'
import ScannerFrame from '~/components/app/scanner/ScannerFrame.vue'
import ToastHost from '~/components/app/ui/ToastHost.vue'
import { useToast } from '~/composables/useToast'

const router = useRouter()
const goBack = () => router.push('/')

const { t } = useI18n()
const { showToast } = useToast()
const scannedCode = ref<string | null>(null)
const manualCode = ref('')

const productQuery = useQuery({
  queryKey: computed(() => ['scan', scannedCode.value]),
  queryFn: () => getProductByBarcode(scannedCode.value || ''),
  enabled: computed(() => Boolean(scannedCode.value)),
  retry: 0,
})

const headerTitle = computed(() => {
  if (!scannedCode.value) {
    return t('scanner.title')
  }
  return productQuery.data.value ? t('product.manageStock') : t('product.newProduct')
})

const panelTitle = computed(() => {
  if (productQuery.data.value) {
    return productQuery.data.value.fields.Name
  }
  if (scannedCode.value) {
    return t('product.newProduct')
  }
  return t('scanner.awaitingScan')
})

const panelSubtitle = computed(() => {
  if (productQuery.isFetching.value) return t('loading.scanner')
  if (productQuery.error.value) return t('toast.lookupFailed')
  if (productQuery.data.value) return t('product.manageStock')
  if (scannedCode.value) return t('product.createFromScan')
  return t('scanner.startHint')
})

watch(
  () => productQuery.error.value,
  (err) => {
    if (err && scannedCode.value) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('Product lookup failed on scan page', {
        barcode: scannedCode.value,
        errorMessage: message,
      })
      showToast('error', t('toast.lookupFailed'), message)
    }
  }
)

const handleScan = (code: string) => {
  scannedCode.value = code
  manualCode.value = code
  if (navigator.vibrate) navigator.vibrate(160)
}

const handleManualSubmit = () => {
  if (manualCode.value.trim().length >= 3) {
    handleScan(manualCode.value.trim())
  }
}

const resetScan = () => {
  scannedCode.value = null
  manualCode.value = ''
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-stone-100 to-stone-200 p-4 lg:p-8">
    <PageHeader :title="headerTitle" :description="t('scanner.helper')" @back="goBack" />
    <div class="grid gap-6 lg:grid-cols-2">
      <CardPanel :title="t('scanner.title')" :description="t('scanner.subtitle')" aria-label="scanner">
        <div class="space-y-4">
          <ScannerFrame scanner-id="scan" @scan="handleScan" />
          <form class="flex gap-2" @submit.prevent="handleManualSubmit">
            <BaseInput v-model="manualCode" :placeholder="t('scanner.manualEntry')" class="flex-1" />
            <BaseButton type="submit" :disabled="manualCode.trim().length < 3">{{ t('scanner.addButton') }}</BaseButton>
          </form>
        </div>
      </CardPanel>

      <CardPanel :title="panelTitle" :description="panelSubtitle" aria-label="scan results">
        <SkeletonBlock v-if="productQuery.isFetching.value" height="lg" />
        <ProductSummary v-else-if="productQuery.data.value && scannedCode" :product="productQuery.data.value" @reset="resetScan" />
        <ProductCreatePanel
          v-else-if="scannedCode"
          :barcode="scannedCode"
          @created="resetScan"
          @cancel="resetScan"
        />
        <EmptyState v-else :title="t('scanner.emptyState')" :description="t('scanner.startHint')" />
      </CardPanel>
    </div>
    <ToastHost />
  </div>
</template>
