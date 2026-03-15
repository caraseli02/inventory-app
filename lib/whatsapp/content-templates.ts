/**
 * Dynamically create and cache Twilio Content resources (list-pickers)
 * with the exact number of items needed.
 *
 * List-picker Content resources are session-only on WhatsApp and
 * do NOT require Meta approval.
 */
import { getTwilioRestCredentials } from './config.js';

const CONTENT_API_BASE = 'https://content.twilio.com/v1/Content';

/** In-memory cache: item count → Content SID */
const sidCache = new Map<number, string>();

interface ContentApiResponse {
  sid?: string;
  status?: string;
}

function buildListPickerPayload(itemCount: number) {
  // Match the working template format:
  // - trailing space in item text: "{{1}} "
  // - empty description
  // - empty variables object
  const items = Array.from({ length: itemCount }, (_, i) => ({
    item: `{{${i + 1}}} `,
    id: `product_${i + 1}`,
    description: '',
  }));

  return {
    friendly_name: `dynamic_list_picker_${itemCount}_${Date.now()}`,
    language: 'ro',
    variables: {},
    types: {
      'twilio/list-picker': {
        body: 'Am găsit mai multe produse. Care anume?',
        button: 'Selectează o opțiune',
        items,
      },
    },
  };
}

/**
 * Get or create a list-picker Content resource with the given number of items.
 * Returns the Content SID, or null if creation fails.
 */
export async function getListPickerContentSid(itemCount: number): Promise<string | null> {
  if (itemCount < 1 || itemCount > 10) return null;

  const cached = sidCache.get(itemCount);
  if (cached) return cached;

  const creds = getTwilioRestCredentials();
  if (!creds) return null;

  const auth = Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString('base64');
  const payload = buildListPickerPayload(itemCount);

  try {
    const resp = await fetch(CONTENT_API_BASE, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      console.error('[whatsapp] Content API create failed: %s %s', resp.status, text.slice(0, 300));
      return null;
    }

    const data = (await resp.json()) as ContentApiResponse;
    if (data.sid) {
      sidCache.set(itemCount, data.sid);
      console.log('[whatsapp] Created list-picker content: %s (%d items)', data.sid, itemCount);
      return data.sid;
    }

    return null;
  } catch (err) {
    console.error('[whatsapp] Content API error:', err);
    return null;
  }
}

/** Clear the SID cache (useful for testing) */
export function clearContentSidCache(): void {
  sidCache.clear();
}
