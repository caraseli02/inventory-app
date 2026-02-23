import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, XCircle, Clock, ShoppingBag, Phone, Calendar, ChevronDown, ChevronUp } from 'lucide-react';

import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/useToast';
import { getOrders, confirmOrder, cancelOrder } from '@/lib/orders-api';
import type { Order, OrderStatus } from '@/types/orders';

interface OrdersPageProps {
  onBack: () => void;
}


const STATUS_CONFIG: Record<OrderStatus, { label: string; className: string }> = {
  pending:   { label: 'Pending',   className: 'bg-amber-100 text-amber-800 border-amber-200' },
  confirmed: { label: 'Confirmed', className: 'bg-green-100 text-green-800 border-green-200' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-800 border-red-200' },
  completed: { label: 'Completed', className: 'bg-stone-100 text-stone-600 border-stone-200' },
};

const FILTER_TABS: { label: string; value: OrderStatus | 'all' }[] = [
  { label: 'All',       value: 'all' },
  { label: 'Pending',   value: 'pending' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'Completed', value: 'completed' },
];

/** Fire-and-forget — sends WhatsApp notification via serverless function */
function notifyCustomer(orderId: string, action: 'confirm' | 'cancel'): void {
  fetch('/api/whatsapp-notify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-notify-secret': import.meta.env.VITE_NOTIFY_SECRET ?? '',
    },
    body: JSON.stringify({ orderId, action }),
  }).catch(err => console.warn('[notify] failed to send customer notification:', err));
}

