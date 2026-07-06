/**
 * @file API Route - POST /api/caption
 * Generates platform-optimized captions for a product using OpenAI.
 * @module @/api/caption/route
 */

import { generateCaption } from '@/lib/ai';
import type { ProductInfo, CaptionResult } from '@/lib/types';

/** Supported social media platforms */
const SUPPORTED_PLATFORMS = ['x', 'instagram', 'facebook', 'pinterest', 'linkedin'];

/**
 * POST handler for /api/caption
 * Generates captions for the specified platforms in parallel.
 * @param request - The incoming HTTP request with JSON body { product: ProductInfo, platforms: string[] }
 * @returns JSON response with generated captions or error details
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const { product, platforms } = body;

    // Validate request body
    if (!product || typeof product !== 'object') {
      return Response.json(
        { success: false, error: 'Missing or invalid "product" field in request body' },
        { status: 400 }
      );
    }

    if (!Array.isArray(platforms) || platforms.length === 0) {
      return Response.json(
        { success: false, error: 'Missing or empty "platforms" array in request body' },
        { status: 400 }
      );
    }

    // Validate all requested platforms are supported
    const invalidPlatforms = platforms.filter(
      (p: string) => !SUPPORTED_PLATFORMS.includes(p)
    );
    if (invalidPlatforms.length > 0) {
      return Response.json(
        { success: false, error: `Unsupported platforms: ${invalidPlatforms.join(', ')}` },
        { status: 400 }
      );
    }

    // Generate captions for all platforms in parallel
    const captionPromises = platforms.map(async (platform: string): Promise<CaptionResult> => {
      try {
        const caption = await generateCaption(product as ProductInfo, platform);
        return { platform, caption };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Caption generation failed';
        console.error(`[API /caption] Failed for ${platform}:`, message);
        return { platform, caption: `Error: ${message}` };
      }
    });

    const captions = await Promise.all(captionPromises);

    return Response.json({
      success: true,
      captions,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error occurred';
    console.error('[API /caption] Error:', message);
    return Response.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
