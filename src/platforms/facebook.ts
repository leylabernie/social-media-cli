/**
 * Facebook Page browser automation platform module.
 *
 * Provides automated posting capabilities for Facebook Pages using
 * Playwright browser automation with human-like interaction patterns.
 * Handles session validation, post creation with image uploads, and
 * post URL extraction.
 *
 * @module platforms/facebook
 * @example
 * ```ts
 * import facebookPlatform from './platforms/facebook.js';
 * const isLoggedIn = await facebookPlatform.checkSession(page);
 * if (isLoggedIn) {
 *   const postUrl = await facebookPlatform.post(page, { product, caption, imagePath });
 * }
 * ```
 */

import type { Page } from 'playwright-core';
import type { Platform, PlatformPostInput } from './types.js';
import {
  humanDelay,
  humanType,
  humanClick,
  humanScroll,
  randomMouseMovement,
} from '../browser/human.js';
import { info, success, warn, error, debug } from '../utils/logger.js';
import env from '../utils/env.js';

/** URL for Facebook login page. */
/** URL for Facebook home feed. */
const HOME_URL = 'https://www.facebook.com/' as const;

/** Maximum wait time for image upload in milliseconds. */
const IMAGE_UPLOAD_TIMEOUT_MS = 30000 as const;

/** Maximum wait time for post publication in milliseconds. */
const POST_PUBLISH_TIMEOUT_MS = 30000 as const;

/** Maximum wait time for page navigation in milliseconds. */
const NAVIGATION_TIMEOUT_MS = 15000 as const;

/** Maximum wait time for element selectors in milliseconds. */
const ELEMENT_SELECTOR_TIMEOUT_MS = 10000 as const;

/** Maximum retries for resilient operations. */
const MAX_RETRIES = 3 as const;

/**
 * Delay duration constants for various interaction points.
 * These are used to simulate realistic human timing.
 */
const DELAY = {
  /** Short pause after navigation or minor interaction. */
  SHORT: { min: 500, max: 1200 },
  /** Medium pause after opening a dialog or expanding a composer. */
  MEDIUM: { min: 1500, max: 3000 },
  /** Long pause after uploading media or submitting a post. */
  LONG: { min: 3000, max: 6000 },
  /** Extra pause for Facebook's heavy DOM updates after posting. */
  EXTRA_LONG: { min: 5000, max: 8000 },
} as const;

/**
 * CSS/XPath selector fallbacks for key Facebook UI elements.
 * Facebook's DOM changes frequently — multiple selectors increase resilience.
 */
const SELECTORS = {
  /** Selectors for the page-level "Create post" composer trigger. */
  pageComposer: [
    'div[role="main"] div[contenteditable="true"]',
    'div[aria-label="Create post"]',
    'div[aria-label="Create a post"]',
    'div[aria-label="What\'s on your mind?"]',
    'div[aria-label*="What"]',
    'span:has-text("What\'s on your mind?")',
    'span:has-text("Create post")',
  ],

  /** Selectors for the photo/video tab/button in the composer. */
  photoVideoTab: [
    'div[role="button"]:has-text("Photo/video")',
    'div[role="button"]:has-text("Photo/Video")',
    'div[role="button"]:has-text("Photo")',
    'input[type="file"][accept*="image"]',
    'div[aria-label="Photo/Video"]',
    'div[aria-label="Photo/video"]',
  ],

  /** Selectors for the "Post" submit button. */
  postButton: [
    'div[role="button"]:has-text("Post")',
    'button:has-text("Post")',
    'div[aria-label="Post"]',
    'div[role="button"]:has-text("Publish")',
  ],

  /** Selectors for detecting a published post (article element). */
  publishedPost: [
    'div[role="article"]',
    'div[data-ad-preview="message"]',
  ],

  /** Selectors for login form detection (invalid session). */
  loginForm: [
    '#login_form',
    'input#email',
    'input[name="email"]',
    'input[placeholder*="Email"]',
    'input[placeholder*="Phone"]',
    'button[type="submit"]:has-text("Log in")',
  ],

  /** Selectors for the home feed (valid session). */
  homeFeed: [
    'div[role="main"]',
    '[data-pagelet="HomeFeed"]',
    'div[aria-label="Facebook"]',
  ],
} as const;

/**
 * Attempts to find a visible element using an ordered list of selector fallbacks.
 *
 * @param page - The Playwright page instance.
 * @param selectors - Ordered array of selector strings to try.
 * @param timeout - Maximum time to wait per selector in milliseconds.
 * @returns The resolved element handle, or `null` if none matched.
 */
