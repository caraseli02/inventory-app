import { AsyncLocalStorage } from 'node:async_hooks';
import fs from 'node:fs/promises';
import path from 'node:path';

type ReplayContext = {
  replayId: string;
};

export type ReplayTransportEvent =
  | { kind: 'typing'; messageSid: string }
  | { kind: 'rest'; to: string; body: string }
  | { kind: 'template'; to: string; contentSid: string; variables?: Record<string, string> };

const replayContext = new AsyncLocalStorage<ReplayContext>();

function getReplayDir(): string {
  return path.resolve(process.cwd(), '.tmp/whatsapp-replay');
}

function getReplayFile(replayId: string): string {
  return path.join(getReplayDir(), `${replayId}.jsonl`);
}

export function getReplayId(): string | null {
  return replayContext.getStore()?.replayId ?? null;
}

export function isReplayRequest(): boolean {
  return Boolean(getReplayId());
}

export async function appendReplayEvent(event: ReplayTransportEvent): Promise<void> {
  const replayId = getReplayId();
  if (!replayId) return;

  const filePath = getReplayFile(replayId);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.appendFile(filePath, `${JSON.stringify(event)}\n`, 'utf8');
}

export async function clearReplayCapture(replayId: string): Promise<void> {
  const filePath = getReplayFile(replayId);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, '', 'utf8');
}

export async function readReplayCapture(replayId: string): Promise<ReplayTransportEvent[]> {
  const filePath = getReplayFile(replayId);
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as ReplayTransportEvent);
  } catch {
    return [];
  }
}

export function runWithReplayContext<T>(replayId: string | null, fn: () => Promise<T>): Promise<T> {
  if (!replayId) return fn();
  return replayContext.run({ replayId }, fn);
}
