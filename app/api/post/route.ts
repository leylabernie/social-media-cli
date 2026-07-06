/**
 * @file API Route - POST /api/post
 * Posts a product to multiple social media platforms using browser automation.
 * Launches a headless browser per platform, authenticates with stored credentials,
 * publishes the post, and persists results to KV storage.
 * @module @/api/post/route
 */

import { launchBrowser, humanDelay, humanType, humanClick, applyCookies, extractCookies } from '@/lib/browser';
import { processImage } from '@/lib/image';
import { getCookies, setCookies, savePost, updatePostStatus } from '@/lib/kv-store';
import type { ProductInfo, PostResult, PostRecord } from '@/lib/types';
import type { Browser, Page } from 'playwright-core';

/** Supported platforms with their display configuration */
const PLATFORM_CONFIG: Record<string, { displayName: string; domain: string; loginUrl: string }> = {
  x: {
    displayName: 'X (Twitter)',
    domain: '.twitter.com',
    loginUrl: 'https://twitter.com/i/flow/login',
  },
  instagram: {
    displayName: 'Instagram',
    domain: '.instagram.com',
    loginUrl: 'https://www.instagram.com/accounts/login/',
  },
  facebook: {
    displayName: 'Facebook',
    domain: '.facebook.com',
    loginUrl: 'https://www.facebook.com/login/',
  },
  pinterest: {
    displayName: 'Pinterest',
    domain: '.pinterest.com',
    loginUrl: 'https://www.pinterest.com/login/',
  },
  linkedin: {
    displayName: 'LinkedIn',
    domain: '.linkedin.com',
    loginUrl: 'https://www.linkedin.com/login/',
  },
};

/** Credential environment variable mapping per platform */
const CREDENTIAL_KEYS: Record<string, { username: string; password: string }> = {
  x: { username: 'X_USERNAME', password: 'X_PASSWORD' },
  instagram: { username: 'INSTAGRAM_USERNAME', password: 'INSTAGRAM_PASSWORD' },
  facebook: { username: 'FACEBOOK_USERNAME', password: 'FACEBOOK_PASSWORD' },
  pinterest: { username: 'PINTEREST_USERNAME', password: 'PINTEREST_PASSWORD' },
  linkedin: { username: 'LINKEDIN_USERNAME', password: 'LINKEDIN_PASSWORD' },
};

/**
 * Log into a social media platform using stored credentials.
 * Applies existing cookies first, checks if already logged in, otherwise performs login.
 * @param page - Playwright page instance
 * @param platform - Platform identifier
 * @returns The updated page (for chaining)
 */
async function loginToPlatform(page: Page, platform: string): Promise<Page> {
  const config = PLATFORM_CONFIG[platform];
  const creds = CREDENTIAL_KEYS[platform];

  if (!config || !creds) {
    throw new Error(`No login configuration for platform: ${platform}`);
  }

  const username = process.env[creds.username];
  const password = process.env[creds.password];

  if (!username || !password) {
    throw new Error(`Missing credentials for ${platform}. Set ${creds.username} and ${creds.password} environment variables.`);
  }

  // Apply existing cookies for session persistence
  const existingCookies = await getCookies(platform);
  await applyCookies(page, existingCookies, config.domain);

  // Navigate to the platform's login page
  await page.goto(config.loginUrl, { waitUntil: 'networkidle' });
  await humanDelay(1500, 3000);

  // Check if we're already logged in (redirected to home/feed)
  const currentUrl = page.url();
  const isLoggedIn =
    platform === 'x' ? currentUrl.includes('twitter.com/home') :
    platform === 'instagram' ? currentUrl.includes('instagram.com') && !currentUrl.includes('login') :
    platform === 'facebook' ? currentUrl.includes('facebook.com') && !currentUrl.includes('login') :
    platform === 'pinterest' ? currentUrl.includes('pinterest.com') && !currentUrl.includes('login') :
    platform === 'linkedin' ? currentUrl.includes('linkedin.com/feed') :
    false;

  if (isLoggedIn) {
    console.log(`[Post] Already logged in to ${platform}`);
    // Refresh cookies in KV
    const newCookies = await extractCookies(page);
    await setCookies(platform, newCookies);
    return page;
  }

  console.log(`[Post] Logging in to ${platform}...`);

  // Platform-specific login flow
  switch (platform) {
    case 'x': {
      // X login flow: username → next → password → login
      await humanType(page, 'input[autocomplete="username"]', username);
      await humanClick(page, 'div[role="button"]:has-text("Next")');
      await humanDelay(1000, 2000);
      await humanType(page, 'input[type="password"]', password);
      await humanClick(page, 'div[data-testid="LoginForm_Login_Button"]');
      break;
    }

    case 'instagram': {
      // Instagram login flow
      await humanType(page, 'input[name="username"]', username);
      await humanType(page, 'input[name="password"]', password);
      await humanClick(page, 'button[type="submit"]');
      await humanDelay(3000, 5000);

      // Dismiss "Save Your Login Info?" if it appears
      try {
        const notNowButton = page.locator('button:has-text("Not Now")');
        if (await notNowButton.isVisible({ timeout: 3000 })) {
          await notNowButton.click();
        }
      } catch {
        // Dialog didn't appear, continue
      }
      break;
    }

    case 'facebook': {
      // Facebook login flow
      await humanType(page, 'input[name="email"]', username);
      await humanType(page, 'input[name="pass"]', password);
      await humanClick(page, 'button[name="login"]');
      await humanDelay(3000, 5000);
      break;
    }

    case 'pinterest': {
      // Pinterest login flow
      await humanType(page, 'input[id="email"]', username);
      await humanType(page, 'input[id="password"]', password);
      await humanClick(page, 'button[data-test-id="registerFormSubmitButton"]');
      await humanDelay(3000, 5000);
      break;
    }

    case 'linkedin': {
      // LinkedIn login flow
      await humanType(page, 'input[id="username"]', username);
      await humanType(page, 'input[id="password"]', password);
      await humanClick(page, 'button[type="submit"]');
      await humanDelay(3000, 5000);
      break;
    }

    default: {
      throw new Error(`Login flow not implemented for platform: ${platform}`);
    }
  }

  // Wait for navigation after login
  await humanDelay(3000, 5000);

  // Save updated cookies
  const cookies = await extractCookies(page);
  await setCookies(platform, cookies);

  console.log(`[Post] Successfully logged in to ${platform}`);
  return page;
}

