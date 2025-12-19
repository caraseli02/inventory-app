/**
 * Supabase Edge Function: invoice-ocr
 *
 * Performs OCR on invoice images using Google Cloud Vision API
 * This keeps the API key secure on the server side
 *
 * POST /functions/v1/invoice-ocr
 * Body: { imageBase64: string } - Base64 encoded image without data URL prefix
 * Returns: { text: string } or { error: string }
 */

import { corsHeaders, handleCorsPreFlight } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  // Generate request ID for tracking
  const requestId = crypto.randomUUID();
  const requestStart = Date.now();

  // Declare timeoutId outside try block so it's accessible in catch
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return handleCorsPreFlight();
  }

  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get API key from environment
    const apiKey = Deno.env.get('GOOGLE_CLOUD_VISION_API_KEY');
    if (!apiKey) {
      console.error('Google Cloud Vision API key not configured', {
        requestId,
        timestamp: new Date().toISOString(),
      });
      return new Response(
        JSON.stringify({ error: 'Server configuration error: API key not set' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Parse request body
    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: 'Missing imageBase64 in request body' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Starting OCR processing', {
      requestId,
      imageSize: imageBase64.length,
      timestamp: new Date().toISOString(),
    });

    // Call Google Cloud Vision API with timeout
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const visionResponse = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              image: {
                content: imageBase64,
              },
              features: [
                {
                  type: 'DOCUMENT_TEXT_DETECTION',
                  maxResults: 1,
                },
              ],
            },
          ],
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!visionResponse.ok) {
      const errorData = await visionResponse.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || `Google Cloud Vision API error: ${visionResponse.statusText}`;

      console.error('Google Cloud Vision API error', {
        status: visionResponse.status,
        statusText: visionResponse.statusText,
        error: errorData,
      });

      // Map specific error codes to user-friendly messages
      if (visionResponse.status === 401) {
        return new Response(
          JSON.stringify({ error: 'API authentication failed. Please contact support.' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
      if (visionResponse.status === 429) {
        const retryAfter = visionResponse.headers.get('Retry-After');
        const errorMessage = retryAfter
          ? `Service quota exceeded. Please try again in ${retryAfter} seconds.`
          : 'Service quota exceeded. Please try again in a few minutes.';

        console.warn('Rate limit hit for Google Cloud Vision API', {
          requestId,
          retryAfter,
          timestamp: new Date().toISOString(),
        });

        return new Response(
          JSON.stringify({ error: errorMessage }),
          {
            status: 429,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
              ...(retryAfter && { 'Retry-After': retryAfter }),
            }
          }
        );
      }

      return new Response(
        JSON.stringify({ error: errorMessage }),
        {
          status: visionResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const result = await visionResponse.json();
    const textAnnotations = result.responses[0]?.textAnnotations;

    if (!textAnnotations || textAnnotations.length === 0) {
      console.warn('No text detected in image');
      return new Response(
        JSON.stringify({ error: 'No text detected in the image. Please ensure the invoice is clear and readable.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const extractedText = textAnnotations[0].description;

    console.log('OCR completed successfully', {
      textLength: extractedText.length,
      timestamp: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({ text: extractedText }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    // Clear timeout if it exists
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }

    // Log full error details for debugging
    console.error('Invoice OCR function error', {
      requestId,
      errorName: error?.constructor?.name,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      requestDuration: Date.now() - requestStart,
      timestamp: new Date().toISOString(),
    });

    // Handle timeout errors
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('Google Cloud Vision API timeout', {
        requestId,
        timeout: 30000,
        timestamp: new Date().toISOString(),
      });
      return new Response(
        JSON.stringify({ error: 'OCR service timeout. The image may be too large or the service is slow. Please try again.' }),
        { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return new Response(
        JSON.stringify({ error: 'Network error: Unable to reach Google Cloud Vision API. Please try again.' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle JSON parsing errors
    if (error instanceof SyntaxError) {
      return new Response(
        JSON.stringify({ error: 'Invalid request format. Please ensure you are using the latest app version.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generic fallback for truly unexpected errors
    // Note: errorType is logged above but not exposed to client for security
    return new Response(
      JSON.stringify({
        error: 'An unexpected error occurred. Please try again or contact support if the issue persists.',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
