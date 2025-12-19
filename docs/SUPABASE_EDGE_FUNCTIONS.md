# Supabase Edge Functions Setup Guide

This guide explains how to deploy and configure the Supabase Edge Functions used for invoice OCR processing.

## Overview

The app uses two Supabase Edge Functions to securely process invoices:

1. **invoice-ocr** - Extracts text from invoice images using Google Cloud Vision API
2. **invoice-parse** - Parses OCR text into structured data using OpenAI GPT-4o mini

**Why Edge Functions?**
- ✅ **Security**: API keys are kept server-side and never exposed to clients
- ✅ **Cost-effective**: ~$0.001 per invoice processed
- ✅ **Scalable**: Runs on Deno runtime with auto-scaling
- ✅ **Fast**: Edge deployment ensures low latency globally

## Prerequisites

1. **Supabase CLI** - Use NPX (recommended, no installation needed):
   ```bash
   # No installation required! Just use npx:
   npx supabase --version
   ```

   **Alternative installation methods** (if you prefer a global install):
   ```bash
   # macOS/Linux (Homebrew)
   brew install supabase/tap/supabase

   # Windows (PowerShell)
   scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
   scoop install supabase
   ```

   **Note**: Throughout this guide, if you see `supabase` commands, you can replace them with `npx supabase`.

2. **Supabase Project** - You should already have one from the database setup
   - Project URL: `https://your-project.supabase.co`
   - Anon key: Already configured in `.env`

3. **API Keys** (required for Edge Functions):
   - Google Cloud Vision API key
   - OpenAI API key

## Step 1: Link to Your Supabase Project

```bash
# Navigate to project root
cd /path/to/inventory-app

# Login to Supabase (opens browser)
npx supabase login

# Link to your project
npx supabase link --project-ref your-project-ref

# You can find your project-ref in the Supabase dashboard URL:
# https://app.supabase.com/project/[project-ref]/...
```

## Step 2: Configure Environment Secrets

Edge Functions need access to the API keys. Set them as secrets in your Supabase project:

```bash
# Set Google Cloud Vision API key
npx supabase secrets set GOOGLE_CLOUD_VISION_API_KEY=your_google_cloud_vision_key_here

# Set OpenAI API key
npx supabase secrets set OPENAI_API_KEY=your_openai_key_here
```

**Alternative: Set via Supabase Dashboard**
1. Go to: https://app.supabase.com
2. Select your project
3. Navigate to: **Settings** → **Edge Functions** → **Secrets**
4. Add both secrets:
   - `GOOGLE_CLOUD_VISION_API_KEY`
   - `OPENAI_API_KEY`

## Step 3: Deploy Edge Functions

Deploy both functions to your Supabase project:

```bash
# Deploy invoice-ocr function
npx supabase functions deploy invoice-ocr

# Deploy invoice-parse function
npx supabase functions deploy invoice-parse
```

**Expected output:**
```
Deploying invoice-ocr (project-ref: your-project-ref)
Bundled invoice-ocr in 234ms
Deployed invoice-ocr to https://your-project.supabase.co/functions/v1/invoice-ocr
```

## Step 4: Test the Functions

Test that the functions are working correctly:

### Test invoice-ocr:

```bash
# Create a test base64 image (small 1x1 PNG)
echo "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" > /tmp/test-image-base64.txt

# Test the function
npx supabase functions invoke invoice-ocr \
  --data '{"imageBase64":"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="}'
```

### Test invoice-parse:

```bash
# Test with sample OCR text
npx supabase functions invoke invoice-parse \
  --data '{"ocrText":"Invoice #12345\nSupplier: Test Store\nProduct A - Qty: 2 - Price: €10.00\nTotal: €20.00"}'
```

**Expected responses:**
- invoice-ocr: `{"text": "..."}`
- invoice-parse: `{"products": [...], "supplier": "...", ...}`

## Step 5: Verify in the App

1. Start the dev server: `pnpm dev`
2. Navigate to the Inventory page
3. Click "Import from Invoice"
4. Upload a test invoice image (JPG/PNG)
5. Verify that OCR and parsing work correctly

## Troubleshooting

### Error: "API key not configured"

**Cause**: The secret environment variables are not set in Supabase.

**Solution**:
```bash
# Check if secrets are set
npx supabase secrets list

# If missing, set them:
npx supabase secrets set GOOGLE_CLOUD_VISION_API_KEY=your_key
npx supabase secrets set OPENAI_API_KEY=your_key

# Re-deploy functions (secrets only apply after re-deploy)
npx supabase functions deploy invoice-ocr
npx supabase functions deploy invoice-parse
```

### Error: "Failed to invoke function"

