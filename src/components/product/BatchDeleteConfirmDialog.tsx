import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { deleteProduct } from '../../lib/api-provider';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { logger } from '../../lib/logger';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import type { Product } from '../../types';

interface BatchDeleteConfirmDialogProps {
  products: Product[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleteSuccess: (deletedIds: string[], failedIds: string[]) => void;
}

interface FailedDeletion {
  product: Product;
  error: string;
}

const BatchDeleteConfirmDialog = ({
  products,
  open,
  onOpenChange,
  onDeleteSuccess,
}: BatchDeleteConfirmDialogProps) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [confirmed, setConfirmed] = useState(false);
  const [failedDeletions, setFailedDeletions] = useState<FailedDeletion[]>([]);

  const productCount = products.length;
  const isLargeBatch = productCount >= 20;
  const previewProducts = useMemo(() => products.slice(0, 5), [products]);

  const mutation = useMutation({
    mutationFn: async () => {
      const results = await Promise.allSettled(
        products.map(async (product) => {
          await deleteProduct(product.id);
          return product.id;
        })
      );

      const deletedIds: string[] = [];
      const failed: FailedDeletion[] = [];

      results.forEach((result, index) => {
        const product = products[index];
        if (result.status === 'fulfilled') {
          deletedIds.push(result.value);
        } else {
          const errorMessage = result.reason instanceof Error ? result.reason.message : String(result.reason);
          logger.error('Product deletion failed in batch operation', {
            productId: product.id,
            productName: product.fields.Name,
            productBarcode: product.fields.Barcode,
            errorMessage,
            errorStack: result.reason instanceof Error ? result.reason.stack : undefined,
            batchSize: products.length,
            batchIndex: index,
            timestamp: new Date().toISOString(),
          });
          failed.push({ product, error: errorMessage });
        }
      });

      return { deletedIds, failed };
    },
    onSuccess: ({ deletedIds, failed }) => {
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['products'] });

      if (deletedIds.length > 0) {
        toast.success(t('dialogs.deleteConfirm.deleted'), {
          description: t('dialogs.deleteConfirm.deletedMany', {
            count: deletedIds.length,
          }),
        });
      }

      if (failed.length > 0) {
        setFailedDeletions(failed);
        toast.error(t('dialogs.deleteConfirm.deleteFailed'), {
          description: t('dialogs.deleteConfirm.deleteFailedCount', {
            count: failed.length,
          }),
        });
      }

      onDeleteSuccess(deletedIds, failed.map((item) => item.product.id));

      if (failed.length === 0) {
        onOpenChange(false);
      }
    },
    onError: (error) => {
      logger.error('Batch deletion mutation failed', {
        count: products.length,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
      });
      toast.error(t('dialogs.deleteConfirm.deleteFailed'), {
        description: error instanceof Error ? error.message : t('errors.unknownError'),
      });
    },
  });

  const handleDelete = () => {
    if (!confirmed || productCount === 0) return;
    mutation.mutate();
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setConfirmed(false);
      setFailedDeletions([]);
      mutation.reset();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="!fixed !inset-0 !left-0 !top-0 !right-0 !bottom-0 w-full h-full !max-w-full !max-h-full !translate-x-0 !translate-y-0 p-6 gap-0 !rounded-none border-2 border-red-200 bg-red-50 relative sm:!inset-0 sm:!left-0 sm:!top-0 sm:!translate-x-0 sm:!translate-y-0 sm:!max-w-full sm:!rounded-none"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* Loading Overlay */}
        {mutation.isPending && (
          <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-50 flex items-center justify-center rounded-xl">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 border-4 border-red-200 border-t-[var(--color-terracotta)] rounded-full animate-spin"></div>
              <p className="text-[var(--color-terracotta)] font-semibold text-lg">{t('dialogs.deleteConfirm.deleting')}...</p>
            </div>
          </div>
        )}

        <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-2xl font-bold text-[var(--color-terracotta)] flex items-center gap-2">
              <AlertTriangle className="h-8 w-8" />
              {t('dialogs.deleteConfirm.titleMultiple', 'Delete selected products')}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {t('dialogs.deleteConfirm.description', 'Confirm deletion of product from inventory')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 w-full">
            <p className="text-sm text-stone-700 font-medium">
              {t('dialogs.deleteConfirm.aboutToDeleteMultiple', {
                count: productCount,
              })}
            </p>

            {isLargeBatch && (
              <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-3 space-y-1">
                <p className="text-sm text-amber-800 font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  {t(
                    'dialogs.deleteConfirm.largeBatchWarningTitle',
                    'Large batch deletion'
                  )}
                </p>
                <p className="text-xs text-amber-700">
                  {t(
                    'dialogs.deleteConfirm.largeBatchWarningBody',
                    'Deleting many products at once may take longer and some deletions may fail due to backend limits. If this happens, try deleting in smaller batches.'
                  )}
                </p>
              </div>
            )}

            <div className="bg-white border-2 border-red-200 rounded-lg p-4 space-y-2">
              <p className="text-xs uppercase tracking-wide text-stone-500 font-semibold">
                {t('dialogs.deleteConfirm.preview', 'Selected items')}
              </p>
              <ul className="space-y-1">
                {previewProducts.map((product) => (
                  <li key={product.id} className="text-sm text-stone-800 font-medium">
                    {product.fields.Name}
                  </li>
                ))}
              </ul>
              {productCount > previewProducts.length && (
                <p className="text-xs text-stone-500">
                  {t('dialogs.deleteConfirm.andMore', {
                    count: productCount - previewProducts.length,
                  })}
                </p>
              )}
            </div>

            <div className="bg-red-100 border-2 border-red-300 rounded-lg p-3 space-y-2">
              <p className="text-sm text-red-800 font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                {t('dialogs.deleteConfirm.cannotUndo')}
              </p>
              <p className="text-xs text-red-700">
                {t('dialogs.deleteConfirm.allDataDeleted')}
              </p>
            </div>

            <div className="flex items-start space-x-3 pt-2">
              <Checkbox
                id="confirm-delete-multiple"
                checked={confirmed}
                onCheckedChange={(checked) => setConfirmed(checked === true)}
                className="mt-0.5"
              />
              <Label
                htmlFor="confirm-delete-multiple"
                className="text-sm text-stone-700 font-medium cursor-pointer leading-tight"
              >
                {t('dialogs.deleteConfirm.confirmCheckboxMultiple', 'I understand this will delete all selected products')}
              </Label>
            </div>

            {failedDeletions.length > 0 && (
              <div className="bg-red-100 border-2 border-red-300 rounded-lg p-3 space-y-2">
                <p className="text-sm text-red-800 font-semibold">
                  {t('dialogs.deleteConfirm.failedListTitle', 'Some products could not be deleted')}
                </p>
                <ul className="text-xs text-red-700 space-y-1">
                  {failedDeletions.slice(0, 4).map((item) => (
                    <li key={item.product.id}>
                      {item.product.fields.Name}: {item.error}
                    </li>
                  ))}
                </ul>
                {failedDeletions.length > 4 && (
                  <p className="text-xs text-red-700">
                    {t('dialogs.deleteConfirm.andMore', {
                      count: failedDeletions.length - 4,
                    })}
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-3 mt-6 w-full">
            <Button
              type="button"
              onClick={() => handleOpenChange(false)}
              variant="outline"
              className="border-2 border-stone-300 hover:bg-stone-100 flex-1 h-12 font-semibold"
              disabled={mutation.isPending}
            >
              {t('dialogs.deleteConfirm.cancel')}
            </Button>
            <Button
              type="button"
              onClick={handleDelete}
              disabled={!confirmed || mutation.isPending || productCount === 0}
              className="font-bold bg-gradient-to-br from-[var(--color-terracotta)] to-[var(--color-terracotta-dark)] hover:opacity-90 text-white disabled:opacity-50 disabled:cursor-not-allowed flex-1 h-12"
            >
              {mutation.isPending ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t('dialogs.deleteConfirm.confirmMultiple', 'Delete Selected')}
                </>
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BatchDeleteConfirmDialog;
