import type { ServerSupabaseClient } from './db.js';

/**
 * Checks if a MessageSid has already been processed (duplicate detection).
 * Returns true if this is a duplicate (already seen), false if fresh.
 * Marks the SID as processed before returning false.
 * Fails open — returns false on DB errors to avoid blocking legitimate messages.
 */
export async function checkAndMarkMessageSid(
  sb: ServerSupabaseClient,
  messageSid: string
): Promise<boolean> {
  if (!messageSid) return false;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (sb as any)
      .from('processed_message_sids')
      .upsert(
        { message_sid: messageSid, processed_at: new Date().toISOString() },
        { onConflict: 'message_sid', ignoreDuplicates: true }
      )
      .select('message_sid');

    // If data is an empty array, the insert was skipped due to conflict → duplicate
    return Array.isArray(data) && data.length === 0;
  } catch (err) {
    console.warn('[whatsapp] dedup check failed (fail open):', err);
    return false;
  }
}
