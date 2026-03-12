export interface TwilioRestCredentials {
  accountSid: string;
  authToken: string;
  from: string;
}

export function getTwilioAuthToken(): string {
  return process.env.TWILIO_AUTH_TOKEN ?? '';
}

export function getTwilioRestCredentials(): TwilioRestCredentials | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID ?? '';
  const authToken = process.env.TWILIO_AUTH_TOKEN ?? '';
  const from = process.env.TWILIO_FROM_NUMBER ?? '';
  if (!accountSid || !authToken || !from) return null;
  return { accountSid, authToken, from };
}
