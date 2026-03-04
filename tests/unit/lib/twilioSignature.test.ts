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
});