/**
 * Post content to a social media platform.
 * @param page - Playwright page instance (must be logged in)
 * @param platform - Platform identifier
 * @param caption - Caption text to post
 * @param imageBuffer - Processed image buffer
 * @param productUrl - Product URL to include
 * @returns URL of the published post if successful
 */
async function publishPost(
  page: Page,
  platform: string,
  caption: string,
  imageBuffer: Buffer,
  productUrl: string
): Promise<string | undefined> {
  console.log(`[Post] Publishing to ${platform}...`);

  switch (platform) {
    case 'x': {
      // Navigate to compose tweet
      await page.goto('https://twitter.com/compose/tweet', { waitUntil: 'networkidle' });
      await humanDelay(1500, 2500);

      // Type caption
      await humanType(page, 'div[data-testid="tweetTextarea_0"] div[contenteditable="true"]', caption);
      await humanDelay(500, 1000);

      // Upload image
      const fileInput = page.locator('input[data-testid="fileInput"]');
      await fileInput.setInputFiles({
        name: 'image.jpg',
        mimeType: 'image/jpeg',
        buffer: imageBuffer,
      });
      await humanDelay(2000, 3500);

      // Click Tweet button
      await humanClick(page, 'button[data-testid="tweetButton"]');
      await humanDelay(3000, 5000);

      // Extract post URL from the resulting page
      const url = page.url();
      if (url.includes('/status/')) {
        return url;
      }
      return undefined;
    }

    case 'instagram': {
      // Navigate to create post
      await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle' });
      await humanDelay(1500, 2500);

      // Click "Create" button
      await humanClick(page, 'svg[aria-label="New post"]');
      await humanDelay(1000, 2000);

      // Upload image via file input
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'image.jpg',
        mimeType: 'image/jpeg',
        buffer: imageBuffer,
      });
      await humanDelay(2000, 3500);

      // Click through aspect ratio/original selection
      await humanClick(page, 'button:has-text("Next")');
      await humanDelay(1000, 2000);
      await humanClick(page, 'button:has-text("Next")');
      await humanDelay(1000, 2000);

      // Type caption
      await humanType(page, 'textarea[aria-label="Write a caption..."]', caption);
      await humanDelay(500, 1000);

      // Click Share
      await humanClick(page, 'button:has-text("Share")');
      await humanDelay(5000, 7000);

      return undefined; // Instagram doesn't give direct post URL
    }

    case 'facebook': {
      // Navigate to create post
      await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle' });
      await humanDelay(2000, 3500);

      // Click "What's on your mind?"
      await humanClick(page, 'div[role="button"]:has-text("What")');
      await humanDelay(1500, 2500);

      // Type caption
      await humanType(page, 'div[contenteditable="true"][role="textbox"]', caption);
      await humanDelay(500, 1000);

      // Upload photo
      const fileInput = page.locator('input[type="file"][accept*="image"]');
      await fileInput.setInputFiles({
        name: 'image.jpg',
        mimeType: 'image/jpeg',
        buffer: imageBuffer,
      });
      await humanDelay(2000, 3500);

      // Click Post
      await humanClick(page, 'div[role="button"][aria-label*="Post"]');
      await humanDelay(3000, 5000);

      return undefined;
    }

    case 'pinterest': {
      // Navigate to create pin
      await page.goto('https://www.pinterest.com/pin-builder/', { waitUntil: 'networkidle' });
      await humanDelay(2000, 3500);

      // Upload image
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'image.jpg',
        mimeType: 'image/jpeg',
        buffer: imageBuffer,
      });
      await humanDelay(2000, 3500);

      // Type title (first 100 chars)
      const title = caption.substring(0, 100);
      await humanType(page, 'textarea[name="title"]', title);
      await humanDelay(500, 1000);

      // Type description
      const description = caption.substring(0, 500);
      await humanType(page, 'div[contenteditable="true"]', description);
      await humanDelay(500, 1000);

      // Add destination URL
      await humanType(page, 'input[name="link"]', productUrl);
      await humanDelay(500, 1000);

      // Select a board (first available)
      try {
        await humanClick(page, 'div[data-test-id="board-dropdown-select"]');
        await humanDelay(1000, 2000);
        await humanClick(page, 'div[role="option"]:first-child');
        await humanDelay(500, 1000);
      } catch {
        // Board selection may be optional if a default board is set
      }

      // Publish
      await humanClick(page, 'button[data-test-id="board-dropdown-save"]');
      await humanDelay(3000, 5000);

      return undefined;
    }

    case 'linkedin': {
      // Navigate to LinkedIn feed
      await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'networkidle' });
      await humanDelay(2000, 3500);

      // Click "Start a post"
      await humanClick(page, 'button[aria-label*="Start a post"]');
      await humanDelay(1500, 2500);

      // Type caption
      await humanType(page, 'div[contenteditable="true"][role="textbox"]', caption);
      await humanDelay(500, 1000);

      // Upload image
      const fileInput = page.locator('input[type="file"][name="file"]');
      await fileInput.setInputFiles({
        name: 'image.jpg',
        mimeType: 'image/jpeg',
        buffer: imageBuffer,
      });
      await humanDelay(2000, 3500);

      // Click Post
      await humanClick(page, 'button:has-text("Post")');
      await humanDelay(3000, 5000);

      return undefined;
    }

    default: {
      throw new Error(`Publishing not implemented for platform: ${platform}`);
    }
  }
}

