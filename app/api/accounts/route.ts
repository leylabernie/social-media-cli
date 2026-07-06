/**
 * @fileoverview Connected accounts listing route.
 * Returns the connection status for all supported social media platforms,
 * including which accounts are connected and when they were connected.
 *
 * @route GET /api/accounts
 */

import { getAllTokens } from '@/lib/kv';
import type { ConnectedAccount, Platform } from '@/lib/types';

/** Human-readable display names for each platform */
const PLATFORM_DISPLAY_NAMES: Record<Platform, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  pinterest: 'Pinterest',
};

/** All supported platforms in display order */
const ALL_PLATFORMS: Platform[] = ['instagram', 'facebook', 'tiktok', 'pinterest'];

/**
 * GET handler - Retrieves the connection status of all social media platforms.
 *
 * @param {Request} _request - The incoming HTTP request
 * @returns {Response} JSON response with accounts array
 *
 * @example
 * // Success response (200):
 * // {
 * //   "accounts": [
 * //     { "platform": "instagram", "displayName": "Instagram", "connected": true, "connectedAt": "2024-01-15T10:30:00.000Z" },
 * //     { "platform": "facebook", "displayName": "Facebook", "connected": true, "connectedAt": "2024-01-15T10:31:00.000Z" },
 * //     { "platform": "tiktok", "displayName": "TikTok", "connected": false },
 * //     { "platform": "pinterest", "displayName": "Pinterest", "connected": false }
 * //   ]
 * // }
 */
export async function GET(_request: Request): Promise<Response> {
  try {
    // Fetch all stored tokens from KV
    const tokens = await getAllTokens();

    // Build response for all platforms
    const accounts: ConnectedAccount[] = ALL_PLATFORMS.map((platform) => {
      const token = tokens[platform];

      if (token) {
        return {
          platform,
          displayName: PLATFORM_DISPLAY_NAMES[platform],
          connected: true,
          connectedAt: token.connectedAt,
        };
      }

      return {
        platform,
        displayName: PLATFORM_DISPLAY_NAMES[platform],
        connected: false,
      };
    });

    return Response.json({ accounts }, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Accounts] Error retrieving accounts:', errorMessage);
    return Response.json(
      { error: 'Failed to retrieve connected accounts' },
      { status: 500 }
    );
  }
}
