import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// Initialize Supabase client
// Note: These env vars must be set in .env for the app to function
//
// Supabase API Keys:
// - Publishable key (also called "anon" key) - Safe for browser/client use with RLS
//   Format: sb_publishable_... or older format with different prefix
// - Secret key (service_role key) - For server/backend use only
//
// Note: The Supabase dashboard may show this as either "anon" or "publishable"
// key depending on the UI version - they refer to the same key.
// See: https://supabase.com/docs/guides/api/api-keys
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
// Support both VITE_SUPABASE_ANON_KEY and VITE_SUPABASE_PUBLISHABLE_KEY (same key, different naming conventions)
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Only warn in non-test environments (tests are expected to run without full env setup)
const isTestEnvironment = import.meta.env.VITEST === 'true' || import.meta.env.NODE_ENV === 'test';

if (!supabaseUrl || !supabaseAnonKey) {
  if (!isTestEnvironment) {
    console.warn(
      'Missing Supabase credentials. Using placeholder values. APP WILL NOT FUNCTION CORRECTLY. ' +
      'Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env'
    );
  }
}

// Fallback to dummy values to prevent app crash (e.g. during tests or initial setup)
const finalUrl = supabaseUrl || 'https://placeholder.supabase.co';
const finalKey = supabaseAnonKey || 'placeholder-key';

export const supabase = createClient<Database>(
  finalUrl,
  finalKey
);

export default supabase;
