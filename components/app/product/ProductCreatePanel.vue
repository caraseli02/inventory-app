<template>
  <CardPanel :title="t('product.newProduct')" :description="t('product.createFromScan')" :aria-label="t('product.newProduct')">
    <form class="space-y-4" @submit.prevent="submit">
      <BaseInput v-model="form.name" :label="t('product.name')" required />
      <BaseInput v-model="form.category" :label="t('product.category')" />
      <BaseInput v-model="form.price" :label="t('product.price')" type="number" step="0.01" />
      <div class="flex items-center justify-end gap-2">
        <BaseButton type="button" variant="ghost" @click="$emit('cancel')">{{ t('common.cancel') }}</BaseButton>
        <BaseButton type="submit" :disabled="createMutation.isPending.value">{{ t('product.save') }}</BaseButton>
      </div>
    </form>
  </CardPanel>
</template>

<script setup lang="ts">
import { reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMutation } from '@tanstack/vue-query'
import { createProduct, type CreateProductDTO } from '@/lib/api'
import { logger } from '@/lib/logger'
import type { Product } from '@/types'
import BaseButton from '../ui/BaseButton.vue'
import BaseInput from '../ui/BaseInput.vue'
import CardPanel from '../ui/CardPanel.vue'
import { useToast } from '~/composables/useToast'

const props = defineProps<{ barcode: string }>()

const emit = defineEmits<{ (e: 'created', product: Product): void; (e: 'cancel'): void }>()

const { t } = useI18n()
const { showToast } = useToast()

const form = reactive({
  name: '',
  category: '',
  price: '',
})

const createMutation = useMutation<Product, unknown, CreateProductDTO>({
  mutationFn: async (payload) => createProduct(payload),
  onSuccess: (product) => {
    showToast('success', t('toast.productCreated'), t('toast.productCreatedMessage'))
    form.name = ''
    form.category = ''
    form.price = ''
    emit('created', product)
  },
  onError: (err) => {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('Failed to create product', {
      barcode: props.barcode,
      formData: { name: form.name, category: form.category },
      errorMessage: message,
    })
    showToast('error', t('toast.createFailed'), message)
  },
})

function parsePrice(value: string): number | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : undefined
}

function submit(): void {
  const payload: CreateProductDTO = {
    name: form.name,
    barcode: props.barcode,
    category: form.category || undefined,
    price: parsePrice(form.price),
  }
  createMutation.mutate(payload)
}
</script>
