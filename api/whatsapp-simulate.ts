import type { VercelRequest, VercelResponse } from '@vercel/node';
import { resetConversationHistory } from './whatsapp/conversation-state.js';
import { buildLocalSimulationReply, buildSimulatorReply } from './whatsapp.js';

interface SimulateBody {
  phone?: string;
  name?: string;
  text?: string;
  reset?: boolean;
  mode?: 'agent' | 'direct';
  debug?: boolean;
}

function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '+40000000000';
  if (trimmed.startsWith('+')) return trimmed;
  return `+${trimmed}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // The simulator is intended for local development only.
  if (process.env.VERCEL) {
    return res.status(404).json({ error: 'Not Found' });
  }

  if (req.method !== 'POST') return res.status(405).end();

  const expectedSecret = process.env.WHATSAPP_SIMULATOR_SECRET ?? process.env.VITE_NOTIFY_SECRET ?? '';
  const providedSecret = String(req.headers['x-notify-secret'] ?? '');
  if (expectedSecret && providedSecret !== expectedSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const body = (req.body ?? {}) as SimulateBody;
  const phone = normalizePhone(String(body.phone ?? ''));
  const name = String(body.name ?? 'Simulator').trim() || 'Simulator';
  const reset = Boolean(body.reset);
  const mode = body.mode ?? 'agent';
  const debug = Boolean(body.debug);
  const text = String(body.text ?? '').trim();

  if (reset) {
    try {
      await resetConversationHistory(phone);
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('[whatsapp-simulate] reset failed:', err);
      return res.status(500).json({ ok: false, error: 'Reset failed' });
    }
  }

  if (!text) {
    return res.status(400).json({ error: 'text is required' });
  }

  try {
    if (mode === 'direct') {
      const reply = await buildLocalSimulationReply(phone, name, text);
      return res.status(200).json({ ok: true, reply, provider: 'local' });
    }

    const result = await buildSimulatorReply(phone, name, text);
    return res.status(200).json({
      ok: true,
      reply: result.reply,
      provider: result.provider,
      ...(debug ? { debug: result.debug } : {}),
    });
  } catch (err) {
    console.error('[whatsapp-simulate] failed:', err);
    return res.status(500).json({ ok: false, error: 'Simulation failed' });
  }
}
