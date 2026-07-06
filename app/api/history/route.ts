/**
 * @file API Route - GET /api/history
 * Returns the most recent post records from KV storage.
 * @module @/api/history/route
 */

import { getPosts } from '@/lib/kv-store';
import type { PostRecord } from '@/lib/types';

/** Default number of posts to return */
const DEFAULT_LIMIT = 20;
/** Maximum allowed limit to prevent abuse */
const MAX_LIMIT = 100;

/**
 * GET handler for /api/history
 * Returns the last N post records, most recent first.
 * @param request - The incoming HTTP request (supports ?limit=N query param)
 * @returns JSON response with posts array
 */
export async function GET(request: Request): Promise<Response> {
  try {
    // Parse the limit from query params
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    let limit = DEFAULT_LIMIT;

    if (limitParam !== null) {
      const parsed = parseInt(limitParam, 10);
      if (!isNaN(parsed) && parsed > 0) {
        limit = Math.min(parsed, MAX_LIMIT);
      }
    }

    // Fetch posts from KV storage
    const posts: PostRecord[] = await getPosts(limit);

    return Response.json({
      success: true,
      posts,
      count: posts.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error occurred';
    console.error('[API /history] Error:', message);
    return Response.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
