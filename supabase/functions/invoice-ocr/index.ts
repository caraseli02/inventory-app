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

// Deno.serve is the standard way to create Edge Functions
Deno.serve(async (req) => {
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
      console.error('Google Cloud Vision API key not configured');
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
      imageSize: imageBase64.length,
      timestamp: new Date().toISOString(),
    });

    // Call Google Cloud Vision API
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
      }
    );

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
        return new Response(
          JSON.stringify({ error: 'Service quota exceeded. Please try again later.' }),
          {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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
    console.error('Invoice OCR function error', {
      error: error.message,
      stack: error.stack,
    });

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to process invoice image'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
