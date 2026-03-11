import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { sendRestMessage, sendTemplateMessage, sendTypingIndicator, twiml } from '../../../api/whatsapp/transport.js';

describe('whatsapp transport', () => {
  const originalEnv = {
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_FROM_NUMBER: process.env.TWILIO_FROM_NUMBER,
  };

  beforeEach(() => {
    process.env.TWILIO_ACCOUNT_SID = 'AC123';
    process.env.TWILIO_AUTH_TOKEN = 'token123';
    process.env.TWILIO_FROM_NUMBER = '+14155238886';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalEnv.TWILIO_ACCOUNT_SID === undefined) delete process.env.TWILIO_ACCOUNT_SID;
    else process.env.TWILIO_ACCOUNT_SID = originalEnv.TWILIO_ACCOUNT_SID;
    if (originalEnv.TWILIO_AUTH_TOKEN === undefined) delete process.env.TWILIO_AUTH_TOKEN;
    else process.env.TWILIO_AUTH_TOKEN = originalEnv.TWILIO_AUTH_TOKEN;
    if (originalEnv.TWILIO_FROM_NUMBER === undefined) delete process.env.TWILIO_FROM_NUMBER;
    else process.env.TWILIO_FROM_NUMBER = originalEnv.TWILIO_FROM_NUMBER;
  });

  it('escapes XML in twiml messages', () => {
    expect(twiml('milk & bread <today>')).toContain('milk &amp; bread &lt;today&gt;');
  });

  it('normalizes phone numbers for plain text sends', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => '' });
    vi.stubGlobal('fetch', fetchMock);

    await sendRestMessage('+40712345678', 'hello');

    const body = String(fetchMock.mock.calls[0]?.[1]?.body ?? '');
    expect(body).toContain('To=whatsapp%3A%2B40712345678');
    expect(body).toContain('From=whatsapp%3A%2B14155238886');
    expect(body).toContain('Body=hello');
  });

  it('sends template content variables when provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => '' });
    vi.stubGlobal('fetch', fetchMock);

    await sendTemplateMessage('+40712345678', 'HX123', { price: '6.84' });

    const body = String(fetchMock.mock.calls[0]?.[1]?.body ?? '');
    expect(body).toContain('ContentSid=HX123');
    expect(body).toContain('ContentVariables=');
  });

  it('marks incoming message as read via typing indicator endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => '' });
    vi.stubGlobal('fetch', fetchMock);

    await sendTypingIndicator('SM123');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/Accounts/AC123/Messages/SM123.json');
    expect(init).toMatchObject({
      method: 'POST',
      headers: expect.objectContaining({ 'Content-Type': 'application/x-www-form-urlencoded' }),
      body: 'Status=read',
    });
  });

  it('does not call fetch when typing indicator message sid is empty', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await sendTypingIndicator('');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('skips REST sends when credentials are incomplete', async () => {
    delete process.env.TWILIO_FROM_NUMBER;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await sendRestMessage('+40712345678', 'hello');
    await sendTemplateMessage('+40712345678', 'HX123');

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
