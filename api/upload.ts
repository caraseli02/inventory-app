import { put } from '@vercel/blob';
import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Vercel Serverless Function for image uploads
 * Receives base64 image data and uploads to Vercel Blob storage
 *
 * POST /api/upload
 * Body: { image: string (base64 data URL), filename?: string }
 * Returns: { url: string } or { error: string }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { image, filename } = req.body as { image?: string; filename?: string };

    if (!image) {
      return res.status(400).json({ error: 'No image provided' });
    }

    // Validate it's a data URL
    if (!image.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Invalid image format. Expected base64 data URL.' });
    }

    // Extract mime type and base64 data
    const matches = image.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({ error: 'Invalid base64 image format' });
    }

    const [, mimeType, base64Data] = matches;

    // Convert base64 to buffer
    const buffer = Buffer.from(base64Data, 'base64');

    // Generate filename
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    const finalFilename = filename || `product-${timestamp}-${randomId}.${mimeType === 'jpeg' ? 'jpg' : mimeType}`;

    // Upload to Vercel Blob
    const blob = await put(finalFilename, buffer, {
      access: 'public',
      contentType: `image/${mimeType}`,
    });

    return res.status(200).json({ url: blob.url });
  } catch (error) {
    console.error('Upload error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: `Upload failed: ${message}` });
  }
}
