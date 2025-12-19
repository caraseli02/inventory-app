/**
 * CORS helper for Supabase Edge Functions
 * Allows requests from the app's origin
 */

// Get allowed origin from environment variable, default to '*' for development
const allowedOrigin = Deno.env.get('ALLOWED_ORIGIN') || '*';

// Log warning if using wildcard in production
if (allowedOrigin === '*') {
  console.warn('CORS configured to allow all origins (*). Set ALLOWED_ORIGIN environment variable in production.', {
    timestamp: new Date().toISOString(),
  });
}

export const corsHeaders = {
  // SECURITY: Change '*' to your production domain before deployment
  // Example: 'https://yourapp.com' or 'https://yourdomain.vercel.app'
  // Using '*' in production allows any website to call these functions,
  // which may lead to unauthorized API usage and unexpected costs
  // Set via: npx supabase secrets set ALLOWED_ORIGIN=https://yourdomain.com
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function handleCorsPreFlight() {
  return new Response('ok', { headers: corsHeaders });
}
