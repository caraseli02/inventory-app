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
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      console.error('OpenAI API key not configured');
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

    // Call OpenAI API
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
    });

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
        return new Response(
          JSON.stringify({ error: 'API rate limit exceeded. Please try again later.' }),
          {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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

    if (!content) {
      console.error('No response from OpenAI API', {
        resultChoices: result.choices?.length,
      });
      return new Response(
        JSON.stringify({ error: 'No response from AI service' }),
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
        error: error.message,
        responsePreview: jsonText.substring(0, 200),
      });
      return new Response(
        JSON.stringify({ error: 'Failed to parse AI response. The invoice format may be unsupported.' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Validate and clean data
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
    console.error('Invoice parse function error', {
      error: error.message,
      stack: error.stack,
    });

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to parse invoice text'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
