/**
 * Pinterest browser automation platform module.
 *
 * Provides automated Pin creation capabilities for Pinterest using
 * Playwright browser automation with human-like interaction patterns.
 * Handles session validation, image upload, title/description/destination-link
 * entry, board selection, and pin URL extraction.
 *
 * Pinterest's Pin Builder is a single-page interface that previews the pin
 * live as the user fills in the form.  This module drives that form
 * programmatically while mimicking human pacing.
 *
 * @module platforms/pinterest
 * @example
 * ```ts
 * import pinterestPlatform from './platforms/pinterest.js';
 * const isLoggedIn = await pinterestPlatform.checkSession(page);
 * if (isLoggedIn) {
 *   const pinUrl = await pinterestPlatform.post(page, { product, caption, imagePath });
 * }
 * ```
 */

import type { Page } from 'playwright-core';
import type { Platform, PlatformPostInput } from './types.js';
import {
  humanDelay,
  humanType,
  humanClick,
  randomMouseMovement,
} from '../browser/human.js';
import { info, success, warn, error, debug } from '../utils/logger.js';
import env from '../utils/env.js';

/* ── constants ─────────────────────────────────────────────────────────── */

/** Pinterest login page URL. */
/** Pinterest home page URL. */
const HOME_URL = 'https://www.pinterest.com/' as const;

/** Pinterest Pin Builder (create-pin) URL. */
const PIN_BUILDER_URL = 'https://www.pinterest.com/pin-builder/' as const;

/** Maximum wait time for image upload preview in milliseconds. */
const IMAGE_UPLOAD_TIMEOUT_MS = 30_000 as const;

/** Maximum wait time for pin publication redirect in milliseconds. */
const PIN_PUBLISH_TIMEOUT_MS = 30_000 as const;

/** Maximum wait time for page navigation in milliseconds. */
const NAVIGATION_TIMEOUT_MS = 15_000 as const;

/** Maximum wait time for element selectors in milliseconds. */
const ELEMENT_SELECTOR_TIMEOUT_MS = 10_000 as const;

/** Maximum retries for resilient operations. */
const MAX_RETRIES = 3 as const;

/** Pinterest title field hard limit (characters). */
const PINTEREST_TITLE_MAX_CHARS = 100 as const;

/**
 * Delay-duration constants for various interaction points.
 * These simulate realistic human timing on Pinterest's relatively
 * heavy React-based UI.
 */
const DELAY = {
  /** Short pause after navigation or minor interaction. */
  SHORT: { min: 800, max: 1_500 },
  /** Medium pause after opening a dialog or expanding a composer. */
  MEDIUM: { min: 1_500, max: 3_000 },
  /** Long pause after uploading media or submitting a form. */
  LONG: { min: 3_000, max: 6_000 },
  /** Extra pause for Pinterest's DOM updates after publishing. */
  EXTRA_LONG: { min: 5_000, max: 10_000 },
} as const;

/**
 * CSS/XPath selector fallbacks for key Pinterest UI elements.
 * Pinterest's DOM changes frequently — multiple selectors increase resilience.
 */
