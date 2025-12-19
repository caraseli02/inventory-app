/**
 * Supabase Edge Function: invoice-parse
 *
 * Parses OCR text into structured invoice data using OpenAI GPT-4o mini
 * This keeps the API key secure on the server side
 *
 * POST /functions/v1/invoice-parse
 * Body: { ocrText: string } - Extracted text from invoice
 * Returns: InvoiceData or { error: string }
 */

import { corsHeaders, handleCorsPreFlight } from '../_shared/cors.ts';

interface InvoiceProduct {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  barcode?: string | null;
}

interface RawInvoiceData {
  supplier?: string | null;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  totalAmount?: number | null;
  products?: InvoiceProduct[];
}

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
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      console.error('OpenAI API key not configured', {
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
    const { ocrText } = await req.json();

    if (!ocrText) {
      return new Response(
        JSON.stringify({ error: 'Missing ocrText in request body' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Starting AI-powered invoice parsing', {
      requestId,
      ocrTextLength: ocrText.length,
      timestamp: new Date().toISOString(),
    });

    const prompt = `You are an invoice data extraction assistant. Extract the following information from this invoice OCR text:

1. Supplier name (if present)
2. Invoice number (if present)
3. Invoice date (if present, in YYYY-MM-DD format)
4. All products/line items with:
   - Product name
   - Quantity (as a number)
   - Unit price (as a number, in euros)
   - Total price (as a number, in euros)
   - Barcode (if present, usually 8-13 digits)

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "supplier": "string or null",
  "invoiceNumber": "string or null",
  "invoiceDate": "YYYY-MM-DD or null",
  "totalAmount": number or null,
  "products": [
    {
      "name": "string",
      "quantity": number,
      "unitPrice": number,
      "totalPrice": number,
      "barcode": "string or null"
    }
  ]
}

Important:
- Product name is REQUIRED (skip rows without a product name)
- If quantity is missing, use 1
- If prices are missing, use 0
- Extract all line items, not just the first few
- Remove any VAT/tax line items
- Barcodes are usually EAN-13 (13 digits) or UPC (12 digits)

Invoice OCR Text:
${ocrText}`;

    // Call OpenAI API with timeout
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a precise invoice data extraction assistant. Always return valid JSON only, no markdown or explanations.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0, // Deterministic output
        max_tokens: 2000,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || `OpenAI API error: ${openaiResponse.statusText}`;

      console.error('OpenAI API error', {
        status: openaiResponse.status,
        statusText: openaiResponse.statusText,
        error: errorData,
      });

      // Map specific error codes to user-friendly messages
      if (openaiResponse.status === 401) {
        return new Response(
          JSON.stringify({ error: 'API authentication failed. Please contact support.' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
      if (openaiResponse.status === 429) {
        const retryAfter = openaiResponse.headers.get('Retry-After');
        const errorMessage = retryAfter
          ? `API rate limit exceeded. Please try again in ${retryAfter} seconds.`
          : 'API rate limit exceeded. Please try again in a few minutes.';

        console.warn('Rate limit hit for OpenAI API', {
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
          status: openaiResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const result = await openaiResponse.json();
    const content = result.choices[0]?.message?.content;

    // Check for empty or missing content
    if (!content || content.trim().length === 0) {
      console.error('Empty or missing response from OpenAI API', {
        requestId,
        resultChoices: result.choices?.length,
        contentLength: content?.length,
        timestamp: new Date().toISOString(),
      });
      return new Response(
        JSON.stringify({ error: 'The AI service returned an empty response. The invoice text may be unreadable or the service is experiencing issues.' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Parse JSON response (remove markdown code blocks if present)
    const jsonText = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let invoiceData: RawInvoiceData;
    try {
      invoiceData = JSON.parse(jsonText);
    } catch (error) {
      console.error('Failed to parse OpenAI JSON response', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
        responseLength: jsonText.length,
        responsePreview: jsonText.substring(0, 200),
        responseFull: jsonText.length < 5000 ? jsonText : jsonText.substring(0, 5000) + '... (truncated)',
        timestamp: new Date().toISOString(),
      });
      return new Response(
        JSON.stringify({ error: 'The AI service returned an invalid response. This may indicate the invoice format is unsupported or the image quality is too low. Please try a clearer image or contact support.' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Validate and clean data
    // Convert null to undefined to match TypeScript InvoiceData type expectations
    // Filter out products without names and normalize numeric values
    const cleanedData = {
      supplier: invoiceData.supplier || undefined,
      invoiceNumber: invoiceData.invoiceNumber || undefined,
      invoiceDate: invoiceData.invoiceDate || undefined,
      totalAmount: invoiceData.totalAmount || undefined,
      products: (invoiceData.products || [])
        .filter((p: InvoiceProduct) => p.name?.trim())
        .map((p: InvoiceProduct) => ({
          name: p.name.trim(),
          quantity: Number(p.quantity) || 1,
          unitPrice: Number(p.unitPrice) || 0,
          totalPrice: Number(p.totalPrice) || 0,
          barcode: p.barcode || undefined,
        })),
    };

    console.log('Invoice parsing completed successfully', {
      productCount: cleanedData.products.length,
      hasSupplier: !!cleanedData.supplier,
      hasInvoiceNumber: !!cleanedData.invoiceNumber,
      timestamp: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify(cleanedData),
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
    console.error('Invoice parse function error', {
      requestId,
      errorName: error?.constructor?.name,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      requestDuration: Date.now() - requestStart,
      timestamp: new Date().toISOString(),
    });

    // Handle timeout errors
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('OpenAI API timeout', {
        requestId,
        timeout: 30000,
        timestamp: new Date().toISOString(),
      });
      return new Response(
        JSON.stringify({ error: 'AI parsing service timeout. The invoice text may be too long or the service is slow. Please try again.' }),
        { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return new Response(
        JSON.stringify({ error: 'Network error: Unable to reach OpenAI API. Please try again.' }),
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
