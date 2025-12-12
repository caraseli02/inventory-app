import { ref } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import i18next from 'i18next'
import { addStockMovement } from '@/lib/api'
import { logger } from '@/lib/logger'
import type { Product, StockMovement } from '@/types'
import { useToast } from './useToast'

const SAFE_STOCK_THRESHOLD = 50

type StockMutationContext = {
  previousProduct: Product | undefined
}

export const useStockMutation = (product: Product) => {
  const queryClient = useQueryClient()
  const loadingAction = ref<'IN' | 'OUT' | null>(null)
  const { showToast } = useToast()

  const stockMutation = useMutation({
    mutationFn: async ({ quantity, type }: { quantity: number; type: 'IN' | 'OUT' }) => {
      logger.info('Initiating stock mutation', { productId: product.id, quantity, type })
      return addStockMovement(product.id, quantity, type)
    },
    onMutate: async ({ type, quantity }): Promise<StockMutationContext> => {
      loadingAction.value = type
      await queryClient.cancelQueries({ queryKey: ['product', product.fields.Barcode] })

      const previousProduct = queryClient.getQueryData<Product>(['product', product.fields.Barcode])

      queryClient.setQueryData(['history', product.id], (old: StockMovement[] | undefined) => {
        if (!old) return old
        const tempMovement = {
          id: `temp-${Date.now()}`,
          fields: {
            Type: type,
            Quantity: type === 'OUT' ? -Math.abs(quantity) : Math.abs(quantity),
            Date: new Date().toISOString().split('T')[0],
          },
        }
        return [tempMovement, ...old]
      })

      return { previousProduct }
    },
    onSuccess: (_data, { type, quantity }) => {
      const action = type === 'IN' ? i18next.t('toast.addedTo') : i18next.t('toast.removedFrom')
      showToast('success', i18next.t('toast.stockUpdateSuccess'), i18next.t('toast.stockUpdateDescription', { quantity, action }))
    },
    onError: (err, _variables, context: StockMutationContext | undefined) => {
      logger.error('Stock mutation failed', { error: err, productId: product.id })
      showToast(
        'error',
        i18next.t('toast.stockUpdateError'),
        err instanceof Error ? err.message : i18next.t('toast.stockUpdateErrorDescription')
      )
      if (context?.previousProduct) {
        queryClient.setQueryData(['product', product.fields.Barcode], context.previousProduct)
      }
    },
    onSettled: () => {
      loadingAction.value = null
      queryClient.invalidateQueries({ queryKey: ['product', product.fields.Barcode] })
      queryClient.invalidateQueries({ queryKey: ['history', product.id] })
    },
  })

  const handleStockChange = (quantity: number, type: 'IN' | 'OUT') => {
    if (isNaN(quantity) || quantity <= 0) {
      logger.warn('Invalid stock quantity', { quantity })
      showToast('warning', i18next.t('toast.invalidQuantity'), i18next.t('toast.invalidQuantityDescription'))
      return
    }

    if (quantity > SAFE_STOCK_THRESHOLD) {
      const action = type === 'IN' ? i18next.t('product.add').toLowerCase() : i18next.t('product.remove').toLowerCase()
      const confirmed = window.confirm(
        `${i18next.t('toast.largeStockWarning')}\n\n${i18next.t('toast.largeStockConfirm', { action, quantity })}`
      )
      if (!confirmed) {
        logger.info('Large stock update cancelled by user', { quantity })
        return
      }
    }

    stockMutation.mutate({ quantity, type })
  }

  return {
    handleStockChange,
    loadingAction,
    isLoading: stockMutation.isPending,
  }
}
