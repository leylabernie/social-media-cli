/**
 * @fileoverview Instagram platform integration for Luxemia Social.
 *
 * Provides browser-automation workflows for checking an existing session
 * and publishing product posts on Instagram.  All interactions use
 * human-like delays and anti-detection helpers to reduce the chance of
 * being flagged as a bot.
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
import { info, success, warn, debug } from '../utils/logger.js';

/** Instagram login page URL. */
/** Instagram home feed URL. */
const HOME_URL = 'https://www.instagram.com/';

/** Maximum time (ms) to wait for the post-publish success indicator. */
const POST_SUCCESS_TIMEOUT = 30_000;

/**
 * Attempts to dismiss the "Save login info?" modal that Instagram shows
 * after a fresh login.  The modal blocks subsequent interactions until it is
 * closed.
 *
 * @param page - The Playwright page instance.
 */
async function dismissSaveLoginModal(page: Page): Promise<void> {
  debug('[Instagram] Checking for "Save login info?" modal…');

  const saveInfoBtn = page.locator('button:has-text("Save info")');
  const notNowBtn = page.locator('text=Not now');

  try {
    if (await saveInfoBtn.isVisible({ timeout: 3_000 })) {
      await humanClick(page, 'button:has-text("Save info")');
      info('[Instagram] Clicked "Save info" on login modal.');
      await humanDelay(1_000, 2_000);
      return;
    }
  } catch {
    // Modal not present – continue silently.
  }

  try {
    if (await notNowBtn.isVisible({ timeout: 3_000 })) {
      await humanClick(page, 'text=Not now');
      info('[Instagram] Clicked "Not now" on login modal.');
      await humanDelay(1_000, 2_000);
      return;
    }
  } catch {
    // Modal not present – continue silently.
  }

  debug('[Instagram] No "Save login info?" modal detected.');
}

/**
 * Waits for one of several possible locators to become visible and returns
 * the one that resolved first.  This is useful for Instagram's A/B tested
 * UI where multiple selectors may represent the same element.
 *
 * @param page  - The Playwright page instance.
 * @param pairs - An ordered list of `[name, selector]` tuples to try.
 * @returns The name of the first locator that became visible.
 * @throws When none of the supplied locators appear within the timeout.
 */
async function waitForFirstVisible(
  page: Page,
  pairs: Array<[string, string]>,
  timeout = 10_000,
): Promise<string> {
  const locators = pairs.map(([name, sel]) => ({ name, locator: page.locator(sel).first() }));

  const race = locators.map(async ({ name, locator }) => {
    try {
      await locator.waitFor({ state: 'visible', timeout });
      return name;
    } catch {
      return null;
    }
  });

  const results = await Promise.all(race);
  const winner = results.find((r): r is string => r !== null);

  if (!winner) {
    const tried = pairs.map((p) => p[0]).join(', ');
    throw new Error(`None of the expected elements became visible: ${tried}`);
  }

  return winner;
}

/**
 * Instagram platform implementation for Luxemia Social.
 *
 * Covers session validation and the full post-creation flow:
 *   Create  → Select "Post"  → Upload image  → Crop (skip)  → Filters (skip)
 *   → Caption  → Share  → Extract post URL from profile page.
 */
