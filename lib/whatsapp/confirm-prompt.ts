import type { PendingOrder } from './types.js';
import { sendRestMessage, sendTemplateMessage } from './transport.js';

export type ConfirmTemplateVariables = {
  product_name: string;
  price: string;
  pickup_time: string;
};

export function buildConfirmTemplateVariables(pending: PendingOrder): ConfirmTemplateVariables {
  return {
    product_name: pending.items.map((item) => `${item.qty}x ${item.name}`).join(', '),
    price: pending.total_price.toFixed(2),
    pickup_time: pending.pickup_time || 'la preluare',
  };
}

/**
 * Send the final confirmation prompt. Tries the Twilio content template first (DA/NU buttons)
 * and falls back to plain text when:
 * - no SID is configured
 * - Twilio rejects the send (sendTemplateMessage returns false)
 * - send throws (network/etc)
 */
export async function sendConfirmPrompt(args: {
  to: string;
  pending: PendingOrder;
  textFallback: string;
}): Promise<'template' | 'text'> {
  const contentSid = process.env.TWILIO_CONFIRM_CONTENT_SID ?? '';
  if (contentSid) {
    try {
      const ok = await sendTemplateMessage(args.to, contentSid, buildConfirmTemplateVariables(args.pending));
      if (ok) return 'template';
      console.warn('[whatsapp] confirmation template send returned false, using text fallback');
    } catch (err) {
      console.warn('[whatsapp] confirmation template send threw, using text fallback:', err);
    }
  }

  await sendRestMessage(args.to, args.textFallback);
  return 'text';
}

