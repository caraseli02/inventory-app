import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ShoppingBag } from 'lucide-react';

import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { getOrders } from '@/lib/orders-api';
import { supabase } from '@/lib/supabase';
import type { OrderStatus } from '@/types/orders';

import { OrderCard } from './orders/OrderCard';

interface OrdersPageProps {
  onBack: () => void;
}

const FILTER_TABS: { label: string; value: OrderStatus | 'all' }[] = [
  { label: 'All',       value: 'all' },
  { label: 'Pending',   value: 'pending' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'Completed', value: 'completed' },
];

export default function OrdersPage({ onBack }: OrdersPageProps) {
  const [activeFilter, setActiveFilter] = useState<OrderStatus | 'all'>('pending');
  const queryClient = useQueryClient();
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const shouldPoll = !realtimeConnected;
  const isMobile = useMediaQuery('(max-width: 639px)');
  const [swipeOpenOrderId, setSwipeOpenOrderId] = useState<string | null>(null);

  useEffect(() => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseUrl || !supabaseAnonKey) return;

    const channel = supabase
      .channel('orders-page')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['orders'] });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setRealtimeConnected(true);
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setRealtimeConnected(false);
          console.warn('[orders realtime] subscription status:', status);
        }
      });

    return () => {
      void channel.unsubscribe();
      supabase.removeChannel(channel);
      setRealtimeConnected(false);
    };
  }, [queryClient]);

  const { data: rawOrders, isLoading, error, refetch: refetchOrders } = useQuery({
    queryKey: ['orders', activeFilter],
    queryFn: () => getOrders(activeFilter === 'all' ? undefined : activeFilter),
    staleTime: shouldPoll ? 0 : 1000 * 30,
    refetchInterval: shouldPoll ? 10_000 : false,
    refetchIntervalInBackground: shouldPoll,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });

  // Separate query for pending count — independent of active filter so the
  // badge in the title always shows the real pending count regardless of tab.
  const { data: pendingOrders } = useQuery({
    queryKey: ['orders', 'pending'],
    queryFn: () => getOrders('pending'),
    staleTime: shouldPoll ? 0 : 1000 * 30,
    refetchInterval: shouldPoll ? 10_000 : false,
    refetchIntervalInBackground: shouldPoll,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
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
            onClick={() => {
              setSwipeOpenOrderId(null);
              setActiveFilter(tab.value);
            }}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      <div
        className="flex-1 overflow-y-auto p-4 space-y-3"
        onScroll={() => {
          if (swipeOpenOrderId) setSwipeOpenOrderId(null);
        }}
      >
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
          <OrderCard
            key={order.id}
            order={order}
            isMobile={isMobile}
            swipeOpenOrderId={swipeOpenOrderId}
            setSwipeOpenOrderId={setSwipeOpenOrderId}
          />
        ))}
      </div>
    </div>
  );
}

