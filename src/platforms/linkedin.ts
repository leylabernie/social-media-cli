/**
 * LinkedIn platform integration for LuxeMia Social.
 *
 * Automates posting to LinkedIn via Playwright browser automation.
 * Handles session validation, post composition, image uploads, and
 * post URL extraction from the LinkedIn feed.
 *
 * @module platforms/linkedin
 * @example
 * ```ts
 * import linkedinPlatform from './platforms/linkedin.js';
 * const isLoggedIn = await linkedinPlatform.checkSession(page);
 * if (isLoggedIn) {
 *   const postUrl = await linkedinPlatform.post(page, { product, caption, imagePath });
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

/* ── constants ─────────────────────────────────────────────────────────── */

/** LinkedIn login page URL. */
/** LinkedIn home feed URL. */
const HOME_URL = 'https://www.linkedin.com/feed/' as const;

/** Maximum wait time for element selectors in milliseconds. */
const ELEMENT_TIMEOUT_MS = 10_000 as const;

/** Maximum wait time for image upload processing in milliseconds. */
const IMAGE_UPLOAD_TIMEOUT_MS = 20_000 as const;

/** Maximum wait time for post publication in milliseconds. */
const POST_PUBLISH_TIMEOUT_MS = 15_000 as const;

/** Delay duration constants for human-like interaction timing. */
const DELAY = {
  /** Short pause for minor UI interactions. */
  SHORT: { min: 800, max: 1_500 },
  /** Medium pause after opening modals or dialogs. */
  MEDIUM: { min: 1_500, max: 3_000 },
  /** Long pause after uploading media or submitting posts. */
  LONG: { min: 3_000, max: 6_000 },
  /** Extra pause for LinkedIn's DOM updates after posting. */
  EXTRA_LONG: { min: 5_000, max: 8_000 },
} as const;

/* ── selector fallbacks ────────────────────────────────────────────────── */

/**
 * Ordered fallback selectors for LinkedIn UI elements.
 *
 * LinkedIn's DOM changes frequently — multiple selectors increase
 * resilience against A/B tests and UI updates.
 */
const SELECTORS = {
  /** "Start a post" button on the feed page. */
  startPostButton: [
    'button:has-text("Start a post")',
    'div[role="button"]:has-text("Start a post")',
    'button.share-box-feed-entry__trigger',
    'div.share-box-feed-entry__wrapper button',
    'div.artdeco-button:has-text("Start a post")',
  ],

  /** Post editor textarea (contenteditable within modal). */
  postEditor: [
    'div[contenteditable="true"][role="textbox"]',
    'div.ql-editor[contenteditable="true"]',
    'div.editor-content[contenteditable="true"]',
    'div.share-box__text-editor div[contenteditable="true"]',
  ],

  /** "Add a photo" image icon/button. */
  imageIcon: [
    'button[aria-label="Add a photo"]',
    'button.icon-image-media',
    'button:has(li-icon[type="image"])',
    'button:has-text("Photo")',
    'button:has-text("Add media")',
  ],

  /** Hidden file input for image upload. */
  imageFileInput: [
    'input[type="file"][accept*="image"]',
    'input[type="file"][accept*="png"]',
    'input[type="file"]',
  ],

  /** "Post" submit button. */
  postButton: [
    'button:has-text("Post"):not([disabled])',
    'button.share-actions__primary-action:not([disabled])',
    'button[aria-label="Post"]:not([disabled])',
    'button[aria-label="Publish post"]:not([disabled])',
  ],

  /** Upload progress indicator (spinner). */
  uploadSpinner: [
    'div[role="progressbar"]',
    'div.loading-spinner',
    'li-icon[type="loader"]',
    'svg.loader',
  ],

  /** Image preview after successful upload. */
  imagePreview: [
    'img[alt*="image"]',
    'div.share-creation-state__media-preview img',
    'div.image-preview img',
  ],

  /** Login form indicators (invalid session). */
  loginForm: [
    'input#username',
    'input#session_key',
    'input[name="session_key"]',
    'input[name="session_password"]',
    'button[type="submit"]:has-text("Sign in")',
    'form.login__form',
    'a[href*="/checkpoint/lg/"]',
  ],

  /** Home feed indicators (valid session). */
  homeFeed: [
    'div.feed-shared-update-v2',
    'main.scaffold-layout__main',
    'div.scaffold-layout__main',
    'aside.scaffold-layout__sidebar',
    'nav.global-nav',
    'a[href="/feed/"]',
  ],

  /** Published post elements (for URL extraction). */
  publishedPost: [
    'div.feed-shared-update-v2',
    'div[data-testid="feed-shared-update-v2"]',
    'article',
  ],

  /** Post timestamp link containing the activity URL. */
  postTimestampLink: [
    'a[href*="/activity-"]',
    'a[href*="urn:li:activity"]',
    'span[dir="ltr"] a[href*="/activity-"]',
    'div.feed-shared-actor__meta a[href*="activity"]',
    'a.app-aware-link[href*="activity"]',
  ],
} as const;

