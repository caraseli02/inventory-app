import type { OrderStatus } from '@/types/orders';

export const STATUS_CONFIG: Record<OrderStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  confirmed: { label: 'Confirmed', className: 'bg-green-100 text-green-800 border-green-200' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-800 border-red-200' },
  completed: { label: 'Completed', className: 'bg-stone-100 text-stone-600 border-stone-200' },
};

export const CONFIRM_ACTION_CLASSES = 'gap-2 rounded-full px-3 bg-emerald-700 text-white hover:bg-emerald-800';
export const REJECT_ACTION_CLASSES = 'gap-2 rounded-full px-3 border-2 border-red-600 text-red-700 hover:bg-red-50';

/** Fire-and-forget — sends WhatsApp notification via serverless function */
export function notifyCustomer(orderId: string, action: 'confirm' | 'cancel'): void {
  void (async () => {
    const { resolveSupabaseAccessToken } = await import('@/lib/invoiceAuth');
    const token = await Promise.race([
      resolveSupabaseAccessToken(),
      new Promise<null>((resolve) => {
        window.setTimeout(() => resolve(null), 800);
      }),
    ]);

    if (!token) {
      console.warn('[notify] skipped (no Supabase access token)');
      return;
    }

    const controller = new AbortController();
    window.setTimeout(() => controller.abort(), 2500);

    await fetch('/api/whatsapp-notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ orderId, action }),
      signal: controller.signal,
    });
  })().catch(err => console.warn('[notify] failed to send customer notification:', err));
}
