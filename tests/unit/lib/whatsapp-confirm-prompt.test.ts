import { describe, expect, it, vi } from 'vitest';

const sentRest: Array<{ to: string; body: string }> = [];

vi.mock('../../../lib/whatsapp/transport.js', () => ({
  sendRestMessage: vi.fn(async (to: string, body: string) => {
    sentRest.push({ to, body });
  }),
  sendTemplateMessage: vi.fn(async () => true),
}));

import { sendConfirmPrompt } from '../../../lib/whatsapp/confirm-prompt.js';

describe('whatsapp confirm-prompt', () => {
  it('falls back to text when template send returns false', async () => {
    process.env.TWILIO_CONFIRM_CONTENT_SID = 'HX_confirm';
    const transport = await import('../../../lib/whatsapp/transport.js');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (transport.sendTemplateMessage as any).mockResolvedValueOnce(false);

    const pending = {
      customer_name: 'Ion',
      customer_phone: '+40123456789',
      items: [{ product_id: 'p1', name: 'Lapte', qty: 2, unit_price: 3.42 }],
      total_price: 6.84,
      pickup_time: '18:30',
    };

    await expect(sendConfirmPrompt({
      to: 'whatsapp:+40123456789',
      pending,
      textFallback: 'DA/NU?',
    })).resolves.toBe('text');

    expect(sentRest.at(-1)?.body).toBe('DA/NU?');
  });

  it('uses template when send succeeds', async () => {
    process.env.TWILIO_CONFIRM_CONTENT_SID = 'HX_confirm';
    sentRest.length = 0;

    const pending = {
      customer_name: 'Ion',
      customer_phone: '+40123456789',
      items: [{ product_id: 'p1', name: 'Lapte', qty: 2, unit_price: 3.42 }],
      total_price: 6.84,
      pickup_time: '18:30',
    };

    await expect(sendConfirmPrompt({
      to: 'whatsapp:+40123456789',
      pending,
      textFallback: 'DA/NU?',
    })).resolves.toBe('template');

    expect(sentRest).toHaveLength(0);
  });
});

