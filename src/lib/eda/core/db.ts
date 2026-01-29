import { supabase } from "../../supabase";

/**
 * # EDA Database Layer (Supabase Adapter)
 * 
 * In the original reference, this used better-sqlite3.
 * We've adapted it to use Supabase (PostgreSQL) for the Inventory App.
 * 
 * Note: Table names and schema should be created in Supabase using 
 * the 'supabase/eda_schema.sql' file.
 */

export const db = supabase;

export function getDatabase() {
  return supabase;
}