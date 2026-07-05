/**
 * @file X (Twitter) platform integration for LuxeMia Social.
 *
 * Automates posting to X (formerly Twitter) via Playwright browser automation.
 * Handles session validation, media upload, caption entry, and tweet URL extraction.
 *
 * @module platforms/x
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

/* ── constants ─────────────────────────────────────────────────────────── */

const HOME_URL = 'https://x.com/home';
const COMPOSE_URL = 'https://x.com/compose/post';

/* ── captcha / challenge detection ─────────────────────────────────────── */

/**
 * Checks whether the current page has triggered a security challenge
 * (e.g. CAPTCHA, phone-verification gate, or unusual-activity warning).
 *
 * @param page - Playwright Page instance
 * @returns `true` if a challenge is detected
 */
async function isChallengeDetected(page: Page): Promise<boolean> {
  const challengeSelectors: string[] = [
    '[data-testid="ocfEnterTextTextInput"]',
    'input[name="challenge_response"]',
    '#challenge-form',
    'form[action*="challenge"]',
    '[data-testid="PhoneVerification_ChallengeChoice"]',
    'div:has-text(" suspicious")',
    'div:has-text("unusual activity")',
    'div:has-text("security challenge")',
  ];

  for (const sel of challengeSelectors) {
    try {
      const el = await page.$(sel);
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
 * Saves a debug screenshot to the project `.cache/` directory.
 *
 * @param page - Playwright Page instance
 * @param label - Descriptive filename slug
 */
async function saveDebugScreenshot(page: Page, label: string): Promise<void> {
  const timestamp = Date.now();
  const path = `/mnt/agents/output/luxemia-social/.cache/x-${label}-${timestamp}.png`;
  try {
    await page.screenshot({ path, fullPage: true });
    warn(`[x] Debug screenshot saved: ${path}`);
  } catch {
    warn('[x] Failed to save debug screenshot');
  }
}

/* ── session helpers ───────────────────────────────────────────────────── */

/**
 * Detects whether X is presenting a login / sign-in form on the current page.
 *
 * @param page - Playwright Page instance
 * @returns `true` if a login prompt is visible
 */
async function isLoginPromptVisible(page: Page): Promise<boolean> {
  const loginIndicators: string[] = [
    '[data-testid="loginButton"]',
    '[data-testid="ocfEnterTextTextInput"]',
    'input[autocomplete="username"]',
    'input[name="text"]',
    'input[name="session[username_or_email]"]',
    'a[href="/login"]',
    'a[href="/i/flow/login"]',
  ];

  for (const sel of loginIndicators) {
    try {
      const el = await page.$(sel);
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

/* ── platform implementation ───────────────────────────────────────────── */

/**
 * X (Twitter) platform integration.
 *
 * Provides automated posting capabilities for X by driving a real
 * Playwright browser session with human-like interaction patterns.
 */
const xPlatform: Platform = {
  name: 'x',
  displayName: 'X (Twitter)',

  /**
   * Validates the current browser session by navigating to the X home feed
   * and checking for the presence of a login prompt.
   *
   * @param page - Playwright Page instance (must use the X browser profile)
   * @returns `true` if the session is valid and the feed loads;
   *          `false` if a login form or "Log in" button is detected
   */
  async checkSession(page: Page): Promise<boolean> {
    info('[x] Checking session validity…');

    try {
      await page.goto(HOME_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await humanDelay(1_500, 3_000);

      /* Random mouse movement to appear human-like */
      await randomMouseMovement(page);
      await humanDelay(500, 1_200);

      /* Check for security challenge first */
      if (await isChallengeDetected(page)) {
        warn('[x] Security challenge detected during session check');
        await saveDebugScreenshot(page, 'session-challenge');
        return false;
      }

      /* Detect login prompt → session invalid */
      if (await isLoginPromptVisible(page)) {
        warn('[x] Session invalid — login prompt detected');
        return false;
      }

      /* Look for a home-timeline indicator (sidebar or tweet articles) */
      const homeIndicators: string[] = [
        '[data-testid="primaryColumn"]',
        '[data-testid="sidebarColumn"]',
        'article[data-testid="tweet"]',
        '[data-testid="AppTabBar_Home_Link"]',
      ];

      for (const sel of homeIndicators) {
        try {
          const el = await page.waitForSelector(sel, { timeout: 5_000 });
          if (el) {
            await el.dispose();
            success('[x] Session valid — home feed loaded');
            return true;
          }
        } catch {
          /* try next indicator */
        }
      }

      /* If neither login nor feed indicator found, conservatively mark invalid */
      warn('[x] Session status ambiguous — no feed indicators found');
      await saveDebugScreenshot(page, 'session-ambiguous');
      return false;
    } catch (err) {
      error(`[x] Session check failed: ${(err as Error).message}`);
      return false;
    }
  },

  /**
   * Composes and publishes a post on X with an optional image attachment.
   *
   * Workflow:
   * 1. Navigate to the compose page
   * 2. Enter the caption into the tweet textarea
   * 3. Upload the image (if provided) via a hidden file input
   * 4. Click the Post button
   * 5. Wait for the tweet to appear in the feed and extract its URL
   *
   * @param page - Playwright Page instance (must be logged in)
   * @param input - Post content, including caption and optional local image path
   * @returns The canonical tweet URL (e.g. `https://x.com/username/status/…`)
   * @throws If a security challenge is encountered or posting fails after retries
   */
  async post(page: Page, input: PlatformPostInput): Promise<string> {
    const { caption, imagePath } = input;
    info('[x] Starting post workflow…');

    /* ── Step 1: Navigate to compose ── */
    await page.goto(COMPOSE_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await humanDelay(2_000, 4_000);
    await randomMouseMovement(page);

    /* Check for challenge */
    if (await isChallengeDetected(page)) {
      await saveDebugScreenshot(page, 'post-challenge');
      throw new Error(
        '[x] Security challenge detected. Manual intervention required. ' +
        'Please log in via the headed browser and complete any verification steps.'
      );
    }

    /* ── Step 2: Wait for the composer textarea ── */
    const composeSelector = '[data-testid="tweetTextarea_0"]';
    let composer: import('playwright-core').ElementHandle | null = null;

    try {
      composer = await page.waitForSelector(composeSelector, {
        state: 'visible',
        timeout: 10_000,
      });
    } catch {
      /* Fallback: try clicking the inline compose trigger on home */
      debug('[x] Composer textarea not found directly, attempting fallback…');
      await page.goto(HOME_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await humanDelay(1_500, 3_000);

      const inlineCompose = await page.$('[data-testid="InlineComposerPrompt"]');
      if (inlineCompose) {
        await inlineCompose.dispose();
        await humanClick(page, '[data-testid="InlineComposerPrompt"]');
        await humanDelay(1_000, 2_000);
        composer = await page.waitForSelector(composeSelector, {
          state: 'visible',
          timeout: 10_000,
        });
      }
    }

    if (!composer) {
      await saveDebugScreenshot(page, 'post-no-composer');
      throw new Error('[x] Unable to locate the tweet composer textarea');
    }
    await composer.dispose();
    debug('[x] Composer textarea is ready');

    /* ── Step 3: Type the caption ── */
    await humanDelay(800, 1_500);
    await humanType(page, composeSelector, caption);
    info('[x] Caption entered');

    /* ── Step 4: Upload image (if provided) ── */
    if (imagePath && imagePath.trim().length > 0) {
      info(`[x] Attaching image: ${imagePath}`);
      await humanDelay(1_000, 2_000);

      /* Locate the hidden file input */
      const fileInputSelector = 'input[type="file"][accept*="image"]';
      const fileInput = await page.$(fileInputSelector);

      if (!fileInput) {
        warn('[x] Image upload input not found — proceeding without image');
        await saveDebugScreenshot(page, 'post-no-file-input');
      } else {
        await fileInput.setInputFiles(imagePath);
        await fileInput.dispose();

        /* Wait for the image preview thumbnail to appear */
        await humanDelay(2_000, 4_000);
        try {
          await page.waitForSelector('[data-testid="tweetPhoto"] img, [data-testid="attachments"] img', {
            timeout: 15_000,
          });
          success('[x] Image preview loaded');
        } catch {
          warn('[x] Image preview did not appear in time — proceeding anyway');
        }
      }
    }

    /* ── Step 5: Click the Post button ── */
    await humanDelay(1_000, 2_000);

    const postButtonSelectors: string[] = [
      '[data-testid="tweetButton"]',
      '[data-testid="tweetButtonInline"]',
    ];

    let posted = false;
    for (const sel of postButtonSelectors) {
      try {
        const btn = await page.$(sel);
        if (btn) {
          const isDisabled = await btn.evaluate(
            (el: any) => el.disabled
          );
          if (!isDisabled) {
            await humanClick(page, sel);
            posted = true;
            debug(`[x] Clicked post button via ${sel}`);
            break;
          }
        }
      } catch {
        /* try next selector */
      }
    }

    if (!posted) {
      await saveDebugScreenshot(page, 'post-button-disabled');
      throw new Error('[x] Post button not found or disabled — caption may be empty or too long');
    }

    /* ── Step 6: Wait for the tweet to appear in the feed ── */
    info('[x] Waiting for tweet to publish…');
    await humanDelay(3_000, 6_000);

    /* After posting X navigates to the home feed where the new tweet appears */
    const tweetLinkSelector = 'article[data-testid="tweet"] a[href*="/status/"]';
    let tweetUrl: string | null = null;

    try {
      /* Wait for at least one tweet article with a status link */
      const tweetLink = await page.waitForSelector(tweetLinkSelector, {
        timeout: 15_000,
      });

      if (tweetLink) {
        const href = await tweetLink.getAttribute('href');
        await tweetLink.dispose();

        if (href) {
          tweetUrl = href.startsWith('http') ? href : `https://x.com${href}`;
        }
      }
    } catch {
      /* If the selector didn't match, try a broader search */
      debug('[x] Primary tweet selector timed out, trying fallback…');
    }

    /* Fallback: scan all status links and pick the first one */
    if (!tweetUrl) {
      const links = await page.$$('a[href*="/status/"]');
      for (const link of links) {
        const href = await link.getAttribute('href');
        await link.dispose();
        if (href && href.includes('/status/')) {
          tweetUrl = href.startsWith('http') ? href : `https://x.com${href}`;
          break;
        }
      }
    }

    if (!tweetUrl) {
      await saveDebugScreenshot(page, 'post-no-tweet-url');
      throw new Error('[x] Tweet may have posted, but unable to extract the tweet URL');
    }

    success(`[x] Tweet published successfully: ${tweetUrl}`);
    return tweetUrl;
  },
};

export default xPlatform;
