/**
 * @file Shared type definitions for all social media platforms.
 * @module luxemia-social/platforms/types
 */

import type { Page } from 'playwright-core';

/**
 * Product information scraped from luxemia.shop.
 * Contains all metadata needed to generate captions and post to platforms.
 */
export interface ProductInfo {
  /** Product title (from og:title or h1) */
  title: string;
  /** Product description (meta description) */
  description: string;
  /** Product price as a formatted string */
  price: string;
  /** Canonical product URL */
  url: string;
  /** URL to the product's main image */
  imageUrl: string;
  /** Product tags / categories */
  tags: string[];
}

/**
 * Result of posting to a single platform.
 * Captures success/failure state and metadata for the post.
 */
export interface PlatformPost {
  /** Platform identifier (e.g., 'x', 'instagram') */
  platform: string;
  /** Caption text that was posted */
  caption: string;
  /** Local path to the processed image */
  imagePath: string;
  /** URL to the live post (if successful) */
  postUrl?: string;
  /** ISO timestamp when the post was made */
  postedAt?: string;
  /** Error message (if posting failed) */
  error?: string;
}

/**
 * Input parameters for a platform posting function.
 * Passed to each platform module's post() method.
 */
export interface PlatformPostInput {
  /** Product information for caption generation */
  product: ProductInfo;
  /** Pre-generated caption text */
  caption: string;
  /** Local path to the processed image */
  imagePath: string;
}

/**
 * Interface that each platform module must implement.
 * Provides a uniform API for session checking and posting across all platforms.
 */
export interface Platform {
  /** Internal platform identifier */
  readonly name: string;
  /** Human-readable platform name */
  readonly displayName: string;

  /**
   * Check if the current browser session is valid (user is logged in).
   * @param page - Playwright page instance
   * @returns True if the session is valid, false otherwise
   */
  checkSession(page: Page): Promise<boolean>;

  /**
   * Post content to the platform.
   * @param page - Playwright page instance with valid session
   * @param input - Post content and metadata
   * @returns URL to the published post
   * @throws Error if posting fails
   */
  post(page: Page, input: PlatformPostInput): Promise<string>;
}