async function trySelectors(
  page: Page,
  selectors: readonly string[],
  timeout: number = ELEMENT_SELECTOR_TIMEOUT_MS,
): Promise<import('playwright-core').ElementHandle | null> {
  for (const selector of selectors) {
    try {
      debug(`Trying selector: ${selector}`);
      const el = await page.waitForSelector(selector, {
        state: 'visible',
        timeout,
      });
      if (el) {
        debug(`Matched selector: ${selector}`);
        return el;
      }
    } catch {
      // Selector didn't match — try the next fallback.
      continue;
    }
  }
  return null;
}

/**
 * Checks whether the current page DOM indicates the user is logged in.
 *
 * Looks for login form elements (invalid session) or home feed elements
 * (valid session). Performs random mouse movement to simulate human
 * idle behaviour before inspecting the DOM.
 *
 * @param page - The Playwright page instance.
 * @returns `true` if the session appears valid, `false` otherwise.
 */
async function checkSession(page: Page): Promise<boolean> {
  info('Checking Facebook session validity...');
  await randomMouseMovement(page);
  await humanDelay(DELAY.SHORT.min, DELAY.SHORT.max);

  try {
    // Check for login form indicators (invalid session).
    for (const selector of SELECTORS.loginForm) {
      const loginEl = await page.$(selector);
      if (loginEl) {
        warn('Login form detected — session is invalid.');
        return false;
      }
    }

    // Check for home feed indicators (valid session).
    for (const selector of SELECTORS.homeFeed) {
      const feedEl = await page.$(selector);
      if (feedEl) {
        success('Facebook home feed detected — session is valid.');
        return true;
      }
    }

    // Ambiguous state — attempt a lightweight navigation check.
    warn('Ambiguous session state; performing navigation check...');
    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('/recover')) {
      warn('Current URL indicates login page — session is invalid.');
      return false;
    }

    // Final fallback: look for user-specific UI like notifications or menu.
    const userMenu = await page.$('div[aria-label="Account"]');
    if (userMenu) {
      success('Account menu detected — session is valid.');
      return true;
    }

    warn('Unable to determine session state — assuming invalid.');
    return false;
  } catch (err) {
    error(`Session check error: ${(err as Error).message}`);
    return false;
  }
}

/**
 * Navigates to the configured Facebook Page URL and waits for the page to stabilise.
 *
 * @param page - The Playwright page instance.
 * @throws If navigation fails after the maximum number of retries.
 */
async function navigateToPage(page: Page): Promise<void> {
  const pageUrl = env.FB_PAGE_URL;
  if (!pageUrl) {
    throw new Error(
      'FB_PAGE_URL is not configured. Set it in your environment or env.ts.',
    );
  }

  info(`Navigating to Facebook Page: ${pageUrl}`);
  await randomMouseMovement(page);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await page.goto(pageUrl, {
        waitUntil: 'networkidle',
        timeout: NAVIGATION_TIMEOUT_MS,
      });
      await humanDelay(DELAY.MEDIUM.min, DELAY.MEDIUM.max);
      success('Facebook Page loaded successfully.');
      return;
    } catch (err) {
      warn(`Navigation attempt ${attempt}/${MAX_RETRIES} failed: ${(err as Error).message}`);
      if (attempt === MAX_RETRIES) {
        throw new Error(
          `Failed to navigate to Facebook Page after ${MAX_RETRIES} attempts: ${(err as Error).message}`,
        );
      }
      await humanDelay(DELAY.SHORT.min, DELAY.SHORT.max);
    }
  }
}

/**
 * Opens the post composer by clicking the page-level "Create post" trigger.
 *
 * Facebook's composer often needs to be clicked to expand the full dialog
 * before media and text can be added.
 *
 * @param page - The Playwright page instance.
 * @throws If no composer element can be found or clicked.
 */
async function openComposer(page: Page): Promise<void> {
  info('Opening post composer...');
  await humanScroll(page);
  await humanDelay(DELAY.SHORT.min, DELAY.SHORT.max);

  const composer = await trySelectors(page, SELECTORS.pageComposer);
  if (!composer) {
    // Try scrolling to reveal the composer if it's below the fold.
    await humanScroll(page);
    await humanDelay(DELAY.SHORT.min, DELAY.SHORT.max);
    const composerAfterScroll = await trySelectors(page, SELECTORS.pageComposer);
    if (!composerAfterScroll) {
      throw new Error(
        'Unable to locate the post composer on the Facebook Page. ' +
          'The page structure may have changed or the composer is not visible.',
      );
    }
  }

  await humanClick(page, SELECTORS.pageComposer[0]);
  await humanDelay(DELAY.MEDIUM.min, DELAY.MEDIUM.max);
  success('Post composer opened.');
}

