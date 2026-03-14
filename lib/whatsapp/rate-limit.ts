import type { ServerSupabaseClient } from './db.js';

export const RATE_LIMIT_WINDOW_SECONDS = 60;
export const RATE_LIMIT_MAX_MESSAGES = 10;

export function buildRateLimitReply(): string {
  return 'Prea multe mesaje trimise. / Too many messages. Please wait a moment and try again.';
}

/**
 * Checks per-phone rate limit: up to RATE_LIMIT_MAX_MESSAGES (10) per RATE_LIMIT_WINDOW_SECONDS (60s).
 * Returns { allowed: false } when the limit is exceeded.
 * Fails open (allows) when DB is unavailable.
 */
export async function checkRateLimit(
  sb: ServerSupabaseClient,
  phone: string
): Promise<{ allowed: boolean }> {
  try {
    const now = new Date();
    const windowCutoff = new Date(now.getTime() - RATE_LIMIT_WINDOW_SECONDS * 1000).toISOString();
    const nowIso = now.toISOString();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (sb as any)
      .from('whatsapp_rate_limits')
      .select('message_count, window_start')
      .eq('phone_number', phone)
      .maybeSingle();

    if (!existing || existing.window_start < windowCutoff) {
      // No record, or current window expired — start a fresh window
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (sb as any)
        .from('whatsapp_rate_limits')
        .upsert(
          { phone_number: phone, message_count: 1, window_start: nowIso },
          { onConflict: 'phone_number' }
        );
      return { allowed: true };
    }

    const newCount = existing.message_count + 1;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb as any)
      .from('whatsapp_rate_limits')
      .update({ message_count: newCount })
      .eq('phone_number', phone);

    return { allowed: newCount <= RATE_LIMIT_MAX_MESSAGES };
  } catch (err) {
    console.warn('[whatsapp] rate limit check failed (fail open):', err);
    return { allowed: true };
  }
}
