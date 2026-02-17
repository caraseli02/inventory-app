import { logger } from './logger';
import { supabase } from './supabase';

function decodeBase64Url(input: string): string | null {
  try {
    const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    return atob(padded);
  } catch {
    return null;
  }
}

function isTokenUsable(token: string): boolean {
  const parts = token.split('.');
  if (parts.length < 2) return false;

  const payloadRaw = decodeBase64Url(parts[1]);
  if (!payloadRaw) return false;

  try {
    const payload = JSON.parse(payloadRaw) as { exp?: unknown };
    if (typeof payload.exp !== 'number') return true;

    const nowSeconds = Math.floor(Date.now() / 1000);
    // Small skew buffer to avoid borderline-expired tokens.
    return payload.exp > nowSeconds + 30;
  } catch {
    return false;
  }
}

function extractAccessToken(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;

  const record = value as Record<string, unknown>;
  if (typeof record.access_token === 'string' && record.access_token && isTokenUsable(record.access_token)) {
    return record.access_token;
  }

  const currentSession = record.currentSession;
  if (currentSession && typeof currentSession === 'object') {
    const session = currentSession as Record<string, unknown>;
    if (typeof session.access_token === 'string' && session.access_token && isTokenUsable(session.access_token)) {
      return session.access_token;
    }
  }

  return null;
}

function parseMaybeJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function getTokenFromLocalStorage(): string | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;

  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (!key || !key.startsWith('sb-') || !key.endsWith('-auth-token')) continue;

    const raw = window.localStorage.getItem(key);
    if (!raw) continue;

    const parsed = parseMaybeJson(raw);
    const token = extractAccessToken(parsed);
    if (token) return token;
  }

  return null;
}

function getTokenFromCookie(): string | null {
  if (typeof document === 'undefined') return null;

  const cookie = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith('sb-') && entry.includes('-auth-token='));
  if (!cookie) return null;

  const encodedValue = cookie.split('=').slice(1).join('=');
  if (!encodedValue) return null;

  let value: string;
  try {
    value = decodeURIComponent(encodedValue);
  } catch {
    return null;
  }
  let jsonPayload = value;

  if (value.startsWith('base64-')) {
    try {
      jsonPayload = atob(value.slice('base64-'.length));
    } catch {
      return null;
    }
  }

  const parsed = parseMaybeJson(jsonPayload);
  return extractAccessToken(parsed);
}

export async function resolveSupabaseAccessToken(): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      logger.warn('supabase.auth.getSession failed while resolving invoice token', {
        errorMessage: error.message,
      });
    }

    const sessionToken = data.session?.access_token;
    if (sessionToken) return sessionToken;
  } catch (error) {
    logger.warn('Unexpected error while resolving invoice token from session', {
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }

  const storageToken = getTokenFromLocalStorage();
  if (storageToken) return storageToken;

  const cookieToken = getTokenFromCookie();
  if (cookieToken) return cookieToken;

  try {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) {
      logger.warn('Anonymous Supabase sign-in failed while resolving invoice token', {
        errorMessage: error.message,
      });
      return null;
    }

    const anonToken = data.session?.access_token ?? null;
    if (anonToken) {
      logger.info('Resolved invoice token via anonymous Supabase session');
      return anonToken;
    }
  } catch (error) {
    logger.warn('Unexpected error during anonymous Supabase sign-in', {
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }

  return null;
}
