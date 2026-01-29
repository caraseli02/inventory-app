/**
 * # Time-of-Day Policy (Gate #5)
 *
 * Purpose:
 * - Prevent price changes outside business hours
 * - Reduces customer confusion from off-hours pricing changes
 *
 * Rule:
 * - Business hours: 9:00 AM to 6:00 PM UTC
 * - Returns true if within business hours
 *
 * Why UTC:
 * - All event timestamps are ISO/UTC
 * - Ensures determinism regardless of server timezone
 */
export function isWithinBusinessHours(ts: string): boolean {
  const hour = new Date(ts).getUTCHours();
  return hour >= 9 && hour < 18;
}
