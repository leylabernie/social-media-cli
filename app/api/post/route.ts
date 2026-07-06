/**
 * Main posting API route.
 *
 * POST /api/post
 *
 * Accepts a product, list of platforms, and caption, then posts
 * to all selected social media platforms in parallel.
 * Results are stored in KV for history tracking.
 *
 * @see lib/platforms/ for individual platform implementations
 */

import { NextRequest, NextResponse } from "next/server";
import { postToInstagram } from "@/lib/platforms/instagram";
import { postToFacebook } from "@/lib/platforms/facebook";
import { postToTiktok } from "@/lib/platforms/tiktok";
import { postToPinterest } from "@/lib/platforms/pinterest";
import { addHistoryEntry } from "@/lib/kv";
import type {
  ProductInfo,
  Platform,
  PostResult,
  PostRequestBody,
  HistoryEntry,
} from "@/lib/types";

/**
 * Map of platform names to their posting handler functions.
 * Each handler accepts a caption and image URL, returning a post URL.
 */
const PLATFORM_HANDLERS: Record<
  string,
  (caption: string, imageUrl: string, product: ProductInfo) => Promise<string>
> = {
  instagram: (caption: string, imageUrl: string) =>
    postToInstagram(caption, imageUrl),

  facebook: (caption: string, imageUrl: string) =>
    postToFacebook(caption, imageUrl),

  pinterest: (caption: string, imageUrl: string, product: ProductInfo) =>
    postToPinterest(product.title, caption, imageUrl, product.url),

  // TikTok is handled separately since it requires video
};

/**
 * POST handler for /api/post
 *
 * Body: { product: ProductInfo, platforms: string[], caption: string }
 *
 * Posts to all requested platforms in parallel using Promise.allSettled,
 * stores results in KV history, and returns per-platform outcomes.
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse> {
  try {
    // Parse and validate request body
    const body = (await request.json()) as PostRequestBody;
    const { product, platforms, caption } = body;

    if (!product || !product.imageUrl || !product.url) {
      return NextResponse.json(
        { success: false, error: "Invalid product data. 'imageUrl' and 'url' are required." },
        { status: 400 }
      );
    }

    if (!Array.isArray(platforms) || platforms.length === 0) {
      return NextResponse.json(
        { success: false, error: "At least one platform must be specified." },
        { status: 400 }
      );
    }

    if (!caption || caption.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Caption is required." },
        { status: 400 }
      );
    }

    const results: PostResult[] = [];

    // Build posting tasks — handle TikTok separately
    const tasks = platforms.map(async (platform): Promise<PostResult> => {
      const startTime = Date.now();

      try {
        let postUrl: string;

        if (platform === "tiktok") {
          // TikTok only supports video content
          return {
            platform,
            status: "error",
            message:
              "TikTok requires video content. Image posting is not supported. " +
              "Please provide a video URL or use a different platform for images.",
          };
        }

        const handler = PLATFORM_HANDLERS[platform];
        if (!handler) {
          return {
            platform,
            status: "error",
            message: `Unsupported platform: "${platform}".`,
          };
        }

        postUrl = await handler(caption, product.imageUrl, product);

        const duration = Date.now() - startTime;
        console.log(`[POST] ${platform} posted in ${duration}ms: ${postUrl}`);

        return {
          platform,
          status: "success",
          url: postUrl,
          postId: postUrl.split("/").pop(),
        };
      } catch (error) {
        const duration = Date.now() - startTime;
        const message =
          error instanceof Error ? error.message : "Unknown error";

        console.error(`[POST] ${platform} failed after ${duration}ms: ${message}`);

        return {
          platform,
          status: "error",
          message,
        };
      }
    });

    // Execute all platform posts in parallel
    const settled = await Promise.allSettled(tasks);

    for (const result of settled) {
      if (result.status === "fulfilled") {
        results.push(result.value);
      } else {
        results.push({
          platform: "unknown",
          status: "error",
          message: result.reason?.message ?? String(result.reason),
        });
      }
    }

    // Store results in KV history
    const historyEntry: HistoryEntry = {
      id: `post_${Date.now()}`,
      timestamp: new Date().toISOString(),
      product,
      platforms: platforms as Platform[],
      results,
    };

    try {
      await addHistoryEntry(historyEntry);
    } catch (historyError) {
      console.warn(
        "[POST] Failed to store history entry:",
        historyError instanceof Error ? historyError.message : historyError
      );
      // Non-fatal: don't fail the request if history storage fails
    }

    const successCount = results.filter((r) => r.status === "success").length;

    return NextResponse.json({
      success: successCount > 0,
      results,
      summary: {
        total: platforms.length,
        succeeded: successCount,
        failed: platforms.length - successCount,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[POST] Unhandled error in /api/post:", message);

    return NextResponse.json(
      { success: false, error: `Internal server error: ${message}` },
      { status: 500 }
    );
  }
}