function OrderCard({ order }: { order: Order }) {
  const [expanded, setExpanded] = useState(false);
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const confirmMutation = useMutation({
    mutationFn: () => confirmOrder(order.id),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      showToast('success', `Order ${updated.order_number} confirmed — stock deducted`);
      notifyCustomer(order.id, 'confirm');
    },
    onError: (err: Error) => {
      showToast('error', err.message);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelOrder(order.id),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      showToast('info', `Order ${updated.order_number} cancelled`);
      notifyCustomer(order.id, 'cancel');
    },
    onError: (err: Error) => {
      showToast('error', err.message);
    },
  });

  const isPending = order.status === 'pending';
  const isLoading = confirmMutation.isPending || cancelMutation.isPending;
  const statusCfg = STATUS_CONFIG[order.status];

  return (
    <Card className="border-2 border-stone-200 shadow-sm rounded-2xl overflow-hidden">
      {/* Header row */}
      <CardHeader className="bg-gradient-to-br from-stone-50 to-stone-100/50 border-b border-stone-200 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-bold text-stone-900 text-sm shrink-0">{order.order_number}</span>
            <Badge className={`text-xs font-semibold border ${statusCfg.className}`}>
              {statusCfg.label}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-stone-400 hover:text-stone-600"
            onClick={() => setExpanded(e => !e)}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>

        {/* Customer info */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
          <div className="flex items-center gap-1.5 text-sm text-stone-700">
            <ShoppingBag className="h-3.5 w-3.5 text-stone-400" />
            <span className="font-medium">{order.customer_name}</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-stone-500">
            <Phone className="h-3.5 w-3.5 text-stone-400" />
            <span>{order.customer_phone}</span>
          </div>
          {order.pickup_time && (
            <div className="flex items-center gap-1.5 text-sm text-stone-500">
              <Clock className="h-3.5 w-3.5 text-stone-400" />
              <span>{order.pickup_time}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-sm text-stone-400">
            <Calendar className="h-3.5 w-3.5" />
            <span>{new Date(order.created_at).toLocaleString('ro-RO', { dateStyle: 'short', timeStyle: 'short' })}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4 py-3 space-y-3">
        {/* Items — always visible summary, expandable detail */}
        <div>
          {!expanded ? (
            <p className="text-sm text-stone-600">
              {order.items.length} item{order.items.length !== 1 ? 's' : ''} · <span className="font-semibold text-stone-900">€{order.total_price.toFixed(2)}</span>
            </p>
          ) : (
            <div className="space-y-1.5">
              {order.items.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-stone-700">{item.qty}× {item.name}</span>
                  <span className="text-stone-500 tabular-nums">€{(item.qty * item.unit_price).toFixed(2)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between text-sm font-bold text-stone-900 pt-1 border-t border-stone-100 mt-1">
                <span>Total</span>
                <span>€{order.total_price.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Notes */}
        {order.notes && (
          <p className="text-xs text-stone-500 italic border-l-2 border-stone-200 pl-2">{order.notes}</p>
        )}

        {/* Actions — only for pending orders */}
        {isPending && (
          <div className="flex gap-2 pt-1">
            <Button
              className="flex-1 gap-2 bg-gradient-to-br from-[var(--color-forest)] to-[var(--color-forest-dark)] text-white hover:opacity-90"
              size="sm"
              disabled={isLoading}
              onClick={() => confirmMutation.mutate()}
            >
              {confirmMutation.isPending ? (
                <Spinner size="sm" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              Confirm & Deduct Stock
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-2 border-2 border-[var(--color-terracotta)] text-[var(--color-terracotta)] hover:bg-[var(--color-terracotta)]/5"
              disabled={isLoading}
              onClick={() => cancelMutation.mutate()}
            >
              {cancelMutation.isPending ? (
                <Spinner size="sm" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              Cancel
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function OrdersPage({ onBack }: OrdersPageProps) {
  const [activeFilter, setActiveFilter] = useState<OrderStatus | 'all'>('pending');

  const { data: rawOrders, isLoading, error, refetch: refetchOrders } = useQuery({
    queryKey: ['orders', activeFilter],
    queryFn: () => getOrders(activeFilter === 'all' ? undefined : activeFilter),
    staleTime: 1000 * 30,
  });

  // Separate query for pending count — independent of active filter so the
  // badge in the title always shows the real pending count regardless of tab.
  const { data: pendingOrders } = useQuery({
    queryKey: ['orders', 'pending'],
    queryFn: () => getOrders('pending'),
    staleTime: 1000 * 30,
  });

  const hasError = !!error;
  const orders = rawOrders ?? [];
  const pendingCount = pendingOrders?.length ?? 0;

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title={pendingCount > 0 && activeFilter !== 'pending' ? `Pickup Orders (${pendingCount} pending)` : 'Pickup Orders'}
        onBack={onBack}
      />

      {/* Filter tabs */}
      <div className="flex gap-1 px-4 py-3 border-b border-stone-200 bg-white overflow-x-auto">
        {FILTER_TABS.map(tab => (
          <Button
            key={tab.value}
            variant={activeFilter === tab.value ? 'default' : 'ghost'}
            size="sm"
            className={
              activeFilter === tab.value
                ? 'bg-stone-900 text-white rounded-full px-4'
                : 'text-stone-600 rounded-full px-4 hover:bg-stone-100'
            }
            onClick={() => setActiveFilter(tab.value)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading && (
          <div className="flex justify-center py-12">
            <Spinner size="lg" label="Loading orders..." />
          </div>
        )}

        {hasError && (
          <div className="text-center py-12 space-y-3">
            <p className="text-stone-500">Failed to load orders</p>
            <Button variant="outline" size="sm" onClick={() => { void (refetchOrders as () => void)(); }}>Try again</Button>
          </div>
        )}

        {!isLoading && !error && orders.length === 0 && (
          <div className="text-center py-16 space-y-2">
            <ShoppingBag className="h-10 w-10 text-stone-300 mx-auto" />
            <p className="text-stone-500 font-medium">No {activeFilter === 'all' ? '' : activeFilter} orders</p>
            <p className="text-stone-400 text-sm">Orders from WhatsApp will appear here</p>
          </div>
        )}

        {!isLoading && orders.map(order => (
          <OrderCard key={order.id} order={order} />
        ))}
      </div>
    </div>
  );
}
