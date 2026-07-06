/**
 * Product scraping API route.
 *
 * POST /api/scrape
 *
 * Accepts a Luxemia product URL, fetches the page, and extracts
 * product metadata (title, description, price, image URL) using Cheerio.
 *
 * Only URLs containing "luxemia.shop" are accepted for security.
 */

import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import type { ProductInfo, ScrapeRequestBody } from "@/lib/types";

/** Allowed domain for scraping */
const ALLOWED_DOMAIN = "luxemia.shop";

/**
 * Validate that a URL belongs to the allowed domain.
 *
 * @param url - The URL string to validate
 * @returns true if the URL contains the allowed domain
 */
function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === ALLOWED_DOMAIN || parsed.hostname.endsWith(`.${ALLOWED_DOMAIN}`);
  } catch {
    return false;
  }
}

/**
 * Extract product information from HTML using Cheerio selectors.
 *
 * Attempts multiple selector strategies to handle different
 * Shopify theme structures.
 *
 * @param html - The raw HTML string of the product page
 * @param pageUrl - The original URL of the product page
 * @returns Extracted product information
 */
function extractProductInfo(html: string, pageUrl: string): ProductInfo {
  const $ = cheerio.load(html);

  // Try multiple selector strategies for each field

  // --- Title ---
  const title =
    $('meta[property="og:title"]').attr("content") ??
    $("h1.product-title").first().text().trim() ??
    $("h1").first().text().trim() ??
    $("title").text().trim() ??
    "Unknown Product";

  // --- Description ---
  let description =
    $('meta[property="og:description"]').attr("content") ??
    $('meta[name="description"]').attr("content") ??
    $(".product-description").first().text().trim() ??
    $("[data-product-description]").first().text().trim() ??
    "";

  // Clean up description — remove extra whitespace
  description = description.replace(/\s+/g, " ").trim();

  // --- Price ---
  let price =
    $(".price").first().text().trim() ??
    $(".product-price").first().text().trim() ??
    $("[data-product-price]").first().text().trim() ??
    $(".current-price").first().text().trim() ??
    "";

  // Try extracting from JSON-LD if still no price
  if (!price) {
    const jsonLdScripts = $("script[type='application/ld+json']");
    jsonLdScripts.each((_, el) => {
      try {
        const data = JSON.parse($(el).text() ?? "{}");
        if (data["@type"] === "Product" && data.offers?.price) {
          price = `$${data.offers.price}`;
          return false; // break
        }
      } catch {
        // ignore malformed JSON-LD
      }
    });
  }

  // --- Image URL ---
  let imageUrl =
    $('meta[property="og:image"]').attr("content") ??
    $(".product-image img").first().attr("src") ??
    $("[data-product-image] img").first().attr("src") ??
    $(".main-image img").first().attr("src") ??
    "";

  // Ensure image URL is absolute
  if (imageUrl && imageUrl.startsWith("/")) {
    const base = new URL(pageUrl);
    imageUrl = `${base.origin}${imageUrl}`;
  }

  // Fallback: try JSON-LD for image
  if (!imageUrl) {
    const jsonLdScripts = $("script[type='application/ld+json']");
    jsonLdScripts.each((_, el) => {
      try {
        const data = JSON.parse($(el).text() ?? "{}");
        if (data["@type"] === "Product" && data.image) {
          imageUrl = Array.isArray(data.image) ? data.image[0] : data.image;
          return false; // break
        }
      } catch {
        // ignore malformed JSON-LD
      }
    });
  }

  return {
    title,
    description,
    price,
    imageUrl,
    url: pageUrl,
  };
}

/**
 * POST handler for /api/scrape
 *
 * Body: { url: string }
 *
 * Validates the URL belongs to luxemia.shop, fetches the page,
 * extracts product data, and returns it.
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse> {
  try {
    const body = (await request.json()) as ScrapeRequestBody;
    const { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { success: false, error: "URL is required and must be a string." },
        { status: 400 }
      );
    }

    // Security: only allow scraping from the Luxemia domain
    if (!isAllowedUrl(url)) {
      return NextResponse.json(
        {
          success: false,
          error: `Only URLs from "${ALLOWED_DOMAIN}" are allowed.`,
        },
        { status: 403 }
      );
    }

    // Fetch the product page
    const pageRes = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.0",
      },
      // Add a timeout via AbortController
      signal: AbortSignal.timeout(15000),
    });

    if (!pageRes.ok) {
      return NextResponse.json(
        {
          success: false,
          error: `Failed to fetch product page: ${pageRes.status} ${pageRes.statusText}`,
        },
        { status: 502 }
      );
    }

    const html = await pageRes.text();

    if (!html || html.length < 100) {
      return NextResponse.json(
        { success: false, error: "Product page returned empty content." },
        { status: 502 }
      );
    }

    // Extract product information
    const product = extractProductInfo(html, url);

    // Validate we got at least a title
    if (!product.title || product.title === "Unknown Product") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Could not extract product information from the page. " +
            "The page structure may have changed.",
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      product,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[SCRAPE] Error scraping product:", message);

    return NextResponse.json(
      { success: false, error: `Scraping failed: ${message}` },
      { status: 500 }
    );
  }
}
