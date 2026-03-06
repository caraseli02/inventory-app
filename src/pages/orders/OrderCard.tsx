import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, CheckCircle, ChevronDown, ChevronUp, Clock, MoreHorizontal, Phone, ShoppingBag, XCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Spinner } from '@/components/ui/spinner';
import { useSwipeReveal } from '@/hooks/useSwipeReveal';
import { useToast } from '@/hooks/useToast';
import { cancelOrder, confirmOrder } from '@/lib/orders-api';
import type { Order } from '@/types/orders';

import { CONFIRM_ACTION_CLASSES, notifyCustomer, REJECT_ACTION_CLASSES, STATUS_CONFIG } from './orderCard.helpers';


export function OrderCard({
  order,
  isMobile,
  swipeOpenOrderId,
  setSwipeOpenOrderId,
}: {
  order: Order;
  isMobile: boolean;
  swipeOpenOrderId: string | null;
  setSwipeOpenOrderId: (id: string | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
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

  // Option B behavior:
  // - Desktop/tablet: always-visible inline buttons
  // - Mobile: swipe-to-reveal actions + visible Actions button (Sheet) + expanded fallback
  const swipeEnabled = isMobile && isPending;
  const isSwipeOpen = swipeEnabled && swipeOpenOrderId === order.id;
  const maxSwipePx = 160;

  const setThisSwipeOpen = (open: boolean) => {
    if (open) {
      setSwipeOpenOrderId(order.id);
      return;
    }
    if (swipeOpenOrderId === order.id) setSwipeOpenOrderId(null);
  };

  const {
    cardRef: swipeCardRef,
    close: closeSwipe,
    swipeStyle,
    handlers: swipeHandlers,
  } = useSwipeReveal({
    enabled: swipeEnabled,
    maxPx: maxSwipePx,
    isOpen: isSwipeOpen,
    onOpenChange: setThisSwipeOpen,
    disabled: isLoading,
  });

  const desktopInlineActions = isPending && !isMobile;
  const mobileFallbackActions = isPending && isMobile && expanded;
  const total = order.total_price;

  return (
    <div
      className="relative"
      data-testid="order-card"
      data-order-id={order.id}
      data-order-number={order.order_number}
    >
      {/* Mobile swipe underlay */}
      {swipeEnabled && (
        <div className="absolute inset-0 rounded-2xl overflow-hidden border-2 border-stone-200">
          <div className="absolute inset-0 bg-gradient-to-br from-stone-50 to-stone-100/60" />
          <div className="absolute inset-0 flex items-stretch justify-end">
            <button
              type="button"
              data-testid="order-confirm-swipe"
              className="w-20 sm:hidden flex flex-col items-center justify-center gap-1 bg-emerald-700 text-white font-semibold active:opacity-90 disabled:opacity-60"
              disabled={isLoading}
              onClick={(e) => {
                e.stopPropagation();
                setSwipeOpenOrderId(null);
                confirmMutation.mutate();
              }}
              aria-label={`Confirm ${order.order_number}`}
            >
              <CheckCircle className="h-5 w-5" />
              <span className="text-xs">Confirm</span>
            </button>
            <button
              type="button"
              data-testid="order-reject-swipe"
              className="w-20 sm:hidden flex flex-col items-center justify-center gap-1 bg-red-600 text-white font-semibold active:opacity-90 disabled:opacity-60"
              disabled={isLoading}
              onClick={(e) => {
                e.stopPropagation();
                setSwipeOpenOrderId(null);
                cancelMutation.mutate();
              }}
              aria-label={`Reject ${order.order_number}`}
            >
              <XCircle className="h-5 w-5" />
              <span className="text-xs">Reject</span>
            </button>
          </div>
        </div>
      )}

      <div
        ref={swipeCardRef}
        className="relative"
        data-testid="order-swipe-surface"
        style={{
          ...swipeStyle,
        }}
        onPointerDown={(e) => {
          if (swipeEnabled && swipeOpenOrderId && swipeOpenOrderId !== order.id) setSwipeOpenOrderId(null);
          swipeHandlers.onPointerDown(e);
        }}
        onPointerMove={swipeHandlers.onPointerMove}
        onPointerUp={swipeHandlers.onPointerUp}
        onPointerCancel={swipeHandlers.onPointerCancel}
        onClick={(e) => {
          if (!swipeEnabled || !isSwipeOpen) return;
          if ((e.target as HTMLElement | null)?.closest('button')) return;
          setSwipeOpenOrderId(null);
          closeSwipe();
        }}
      >
        <Card className="border-2 border-stone-200 shadow-sm rounded-2xl overflow-hidden bg-white">
          <CardHeader className="bg-gradient-to-br from-stone-50 to-stone-100/50 border-b border-stone-200 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-bold text-stone-900 text-sm shrink-0">{order.order_number}</span>
                <Badge className={`text-xs font-semibold border ${statusCfg.className}`}>
                  {statusCfg.label}
                </Badge>
                {swipeEnabled && (
                  <span className="sm:hidden ml-1 inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white px-2 py-0.5 text-xs font-semibold text-stone-500">
                    Swipe
                    <span className="text-stone-400">←</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {desktopInlineActions && (
                  <div className="hidden sm:flex items-center gap-2">
                    <Button
                      size="sm"
                      data-testid="order-confirm-desktop"
                      className={CONFIRM_ACTION_CLASSES}
                      disabled={isLoading}
                      onClick={() => confirmMutation.mutate()}
                    >
                      {confirmMutation.isPending ? <Spinner size="sm" /> : <CheckCircle className="h-4 w-4" />}
                      Confirm
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      data-testid="order-reject-desktop"
                      className={REJECT_ACTION_CLASSES}
                      disabled={isLoading}
                      onClick={() => cancelMutation.mutate()}
                    >
                      {cancelMutation.isPending ? <Spinner size="sm" /> : <XCircle className="h-4 w-4" />}
                      Reject
                    </Button>
                  </div>
                )}
                {isMobile && isPending && (
                  <Button
                    variant="ghost"
                    size="sm"
                    data-testid="order-actions-trigger"
                    className="h-7 w-7 p-0 text-stone-400 hover:text-stone-600"
                    onClick={() => {
                      if (swipeEnabled && isSwipeOpen) closeSwipe();
                      setActionsOpen(true);
                    }}
                    aria-label={`Actions for ${order.order_number}`}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  data-testid="order-expand-toggle"
                  className="h-7 w-7 p-0 text-stone-400 hover:text-stone-600"
                  onClick={() => {
                    if (swipeEnabled && isSwipeOpen) closeSwipe();
                    setExpanded(e => !e);
                  }}
                  aria-expanded={expanded}
                  aria-controls={`order-${order.id}-details`}
                >
                  {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>
            </div>

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

          <CardContent className="px-4 py-3 space-y-3" id={`order-${order.id}-details`}>
            <div>
              {!expanded ? (
                <p className="text-sm text-stone-600">
                  {order.items.length} item{order.items.length !== 1 ? 's' : ''} · <span className="font-semibold text-stone-900">€{total.toFixed(2)}</span>
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
                    <span>€{total.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>

            {order.notes && (
              <p className="text-xs text-stone-500 italic border-l-2 border-stone-200 pl-2">{order.notes}</p>
            )}

            {mobileFallbackActions && (
              <div className="flex gap-2 pt-1">
                <Button
                  className="flex-1 gap-2 bg-emerald-700 text-white hover:bg-emerald-800"
                  size="sm"
                  data-testid="order-confirm-expanded"
                  disabled={isLoading}
                  onClick={() => confirmMutation.mutate()}
                >
                  {confirmMutation.isPending ? (
                    <Spinner size="sm" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  Confirm
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  data-testid="order-reject-expanded"
                  className="flex-1 gap-2 border-2 border-red-600 text-red-700 hover:bg-red-50"
                  disabled={isLoading}
                  onClick={() => cancelMutation.mutate()}
                >
                  {cancelMutation.isPending ? (
                    <Spinner size="sm" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  Reject
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Mobile visible fallback: Actions Sheet (non-gesture) */}
      {isMobile && isPending && (
        <Sheet
          open={actionsOpen}
          onOpenChange={(open) => {
            if (swipeEnabled && isSwipeOpen) closeSwipe();
            setActionsOpen(open);
          }}
        >
          <SheetContent side="bottom" className="h-[50vh] min-h-72 flex flex-col p-0">
            <SheetHeader className="bg-gradient-to-br from-stone-50 to-stone-100/50 border-b-2 border-stone-200 px-6 py-4 flex-shrink-0">
              <SheetTitle className="text-xl font-bold text-stone-900">
                {order.order_number} · Actions
              </SheetTitle>
              <SheetDescription className="text-stone-600">
                Confirm or reject this order.
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
              <div className="rounded-2xl border-2 border-stone-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-stone-900 truncate">{order.customer_name}</div>
                    <div className="text-xs text-stone-500 truncate">{order.customer_phone}{order.pickup_time ? ` · ${order.pickup_time}` : ''}</div>
                  </div>
                  <Badge className={`text-xs font-semibold border ${statusCfg.className}`}>
                    {statusCfg.label}
                  </Badge>
                </div>
                <div className="mt-3 text-sm text-stone-600">
                  {order.items.length} item{order.items.length !== 1 ? 's' : ''} · <span className="font-semibold text-stone-900">€{total.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  className="flex-1 gap-2 bg-emerald-700 text-white hover:bg-emerald-800"
                  size="lg"
                  data-testid="order-confirm-sheet"
                  disabled={isLoading}
                  onClick={() => {
                    setActionsOpen(false);
                    confirmMutation.mutate();
                  }}
                >
                  {confirmMutation.isPending ? <Spinner size="sm" /> : <CheckCircle className="h-5 w-5" />}
                  Confirm & Deduct Stock
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 gap-2 border-2 border-red-600 text-red-700 hover:bg-red-50"
                  size="lg"
                  data-testid="order-reject-sheet"
                  disabled={isLoading}
                  onClick={() => {
                    setActionsOpen(false);
                    cancelMutation.mutate();
                  }}
                >
                  {cancelMutation.isPending ? <Spinner size="sm" /> : <XCircle className="h-5 w-5" />}
                  Reject
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
