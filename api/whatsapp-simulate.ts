import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildReply } from './whatsapp.js';

interface SimulateBody {
  phone?: string;
  name?: string;
  text?: string;
}

function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '+40000000000';
  if (trimmed.startsWith('+')) return trimmed;
  return `+${trimmed}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const expectedSecret = process.env.WHATSAPP_SIMULATOR_SECRET ?? process.env.VITE_NOTIFY_SECRET ?? '';
  const providedSecret = String(req.headers['x-notify-secret'] ?? '');
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const body = (req.body ?? {}) as SimulateBody;
  const text = String(body.text ?? '').trim();
  const phone = normalizePhone(String(body.phone ?? ''));
  const name = String(body.name ?? 'Simulator').trim() || 'Simulator';

  if (!text) {
    return res.status(400).json({ error: 'text is required' });
  }

  try {
    const reply = await buildReply(phone, name, text);
    return res.status(200).json({ ok: true, reply });
  } catch (err) {
    console.error('[whatsapp-simulate] failed:', err);
    return res.status(500).json({ ok: false, error: 'Simulation failed' });
  }
}

