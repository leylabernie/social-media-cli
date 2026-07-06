/**
 * @file Shared TypeScript type definitions for the Luxemia Social backend.
 * @module @/lib/types
 */

/** Product information scraped from a luxemia.shop product page */
export interface ProductInfo {
  /** Product title/name */
  title: string;
  /** Product description or excerpt */
  description: string;
  /** Product price as a formatted string */
  price: string;
  /** Original product page URL */
  url: string;
  /** URL to the product's primary image */
  imageUrl: string;
  /** Array of product tags or categories */
  tags: string[];
}

/** A generated caption for a specific social media platform */
export interface CaptionResult {
  /** Target platform identifier (x, instagram, facebook, pinterest, linkedin) */
  platform: string;
  /** Generated caption text */
  caption: string;
}

/** Result of posting to a single social media platform */
export interface PostResult {
  /** Target platform identifier */
  platform: string;
  /** Whether the post was successfully published */
  success: boolean;
  /** URL to the published post, if successful */
  postUrl?: string;
  /** Error message, if posting failed */
  error?: string;
}

/** Authentication and connection status for a social media platform */
export interface PlatformStatus {
  /** Platform identifier */
  platform: string;
  /** Human-readable display name */
  displayName: string;
  /** Whether valid session cookies exist in KV storage */
  authenticated: boolean;
  /** ISO timestamp of the last status check */
  lastCheck: string;
}

/** A stored record of a product posting session */
export interface PostRecord {
  /** Unique identifier for the post record */
  id: string;
  /** URL of the product that was posted */
  productUrl: string;
  /** Title of the product that was posted */
  productTitle: string;
  /** URL to the product image */
  productImageUrl: string;
  /** ISO timestamp when the post was created */
  createdAt: string;
  /** Overall posting status */
  status: 'pending' | 'posted' | 'partial' | 'failed';
  /** Results for each platform that was attempted */
  results: PostResult[];
}
