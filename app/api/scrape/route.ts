/**
 * @file API Route - POST /api/scrape
 * Scrapes product information from a luxemia.shop product URL.
 * @module @/api/scrape/route
 */

import { scrapeProduct } from '@/lib/scraper';
import type { ProductInfo } from '@/lib/types';

/**
 * POST handler for /api/scrape
 * Accepts a product URL, validates it's from luxemia.shop, and returns scraped product info.
 * @param request - The incoming HTTP request with JSON body { url: string }
 * @returns JSON response with scraped product data or error details
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const { url } = body;

    // Validate URL presence
    if (!url || typeof url !== 'string') {
      return Response.json(
        { success: false, error: 'Missing or invalid "url" field in request body' },
        { status: 400 }
      );
    }

    // Validate it's a luxemia.shop URL (also validated inside scrapeProduct, but check early)
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return Response.json(
        { success: false, error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    if (!parsed.hostname.endsWith('luxemia.shop')) {
      return Response.json(
        { success: false, error: 'URL must be from luxemia.shop domain' },
        { status: 400 }
      );
    }

    // Scrape the product page
    const product: ProductInfo = await scrapeProduct(url);

    return Response.json({
      success: true,
      product,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error occurred';
    console.error('[API /scrape] Error:', message);
    return Response.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
