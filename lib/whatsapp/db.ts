import { createClient } from '@supabase/supabase-js';

export function createSupabaseClient() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '';
  const key =
    process.env.SUPABASE_ANON_KEY ??
    process.env.VITE_SUPABASE_ANON_KEY ??
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    '';

  if (!url || !key) {
    console.error(
      '[whatsapp] Supabase not configured: url=%s key=%s',
      url ? 'SET' : 'MISSING',
      key ? 'SET' : 'MISSING'
    );
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export type ServerSupabaseClient = ReturnType<typeof createSupabaseClient>;