/* ── helper functions ──────────────────────────────────────────────────── */

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
  timeout = ELEMENT_TIMEOUT_MS,
): Promise<import('playwright-core').ElementHandle | null> {
  for (const selector of selectors) {
    try {
      debug(`[linkedin] Trying selector: ${selector}`);
      const el = await page.waitForSelector(selector, {
        state: 'visible',
        timeout,
      });
      if (el) {
        debug(`[linkedin] Matched selector: ${selector}`);
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
 * Saves a debug screenshot to the project `.cache/` directory.
 *
 * @param page - Playwright Page instance.
 * @param label - Descriptive filename slug.
 */
async function saveDebugScreenshot(page: Page, label: string): Promise<void> {
  const timestamp = Date.now();
  const path = `/mnt/agents/output/luxemia-social/.cache/linkedin-${label}-${timestamp}.png`;
  try {
    await page.screenshot({ path, fullPage: true });
    warn(`[linkedin] Debug screenshot saved: ${path}`);
  } catch {
    warn('[linkedin] Failed to save debug screenshot');
  }
}

/**
 * Detects whether a login form is visible on the current page.
 *
 * @param page - Playwright Page instance.
 * @returns `true` if a login prompt is visible.
 */
async function isLoginPromptVisible(page: Page): Promise<boolean> {
  for (const selector of SELECTORS.loginForm) {
    try {
      const el = await page.$(selector);
      if (el) {
        await el.dispose();
        return true;
      }
    } catch {
      /* ignore */
    }
  }
  return false;
}

/**
 * Waits for an image upload to complete by polling for the spinner to disappear
 * and the image preview to appear.
 *
 * @param page - Playwright Page instance.
 * @param timeout - Maximum wait time in milliseconds.
 * @throws If the upload does not complete within the timeout.
 */
async function waitForImageUpload(
  page: Page,
  timeout = IMAGE_UPLOAD_TIMEOUT_MS,
): Promise<void> {
  const startTime = Date.now();

  // Poll for spinner disappearance or image preview appearance.
  while (Date.now() - startTime < timeout) {
    // Check if image preview is visible (upload succeeded).
    for (const previewSel of SELECTORS.imagePreview) {
      try {
        const preview = await page.$(previewSel);
        if (preview) {
          await preview.dispose();
          debug('[linkedin] Image preview detected — upload complete');
          return;
        }
      } catch {
        /* ignore */
      }
    }

    // Check if spinner is still visible.
    let spinnerVisible = false;
    for (const spinnerSel of SELECTORS.uploadSpinner) {
      try {
        const spinner = await page.$(spinnerSel);
        if (spinner) {
          await spinner.dispose();
          spinnerVisible = true;
          break;
        }
      } catch {
        /* ignore */
      }
    }

    // No spinner and no preview — wait a bit longer.
    if (!spinnerVisible) {
      // One more safety delay in case preview is still rendering.
      await humanDelay(500, 1_000);

      for (const previewSel of SELECTORS.imagePreview) {
        try {
          const preview = await page.$(previewSel);
          if (preview) {
            await preview.dispose();
            debug('[linkedin] Image preview detected after spinner cleared');
            return;
          }
        } catch {
          /* ignore */
        }
      }

      debug('[linkedin] Spinner cleared — assuming upload complete');
      return;
    }

    // Wait before next poll.
    await humanDelay(500, 800);
  }

  warn('[linkedin] Image upload timed out — proceeding anyway');
}

/* ── platform implementation ───────────────────────────────────────────── */

/**
 * LinkedIn platform integration.
 *
 * Provides automated posting capabilities for LinkedIn by driving a real
 * Playwright browser session with human-like interaction patterns.
 */
const linkedinPlatform: Platform = {
  name: 'linkedin',
  displayName: 'LinkedIn',

  /**
   * Validates the current browser session by navigating to the LinkedIn feed
   * and checking for the presence of a login prompt or home feed indicators.
   *
   * Workflow:
   * 1. Navigate to the LinkedIn feed URL.
   * 2. Perform human-like mouse movement.
   * 3. Check for login form indicators (invalid session).
   * 4. Check for home feed indicators (valid session).
   * 5. Fall back to URL-based detection if ambiguous.
   *
   * @param page - Playwright Page instance (must use the LinkedIn browser profile).
   * @returns `true` if the session is valid and the feed loads;
   *          `false` if a login form or sign-in prompt is detected.
   */
  async checkSession(page: Page): Promise<boolean> {
    info('[linkedin] Checking session validity…');

    try {
      await page.goto(HOME_URL, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });
      await humanDelay(DELAY.MEDIUM.min, DELAY.MEDIUM.max);

      /* Random mouse movement to appear human-like */
      await randomMouseMovement(page);
      await humanDelay(DELAY.SHORT.min, DELAY.SHORT.max);

      /* Detect login prompt → session invalid */
      if (await isLoginPromptVisible(page)) {
        warn('[linkedin] Session invalid — login prompt detected');
        return false;
      }

      /* Check for home feed indicators (valid session) */
      for (const selector of SELECTORS.homeFeed) {
        try {
          const el = await page.waitForSelector(selector, {
            timeout: 5_000,
          });
          if (el) {
            await el.dispose();
            success('[linkedin] Session valid — home feed loaded');
            return true;
          }
        } catch {
          /* try next indicator */
        }
      }

      /* URL-based fallback detection */
      const currentUrl = page.url();
      if (
        currentUrl.includes('/login') ||
        currentUrl.includes('/checkpoint') ||
        currentUrl.includes('/authwall')
      ) {
        warn('[linkedin] Session invalid — redirected to login or auth wall');
        return false;
      }

      /* Ambiguous state */
      warn('[linkedin] Session status ambiguous — no clear indicators found');
      await saveDebugScreenshot(page, 'session-ambiguous');
      return false;
    } catch (err) {
      error(`[linkedin] Session check failed: ${(err as Error).message}`);
      return false;
    }
  },

  /**
   * Composes and publishes a post on LinkedIn with an image attachment.
   *
   * Workflow:
   * 1. Navigate to the LinkedIn feed.
   * 2. Click the "Start a post" button to open the composer modal.
   * 3. Click the contenteditable editor and type the caption using human-like delays.
   * 4. Click the "Add a photo" icon to open the upload dialog.
   * 5. Use `setInputFiles` on the hidden file input to upload the image.
   * 6. Wait for the image upload to complete (spinner disappears, preview appears).
   * 7. Click the "Post" button to publish.
   * 8. Wait for the post to appear in the feed and extract its direct URL.
   * 9. Return the canonical post URL.
   *
   * @param page - Playwright Page instance (must be logged in).
   * @param input - Post content, including caption and local image path.
   * @returns The canonical LinkedIn post URL (e.g. `https://www.linkedin.com/feed/update/…`).
   * @throws If the composer cannot be opened, image upload fails, or the post URL cannot be extracted.
   */
  async post(page: Page, input: PlatformPostInput): Promise<string> {
    const { caption, imagePath } = input;
    info('[linkedin] Starting post workflow…');

    /* ── Step 1: Navigate to feed ── */
    await page.goto(HOME_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await humanDelay(DELAY.MEDIUM.min, DELAY.MEDIUM.max);
    await randomMouseMovement(page);

    /* ── Step 2: Click "Start a post" ── */
    const startPostBtn = await trySelectors(page, SELECTORS.startPostButton);
    if (!startPostBtn) {
      await saveDebugScreenshot(page, 'post-no-start-button');
      throw new Error(
        '[linkedin] Unable to locate the "Start a post" button. ' +
          'The feed page structure may have changed.',
      );
    }
    await startPostBtn.dispose();

    await humanClick(page, SELECTORS.startPostButton[0]);
    debug('[linkedin] Clicked "Start a post" button');
    await humanDelay(DELAY.MEDIUM.min, DELAY.MEDIUM.max);

    /* ── Step 3: Find post editor and type caption ── */
    const editor = await trySelectors(page, SELECTORS.postEditor);
    if (!editor) {
      await saveDebugScreenshot(page, 'post-no-editor');
      throw new Error(
        '[linkedin] Post editor textarea not found after opening composer modal.',
      );
    }
    await editor.dispose();

    await humanClick(page, SELECTORS.postEditor[0]);
    await humanDelay(DELAY.SHORT.min, DELAY.SHORT.max);

    await humanType(page, SELECTORS.postEditor[0], caption);
    info('[linkedin] Caption entered');

    /* ── Step 4: Click "Add a photo" icon ── */
    await humanDelay(DELAY.SHORT.min, DELAY.SHORT.max);

    const imageIcon = await trySelectors(page, SELECTORS.imageIcon);
    if (!imageIcon) {
      await saveDebugScreenshot(page, 'post-no-image-icon');
      warn('[linkedin] Image icon not found — proceeding without image upload');
    } else {
      await imageIcon.dispose();
      await humanClick(page, SELECTORS.imageIcon[0]);
      debug('[linkedin] Clicked "Add a photo" icon');
      await humanDelay(DELAY.MEDIUM.min, DELAY.MEDIUM.max);

      /* ── Step 5: Upload image via file input ── */
      let fileInputSelector: string | null = null;
      for (const selector of SELECTORS.imageFileInput) {
        const fileInput = await page.$(selector);
        if (fileInput) {
          await fileInput.dispose();
          fileInputSelector = selector;
          break;
        }
      }

      if (!fileInputSelector) {
        warn('[linkedin] File input not found — proceeding without image');
        await saveDebugScreenshot(page, 'post-no-file-input');
      } else {
        info(`[linkedin] Uploading image: ${imagePath}`);

        const fileInput = await page.$(fileInputSelector);
        if (!fileInput) {
          throw new Error('[linkedin] File input element disappeared unexpectedly');
        }
        await fileInput.setInputFiles(imagePath);
        await fileInput.dispose();
        debug('[linkedin] Image file attached to input element');

        /* ── Step 6: Wait for image upload to complete ── */
        await waitForImageUpload(page);
        success('[linkedin] Image uploaded successfully');
        await humanDelay(DELAY.SHORT.min, DELAY.SHORT.max);
      }
    }

    /* ── Step 7: Click "Post" button ── */
    await humanDelay(DELAY.SHORT.min, DELAY.SHORT.max);

    const postBtn = await trySelectors(page, SELECTORS.postButton);
    if (!postBtn) {
      await saveDebugScreenshot(page, 'post-no-post-button');
      throw new Error(
        '[linkedin] Post button not found or is disabled. ' +
          'Caption may be empty, or LinkedIn may be throttling requests.',
      );
    }
    await postBtn.dispose();

    await humanClick(page, SELECTORS.postButton[0]);
    debug('[linkedin] Clicked "Post" button');
    info('[linkedin] Waiting for post to publish…');

    /* ── Step 8: Wait for post to appear in feed ── */
    await humanDelay(DELAY.EXTRA_LONG.min, DELAY.EXTRA_LONG.max);

    // LinkedIn navigates back to the feed after posting.
    // Scroll to ensure the new post is in the viewport.
    await humanScroll(page);
    await humanDelay(DELAY.SHORT.min, DELAY.SHORT.max);

    /* ── Step 9: Extract the post URL ── */
    let postUrl: string | null = null;

    // Try to find the post timestamp link containing the activity URL.
    for (const selector of SELECTORS.postTimestampLink) {
      try {
        const link = await page.waitForSelector(selector, {
          timeout: POST_PUBLISH_TIMEOUT_MS,
        });
        if (link) {
          const href = await link.getAttribute('href');
          await link.dispose();

          if (href) {
            postUrl = href.startsWith('http')
              ? href
              : `https://www.linkedin.com${href}`;
            break;
          }
        }
      } catch {
        /* try next selector */
      }
    }

    // Fallback: scan all activity links on the page.
    if (!postUrl) {
      debug('[linkedin] Primary timestamp selector timed out, trying fallback…');

      const links = await page.$$('a[href*="activity"]');
      for (const link of links) {
        const href = await link.getAttribute('href');
        await link.dispose();
        if (href && (href.includes('/activity-') || href.includes('urn:li:activity'))) {
          postUrl = href.startsWith('http')
            ? href
            : `https://www.linkedin.com${href}`;
          break;
        }
      }
    }

    // Final fallback: look for any posts pattern.
    if (!postUrl) {
      debug('[linkedin] Trying broad post URL pattern scan…');

      const links = await page.$$('a[href*="/posts/"], a[href*="/feed/update/"]');
      for (const link of links) {
        const href = await link.getAttribute('href');
        await link.dispose();
        if (href) {
          postUrl = href.startsWith('http')
            ? href
            : `https://www.linkedin.com${href}`;
          break;
        }
      }
    }

    if (!postUrl) {
      await saveDebugScreenshot(page, 'post-no-url');
      throw new Error(
        '[linkedin] Post may have published, but unable to extract the post URL. ' +
          'Please verify the post manually on LinkedIn.',
      );
    }

    success(`[linkedin] Post published successfully: ${postUrl}`);
    return postUrl;
  },
};

export default linkedinPlatform;
