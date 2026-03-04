import crypto from 'node:crypto';

export type TwilioParams = Record<string, string | number | boolean | null | undefined>;

export function computeTwilioSignature(args: {
  authToken: string;
  url: string;
  params: TwilioParams;
}): string {
  const { authToken, url, params } = args;

  const sortedKeys = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== null)
    .sort();

  let data = url;
  for (const k of sortedKeys) {
    data += k + String(params[k]);
  }

  const digest = crypto.createHmac('sha1', authToken).update(data, 'utf8').digest('base64');
  return digest;
}

export function validateTwilioSignature(args: {
  authToken: string;
  url: string;
  params: TwilioParams;
  signature: string;
}): boolean {
  const expected = computeTwilioSignature({
    authToken: args.authToken,
    url: args.url,
    params: args.params,
  });

  const provided = args.signature;
  if (!provided) return false;

  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(provided, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