const SELECTORS = {
  /** Indicators that the user is NOT logged in (login page elements). */
  loginIndicators: [
    'button:has-text("Log in")',
    'button[type="submit"]:has-text("Log in")',
    'input#email',
    'input[name="username"]',
    'input[name="password"]',
    'input[placeholder*="Email" i]',
    'input[placeholder*="Password" i]',
    '[data-test-id="login-button"]',
    'a[href="/login/"]',
  ],

  /** Indicators that the Pinterest home feed has loaded (valid session). */
  homeFeed: [
    '[data-test-id="home-feed"]',
    'div[role="main"]',
    '[data-test-id="pin"]',
    'div[aria-label="Home feed"]',
    'a[href="/today/"]',
    'a[href*="/ideas/"]',
    '[data-test-id="header-profile-button"]',
    '[data-test-id="header-create-button"]',
  ],

  /** The global "Create" button (top-right "+" icon or "Create" text). */
  createButton: [
    '[data-test-id="create-pin-button"]',
    'button:has-text("Create")',
    'div[aria-label="Create"]',
    '[data-test-id="header-create-button"]',
    'button svg[aria-label="Create"]',
  ],

  /** The "Create Pin" option inside the Create dropdown/modal. */
  createPinOption: [
    'div:has-text("Create Pin")',
    'a[href="/pin-builder/"]',
    'a[href="/pin-creation-tool/"]',
    '[data-test-id="create-pin-option"]',
  ],

  /** The hidden file input used for image upload. */
  imageUploadInput: [
    '[data-test-id="pin-draft-image-upload"] input[type="file"]',
    'input[type="file"][accept*="image"]',
    '[data-test-id="storyboard-upload-input"]',
    'input[type="file"]',
  ],

  /** Image preview element that appears after a successful upload. */
  imagePreview: [
    '[data-test-id="pin-draft-image"] img',
    '[data-test-id="storyboard-image"] img',
    'img[alt*="pin" i]',
    'div[role="img"] img',
    'img[src*="i.pinimg.com"]',
  ],

  /** The pin title input field. */
  titleInput: [
    'input[id="storyboard-selector-title"]',
    'input[placeholder*="title" i]',
    'textarea[name="title"]',
    '[data-test-id="pin-title-input"]',
    '[data-test-id="storyboard-title-input"]',
  ],

  /** The pin description textarea. */
  descriptionTextarea: [
    'textarea[id="storyboard-selector-description"]',
    'textarea[placeholder*="description" i]',
    'textarea[name="description"]',
    '[data-test-id="pin-description-textarea"]',
    '[data-test-id="storyboard-description-input"]',
  ],

  /** The destination link / URL input field. */
  linkInput: [
    'input[placeholder*="URL" i]',
    'input[name="link"]',
    'input[placeholder*="link" i]',
    'input[placeholder*="destination" i]',
    '[data-test-id="pin-link-input"]',
    '[data-test-id="storyboard-link-input"]',
  ],

  /** The board-selection dropdown trigger button. */
  boardDropdown: [
    '[data-test-id="board-dropdown-select-button"]',
    'button:has-text("Select a board")',
    'div[aria-label="Select a board"]',
    '[data-test-id="board-dropdown"]',
    'button:has-text("Choose a board")',
  ],

  /** The search input inside the board dropdown (for filtering boards). */
  boardSearchInput: [
    'input[placeholder*="search" i]',
    '[data-test-id="board-dropdown-search"] input',
    'input[placeholder*="Search" i]',
  ],

  /** The "Publish" / "Save" button that finalises pin creation. */
  publishButton: [
    'button:has-text("Publish")',
    'button[data-test-id="board-dropdown-save-button"]',
    '[data-test-id="pin-builder-publish"]',
    'button:has-text("Save")',
    'button:has-text("Create Pin")',
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
  timeout: number = ELEMENT_SELECTOR_TIMEOUT_MS,
): Promise<import('playwright-core').ElementHandle | null> {
  for (const selector of selectors) {
    try {
      debug(`[pinterest] Trying selector: ${selector}`);
      const el = await page.waitForSelector(selector, {
        state: 'visible',
        timeout,
      });
      if (el) {
        debug(`[pinterest] Matched selector: ${selector}`);
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
 * Checks whether the current page DOM indicates the user is logged in to Pinterest.
 *
 * Looks for login-form elements (invalid session) or home-feed elements
 * (valid session).  Performs random mouse movement to simulate human
 * idle behaviour before inspecting the DOM.
 *
 * @param page - The Playwright page instance.
 * @returns `true` if the session appears valid, `false` otherwise.
 */
async function checkSession(page: Page): Promise<boolean> {
  info('[pinterest] Checking Pinterest session validity...');
  await randomMouseMovement(page);
  await humanDelay(DELAY.SHORT.min, DELAY.SHORT.max);

  try {
    // Check for login-form indicators (invalid session).
    for (const selector of SELECTORS.loginIndicators) {
      const loginEl = await page.$(selector);
      if (loginEl) {
        await loginEl.dispose();
        warn('[pinterest] Login form detected — session is invalid.');
        return false;
      }
    }

    // Check for home-feed indicators (valid session).
    for (const selector of SELECTORS.homeFeed) {
      const feedEl = await page.$(selector);
      if (feedEl) {
        await feedEl.dispose();
        success('[pinterest] Home feed detected — session is valid.');
        return true;
      }
    }

    // Ambiguous state — inspect the URL for additional clues.
    warn('[pinterest] Ambiguous session state; checking URL...');
    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('/password/')) {
      warn('[pinterest] Current URL indicates login page — session is invalid.');
      return false;
    }

    // Final fallback: look for the user-profile avatar button.
    const profileBtn = await page.$('[data-test-id="header-profile-button"]');
    if (profileBtn) {
      await profileBtn.dispose();
      success('[pinterest] Profile button detected — session is valid.');
      return true;
    }

    warn('[pinterest] Unable to determine session state — assuming invalid.');
    return false;
  } catch (err) {
    error(`[pinterest] Session check error: ${(err as Error).message}`);
    return false;
  }
}

/**
 * Navigates to the Pinterest home page and waits for the page to stabilise.
 *
 * @param page - The Playwright page instance.
 * @param targetUrl - The URL to navigate to.
 * @throws If navigation fails after the maximum number of retries.
 */
async function navigateToPage(page: Page, targetUrl: string): Promise<void> {
  info(`[pinterest] Navigating to ${targetUrl}`);
  await randomMouseMovement(page);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await page.goto(targetUrl, {
        waitUntil: 'networkidle',
        timeout: NAVIGATION_TIMEOUT_MS,
      });
      await humanDelay(DELAY.MEDIUM.min, DELAY.MEDIUM.max);
      success(`[pinterest] Page loaded: ${targetUrl}`);
      return;
    } catch (err) {
      warn(
        `[pinterest] Navigation attempt ${attempt}/${MAX_RETRIES} failed: ${(err as Error).message}`,
      );
      if (attempt === MAX_RETRIES) {
        throw new Error(
          `[pinterest] Failed to navigate to ${targetUrl} after ${MAX_RETRIES} attempts: ${(err as Error).message}`,
        );
      }
      await humanDelay(DELAY.SHORT.min, DELAY.SHORT.max);
    }
  }
}

/**
 * Clicks the global "Create" button and selects "Create Pin" from the
 * resulting dropdown / modal.
 *
 * @param page - The Playwright page instance.
 * @throws If the Create button or "Create Pin" option cannot be found.
 */
async function openCreatePinFlow(page: Page): Promise<void> {
  info('[pinterest] Opening Create Pin flow...');

  // Step 1: Click the global "Create" button.
  const createBtn = await trySelectors(page, SELECTORS.createButton);
  if (!createBtn) {
    throw new Error(
      '[pinterest] Unable to locate the global "Create" button. ' +
        'Pinterest UI may have changed.',
    );
  }
  await createBtn.dispose();
  await humanClick(page, SELECTORS.createButton[0]);
  await humanDelay(DELAY.MEDIUM.min, DELAY.MEDIUM.max);
  success('[pinterest] Create button clicked.');

  // Step 2: Select "Create Pin" from the dropdown/modal.
  const createPinOpt = await trySelectors(page, SELECTORS.createPinOption);
  if (!createPinOpt) {
    // Fallback: try navigating directly to the Pin Builder URL.
    warn('[pinterest] "Create Pin" option not found — falling back to direct navigation.');
    await navigateToPage(page, PIN_BUILDER_URL);
    return;
  }
  await createPinOpt.dispose();
  await humanClick(page, SELECTORS.createPinOption[0]);
  await humanDelay(DELAY.MEDIUM.min, DELAY.MEDIUM.max);
  success('[pinterest] "Create Pin" option selected.');
}

/**
 * Uploads an image to the Pin Builder using Playwright's `setInputFiles`.
 *
 * Waits for the upload to complete by monitoring for the image preview
 * element to appear.
 *
 * @param page - The Playwright page instance.
 * @param imagePath - Absolute file-system path to the image.
 * @throws If the upload input cannot be found or the upload times out.
 */
async function uploadImage(page: Page, imagePath: string): Promise<void> {
  info(`[pinterest] Uploading image: ${imagePath}`);

  // Locate the hidden file input.
  let fileInput: import('playwright-core').ElementHandle | null = null;
  for (const selector of SELECTORS.imageUploadInput) {
    fileInput = await page.$(selector);
    if (fileInput) {
      debug(`[pinterest] Found file input via selector: ${selector}`);
      break;
    }
  }

  if (!fileInput) {
    throw new Error(
      '[pinterest] File input element not found in the Pin Builder. ' +
        'The Pin Builder interface may have changed.',
    );
  }

  await fileInput.setInputFiles(imagePath);
  await fileInput.dispose();
  debug('[pinterest] Image file attached to input element.');

  // Wait for the image preview to appear (signals successful upload).
  try {
    const preview = await trySelectors(
      page,
      SELECTORS.imagePreview,
      IMAGE_UPLOAD_TIMEOUT_MS,
    );
    if (preview) {
      await preview.dispose();
      await humanDelay(DELAY.LONG.min, DELAY.LONG.max);
      success('[pinterest] Image uploaded and preview visible.');
    } else {
      // No explicit preview — wait a bit longer and proceed.
      warn('[pinterest] No explicit image preview detected — waiting extended delay.');
      await humanDelay(DELAY.LONG.min + 2_000, DELAY.LONG.max + 2_000);
    }
  } catch {
    warn('[pinterest] Image preview check timed out — proceeding with extended delay.');
    await humanDelay(DELAY.LONG.min + 2_000, DELAY.LONG.max + 2_000);
  }
}

/**
 * Types the pin title into the title input field.
 *
 * The title is truncated to {@link PINTEREST_TITLE_MAX_CHARS} characters
 * to respect Pinterest's limit.
 *
 * @param page - The Playwright page instance.
 * @param title - The raw product title.
 * @throws If the title input cannot be found.
 */
async function typeTitle(page: Page, title: string): Promise<void> {
  const truncatedTitle = title.slice(0, PINTEREST_TITLE_MAX_CHARS);
  info(`[pinterest] Typing pin title (${truncatedTitle.length} chars)...`);

  const titleInput = await trySelectors(page, SELECTORS.titleInput);
  if (!titleInput) {
    throw new Error(
      '[pinterest] Title input field not found in the Pin Builder.',
    );
  }
  await titleInput.dispose();

  await humanType(page, SELECTORS.titleInput[0], truncatedTitle);
  await humanDelay(DELAY.SHORT.min, DELAY.SHORT.max);
  success('[pinterest] Pin title entered.');
}

/**
 * Types the pin description into the description textarea.
 *
 * @param page - The Playwright page instance.
 * @param description - The caption / description text.
 * @throws If the description textarea cannot be found.
 */
async function typeDescription(page: Page, description: string): Promise<void> {
  info(`[pinterest] Typing pin description (${description.length} chars)...`);

  const descTextarea = await trySelectors(page, SELECTORS.descriptionTextarea);
  if (!descTextarea) {
    throw new Error(
      '[pinterest] Description textarea not found in the Pin Builder.',
    );
  }
  await descTextarea.dispose();

  await humanType(page, SELECTORS.descriptionTextarea[0], description);
  await humanDelay(DELAY.SHORT.min, DELAY.SHORT.max);
  success('[pinterest] Pin description entered.');
}

/**
 * Types the destination link (product URL) into the link input field.
 *
 * @param page - The Playwright page instance.
 * @param link - The destination URL (product page).
 * @throws If the link input cannot be found.
 */
async function typeDestinationLink(page: Page, link: string): Promise<void> {
  info(`[pinterest] Typing destination link: ${link}`);

  const linkInput = await trySelectors(page, SELECTORS.linkInput);
  if (!linkInput) {
    // Pinterest sometimes collapses the link field behind an "Add a link" button.
    warn('[pinterest] Direct link input not found — attempting to expand collapsed link field.');
    const addLinkBtn = await page.$('button:has-text("Add a link"), button:has-text("Add link")');
    if (addLinkBtn) {
      await humanClick(page, 'button:has-text("Add a link"), button:has-text("Add link")');
      await humanDelay(DELAY.SHORT.min, DELAY.SHORT.max);
      await addLinkBtn.dispose();
    }

    // Retry link-input search after potential expansion.
    const linkInputRetry = await trySelectors(page, SELECTORS.linkInput);
    if (!linkInputRetry) {
      throw new Error(
        '[pinterest] Link input field not found even after attempting to expand.',
      );
    }
    await linkInputRetry.dispose();
  } else {
    await linkInput.dispose();
  }

  await humanType(page, SELECTORS.linkInput[0], link);
  await humanDelay(DELAY.SHORT.min, DELAY.SHORT.max);
  success('[pinterest] Destination link entered.');
}

/**
 * Selects the target board from the board-selection dropdown.
 *
 * Opens the dropdown, searches for the board name (configured via
 * {@link env.PINTEREST_BOARD_NAME}), and clicks the matching option.
 *
 * @param page - The Playwright page instance.
 * @throws If the dropdown cannot be opened or the board cannot be found.
 */
async function selectBoard(page: Page): Promise<void> {
  const boardName = env.PINTEREST_BOARD_NAME;
  if (!boardName) {
    warn(
      '[pinterest] PINTEREST_BOARD_NAME is not configured. ' +
        'Skipping explicit board selection — pin will be saved to the default board.',
    );
    return;
  }

  info(`[pinterest] Selecting board: "${boardName}"`);

  // Step 1: Open the board dropdown.
  const dropdown = await trySelectors(page, SELECTORS.boardDropdown);
  if (!dropdown) {
    warn(
      '[pinterest] Board dropdown not found — skipping board selection. ' +
        'Pin will be saved to the default board.',
    );
    return;
  }
  await dropdown.dispose();
  await humanClick(page, SELECTORS.boardDropdown[0]);
  await humanDelay(DELAY.SHORT.min, DELAY.SHORT.max);
  debug('[pinterest] Board dropdown opened.');

  // Step 2: Search for the board name inside the dropdown.
  const searchInput = await trySelectors(page, SELECTORS.boardSearchInput, 5_000);
  if (searchInput) {
    await searchInput.dispose();
    await humanType(page, SELECTORS.boardSearchInput[0], boardName);
    await humanDelay(DELAY.SHORT.min, DELAY.SHORT.max);
    debug(`[pinterest] Board search query typed: "${boardName}"`);
  }

  // Step 3: Click the matching board option.
  // Build a dynamic selector based on the exact board name.
  const boardOptionSelectors: string[] = [
    `div:has-text("${boardName}")`,
    `button:has-text("${boardName}")`,
    `[data-test-id="board-dropdown-item"]:has-text("${boardName}")`,
  ];

  const boardOption = await trySelectors(page, boardOptionSelectors, 8_000);
  if (!boardOption) {
    warn(
      `[pinterest] Board "${boardName}" not found in dropdown — ` +
        'pin will be saved to the default board.',
    );
    return;
  }
  await boardOption.dispose();
  await humanClick(page, boardOptionSelectors[0]);
  await humanDelay(DELAY.SHORT.min, DELAY.SHORT.max);
  success(`[pinterest] Board "${boardName}" selected.`);
}

/**
 * Clicks the "Publish" button to submit the pin.
 *
 * @param page - The Playwright page instance.
 * @throws If the Publish button cannot be found or clicked.
 */
async function clickPublishButton(page: Page): Promise<void> {
  info('[pinterest] Clicking Publish button...');

  const publishBtn = await trySelectors(page, SELECTORS.publishButton);
  if (!publishBtn) {
    throw new Error(
      '[pinterest] Unable to locate the "Publish" button in the Pin Builder.',
    );
  }
  await publishBtn.dispose();
  await humanClick(page, SELECTORS.publishButton[0]);
  await humanDelay(DELAY.EXTRA_LONG.min, DELAY.EXTRA_LONG.max);
  success('[pinterest] Publish button clicked — pin submitted.');
}

/**
 * Waits for the pin creation to complete and extracts the new pin's URL.
 *
 * Pinterest redirects to the newly created pin page after successful
 * publication.  The URL pattern is:
 * `https://www.pinterest.com/pin/{pin_id}/`
 *
 * @param page - The Playwright page instance.
 * @returns The full URL of the newly created pin.
 * @throws If the pin URL cannot be extracted within the timeout.
 */
async function extractPinUrl(page: Page): Promise<string> {
  info('[pinterest] Waiting for pin creation to complete and extracting URL...');

  const deadline = Date.now() + PIN_PUBLISH_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      const currentUrl = page.url();

      // Check if we've been redirected to a pin page.
      if (currentUrl.includes('/pin/')) {
        // Normalise the URL (remove query parameters and hash).
        const url = new URL(currentUrl);
        const pinUrl = `${url.origin}${url.pathname}`;
        success(`[pinterest] Pin URL extracted: ${pinUrl}`);
        return pinUrl;
      }

      // If not yet redirected, wait and check again.
      await humanDelay(2_000, 4_000);
    } catch (err) {
      debug(`[pinterest] URL extraction attempt failed: ${(err as Error).message}`);
      await humanDelay(2_000, 4_000);
    }
  }

  // Timeout reached — try a last-resort DOM scan for pin links.
  warn('[pinterest] URL-based extraction timed out — attempting DOM fallback...');
  try {
    const pinLinks = await page.$$('a[href*="/pin/"]');
    for (const link of pinLinks) {
      const href = await link.getAttribute('href');
      await link.dispose();
      if (href && /^\/pin\/\d+\/?$/.test(href)) {
        const pinUrl = href.startsWith('http') ? href : `https://www.pinterest.com${href}`;
        success(`[pinterest] Pin URL extracted (DOM fallback): ${pinUrl}`);
        return pinUrl;
      }
    }
  } catch {
    /* ignore */
  }

  throw new Error(
    '[pinterest] Timed out waiting for the pin to be created and its URL to become available.',
  );
}