const instagramPlatform: Platform = {
  name: 'instagram',
  displayName: 'Instagram',

  /**
   * Determines whether the browser context currently holds a valid Instagram
   * session by navigating to the home feed and looking for authenticated-user
   * indicators (stories rail or suggested posts).  If a login form is present
   * the session is considered invalid.
   *
   * @param page - The Playwright page instance.
   * @returns `true` when an authenticated session is detected.
   */
  async checkSession(page: Page): Promise<boolean> {
    info('[Instagram] Checking session validity…');
    await page.goto(HOME_URL, { waitUntil: 'networkidle' });
    await humanDelay(2_000, 4_000);

    // Dismiss "Save login info?" modal when it blocks the UI.
    await dismissSaveLoginModal(page);

    // If the login form or a "Log in" button is visible, the session is invalid.
    const loginIndicators = [
      page.locator('input[name="username"]').first(),
      page.locator('input[name="password"]').first(),
      page.locator('button:has-text("Log in")').first(),
    ];

    for (const indicator of loginIndicators) {
      try {
        if (await indicator.isVisible({ timeout: 3_000 })) {
          warn('[Instagram] Login form detected – session is invalid.');
          return false;
        }
      } catch {
        // Indicator not present – continue checking.
      }
    }

    // Authenticated indicators: stories rail or suggested posts in the feed.
    const authIndicators = [
      page.locator('[data-pagelet="Stories"]').first(),
      page.locator('article').first(),
      page.locator('a[href*="/stories/"]').first(),
    ];

    for (const indicator of authIndicators) {
      try {
        if (await indicator.isVisible({ timeout: 5_000 })) {
          success('[Instagram] Authenticated session detected.');
          return true;
        }
      } catch {
        // Indicator not present – continue checking.
      }
    }

    warn('[Instagram] Unable to confirm session status – assuming invalid.');
    return false;
  },

  /**
   * Publishes a product post on Instagram.
   *
   * The flow follows Instagram's native creation UI:
   * 1. Navigate to the home page.
   * 2. Open the creation modal and select "Post".
   * 3. Upload the provided image via the hidden file input.
   * 4. Skip the crop and optional filter steps.
   * 5. Enter the caption.
   * 6. Click Share and wait for the success indicator.
   * 7. Navigate to the profile page and extract the URL of the most
   *    recent post.
   *
   * @param page  - The Playwright page instance.
   * @param input - Product data, caption text, and local image path.
   * @returns The canonical URL of the newly created post.
   * @throws When any step in the creation pipeline fails or the post URL
   *         cannot be extracted.
   */
  async post(page: Page, input: PlatformPostInput): Promise<string> {
    const { product, caption, imagePath } = input;

    info(`[Instagram] Starting post creation for product: ${product.title}`);

    // ── 1. Navigate to Instagram home ──────────────────────────────────────
    await page.goto(HOME_URL, { waitUntil: 'networkidle' });
    await humanDelay(2_000, 4_000);
    await randomMouseMovement(page);

    await dismissSaveLoginModal(page);

    // ── 2. Open creation flow ──────────────────────────────────────────────
    debug('[Instagram] Opening creation flow…');

    const createSelectors: Array<[string, string]> = [
      ['create-link', 'a[href="/create/select/"]'],
      ['create-aria', '[aria-label="New post"]'],
      ['create-svg', 'svg[aria-label="New post"]'],
    ];

    const createWinner = await waitForFirstVisible(page, createSelectors, 10_000);
    const createSelector = createSelectors.find(([name]) => name === createWinner)![1];
    await humanClick(page, createSelector);
    await humanDelay(1_500, 3_000);

    // ── 3. Select "Post" option ────────────────────────────────────────────
    debug('[Instagram] Selecting "Post" option…');

    const postOptionSelectors: Array<[string, string]> = [
      ['post-text', 'text=Post'],
      ['post-button', '[role="button"]:has-text("Post")'],
    ];

    const postWinner = await waitForFirstVisible(page, postOptionSelectors, 8_000);
    const postSelector = postOptionSelectors.find(([name]) => name === postWinner)![1];
    await humanClick(page, postSelector);
    await humanDelay(1_500, 3_000);

    // ── 4. Upload image ────────────────────────────────────────────────────
    debug(`[Instagram] Uploading image: ${imagePath}`);

    const fileInputSelectors: Array<[string, string]> = [
      ['file-input-generic', 'input[type="file"]'],
      ['file-input-accept', 'input[accept="image/jpeg,image/png,image/heic"]'],
    ];

    const fileWinner = await waitForFirstVisible(page, fileInputSelectors, 8_000);
    const fileSelector = fileInputSelectors.find(([name]) => name === fileWinner)![1];

    await page.locator(fileSelector).first().setInputFiles(imagePath);
    info('[Instagram] Image file sent to input.');
    await humanDelay(3_000, 6_000);

    // ── 5. Skip crop step ──────────────────────────────────────────────────
    debug('[Instagram] Skipping crop step…');

    const cropNextSelectors: Array<[string, string]> = [
      ['crop-next-btn', 'button:has-text("Next")'],
      ['crop-next-role', '[role="button"]:has-text("Next")'],
    ];

    const cropWinner = await waitForFirstVisible(page, cropNextSelectors, 15_000);
    const cropSelector = cropNextSelectors.find(([name]) => name === cropWinner)![1];
    await humanClick(page, cropSelector);
    await humanDelay(2_000, 4_000);

    // ── 6. Skip optional filter step ───────────────────────────────────────
    debug('[Instagram] Skipping filter step…');

    const filterNextSelectors: Array<[string, string]> = [
      ['filter-next-btn', 'button:has-text("Next")'],
      ['filter-next-role', '[role="button"]:has-text("Next")'],
    ];

    const filterWinner = await waitForFirstVisible(page, filterNextSelectors, 10_000);
    const filterSelector = filterNextSelectors.find(([name]) => name === filterWinner)![1];
    await humanClick(page, filterSelector);
    await humanDelay(2_000, 4_000);

    // ── 7. Enter caption ───────────────────────────────────────────────────
    debug('[Instagram] Entering caption…');

    const captionSelectors: Array<[string, string]> = [
      ['caption-textarea', 'textarea[aria-label="Write a caption..."]'],
      ['caption-editable', 'div[contenteditable="true"]'],
    ];

    const captionWinner = await waitForFirstVisible(page, captionSelectors, 10_000);
    const captionSelector = captionSelectors.find(([name]) => name === captionWinner)![1];

    // Build the caption text including product details and tags.
    const tagsString = product.tags.map((tag) => `#${tag}`).join(' ');
    const fullCaption = `${caption}\n\n${product.title} — ${product.price}\n${tagsString}`;

    await humanType(page, captionSelector, fullCaption);
    info('[Instagram] Caption entered.');
    await humanDelay(1_500, 3_000);
    await humanScroll(page);

    // ── 8. Click Share ─────────────────────────────────────────────────────
    debug('[Instagram] Clicking Share…');

    const shareSelectors: Array<[string, string]> = [
      ['share-btn', 'button:has-text("Share")'],
      ['share-role', '[role="button"]:has-text("Share")'],
    ];

    const shareWinner = await waitForFirstVisible(page, shareSelectors, 8_000);
    const shareSelector = shareSelectors.find(([name]) => name === shareWinner)![1];
    await humanClick(page, shareSelector);
    info('[Instagram] Share button clicked – uploading…');

    // ── 9. Wait for post success ───────────────────────────────────────────
    debug('[Instagram] Waiting for upload to complete…');

    const successIndicator = page.locator('text=Your post has been shared').first();
    try {
      await successIndicator.waitFor({ state: 'visible', timeout: POST_SUCCESS_TIMEOUT });
      success('[Instagram] Post published successfully.');
    } catch {
      warn('[Instagram] Success indicator not seen – falling back to redirect check.');
    }

    await humanDelay(3_000, 5_000);

    // ── 10. Extract post URL from profile ──────────────────────────────────
    debug('[Instagram] Navigating to profile to extract post URL…');

    // Determine the current user's username from the navigation link.
    let username = '';

    try {
      const profileHref = await page
        .locator('header a[href^="/"]')
        .first()
        .getAttribute('href', { timeout: 5_000 });
      username = profileHref?.replace(/^\//, '').replace(/\/$/, '') ?? '';
    } catch {
      // Fallback: try extracting from the URL after visiting the profile page.
    }

    // Navigate directly to the profile page.
    await page.goto(`${HOME_URL}${username}/`, { waitUntil: 'networkidle' });
    await humanDelay(2_000, 4_000);

    if (!username) {
      // Extract username from the current URL.
      const currentUrl = page.url();
      const match = currentUrl.match(/instagram\.com\/([^/]+)/);
      if (match && match[1]) {
        username = match[1];
      }
    }

    if (!username) {
      throw new Error(
        '[Instagram] Unable to determine username for post URL extraction.',
      );
    }

    const profileUrl = `${HOME_URL}${username}/`;
    await page.goto(profileUrl, { waitUntil: 'networkidle' });
    await humanDelay(2_000, 4_000);

    // Most recent post link.
    const postLink = page.locator('article a[href*="/p/"]').first();
    await postLink.waitFor({ state: 'visible', timeout: 10_000 });

    const postHref = await postLink.getAttribute('href');
    if (!postHref) {
      throw new Error('[Instagram] Could not extract href from the most recent post.');
    }

    const postUrl = postHref.startsWith('http')
      ? postHref
      : `https://www.instagram.com${postHref}`;

    success(`[Instagram] Post published: ${postUrl}`);
    return postUrl;
  },
};

export default instagramPlatform;
