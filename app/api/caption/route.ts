/**
 * AI Caption Generation API route.
 *
 * POST /api/caption
 *
 * Accepts product information and a list of target platforms,
 * then uses OpenAI to generate platform-optimized captions.
 *
 * @see lib/ai.ts for the caption generation implementation
 */

import { NextRequest, NextResponse } from "next/server";
import { generateCaptionsForPlatforms } from "@/lib/ai";
import type { CaptionRequestBody, Platform } from "@/lib/types";

/**
 * POST handler for /api/caption
 *
 * Body: { product: ProductInfo, platforms: string[] }
 *
 * Generates tailored captions for each requested platform using
 * OpenAI GPT-4o-mini with platform-specific prompting rules.
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse> {
  try {
    const body = (await request.json()) as CaptionRequestBody;
    const { product, platforms } = body;

    // Validate product data
    if (!product || !product.title) {
      return NextResponse.json(
        { success: false, error: "Product data with a title is required." },
        { status: 400 }
      );
    }

    // Validate platforms
    if (!Array.isArray(platforms) || platforms.length === 0) {
      return NextResponse.json(
        { success: false, error: "At least one platform must be specified." },
        { status: 400 }
      );
    }

    // Validate all platforms are supported
    const validPlatforms: Platform[] = ["instagram", "facebook", "tiktok", "pinterest"];
    const invalidPlatforms = platforms.filter(
      (p) => !validPlatforms.includes(p as Platform)
    );

    if (invalidPlatforms.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported platforms: ${invalidPlatforms.join(", ")}. ` +
            `Supported: ${validPlatforms.join(", ")}.`,
        },
        { status: 400 }
      );
    }

    // Generate captions for all platforms in parallel
    const captions = await generateCaptionsForPlatforms(
      product,
      platforms as Platform[]
    );

    return NextResponse.json({
      success: true,
      captions,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[CAPTION] Error generating captions:", message);

    return NextResponse.json(
      { success: false, error: `Caption generation failed: ${message}` },
      { status: 500 }
    );
  }
}