/* ── platform implementation ───────────────────────────────────────────── */

/**
 * Pinterest platform automation implementation.
 *
 * Provides methods to validate an existing browser session and publish
 * Pins (with images, titles, descriptions, destination links, and board
 * selection) to Pinterest.
 *
 * @implements {Platform}
 */
const pinterestPlatform: Platform = {
  /** Internal platform identifier. */
  name: 'pinterest',

  /** Human-readable platform name shown in CLI output. */
  displayName: 'Pinterest',

  /**
   * Validates whether the browser session is authenticated with Pinterest.
   *
   * Navigates to the Pinterest home page and inspects the DOM for login
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
   * Creates and publishes a new Pin on Pinterest with an image attachment.
   *
   * The full workflow:
   *   1. Navigate to the Pinterest home page.
   *   2. Click the global "Create" button and select "Create Pin".
   *   3. Upload the image file via the Pin Builder's file input.
   *   4. Wait for the image preview to appear.
   *   5. Enter the pin title (product title truncated to 100 characters).
   *   6. Enter the pin description (the caption).
   *   7. Enter the destination link (product URL).
   *   8. Select the target board from the dropdown (via PINTEREST_BOARD_NAME).
   *   9. Click the "Publish" button to submit the pin.
   *   10. Wait for the redirect to the new pin page and extract its URL.
   *
   * @param page - The Playwright page instance to use.
   * @param input - Post content including product metadata, caption, and image path.
   * @returns Resolves to the full URL of the published Pinterest pin.
   * @throws If any step of the pin-creation workflow fails.
   */
  async post(page: Page, input: PlatformPostInput): Promise<string> {
    const { product, caption, imagePath } = input;

    info('[pinterest] Starting Pinterest pin creation workflow...');

    try {
      // Step 1: Navigate to Pinterest home.
      await navigateToPage(page, HOME_URL);

      // Step 2: Open the Create → Create Pin flow.
      await openCreatePinFlow(page);

      // Step 3: Upload the image.
      await uploadImage(page, imagePath);

      // Step 4: Enter the pin title (truncated to 100 chars).
      await typeTitle(page, product.title);

      // Step 5: Enter the pin description.
      await typeDescription(page, caption);

      // Step 6: Enter the destination link.
      await typeDestinationLink(page, product.url);

      // Step 7: Select the target board.
      await selectBoard(page);

      // Step 8: Click Publish.
      await clickPublishButton(page);

      // Step 9: Extract the new pin URL.
      const pinUrl = await extractPinUrl(page);

      success(`[pinterest] Pin published successfully: ${pinUrl}`);
      return pinUrl;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      error(`[pinterest] Pin creation failed: ${message}`);
      throw new Error(`[pinterest] Pin creation failed: ${message}`);
    }
  },
};

export default pinterestPlatform;