**Cause**: Edge Functions may not be enabled or deployed.

**Solution**:
1. Check if functions are deployed:
   ```bash
   npx supabase functions list
   ```
2. Re-deploy if needed:
   ```bash
   npx supabase functions deploy invoice-ocr
   npx supabase functions deploy invoice-parse
   ```

### Error: "CORS error in browser"

**Cause**: CORS headers may need adjustment for your domain.

**Solution**: Update `supabase/functions/_shared/cors.ts`:
```typescript
export const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://yourdomain.com', // Change from '*'
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```

Then re-deploy:
```bash
npx supabase functions deploy invoice-ocr
npx supabase functions deploy invoice-parse
```

### Error: "Google Cloud Vision API quota exceeded"

**Cause**: You've exceeded the free tier (1,000 pages/month).

**Solution**:
1. Check your usage in Google Cloud Console
2. Enable billing if needed (extremely cheap: $1.50/1000 pages)
3. Or wait until next month for quota reset

### Error: "OpenAI rate limit exceeded"

**Cause**: You've exceeded your OpenAI rate limit.

**Solution**:
1. Check your OpenAI usage dashboard
2. Add billing/credits if needed
3. Increase rate limits in OpenAI settings

## Local Development

You can run Edge Functions locally for testing:

```bash
# Start local Supabase (includes Edge Functions runtime)
npx supabase start

# The functions will be available at:
# http://localhost:54321/functions/v1/invoice-ocr
# http://localhost:54321/functions/v1/invoice-parse

# Set local secrets
npx supabase secrets set GOOGLE_CLOUD_VISION_API_KEY=your_key --local
npx supabase secrets set OPENAI_API_KEY=your_key --local

# Test locally
curl -X POST http://localhost:54321/functions/v1/invoice-ocr \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"imageBase64":"..."}'
```

## Cost Monitoring

Keep track of your usage to avoid unexpected costs:

### Google Cloud Vision
- **Free tier**: 1,000 pages/month (ongoing)
- **After free tier**: $1.50 per 1,000 pages
- **Monitor**: https://console.cloud.google.com/billing

### OpenAI GPT-4o mini
- **Cost**: ~$0.0001 per invoice (~$0.10 per 1,000 invoices)
- **Monitor**: https://platform.openai.com/usage

### Supabase Edge Functions
- **Free tier**: 500,000 invocations/month OR 2 million compute seconds/month
- **After free tier**: $2 per 1 million invocations
- **Monitor**: Supabase Dashboard → Usage

**Typical monthly cost for small business (100 invoices/month)**:
- Google Cloud Vision: $0 (under 1,000 pages free tier)
- OpenAI: ~$0.01 (100 invoices × $0.0001)
- Supabase Edge Functions: $0 (200 invocations under 500,000 free tier)
- **Total: ~$0.01/month** 🎉

## Security Best Practices

1. **Never commit secrets** to version control
2. **Rotate API keys** periodically (every 90 days)
3. **Restrict API keys** in provider settings:
   - Google Cloud: Restrict to Vision API only
   - OpenAI: Limit to specific models if possible
4. **Monitor usage** regularly to detect anomalies
5. **Set billing alerts** to avoid surprise costs
6. **Use CORS restrictions** in production (change from '*' to your domain)

## Deployment Checklist

Before deploying to production:

- [ ] Supabase CLI installed and logged in
- [ ] Project linked to Supabase
- [ ] Google Cloud Vision API key set as secret
- [ ] OpenAI API key set as secret
- [ ] Both Edge Functions deployed successfully
- [ ] Functions tested with sample data
- [ ] CORS headers updated for production domain
- [ ] Billing alerts configured in Google Cloud and OpenAI
- [ ] Usage monitoring set up

## Next Steps

After setting up Edge Functions:

1. **Test invoice import** with real invoices from your suppliers
2. **Adjust AI prompts** if needed (in `invoice-parse/index.ts`)
3. **Monitor costs** for the first month
4. **Update CORS** settings for production domain
5. **Set up error monitoring** (optional: integrate with Sentry)

## Additional Resources

- [Supabase Edge Functions Documentation](https://supabase.com/docs/guides/functions)
- [Google Cloud Vision API Pricing](https://cloud.google.com/vision/pricing)
- [OpenAI API Pricing](https://openai.com/api/pricing/)
- [Deno Runtime Documentation](https://deno.land/manual)

## Support

If you encounter issues:

1. Check the [Troubleshooting](#troubleshooting) section above
2. Review Supabase Edge Function logs:
   ```bash
   npx supabase functions logs invoice-ocr
   npx supabase functions logs invoice-parse
   ```
3. Check browser console for client-side errors
4. Open an issue in the project repository
