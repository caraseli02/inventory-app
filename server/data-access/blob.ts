import { put } from '@vercel/blob';
import type { H3Event } from 'h3';
import { useRuntimeConfig } from '#imports';

/**
 * Loads Blob configuration from Nuxt runtime config, falling back to environment variables.
 */
const getBlobToken = (event: H3Event): string | undefined => {
  const runtimeConfig = useRuntimeConfig(event) as { blob?: { readWriteToken?: string } };
  return runtimeConfig?.blob?.readWriteToken || process.env.BLOB_READ_WRITE_TOKEN;
};

export const uploadBlobImage = async (
  event: H3Event,
  filename: string,
  buffer: Buffer,
  contentType: string,
) => {
  const token = getBlobToken(event);

  return put(filename, buffer, {
    access: 'public',
    contentType,
    token,
  });
};
