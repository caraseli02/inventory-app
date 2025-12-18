import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// Initialize Supabase client
// Note: These env vars must be set in .env for the app to function
//
// Supabase API Keys (2025+):
// - Publishable key (sb_publishable_...) - Safe for browser/client use with RLS
// - Secret key (sb_secret_...) - For server/backend use only
//
// The publishable key replaces the legacy "anon" key.
// See: https://supabase.com/docs/guides/api/api-keys
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  console.warn('Missing Supabase credentials. Please check .env file.');
  console.warn('Required: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY');
}

export const supabase = createClient<Database>(
  supabaseUrl || '',
  supabasePublishableKey || ''
);

export default supabase;
