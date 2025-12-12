/**
 * Image upload service using imgbb.com (free image hosting)
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
 * Upload a base64 image to imgbb and return the URL
 * Falls back to returning the original URL if upload fails or no API key
 */
export async function uploadImage(imageUrl: string): Promise<string> {
  // If not a data URL, return as-is
  if (!isDataUrl(imageUrl)) {
    return imageUrl;
  }

  // If no API key configured, throw error with instructions
  if (!IMGBB_API_KEY) {
    throw new Error(
      'Image upload not configured. Please add VITE_IMGBB_API_KEY to your .env file. ' +
      'Get a free API key at https://api.imgbb.com/'
    );
  }

  try {
    // Extract base64 data from data URL
    const base64Data = imageUrl.split(',')[1];
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
  } catch (error) {
    console.error('Image upload error:', error);
    throw error;
  }
}
