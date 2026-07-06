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

/** Generic stored token shape for any platform */
export interface StoredToken {
  platform: Platform;
  accessToken: string;
  refreshToken?: string;
  pageId?: string;
  pageName?: string;
  igBusinessAccountId?: string;
  openId?: string;
  connectedAt: string;
  expiresAt?: string;
}

/** Connected account response for the dashboard */
export interface ConnectedAccount {
  platform: Platform;
  displayName: string;
  connected: boolean;
  connectedAt?: string;
}

/** Facebook Pages API response */
export interface FacebookPagesResponse {
  data: Array<{
    id: string;
    name: string;
    access_token: string;
    category?: string;
  }>;
  paging?: {
    cursors?: {
      before: string;
      after: string;
    };
  };
}

/** Instagram Business Account linked to a Facebook page */
export interface InstagramBusinessAccountResponse {
  instagram_business_account?: {
    id: string;
  };
  name: string;
  id: string;
}

/** TikTok token exchange response */
export interface TikTokTokenResponse {
  access_token: string;
  refresh_token: string;
  open_id: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

/** Pinterest token exchange response */
export interface PinterestTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  scope: string;
}
