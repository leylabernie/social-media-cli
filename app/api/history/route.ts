/**
 * Post History API route.
 *
 * GET /api/history
 *
 * Returns recent post history entries from Vercel KV.
 * Each entry includes the product, platforms posted to, and results.
 *
 * Query params:
 *   - limit: Maximum number of entries (default 20, max 50)
 */

import { NextRequest, NextResponse } from "next/server";
import { getHistory } from "@/lib/kv";

/**
 * GET handler for /api/history
 *
 * Returns the most recent post history entries, newest first.
 * Supports an optional `limit` query parameter.
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse> {
  try {
    // Parse optional limit from query params
    const { searchParams } = new URL(request.url);
    const rawLimit = searchParams.get("limit");

    let limit = 20;
    if (rawLimit) {
      const parsed = parseInt(rawLimit, 10);
      if (!isNaN(parsed) && parsed > 0) {
        limit = Math.min(parsed, 50); // cap at 50
      }
    }

    // Fetch history from KV
    const entries = await getHistory(limit);

    return NextResponse.json({
      success: true,
      entries,
      count: entries.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[HISTORY] Error fetching history:", message);

    return NextResponse.json(
      { success: false, error: `Failed to fetch history: ${message}` },
      { status: 500 }
    );
  }
}
