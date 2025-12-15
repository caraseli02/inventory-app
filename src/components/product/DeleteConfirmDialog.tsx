import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Package, AlertTriangle } from 'lucide-react';
import { deleteProduct } from '../../lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { logger } from '../../lib/logger';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import type { Product } from '../../types';

interface DeleteConfirmDialogProps {
  product: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleteSuccess: () => void; // Callback to navigate away after deletion
}

const DeleteConfirmDialog = ({ product, open, onOpenChange, onDeleteSuccess }: DeleteConfirmDialogProps) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [confirmed, setConfirmed] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      await deleteProduct(product.id);
    },
    onSuccess: () => {
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.removeQueries({ queryKey: ['product', product.fields.Barcode] });

      toast.success(t('dialogs.deleteConfirm.deleted'), {
        description: t('dialogs.deleteConfirm.deletedMessage', { name: product.fields.Name }),
      });

      onOpenChange(false);
      onDeleteSuccess(); // Navigate away
    },
    onError: (error) => {
      logger.error('Product deletion mutation failed', {
        productId: product.id,
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
    if (!confirmed) return;
    mutation.mutate();
  };

  // Reset confirmation when dialog opens/closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setConfirmed(false);
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

        <div className="h-full flex flex-col items-center justify-center max-w-lg mx-auto">
        <DialogHeader className="mb-6">
          <DialogTitle className="text-2xl font-bold text-[var(--color-terracotta)] flex items-center gap-2">
            <AlertTriangle className="h-8 w-8" />
            {t('dialogs.deleteConfirm.title')}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t('dialogs.deleteConfirm.description', 'Confirm deletion of product from inventory')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-stone-700 font-medium">
            {t('dialogs.deleteConfirm.aboutToDelete')}
          </p>

          <div className="bg-white border-2 border-red-200 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-3">
              {product.fields.Image && product.fields.Image.length > 0 ? (
                <img
                  src={product.fields.Image[0].url}
                  alt={product.fields.Name}
                  className="w-12 h-12 object-cover rounded-lg border border-stone-200"
                />
              ) : (
                <div className="w-12 h-12 bg-stone-100 rounded-lg border border-stone-200 flex items-center justify-center">
                  <Package className="h-6 w-6 text-stone-400" />
                </div>
              )}
              <div className="flex-1">
                <h3 className="font-bold text-stone-900">{product.fields.Name}</h3>
                <p className="text-xs text-stone-600">{t('dialogs.deleteConfirm.barcode')}: {product.fields.Barcode}</p>
              </div>
            </div>

            {product.fields['Current Stock Level'] != null && product.fields['Current Stock Level'] > 0 && (
              <div className="pt-2 border-t border-stone-200">
                <p className="text-sm text-stone-700">
                  <span className="font-semibold">{t('dialogs.deleteConfirm.currentStock')}:</span>{' '}
                  {product.fields['Current Stock Level']} {t('dialogs.deleteConfirm.units')}
                </p>
              </div>
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
              id="confirm-delete"
              checked={confirmed}
              onCheckedChange={(checked: boolean) => setConfirmed(checked)}
              className="mt-0.5"
            />
            <Label
              htmlFor="confirm-delete"
              className="text-sm text-stone-700 font-medium cursor-pointer leading-tight"
            >
              {t('dialogs.deleteConfirm.confirmCheckbox')}
            </Label>
          </div>
        </div>

        {mutation.isError && (
          <div className="text-red-700 text-sm text-center bg-red-100 p-3 rounded-lg border-2 border-red-300 font-medium">
            {mutation.error instanceof Error ? mutation.error.message : t('dialogs.deleteConfirm.deleteFailed')}
          </div>
        )}

        <DialogFooter className="gap-3 mt-6">
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
            disabled={!confirmed || mutation.isPending}
            className="font-bold bg-gradient-to-br from-[var(--color-terracotta)] to-[var(--color-terracotta-dark)] hover:opacity-90 text-white disabled:opacity-50 disabled:cursor-not-allowed flex-1 h-12"
          >
            {mutation.isPending ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
              t('dialogs.deleteConfirm.confirm')
            )}
          </Button>
        </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteConfirmDialog;
