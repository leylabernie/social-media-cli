/**
 * Shared TypeScript types for the Luxemia Social Dashboard.
 * All platform modules and API routes import from here.
 */

/** Product information scraped from a Luxemia product page */
export interface ProductInfo {
  title: string;
  description: string;
  price: string;
  imageUrl: string;
  url: string;
}

/** Result of a single platform post attempt */
export interface PostResult {
  platform: string;
  status: "success" | "error";
  url?: string;
  message?: string;
  postId?: string;
}

/** Instagram token shape stored in Vercel KV */
export interface InstagramToken {
  accessToken: string;
  igBusinessAccountId: string;
}

/** Facebook token shape stored in Vercel KV */
export interface FacebookToken {
  accessToken: string;
  pageId: string;
}

/** TikTok token shape stored in Vercel KV */
export interface TikTokToken {
  accessToken: string;
  openId: string;
}

/** Pinterest token shape stored in Vercel KV */
export interface PinterestToken {
  accessToken: string;
}

/** Union of all platform token types */
export type PlatformToken =
  | InstagramToken
  | FacebookToken
  | TikTokToken
  | PinterestToken;

/** Supported platform identifiers */
export type Platform = "instagram" | "facebook" | "tiktok" | "pinterest";

/** Caption generated for a specific platform */
export interface GeneratedCaption {
  platform: Platform;
  caption: string;
}

/** Stored history entry for a batch post operation */
export interface HistoryEntry {
  id: string;
  timestamp: string;
  product: ProductInfo;
  platforms: Platform[];
  results: PostResult[];
}

/** Request body for the main /api/post endpoint */
export interface PostRequestBody {
  product: ProductInfo;
  platforms: Platform[];
  caption: string;
}

/** Request body for the /api/scrape endpoint */
export interface ScrapeRequestBody {
  url: string;
}

/** Request body for the /api/caption endpoint */
export interface CaptionRequestBody {
  product: ProductInfo;
  platforms: Platform[];
}
