/**
 * @file Image processing module using Sharp.
 * Downloads product images and resizes them per-platform specifications.
 * @module luxemia-social/image/processor
 */

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { info, debug, error } from '../utils/logger.js';

/** Platform-specific image dimensions */
const PLATFORM_SIZES: Record<string, { width: number; height: number }> = {
  x: { width: 1200, height: 675 },
  instagram: { width: 1080, height: 1350 },
  facebook: { width: 1200, height: 630 },
  pinterest: { width: 1000, height: 1500 },
  linkedin: { width: 1200, height: 627 },
};

/** Cache directory for processed images */
const CACHE_DIR = path.resolve(process.cwd(), '.cache', 'images');

/** Request timeout in milliseconds */
const FETCH_TIMEOUT_MS = 30000;

/**
 * Ensure the image cache directory exists.
 */
function ensureCacheDir(): void {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

/**
 * Download an image from a URL to a temporary buffer.
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

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.startsWith('image/') && contentType !== 'application/octet-stream') {
      debug(`Unexpected content type: ${contentType}`);
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
 * @param sourceUrl - URL of the source image
 * @param platform - Platform identifier (x, instagram, facebook, pinterest, linkedin)
 * @returns Absolute file path to the processed image
 * @throws Error if processing fails
 */
export async function processImage(sourceUrl: string, platform: string): Promise<string> {
  const size = PLATFORM_SIZES[platform];
  if (!size) {
    throw new Error(`No image size config for platform: ${platform}`);
  }

  info(`Processing image for ${platform} (${size.width}x${size.height})...`);
  ensureCacheDir();

  const timestamp = Date.now();
  const outputPath = path.join(CACHE_DIR, `${platform}-${timestamp}.jpg`);

  try {
    const buffer = await downloadImage(sourceUrl);

    await sharp(buffer)
      .resize(size.width, size.height, {
        fit: 'cover',
        position: 'center',
      })
      .jpeg({ quality: 90, progressive: true })
      .toFile(outputPath);

    debug(`Image saved: ${outputPath}`);
    return outputPath;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    error(`Image processing failed for ${platform}: ${message}`);

    // Clean up partial file if it exists
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }

    throw new Error(`Failed to process image for ${platform}: ${message}`);
  }
}
