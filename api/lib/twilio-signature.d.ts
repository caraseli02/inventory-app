export function computeTwilioSignature(args: {
  authToken: string;
  url: string;
  params: Record<string, string | number | boolean | null | undefined>;
}): string;

export function validateTwilioSignature(args: {
  authToken: string;
  url: string;
  params: Record<string, string | number | boolean | null | undefined>;
  signature: string;
}): boolean;
