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

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase credentials. Please set VITE_SUPABASE_URL and either VITE_SUPABASE_ANON_KEY or VITE_SUPABASE_PUBLISHABLE_KEY in your .env file. ' +
    'See: https://supabase.com/docs/guides/api/api-keys'
  );
}

export const supabase = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey
);

export default supabase;
