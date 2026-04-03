import { describe, it, expect } from 'vitest';

import { computeTwilioSignature, validateTwilioSignature } from '../../../api/lib/twilio-signature';

describe('twilio-signature', () => {
  it('computes signature and validates exact match', () => {
    const authToken = 'secret';
    const url = 'https://example.com/api/whatsapp';
    const params = { From: 'whatsapp:+123', Body: 'Hello', ProfileName: 'Alice' };

    const sig = computeTwilioSignature({ authToken, url, params });
    expect(validateTwilioSignature({ authToken, url, params, signature: sig })).toBe(true);
  });

  it('fails validation when params change', () => {
    const authToken = 'secret';
    const url = 'https://example.com/api/whatsapp';
    const params = { From: 'whatsapp:+123', Body: 'Hello', ProfileName: 'Alice' };

    const sig = computeTwilioSignature({ authToken, url, params });
    expect(
      validateTwilioSignature({
        authToken,
        url,
        params: { ...params, Body: 'Hello!' },
        signature: sig,
      })
    ).toBe(false);
  });

  it('fails validation when signature is missing', () => {
    const authToken = 'secret';
    const url = 'https://example.com/api/whatsapp';
    const params = { From: 'whatsapp:+123', Body: 'Hello' };

    expect(
      validateTwilioSignature({
        authToken,
        url,
        params,
        signature: '',
      })
    ).toBe(false);
  });

  it('fails validation when signature is null', () => {
    const authToken = 'secret';
    const url = 'https://example.com/api/whatsapp';
    const params = { From: 'whatsapp:+123', Body: 'Hello' };

    expect(
      validateTwilioSignature({
        authToken,
        url,
        params,
        signature: null as unknown as string,
      })
    ).toBe(false);
  });

  it('filters out undefined and null params when computing', () => {
    const authToken = 'secret';
    const url = 'https://example.com/api/whatsapp';
    const params1 = { From: 'whatsapp:+123', Body: 'Hello', Extra: undefined };
    const params2 = { From: 'whatsapp:+123', Body: 'Hello', Extra: null as unknown as string };

    const sig1 = computeTwilioSignature({ authToken, url, params: params1 });
    const sig2 = computeTwilioSignature({ authToken, url, params: params2 });

    // Both should produce same signature since undefined/null are filtered out
    expect(sig1).toBe(sig2);
  });
});

