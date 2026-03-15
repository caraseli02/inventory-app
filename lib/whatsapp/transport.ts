import { getTwilioRestCredentials } from './config.js';
import { appendReplayEvent, isReplayRequest } from './replay-context.js';

export function twiml(message: string): string {
  const safe = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${safe ? `<Message>${safe}</Message>` : ''}</Response>`;
}

export async function sendTypingIndicator(messageSid: string): Promise<void> {
  if (isReplayRequest()) {
    await appendReplayEvent({ kind: 'typing', messageSid });
  }

  const creds = getTwilioRestCredentials();
  if (!creds || !messageSid) return;
  try {
    const readUrl = `https://api.twilio.com/2010-04-01/Accounts/${creds.accountSid}/Messages/${messageSid}.json`;
    const auth = Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString('base64');
    await fetch(readUrl, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'Status=read',
    });
  } catch {
    // non-critical
  }
}

export async function sendRestMessage(to: string, body: string): Promise<void> {
  if (isReplayRequest()) {
    await appendReplayEvent({ kind: 'rest', to, body });
  }

  const creds = getTwilioRestCredentials();
  if (!creds) {
    if (!isReplayRequest()) {
      console.warn('[whatsapp] REST send skipped — TWILIO_ACCOUNT_SID/FROM_NUMBER not configured');
    }
    return;
  }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${creds.accountSid}/Messages.json`;
  const auth = Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString('base64');
  const params = new URLSearchParams({
    To: to.startsWith('whatsapp:') ? to : `whatsapp:${to}`,
    From: creds.from.startsWith('whatsapp:') ? creds.from : `whatsapp:${creds.from}`,
    Body: body,
  });
  const resp = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    console.error('[whatsapp] REST send failed: %s %s', resp.status, text.slice(0, 200));
  }
}

/** Number of variable slots in the Twilio list-picker template ({{1}}..{{6}}) */
const LIST_PICKER_SLOT_COUNT = 6;

export async function sendListPickerTemplate(
  to: string,
  contentSid: string,
  _title: string,
  items: string[]
): Promise<void> {
  const variables: Record<string, string> = {};
  // Template uses {{1}}..{{6}} placeholders — keys must be "1".."6", always fill all 6 slots
  for (let i = 0; i < LIST_PICKER_SLOT_COUNT; i++) {
    variables[String(i + 1)] = items[i] || '-';
  }
  return sendTemplateMessage(to, contentSid, variables);
}

export async function sendTemplateMessage(
  to: string,
  contentSid: string,
  variables?: Record<string, string>
): Promise<void> {
  if (isReplayRequest()) {
    await appendReplayEvent({ kind: 'template', to, contentSid, variables });
  }

  const creds = getTwilioRestCredentials();
  if (!creds) {
    if (!isReplayRequest()) {
      console.warn('[whatsapp] Template send skipped — TWILIO_ACCOUNT_SID/FROM_NUMBER not configured');
    }
    return;
  }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${creds.accountSid}/Messages.json`;
  const auth = Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString('base64');
  const params = new URLSearchParams({
    To: to.startsWith('whatsapp:') ? to : `whatsapp:${to}`,
    From: creds.from.startsWith('whatsapp:') ? creds.from : `whatsapp:${creds.from}`,
    ContentSid: contentSid,
    ...(variables && { ContentVariables: JSON.stringify(variables) }),
  });
  console.log('[whatsapp] [TEMPLATE_DEBUG] sending template:', {
    contentSid,
    variableKeys: variables ? Object.keys(variables) : [],
    variableValues: variables ? Object.values(variables).map(v => v.slice(0, 40)) : [],
    contentVariablesJson: variables ? JSON.stringify(variables) : '(none)',
  });
  const resp = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    console.error('[whatsapp] Template send failed: %s %s', resp.status, text.slice(0, 200));
  }
}