/**
 * Execute the full post workflow for a single platform: login, process image, publish.
 * @param platform - Platform identifier
 * @param product - Product information
 * @param caption - Caption text for the platform
 * @returns PostResult with success status and post URL or error
 */
async function postToPlatform(
  platform: string,
  product: ProductInfo,
  caption: string
): Promise<PostResult> {
  let browser: Browser | undefined;

  try {
    // Launch browser
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 800 });

    // Log in
    await loginToPlatform(page, platform);

    // Process the image for this platform
    const imageBuffer = await processImage(product.imageUrl, platform);

    // Publish the post
    const postUrl = await publishPost(page, platform, caption, imageBuffer, product.url);

    return {
      platform,
      success: true,
      postUrl,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Post] Failed for ${platform}:`, message);
    return {
      platform,
      success: false,
      error: message,
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * POST handler for /api/post
 * Posts a product to multiple social media platforms in parallel.
 * @param request - The incoming HTTP request with JSON body
 * @returns JSON response with posting results for each platform
 */
export async function POST(request: Request): Promise<Response> {
  const recordId = `post_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

  try {
    const body = await request.json();
    const { product, platforms, captions } = body;

    // Validate request body
    if (!product || typeof product !== 'object') {
      return Response.json(
        { success: false, error: 'Missing or invalid "product" field in request body' },
        { status: 400 }
      );
    }

    if (!Array.isArray(platforms) || platforms.length === 0) {
      return Response.json(
        { success: false, error: 'Missing or empty "platforms" array in request body' },
        { status: 400 }
      );
    }

    if (!captions || typeof captions !== 'object') {
      return Response.json(
        { success: false, error: 'Missing or invalid "captions" field in request body' },
        { status: 400 }
      );
    }

    // Create initial pending record
    const initialRecord: PostRecord = {
      id: recordId,
      productUrl: product.url,
      productTitle: product.title,
      productImageUrl: product.imageUrl,
      createdAt: new Date().toISOString(),
      status: 'pending',
      results: [],
    };
    await savePost(initialRecord);

    // Post to all platforms in parallel
    const postPromises = platforms.map((platform: string) => {
      const caption = captions[platform] || `${product.title} - ${product.url}`;
      return postToPlatform(platform, product as ProductInfo, caption);
    });

    const results = await Promise.all(postPromises);

    // Determine overall status
    const allSucceeded = results.every((r) => r.success);
    const someSucceeded = results.some((r) => r.success);
    const status: PostRecord['status'] = allSucceeded
      ? 'posted'
      : someSucceeded
      ? 'partial'
      : 'failed';

    // Update the record with results
    await updatePostStatus(recordId, status, results);

    return Response.json({
      success: status !== 'failed',
      results,
      status,
      recordId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error occurred';
    console.error('[API /post] Error:', message);

    // Try to update the record as failed
    try {
      await updatePostStatus(recordId, 'failed', [
        { platform: 'all', success: false, error: message },
      ]);
    } catch {
      // Best-effort update, don't fail the response if this errors
    }

    return Response.json(
      { success: false, error: message, recordId },
      { status: 500 }
    );
  }
}
