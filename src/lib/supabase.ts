import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// Initialize Supabase client
// Note: These env vars must be set in .env for the app to function
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase credentials. Please check .env file.');
}

export const supabase = createClient<Database>(
  supabaseUrl || '',
  supabaseAnonKey || ''
);

export default supabase;
