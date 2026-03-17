/**
 * Dynamically create and cache Twilio Content resources (list-pickers)
 * with the exact number of items needed.
 *
 * List-picker Content resources are session-only on WhatsApp and
 * do NOT require Meta approval.
 */
import { getTwilioRestCredentials } from './config.js';

const CONTENT_API_BASE = 'https://content.twilio.com/v1/Content';

/**
 * In-memory cache: item count → Content SID.
 * NOTE: This cache is lost on process restart (serverless cold starts). On a cache miss,
 * we first search the Content API by deterministic friendly_name before creating a new resource,
 * so each item count has at most one Content resource per Twilio account.
 */
const sidCache = new Map<number, string>();

/** Dedup inflight requests for the same item count to avoid duplicate Content creation */
const inflight = new Map<number, Promise<string | null>>();

interface ContentResource {
  sid: string;
  friendly_name: string;
}

interface ContentListResponse {
  contents?: ContentResource[];
}

interface ContentApiResponse {
  sid?: string;
}

/** Deterministic name keyed only by item count — ensures at most one resource per count.
 * v2: variables object must declare all {{N}} placeholders used in items. */
function friendlyName(itemCount: number): string {
  return `dynamic_list_picker_v2_${itemCount}`;
}

function buildListPickerPayload(itemCount: number) {
  const items = Array.from({ length: itemCount }, (_, i) => ({
    item: `{{${i + 1}}}`,
    id: `product_${i + 1}`,
    description: '',
  }));

  // Variables must be declared so Twilio accepts ContentVariables when sending
  const variables: Record<string, string> = {};
  for (let i = 1; i <= itemCount; i++) {
    variables[String(i)] = `Product ${i}`;
  }

  return {
    friendly_name: friendlyName(itemCount),
    language: 'ro',
    variables,
    types: {
      'twilio/list-picker': {
        body: 'Am găsit mai multe produse. Care anume?',
        button: 'Selectează o opțiune',
        items,
      },
    },
  };
}

/** Search Content API for an existing resource with the deterministic friendly_name */
async function findExistingContentSid(auth: string, itemCount: number): Promise<string | null> {
  try {
    const url = `${CONTENT_API_BASE}?PageSize=50`;
    const resp = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
    if (!resp.ok) return null;
    const data = (await resp.json()) as ContentListResponse;
    const name = friendlyName(itemCount);
    const match = data.contents?.find((c) => c.friendly_name === name);
    return match?.sid ?? null;
  } catch {
    return null;
  }
}

async function resolveContentSid(itemCount: number): Promise<string | null> {
  const creds = getTwilioRestCredentials();
  if (!creds) return null;

  const auth = Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString('base64');

  // Look up existing resource before creating a new one (prevents accumulation on cold starts)
  const existing = await findExistingContentSid(auth, itemCount);
  if (existing) {
    sidCache.set(itemCount, existing);
    console.log('[whatsapp] Reusing list-picker content: %s (%d items)', existing, itemCount);
    return existing;
  }

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

/**
 * Get or create a list-picker Content resource with the given number of items.
 * Returns the Content SID, or null if creation fails.
 * Deduplicates concurrent requests for the same count to avoid duplicate resources.
 */
export function getListPickerContentSid(itemCount: number): Promise<string | null> {
  if (itemCount < 1 || itemCount > 10) return Promise.resolve(null);

  const cached = sidCache.get(itemCount);
  if (cached) return Promise.resolve(cached);

  // Dedup: return the same inflight promise for concurrent requests
  const existing = inflight.get(itemCount);
  if (existing) return existing;

  const promise = resolveContentSid(itemCount).finally(() => {
    inflight.delete(itemCount);
  });
  inflight.set(itemCount, promise);
  return promise;
}

/** Clear the SID cache (useful for testing) */
export function clearContentSidCache(): void {
  sidCache.clear();
}
