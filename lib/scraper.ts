/**
 * @file Product page scraper for luxemia.shop.
 * Extracts product metadata using native fetch and Cheerio HTML parsing.
 * @module @/lib/scraper
 */

import * as cheerio from 'cheerio';
import type { ProductInfo } from '@/lib/types';

/** Valid domain for product URLs */
const ALLOWED_DOMAIN = 'luxemia.shop';

/** Request timeout in milliseconds */
const FETCH_TIMEOUT_MS = 15000;

/**
 * Validate that the given URL belongs to the allowed domain.
 * @param url - The URL to validate
 * @throws Error if the URL is not from luxemia.shop
 */
function validateUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  if (!parsed.hostname.endsWith(ALLOWED_DOMAIN)) {
    throw new Error(
      `URL must be from ${ALLOWED_DOMAIN}, got: ${parsed.hostname}`
    );
  }
}

/**
 * Extract price from JSON-LD structured data or fallback to DOM selectors.
 * @param $ - Cheerio root
 * @returns Price string or 'Unknown' if not found
 */
function extractPrice($: cheerio.CheerioAPI): string {
  // Try JSON-LD structured data first
  const jsonLd = $('script[type="application/ld+json"]').first().text();
  if (jsonLd) {
    try {
      const data = JSON.parse(jsonLd) as Record<string, unknown>;
      if (typeof data.offers === 'object' && data.offers !== null) {
        const offers = data.offers as Record<string, unknown>;
        if (typeof offers.price === 'string' || typeof offers.price === 'number') {
          const price = String(offers.price);
          const currency = typeof offers.priceCurrency === 'string' ? offers.priceCurrency : 'USD';
          return `${price} ${currency}`;
        }
      }
      if (typeof data.price === 'string' || typeof data.price === 'number') {
        return String(data.price);
      }
    } catch {
      // Ignore JSON parse errors, fall through to DOM selectors
    }
  }

  // Fallback to common DOM selectors
  const selectors = [
    '.price .amount',
    '.product-price',
    '[data-testid="product-price"]',
    '.woocommerce-Price-amount',
    '.current-price',
    '.sale-price',
    '.price',
  ];

  for (const sel of selectors) {
    const el = $(sel).first();
    const text = el.text().trim();
    if (text) return text;
  }

  return 'Unknown';
}

/**
 * Extract tags/categories from the product page.
 * @param $ - Cheerio root
 * @returns Array of tag strings
 */
function extractTags($: cheerio.CheerioAPI): string[] {
  const tags: string[] = [];

  // Try meta keywords
  const keywords = $('meta[name="keywords"]').attr('content');
  if (keywords) {
    tags.push(...keywords.split(',').map((t: string) => t.trim()).filter(Boolean));
  }

  // Try product category links
  $('.product-category a, .posted_in a, [rel="tag"]').each((_idx: number, el: cheerio.Element) => {
    const text = $(el).text().trim();
    if (text && !tags.includes(text)) {
      tags.push(text);
    }
  });

  // If no tags found, add defaults from title keywords
  if (tags.length === 0) {
    const common = ['luxury', 'fashion', 'lifestyle', 'premium'];
    return common.slice(0, 3);
  }

  return tags.slice(0, 10); // Limit to 10 tags
}

/**
 * Scrape product information from a luxemia.shop product page.
 * @param url - Full URL to the product page
 * @returns ProductInfo object with all extracted metadata
 * @throws Error if the URL is invalid or scraping fails
 */
export async function scrapeProduct(url: string): Promise<ProductInfo> {
  validateUrl(url);

  console.log(`[Scraper] Scraping product: ${url}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const title =
      $('meta[property="og:title"]').attr('content')?.trim() ||
      $('h1').first().text().trim() ||
      $('title').first().text().trim() ||
      'Untitled Product';

    const description =
      $('meta[property="og:description"]').attr('content')?.trim() ||
      $('meta[name="description"]').attr('content')?.trim() ||
      '';

    const imageUrl =
      $('meta[property="og:image"]').attr('content')?.trim() ||
      $('img.wp-post-image').first().attr('src')?.trim() ||
      $('img[data-src]').first().attr('data-src')?.trim() ||
      $('img').first().attr('src')?.trim() ||
      '';

    const price = extractPrice($);
    const tags = extractTags($);

    const product: ProductInfo = {
      title,
      description,
      price,
      url,
      imageUrl,
      tags,
    };

    console.log(`[Scraper] Scraped: "${title}" - ${price}`);
    return product;
  } catch (err) {
    clearTimeout(timeout);
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Scraper] Failed to scrape product: ${message}`);
    throw new Error(`Product scraping failed: ${message}`);
  }
}
