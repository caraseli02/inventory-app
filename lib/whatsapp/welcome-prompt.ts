import { sendRestMessage, sendTemplateMessage } from './transport.js';

function getWelcomeContentSid(): string {
  // Back-compat: older env var name used in previous iterations.
  return (process.env.TWILIO_WELCOME_CONTENT_SID ?? process.env.TWILIO_WELCOME_SID ?? '').trim();
}

export function buildWelcomeTextFallback(args: { isEnglish: boolean }): string {
  if (args.isEnglish) {
    return [
      'Welcome!',
      'Send the product name you need (example: "milk") or type "list" / "products" to browse.',
    ].join('\n');
  }

  return [
    'Bun venit!',
    'Trimite denumirea produsului (ex: "lapte") sau scrie "lista" / "produse" ca să vezi ce avem.',
  ].join('\n');
}

/**
 * Send the initial welcome message. Tries the Twilio content template first (quick reply buttons)
 * and falls back to plain text when:
 * - no SID is configured
 * - Twilio rejects the send (sendTemplateMessage returns false)
 * - send throws (network/etc)
 */
export async function sendWelcomePrompt(args: {
  to: string;
  textFallback: string;
}): Promise<'template' | 'text'> {
  const contentSid = getWelcomeContentSid();
  if (contentSid) {
    try {
      const ok = await sendTemplateMessage(args.to, contentSid);
      if (ok) return 'template';
      console.warn('[whatsapp] welcome template send returned false, using text fallback');
    } catch (err) {
      console.warn('[whatsapp] welcome template send threw, using text fallback:', err);
    }
  }

  await sendRestMessage(args.to, args.textFallback);
  return 'text';
}

