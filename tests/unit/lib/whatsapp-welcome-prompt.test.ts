import { describe, expect, it, vi } from 'vitest';

const sentRest: Array<{ to: string; body: string }> = [];

vi.mock('../../../lib/whatsapp/transport.js', () => ({
  sendRestMessage: vi.fn(async (to: string, body: string) => {
    sentRest.push({ to, body });
  }),
  sendTemplateMessage: vi.fn(async () => true),
}));

import { sendWelcomePrompt } from '../../../lib/whatsapp/welcome-prompt.js';

describe('whatsapp welcome-prompt', () => {
  it('falls back to text when template send returns false', async () => {
    process.env.TWILIO_WELCOME_CONTENT_SID = 'HX_welcome';
    const transport = await import('../../../lib/whatsapp/transport.js');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (transport.sendTemplateMessage as any).mockResolvedValueOnce(false);

    await expect(sendWelcomePrompt({
      to: 'whatsapp:+40123456789',
      textFallback: 'Salut!',
    })).resolves.toBe('text');

    expect(sentRest.at(-1)?.body).toBe('Salut!');
  });

  it('uses template when send succeeds', async () => {
    process.env.TWILIO_WELCOME_CONTENT_SID = 'HX_welcome';
    sentRest.length = 0;

    await expect(sendWelcomePrompt({
      to: 'whatsapp:+40123456789',
      textFallback: 'Salut!',
    })).resolves.toBe('template');

    expect(sentRest).toHaveLength(0);
  });

  it('accepts TWILIO_WELCOME_SID for back-compat', async () => {
    delete process.env.TWILIO_WELCOME_CONTENT_SID;
    process.env.TWILIO_WELCOME_SID = 'HX_welcome_old';
    sentRest.length = 0;

    await expect(sendWelcomePrompt({
      to: 'whatsapp:+40123456789',
      textFallback: 'Salut!',
    })).resolves.toBe('template');
  });
});

