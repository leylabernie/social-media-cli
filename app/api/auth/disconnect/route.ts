/**
 * @fileoverview Disconnect (logout) route for social media platforms.
 * Removes the stored OAuth token for the specified platform from Vercel KV,
 * effectively disconnecting the user's account.
 *
 * @route POST /api/auth/disconnect
 * @body { platform: string }
 */

import { removeToken } from '@/lib/kv';
import type { Platform } from '@/lib/types';

/** Supported platforms that can be disconnected */
const VALID_PLATFORMS: Platform[] = ['instagram', 'facebook', 'tiktok', 'pinterest'];

/**
 * Request body for the disconnect endpoint.
 */
interface DisconnectRequestBody {
  /** The social media platform to disconnect */
  platform: string;
}

/**
 * POST handler - Disconnects a social media platform by removing its stored token.
 *
 * @param {Request} request - The incoming HTTP request with platform in body
 * @returns {Response} JSON response indicating success or failure
 *
 * @example
 * // Request body:
 * // { "platform": "instagram" }
 *
 * // Success response (200):
 * // { "success": true, "message": "instagram disconnected successfully" }
 *
 * // Error response (400):
 * // { "success": false, "error": "Invalid platform" }
 */
export async function POST(request: Request): Promise<Response> {
  try {
    // Parse request body
    let body: DisconnectRequestBody;
    try {
      body = (await request.json()) as DisconnectRequestBody;
    } catch {
      return Response.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const { platform } = body;

    // Validate platform
    if (!platform || typeof platform !== 'string') {
      return Response.json(
        { success: false, error: 'Platform is required' },
        { status: 400 }
      );
    }

    if (!VALID_PLATFORMS.includes(platform as Platform)) {
      return Response.json(
        {
          success: false,
          error: `Invalid platform. Must be one of: ${VALID_PLATFORMS.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Remove token from KV
    await removeToken(platform);
    console.log(`[Disconnect] Successfully disconnected ${platform}`);

    return Response.json(
      {
        success: true,
        message: `${platform} disconnected successfully`,
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Disconnect] Error:', errorMessage);
    return Response.json(
      { success: false, error: 'Failed to disconnect account' },
      { status: 500 }
    );
  }
}
