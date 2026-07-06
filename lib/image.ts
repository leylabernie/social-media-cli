/**
 * @file Image processing module using Sharp.
 * Downloads product images and resizes them per-platform specifications.
 * Returns a Buffer for serverless compatibility (no persistent filesystem).
 * @module @/lib/image
 */

import sharp from 'sharp';

/** Platform-specific image dimensions */
const PLATFORM_SIZES: Record<string, { width: number; height: number }> = {
  x: { width: 1200, height: 675 },
  instagram: { width: 1080, height: 1350 },
  facebook: { width: 1200, height: 630 },
  pinterest: { width: 1000, height: 1500 },
  linkedin: { width: 1200, height: 627 },
};

/** Request timeout in milliseconds */
const FETCH_TIMEOUT_MS = 30000;

/**
 * Download an image from a URL into a Buffer.
 * @param url - Image URL
 * @returns Buffer containing the image data
 * @throws Error if download fails
 */
async function downloadImage(url: string): Promise<Buffer> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        Referer: 'https://luxemia.shop/',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (err) {
    clearTimeout(timeout);
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to download image: ${message}`);
  }
}

/**
 * Process (download + resize) an image for a specific platform.
 * Returns a Buffer instead of a file path for serverless compatibility.
 * @param sourceUrl - URL of the source image
 * @param platform - Platform identifier (x, instagram, facebook, pinterest, linkedin)
 * @returns Buffer containing the processed JPEG image
 * @throws Error if the platform is unsupported or processing fails
 */
export async function processImage(sourceUrl: string, platform: string): Promise<Buffer> {
  const size = PLATFORM_SIZES[platform];
  if (!size) {
    throw new Error(`No image size config for platform: ${platform}`);
  }

  console.log(`[Image] Processing image for ${platform} (${size.width}x${size.height})...`);

  try {
    const buffer = await downloadImage(sourceUrl);

    const processed = await sharp(buffer)
      .resize(size.width, size.height, {
        fit: 'cover',
        position: 'center',
      })
      .jpeg({ quality: 90, progressive: true })
      .toBuffer();

    console.log(`[Image] Processed image for ${platform} (${processed.length} bytes)`);
    return processed;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Image] Image processing failed for ${platform}: ${message}`);
    throw new Error(`Failed to process image for ${platform}: ${message}`);
  }
}
