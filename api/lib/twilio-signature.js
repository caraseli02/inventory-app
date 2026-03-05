import crypto from 'node:crypto';

export function computeTwilioSignature(args) {
  const { authToken, url, params } = args;

  const sortedKeys = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== null)
    .sort();

  let data = url;
  for (const key of sortedKeys) {
    data += key + String(params[key]);
  }

  return crypto.createHmac('sha1', authToken).update(data, 'utf8').digest('base64');
}

export function validateTwilioSignature(args) {
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
