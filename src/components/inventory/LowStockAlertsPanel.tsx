import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ChevronDown, ChevronUp, Package, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import type { LowStockProduct } from '../../hooks/useLowStockAlerts';

interface LowStockAlertsPanelProps {
  lowStockProducts: LowStockProduct[];
  onViewProduct: (product: LowStockProduct) => void;
  /** Called when panel is first shown (for toast notification) */
  onAlertShown?: () => void;
}

/**
 * Collapsible panel showing products that need reordering
 * Displays at the top of the inventory page when there are low-stock items
 */
export const LowStockAlertsPanel = ({
  lowStockProducts,
  onViewProduct,
  onAlertShown,
}: LowStockAlertsPanelProps) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(true);
  // Use ref instead of state to track alert shown status (avoids cascading renders)
  const hasShownAlertRef = useRef(false);
  const prevLowStockCountRef = useRef(lowStockProducts.length);

  // Trigger alert notification once when panel first renders with alerts
  useEffect(() => {
    if (lowStockProducts.length > 0 && !hasShownAlertRef.current && onAlertShown) {
      onAlertShown();
      hasShownAlertRef.current = true;
    }
    // Reset when products go to 0
    if (lowStockProducts.length === 0 && prevLowStockCountRef.current > 0) {
      hasShownAlertRef.current = false;
    }
    prevLowStockCountRef.current = lowStockProducts.length;
  }, [lowStockProducts.length, onAlertShown]);

  if (lowStockProducts.length === 0) {
    return null;
  }

  return (
    <Card className="border-2 border-[var(--color-terracotta)] bg-gradient-to-br from-[var(--color-terracotta)]/5 to-[var(--color-terracotta)]/10 shadow-lg">
      <CardHeader
        className="p-4 cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-terracotta)] text-white shadow-md">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-stone-900">
                {t('alerts.reorderAlerts', 'Reorder Alerts')}
              </h3>
              <p className="text-sm text-[var(--color-terracotta)] font-medium">
                {t('alerts.itemsNeedReorder', '{{count}} items need reordering', {
                  count: lowStockProducts.length,
                })}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-[var(--color-terracotta)]/10"
          >
            {isExpanded ? (
              <ChevronUp className="h-5 w-5 text-stone-600" />
            ) : (
              <ChevronDown className="h-5 w-5 text-stone-600" />
            )}
          </Button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="px-4 pb-4 pt-0">
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {lowStockProducts.map((product) => {
              const currentStock = product.fields['Current Stock Level'] ?? 0;
              const minStock = product.fields['Min Stock Level'] ?? 0;
              const percentRemaining = minStock > 0 ? Math.round((currentStock / minStock) * 100) : 0;

              return (
                <div
                  key={product.id}
                  className="flex items-center gap-3 p-3 bg-white rounded-xl border-2 border-stone-200 hover:border-[var(--color-terracotta)]/50 hover:shadow-md transition-all cursor-pointer group"
                  onClick={() => onViewProduct(product)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      onViewProduct(product);
                    }
                  }}
                >
                  {/* Product Image or Placeholder */}
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-stone-100 border border-stone-200">
                    {product.fields.Image?.[0]?.url ? (
                      <img
                        src={product.fields.Image[0].url}
                        alt={product.fields.Name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-stone-400">
                        <Package className="h-6 w-6" />
                      </div>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-stone-900 truncate">
                        {product.fields.Name}
                      </h4>
                      {product.fields.Supplier && (
                        <Badge variant="outline" className="text-xs shrink-0">
                          {product.fields.Supplier}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm text-[var(--color-terracotta)] font-medium">
                        {t('alerts.stockLevel', 'Stock: {{current}}/{{min}}', {
                          current: currentStock,
                          min: minStock,
                        })}
                      </span>
                      <span className="text-xs text-stone-500">
                        ({percentRemaining}%)
                      </span>
                    </div>
                  </div>

                  {/* Deficit Badge */}
                  <div className="flex items-center gap-2">
                    <Badge className="bg-[var(--color-terracotta)] text-white border-0">
                      {t('alerts.need', 'Need')} +{product.stockDeficit}
                    </Badge>
                    <ExternalLink className="h-4 w-4 text-stone-400 group-hover:text-[var(--color-terracotta)] transition-colors" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary Footer */}
          <div className="mt-4 pt-3 border-t border-[var(--color-terracotta)]/20">
            <div className="flex items-center justify-between text-sm">
              <span className="text-stone-600">
                {t('alerts.totalDeficit', 'Total units needed:')}
              </span>
              <span className="font-bold text-[var(--color-terracotta)]">
                +{lowStockProducts.reduce((sum, p) => sum + p.stockDeficit, 0)}
              </span>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
};
