import { createError, defineEventHandler, readBody } from 'h3';
import { uploadBlobImage } from '../data-access/blob';

interface UploadRequestBody {
  image?: string;
  filename?: string;
}

export default defineEventHandler(async (event) => {
  if (event.node.req.method !== 'POST') {
    throw createError({ statusCode: 405, statusMessage: 'Method not allowed' });
  }

  const { image, filename } = (await readBody<UploadRequestBody>(event)) || {};

  if (!image) {
    throw createError({ statusCode: 400, statusMessage: 'No image provided' });
  }

  if (!image.startsWith('data:image/')) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid image format. Expected base64 data URL.',
    });
  }

  const matches = image.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!matches) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid base64 image format' });
  }

  const [, mimeType, base64Data] = matches;
  const buffer = Buffer.from(base64Data, 'base64');

  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 8);
  const finalFilename = filename || `product-${timestamp}-${randomId}.${mimeType === 'jpeg' ? 'jpg' : mimeType}`;

  try {
    const blob = await uploadBlobImage(event, finalFilename, buffer, `image/${mimeType}`);
    return { url: blob.url };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[UPLOAD_ERROR]', {
      error: message,
      errorStack: error instanceof Error ? error.stack : undefined,
      filename: finalFilename,
      contentType: `image/${mimeType}`,
      timestamp: new Date().toISOString(),
    });
    throw createError({ statusCode: 500, statusMessage: `Upload failed: ${message}` });
  }
});
