import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getTwilioAuthToken, getTwilioRestCredentials } from '../../../lib/whatsapp/config.js';

describe('whatsapp config', () => {
  const originalEnv = {
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_FROM_NUMBER: process.env.TWILIO_FROM_NUMBER,
  };

  beforeEach(() => {
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_FROM_NUMBER;
  });

  afterEach(() => {
    if (originalEnv.TWILIO_ACCOUNT_SID === undefined) delete process.env.TWILIO_ACCOUNT_SID;
    else process.env.TWILIO_ACCOUNT_SID = originalEnv.TWILIO_ACCOUNT_SID;
    if (originalEnv.TWILIO_AUTH_TOKEN === undefined) delete process.env.TWILIO_AUTH_TOKEN;
    else process.env.TWILIO_AUTH_TOKEN = originalEnv.TWILIO_AUTH_TOKEN;
    if (originalEnv.TWILIO_FROM_NUMBER === undefined) delete process.env.TWILIO_FROM_NUMBER;
    else process.env.TWILIO_FROM_NUMBER = originalEnv.TWILIO_FROM_NUMBER;
  });

  it('returns empty auth token when unset', () => {
    expect(getTwilioAuthToken()).toBe('');
  });

  it('returns complete REST credentials when all env vars exist', () => {
    process.env.TWILIO_ACCOUNT_SID = 'AC123';
    process.env.TWILIO_AUTH_TOKEN = 'token123';
    process.env.TWILIO_FROM_NUMBER = '+14155550123';

    expect(getTwilioRestCredentials()).toEqual({
      accountSid: 'AC123',
      authToken: 'token123',
      from: '+14155550123',
    });
  });

  it('returns null REST credentials when one env var is missing', () => {
    process.env.TWILIO_ACCOUNT_SID = 'AC123';
    process.env.TWILIO_AUTH_TOKEN = 'token123';

    expect(getTwilioRestCredentials()).toBeNull();
  });
});
