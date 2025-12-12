/**
 * Image upload service
 *
 * Production: Uses Vercel Blob storage via /api/upload
 * Development fallback: Uses imgbb.com (free image hosting)
 *
 * Converts base64 data URLs to actual URLs that Airtable can fetch
 */

const IMGBB_API_KEY = import.meta.env.VITE_IMGBB_API_KEY;

/**
 * Check if a string is a base64 data URL
 */
export function isDataUrl(url: string): boolean {
  return url.startsWith('data:');
}

/**
 * Upload image to Vercel Blob via serverless function
 * Used in production on Vercel
 */
async function uploadToVercelBlob(imageDataUrl: string): Promise<string> {
  const response = await fetch('/api/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ image: imageDataUrl }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(error.error || `Upload failed: ${response.status}`);
  }

  const result = await response.json();
  if (!result.url) {
    throw new Error('Upload failed: No URL returned');
  }

  return result.url;
}

/**
 * Upload image to imgbb.com (fallback for development)
 */
async function uploadToImgbb(imageDataUrl: string): Promise<string> {
  if (!IMGBB_API_KEY) {
    throw new Error(
      'Image upload not configured. In development, add VITE_IMGBB_API_KEY to .env. ' +
      'In production on Vercel, add BLOB_READ_WRITE_TOKEN.'
    );
  }

  // Extract base64 data from data URL
  const base64Data = imageDataUrl.split(',')[1];
  if (!base64Data) {
    throw new Error('Invalid image data');
  }

  // Upload to imgbb
  const formData = new FormData();
  formData.append('image', base64Data);

  const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Image upload failed: ${errorText}`);
  }

  const result = await response.json();

  if (!result.success || !result.data?.url) {
    throw new Error('Image upload failed: Invalid response');
  }

  return result.data.url;
}

/**
 * Upload a base64 image and return the URL
 *
 * Strategy:
 * 1. Try Vercel Blob first (works in production)
 * 2. Fall back to imgbb (works in development)
 *
 * @param imageUrl - Base64 data URL or regular URL
 * @returns Public URL for the image
 */
export async function uploadImage(imageUrl: string): Promise<string> {
  // If not a data URL, return as-is (already a URL)
  if (!isDataUrl(imageUrl)) {
    return imageUrl;
  }

  try {
    // Try Vercel Blob first (production)
    return await uploadToVercelBlob(imageUrl);
  } catch (vercelError) {
    console.log('Vercel Blob upload failed, trying imgbb fallback:', vercelError);

    try {
      // Fall back to imgbb (development)
      return await uploadToImgbb(imageUrl);
    } catch (imgbbError) {
      console.error('All image upload methods failed:', { vercelError, imgbbError });
      throw new Error(
        'Image upload failed. ' +
        'In production, ensure BLOB_READ_WRITE_TOKEN is set. ' +
        'In development, ensure VITE_IMGBB_API_KEY is set.'
      );
    }
  }
}