/**
 * Clicks the "Photo/video" tab in the composer to prepare for image upload.
 *
 * If a direct file input is found, it is used instead of clicking the tab
 * (some Facebook UIs expose the file input immediately).
 *
 * @param page - The Playwright page instance.
 * @returns The selector string for the file input element, if found.
 * @throws If the photo/video tab cannot be found or clicked.
 */
async function activatePhotoVideoTab(page: Page): Promise<string> {
  info('Activating Photo/video tab...');

  // Check for a direct file input first (some FB UIs expose it right away).
  const fileInput = await page.$('input[type="file"][accept*="image"]');
  if (fileInput) {
    debug('Direct file input detected — skipping tab click.');
    return 'input[type="file"][accept*="image"]';
  }

  const tab = await trySelectors(page, SELECTORS.photoVideoTab);
  if (!tab) {
    throw new Error(
      'Unable to locate the "Photo/video" tab in the post composer.',
    );
  }

  await humanClick(page, SELECTORS.photoVideoTab[0]);
  await humanDelay(DELAY.MEDIUM.min, DELAY.MEDIUM.max);
  success('Photo/video tab activated.');

  return SELECTORS.photoVideoTab[0];
}

/**
 * Uploads an image to the post composer using Playwright's `setInputFiles`.
 *
 * Waits for the upload to complete by monitoring for preview or loading
 * indicator changes.
 *
 * @param page - The Playwright page instance.
 * @param imagePath - Absolute file system path to the image.
 * @throws If the upload fails or times out.
 */
async function uploadImage(page: Page, imagePath: string): Promise<void> {
  info(`Uploading image: ${imagePath}`);

  const fileInput = await page.$('input[type="file"][accept*="image"]');
  if (!fileInput) {
    throw new Error(
      'File input element not found after activating Photo/video tab.',
    );
  }

  await fileInput.setInputFiles(imagePath);
  debug('Image file attached to input element.');

  // Wait for the upload to process — look for preview or loading indicators.
  try {
    await page.waitForSelector('img[src*="scontent"] | div[aria-label*="image"] | div[role="progressbar"]', {
      timeout: IMAGE_UPLOAD_TIMEOUT_MS,
      state: 'visible',
    });
    await humanDelay(DELAY.LONG.min, DELAY.LONG.max);
    success('Image uploaded successfully.');
  } catch {
    // Facebook may not show a clear upload indicator — proceed with a longer delay.
    warn('No explicit upload indicator detected — waiting extended delay.');
    await humanDelay(DELAY.LONG.min + 2000, DELAY.LONG.max + 2000);
  }
}

/**
 * Types the post caption into the contenteditable composer area.
 *
 * Uses human-like typing with randomised delays between keystrokes.
 *
 * @param page - The Playwright page instance.
 * @param caption - The caption text to type.
 * @throws If the composer text area cannot be found.
 */
async function typeCaption(page: Page, caption: string): Promise<void> {
  info('Typing post caption...');

  // The expanded composer typically reuses the same contenteditable.
  const composerSelector = 'div[contenteditable="true"][role="textbox"]';
  const textArea = await page.$(composerSelector);

  if (!textArea) {
    // Fallback: try any visible contenteditable within the composer dialog.
    const fallback = await page.waitForSelector(
      'div[role="dialog"] div[contenteditable="true"]',
      { state: 'visible', timeout: ELEMENT_SELECTOR_TIMEOUT_MS },
    );
    if (!fallback) {
      throw new Error('Caption text area not found in the post composer.');
    }
  }

  await humanType(page, composerSelector, caption);
  await humanDelay(DELAY.SHORT.min, DELAY.SHORT.max);
  success('Caption typed.');
}

/**
 * Clicks the "Post" button to publish the post.
 *
 * @param page - The Playwright page instance.
 * @throws If the Post button cannot be found or clicked.
 */
async function clickPostButton(page: Page): Promise<void> {
  info('Clicking Post button...');

  const postBtn = await trySelectors(page, SELECTORS.postButton);
  if (!postBtn) {
    throw new Error('Unable to locate the "Post" publish button.');
  }

  await humanClick(page, SELECTORS.postButton[0]);
  await humanDelay(DELAY.EXTRA_LONG.min, DELAY.EXTRA_LONG.max);
  success('Post submitted.');
}

