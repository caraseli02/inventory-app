import { useTranslation } from 'react-i18next';
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { Spinner } from '../ui/spinner';
import { ProductHistory } from '../ProductHistory';
import { logger } from '../../lib/logger';
import type { StockMovement } from '../../types';

interface MovementHistorySectionProps {
  productId: string;
  movements: StockMovement[];
  loadingMovements: boolean;
  movementsHasError: boolean;
  movementsErrorMessage: string;
  isRefetchingMovements: boolean;
  refetchMovements: () => Promise<unknown>;
}

function MovementCard({ movement }: { movement: StockMovement }) {
  const { t } = useTranslation();
  const isIn = movement.fields.Type === 'IN';
  return (
    <Card className="border-zinc-200 shadow-sm hover:shadow-md transition-all">
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`p-2 rounded-lg ${isIn ? 'bg-emerald-50' : 'bg-zinc-100'}`}>
              {isIn
                ? <ArrowDownToLine className="h-4 w-4 text-emerald-600" />
                : <ArrowUpFromLine className="h-4 w-4 text-zinc-600" />}
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-900">
                {isIn ? '+' : '−'}{Math.abs(movement.fields.Quantity)} {t('dialogs.productDetail.units')}
              </p>
              <p className="text-xs text-zinc-500">
                {movement.fields.Date ? new Date(movement.fields.Date).toLocaleDateString() : '—'}
              </p>
            </div>
          </div>
          <Badge
            variant={isIn ? 'default' : 'secondary'}
            className={isIn ? 'bg-emerald-500 text-white' : 'bg-zinc-200 text-zinc-900'}
          >
            {movement.fields.Type}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

export function MovementHistorySection({
  productId,
  movements,
  loadingMovements,
  movementsHasError,
  movementsErrorMessage,
  isRefetchingMovements,
  refetchMovements,
}: MovementHistorySectionProps) {
  const { t } = useTranslation();

  return (
    <div>
      <h3 className="text-base font-bold text-zinc-900 mb-3">
        {t('dialogs.productDetail.recentMovements')}
      </h3>
      {loadingMovements ? (
        <div className="flex justify-center py-8">
          <Spinner size="md" label={t('dialogs.productDetail.loadingMovements')} />
        </div>
      ) : movementsHasError ? (
        <Card className="border-red-200 bg-red-50/40">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-800">
                  {t('dialogs.productDetail.movementsLoadErrorTitle', 'Failed to load movement history')}
                </p>
                <p className="text-sm text-red-700 mt-1">{movementsErrorMessage}</p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                logger.warn('Retrying stock movement fetch after error', { productId, previousErrorMessage: movementsErrorMessage });
                try {
                  await refetchMovements();
                } catch (error) {
                  logger.error('Stock movement retry failed', {
                    productId,
                    errorMessage: error instanceof Error ? error.message : String(error),
                    errorStack: error instanceof Error ? error.stack : undefined,
                  });
                }
              }}
              disabled={isRefetchingMovements}
              className="border-red-300 text-red-800 hover:bg-red-100"
            >
              {isRefetchingMovements ? t('common.loading', 'Loading...') : t('common.tryAgain', 'Try again')}
            </Button>
          </CardContent>
        </Card>
      ) : movements.length > 0 ? (
        <div className="space-y-2">
          {movements.slice(0, 10).map((movement) => (
            <MovementCard key={movement.id} movement={movement} />
          ))}
          <div className="mt-8">
            <ProductHistory productId={productId} />
          </div>
        </div>
      ) : (
        <Card className="border-zinc-200">
          <CardContent className="p-8">
            <p className="text-center text-zinc-500">{t('dialogs.productDetail.noMovements')}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
