/**
 * CORS helper for Supabase Edge Functions
 * Allows requests from the app's origin
 */

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Change to your domain in production
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export function handleCorsPreFlight() {
  return new Response('ok', { headers: corsHeaders });
}