/**
 * Waits for the newly published post to appear in the page feed and extracts its URL.
 *
 * Facebook assigns a post URL containing `/posts/` once the post is live.
 *
 * @param page - The Playwright page instance.
 * @returns The full URL of the newly created post.
 * @throws If the post cannot be found or its URL extracted within the timeout.
 */
async function extractPostUrl(page: Page): Promise<string> {
  info('Waiting for post to appear and extracting URL...');

  const deadline = Date.now() + POST_PUBLISH_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      // Look for the most recent article element.
      const article = await trySelectors(page, SELECTORS.publishedPost, 5000);
      if (!article) {
        await humanDelay(2000, 4000);
        continue;
      }

      // Find the timestamp anchor — it contains the post's permalink.
      const timestampLink = await article.$('a[href*="/posts/"]');
      if (timestampLink) {
        const href = await timestampLink.getAttribute('href');
        if (href) {
          const postUrl = href.startsWith('http') ? href : `https://www.facebook.com${href}`;
          success(`Post URL extracted: ${postUrl}`);
          return postUrl;
        }
      }

      // Fallback: scan page for any /posts/ link.
      const anyPostLink = await page.$('a[href*="/posts/"]');
      if (anyPostLink) {
        const href = await anyPostLink.getAttribute('href');
        if (href) {
          const postUrl = href.startsWith('http') ? href : `https://www.facebook.com${href}`;
          success(`Post URL extracted (fallback): ${postUrl}`);
          return postUrl;
        }
      }

      await humanDelay(2000, 4000);
    } catch (err) {
      debug(`Extraction attempt failed: ${(err as Error).message}`);
      await humanDelay(2000, 4000);
    }
  }

  throw new Error(
    'Timed out waiting for the post to appear and its URL to become extractable.',
  );
}

// ---------------------------------------------------------------------------
// Platform object implementation
// ---------------------------------------------------------------------------

/**
 * Facebook Page platform automation implementation.
 *
 * Provides methods to validate an existing browser session and publish
 * posts (with images) to a configured Facebook Page.
 *
 * @implements {Platform}
 */
const facebookPlatform: Platform = {
  /** Internal platform identifier. */
  name: 'facebook',

  /** Human-readable platform name shown in CLI output. */
  displayName: 'Facebook Page',

  /**
   * Validates whether the browser session is authenticated with Facebook.
   *
   * Navigates to the Facebook home page and inspects the DOM for login
   * form elements (invalid) or feed elements (valid).
   *
   * @param page - The Playwright page instance to inspect.
   * @returns Resolves to `true` when the session is valid, `false` otherwise.
   */
  async checkSession(page: Page): Promise<boolean> {
    await page.goto(HOME_URL, {
      waitUntil: 'domcontentloaded',
      timeout: NAVIGATION_TIMEOUT_MS,
    });
    await humanDelay(DELAY.SHORT.min, DELAY.SHORT.max);
    return checkSession(page);
  },

  /**
   * Publishes a post with an image to the configured Facebook Page.
   *
   * The full workflow:
   *   1. Navigate to the configured Facebook Page ({@link env.FB_PAGE_URL}).
   *   2. Open the "Create post" composer.
   *   3. Activate the Photo/video tab.
   *   4. Upload the image file.
   *   5. Type the caption into the contenteditable composer.
   *   6. Click the Post button to publish.
   *   7. Wait for the post to appear and extract its permalink.
   *
   * @param page - The Playwright page instance to use.
   * @param input - Post content including product metadata, caption, and image path.
   * @returns Resolves to the full URL of the published Facebook post.
   * @throws If any step of the posting workflow fails.
   */
  async post(page: Page, input: PlatformPostInput): Promise<string> {
    const { caption, imagePath } = input;

    info('Starting Facebook Page post workflow...');

    try {
      await navigateToPage(page);
      await openComposer(page);
      await activatePhotoVideoTab(page);
      await uploadImage(page, imagePath);
      await typeCaption(page, caption);
      await clickPostButton(page);
      const postUrl = await extractPostUrl(page);

      success(`Facebook Page post published successfully: ${postUrl}`);
      return postUrl;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : String(err);
      error(`Facebook Page post failed: ${message}`);
      throw new Error(`Facebook Page post failed: ${message}`);
    }
  },
};

export default facebookPlatform;
