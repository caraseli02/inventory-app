/**
 * Unit Tests: Invoice Authentication
 *
 * Tests for Supabase access token resolution for invoice OCR.
 * Tests JWT parsing, localStorage/cookie extraction, and fallback auth.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolveSupabaseAccessToken } from '@/lib/invoiceAuth';
import { supabase } from '@/lib/supabase';

// Mock the logger
vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      signInAnonymously: vi.fn(),
    },
  },
}));

describe('Invoice Authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset localStorage and document
    const store = new Map<string, string>();
    const localStorageShim: Storage = {
      get length() { return store.size; },
      clear: () => { store.clear(); },
      getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
      key: (index: number) => Array.from(store.keys())[index] ?? null,
      removeItem: (key: string) => { store.delete(key); },
      setItem: (key: string, value: string) => { store.set(key, String(value)); },
    };
    vi.stubGlobal('localStorage', localStorageShim);

    const documentShim = { cookie: '' } as unknown as Document;
    vi.stubGlobal('document', documentShim);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('Supabase session token', () => {
    it('returns token from active Supabase session', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: { access_token: 'session-token-123' } },
        error: null,
      });

      const result = await resolveSupabaseAccessToken();

      expect(result).toBe('session-token-123');
      expect(supabase.auth.getSession).toHaveBeenCalledTimes(1);
    });

    it('returns null when session has no access_token', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const result = await resolveSupabaseAccessToken();

      expect(result).toBeNull();
    });

    it('handles getSession error gracefully', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: { message: 'Auth error' },
      });

      const result = await resolveSupabaseAccessToken();

      expect(result).toBeNull();
    });

    it('handles getSession exception', async () => {
      vi.mocked(supabase.auth.getSession).mockRejectedValue(new Error('Network error'));

      const result = await resolveSupabaseAccessToken();

      expect(result).toBeNull();
    });
  });

  describe('localStorage token extraction', () => {
    beforeEach(() => {
      // Supabase session returns null
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      });
    });

    it('extracts valid token from localStorage', async () => {
      // Create a valid JWT-like token (payload: {"exp": 9999999999})
      const validToken = createMockToken(9999999999);
      globalThis.localStorage.setItem('sb-test-auth-token', JSON.stringify({
        access_token: validToken,
      }));

      const result = await resolveSupabaseAccessToken();

      expect(result).toBe(validToken);
    });

    it('extracts token from currentSession field', async () => {
      const validToken = createMockToken(9999999999);
      globalThis.localStorage.setItem('sb-test-auth-token', JSON.stringify({
        currentSession: { access_token: validToken },
      }));

      const result = await resolveSupabaseAccessToken();

      expect(result).toBe(validToken);
    });

    it('skips expired tokens', async () => {
      const expiredToken = createMockToken(Math.floor(Date.now() / 1000) - 100);
      globalThis.localStorage.setItem('sb-test-auth-token', JSON.stringify({
        access_token: expiredToken,
      }));

      const result = await resolveSupabaseAccessToken();

      expect(result).toBeNull();
    });

    it('skips tokens expiring within 30 seconds (buffer)', async () => {
      const expiringSoonToken = createMockToken(Math.floor(Date.now() / 1000) + 20);
      globalThis.localStorage.setItem('sb-test-auth-token', JSON.stringify({
        access_token: expiringSoonToken,
      }));

      const result = await resolveSupabaseAccessToken();

      expect(result).toBeNull();
    });

    it('handles malformed JSON in localStorage', async () => {
      globalThis.localStorage.setItem('sb-test-auth-token', '{invalid json');

      const result = await resolveSupabaseAccessToken();

      expect(result).toBeNull();
    });

    it('ignores non-matching localStorage keys', async () => {
      const validToken = createMockToken(9999999999);
      globalThis.localStorage.setItem('other-key', JSON.stringify({ access_token: validToken }));
      globalThis.localStorage.setItem('sb-test', JSON.stringify({ access_token: validToken }));

      const result = await resolveSupabaseAccessToken();

      expect(result).toBeNull();
    });

    it('scans multiple localStorage keys', async () => {
      const validToken = createMockToken(9999999999);
      globalThis.localStorage.setItem('sb-wrong-auth-token', JSON.stringify({ access_token: 'expired' }));
      globalThis.localStorage.setItem('sb-correct-auth-token', JSON.stringify({ access_token: validToken }));

      const result = await resolveSupabaseAccessToken();

      expect(result).toBe(validToken);
    });
  });

  describe('cookie token extraction', () => {
    beforeEach(() => {
      // Supabase session and localStorage return null
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      });
    });

    const setDocumentCookie = (cookieString: string) => {
      vi.stubGlobal('document', { cookie: cookieString } as unknown as Document);
    };

    it('extracts valid token from cookie', async () => {
      const validToken = createMockToken(9999999999);
      setDocumentCookie(`sb-test-auth-token=${encodeURIComponent(JSON.stringify({ access_token: validToken }))}`);

      const result = await resolveSupabaseAccessToken();

      expect(result).toBe(validToken);
    });

    it('extracts token from base64-encoded cookie', async () => {
      const validToken = createMockToken(9999999999);
      const cookieValue = JSON.stringify({ access_token: validToken });
      const base64Value = 'base64-' + btoa(cookieValue);
      setDocumentCookie(`sb-test-auth-token=${base64Value}`);

      const result = await resolveSupabaseAccessToken();

      expect(result).toBe(validToken);
    });

    it('handles URL-encoded cookie values', async () => {
      const validToken = createMockToken(9999999999);
      // JSON with special characters that need encoding
      const cookieValue = JSON.stringify({ access_token: validToken, extra: 'test with spaces' });
      setDocumentCookie(`sb-test-auth-token=${encodeURIComponent(cookieValue)}`);

      const result = await resolveSupabaseAccessToken();

      expect(result).toBe(validToken);
    });

    it('skips expired tokens in cookie', async () => {
      const expiredToken = createMockToken(Math.floor(Date.now() / 1000) - 100);
      setDocumentCookie(`sb-test-auth-token=${encodeURIComponent(JSON.stringify({ access_token: expiredToken }))}`);

      const result = await resolveSupabaseAccessToken();

      expect(result).toBeNull();
    });

    it('handles malformed cookie JSON', async () => {
      setDocumentCookie('sb-test-auth-token={invalid}');

      const result = await resolveSupabaseAccessToken();

      expect(result).toBeNull();
    });

    it('parses multiple cookies correctly', async () => {
      const validToken = createMockToken(9999999999);
      const cookieValue = encodeURIComponent(JSON.stringify({ access_token: validToken }));
      setDocumentCookie(`other=value; sb-test-auth-token=${cookieValue}; another=thing`);

      const result = await resolveSupabaseAccessToken();

      expect(result).toBe(validToken);
    });
  });

  describe('anonymous sign-in fallback', () => {
    beforeEach(() => {
      // No session, localStorage, or cookie tokens
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      });
    });

    it('falls back to anonymous sign-in when no token found', async () => {
      const anonToken = createMockToken(9999999999);
      vi.mocked(supabase.auth.signInAnonymously).mockResolvedValue({
        data: { session: { access_token: anonToken } },
        error: null,
      });

      const result = await resolveSupabaseAccessToken();

      expect(result).toBe(anonToken);
      expect(supabase.auth.signInAnonymously).toHaveBeenCalledTimes(1);
    });

    it('returns null when anonymous sign-in fails', async () => {
      vi.mocked(supabase.auth.signInAnonymously).mockResolvedValue({
        data: { session: null },
        error: { message: 'Sign-in failed' },
      });

      const result = await resolveSupabaseAccessToken();

      expect(result).toBeNull();
    });

    it('handles anonymous sign-in exception', async () => {
      vi.mocked(supabase.auth.signInAnonymously).mockRejectedValue(new Error('Network error'));

      const result = await resolveSupabaseAccessToken();

      expect(result).toBeNull();
    });
  });

  describe('token priority order', () => {
    it('prioritizes session token over localStorage', async () => {
      const sessionToken = createMockToken(9999999999);
      const storageToken = createMockToken(9999999998);

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: { access_token: sessionToken } },
        error: null,
      });
      globalThis.localStorage.setItem('sb-test-auth-token', JSON.stringify({ access_token: storageToken }));

      const result = await resolveSupabaseAccessToken();

      expect(result).toBe(sessionToken);
    });

    it('prioritizes localStorage over cookie', async () => {
      const storageToken = createMockToken(9999999999);
      const cookieToken = createMockToken(9999999998);

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      });
      globalThis.localStorage.setItem('sb-test-auth-token', JSON.stringify({ access_token: storageToken }));
      globalThis.document.cookie = `sb-test-auth-token=${encodeURIComponent(JSON.stringify({ access_token: cookieToken }))}`;

      const result = await resolveSupabaseAccessToken();

      expect(result).toBe(storageToken);
    });
  });
});

/**
 * Helper: Create a mock JWT token with specified expiration
 */
function createMockToken(exp: number): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ exp }));
  // Fake signature (not actually validated)
  const signature = 'signature';
  return `${header}.${payload}.${signature}`.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
