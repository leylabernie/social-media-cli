/**
 * @file API Route - GET /api/status
 * Returns authentication status for all configured social media platforms
 * by checking for stored session cookies in KV storage.
 * @module @/api/status/route
 */

import { getCookies } from '@/lib/kv-store';
import type { PlatformStatus } from '@/lib/types';

/** All supported platforms with their human-readable display names */
const PLATFORMS: { platform: string; displayName: string }[] = [
  { platform: 'x', displayName: 'X (Twitter)' },
  { platform: 'instagram', displayName: 'Instagram' },
  { platform: 'facebook', displayName: 'Facebook' },
  { platform: 'pinterest', displayName: 'Pinterest' },
  { platform: 'linkedin', displayName: 'LinkedIn' },
];

/**
 * GET handler for /api/status
 * Checks each platform for stored authentication cookies.
 * @returns JSON response with platform status array
 */
export async function GET(): Promise<Response> {
  try {
    const now = new Date().toISOString();

    // Check cookies for all platforms in parallel
    const statusPromises = PLATFORMS.map(
      async ({ platform, displayName }): Promise<PlatformStatus> => {
        try {
          const cookies = await getCookies(platform);
          const hasCookies = Object.keys(cookies).length > 0;

          return {
            platform,
            displayName,
            authenticated: hasCookies,
            lastCheck: now,
          };
        } catch {
          // If checking one platform fails, still report it as unauthenticated
          return {
            platform,
            displayName,
            authenticated: false,
            lastCheck: now,
          };
        }
      }
    );

    const platforms = await Promise.all(statusPromises);

    return Response.json({
      success: true,
      platforms,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error occurred';
    console.error('[API /status] Error:', message);
    return Response.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
