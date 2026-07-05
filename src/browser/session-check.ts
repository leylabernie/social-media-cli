/**
 * @file Session validity checker for all supported platforms.
 * Navigates to each platform and checks if the user is still logged in.
 * @module luxemia-social/browser/session-check
 */

import type { Page } from 'playwright-core';
import { humanDelay } from './human.js';
import { debug, warn } from '../utils/logger.js';

/**
 * Platform-specific session check configuration.
 * Each entry defines the URL and selector(s) used to detect login state.
 */
const PLATFORM_CHECKS: Record<
  string,
  {
    /** URL to navigate to for session checking */
    url: string;
    /** CSS selector that indicates the user is logged OUT */
    loginIndicator: string;
    /** Optional additional selector that confirms logged-in state */
    feedIndicator?: string;
  }
> = {
  x: {
    url: 'https://x.com/home',
    loginIndicator: '[data-testid="loginButton"], a[href="/login"]',
    feedIndicator: '[data-testid="primaryColumn"]',
  },
  instagram: {
    url: 'https://www.instagram.com/',
    loginIndicator: 'input[name="username"], input[name="password"]',
    feedIndicator: '[data-testid="user-avatar"], svg[aria-label="Home"]',
  },
  facebook: {
    url: 'https://www.facebook.com/',
    loginIndicator: 'input[name="email"], input[name="pass"], [data-testid="royal_login_button"]',
    feedIndicator: '[aria-label="Facebook"]',
  },
  pinterest: {
    url: 'https://www.pinterest.com/',
    loginIndicator: '[data-testid="login-button"], a[href="/login/"]',
    feedIndicator: '[data-testid="home-feed"]',
  },
  linkedin: {
    url: 'https://www.linkedin.com/feed/',
    loginIndicator: '.sign-in-form, input[name="session_key"]',
    feedIndicator: '.share-box-feed-entry__wrapper',
  },
};

/**
 * Check if the current browser session is valid for a given platform.
 * Navigates to the platform's home page and checks for login indicators.
 * @param platform - Platform identifier (e.g., 'x', 'instagram', 'facebook', 'pinterest', 'linkedin')
 * @param page - Playwright page instance
 * @returns True if the session is valid (user is logged in), false otherwise
 */
export async function checkSession(platform: string, page: Page): Promise<boolean> {
  const check = PLATFORM_CHECKS[platform];
  if (!check) {
    warn(`Unknown platform "${platform}" — cannot check session`);
    return false;
  }

  try {
    debug(`Checking session for ${platform} at ${check.url}...`);
    await page.goto(check.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await humanDelay(1000, 2000);

    // Check for login form indicators (logged out state)
    const loginForm = await page.locator(check.loginIndicator).first();
    const isLoginVisible = await loginForm.isVisible().catch(() => false);

    if (isLoginVisible) {
      debug(`Login form visible for ${platform} — session invalid`);
      return false;
    }

    // If we have a feed indicator, verify it's present
    if (check.feedIndicator) {
      const feed = await page.locator(check.feedIndicator).first();
      const isFeedVisible = await feed.isVisible().catch(() => false);

      if (!isFeedVisible) {
        debug(`Feed not visible for ${platform} — session may be invalid`);
        return false;
      }
    }

    debug(`Session valid for ${platform}`);
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    warn(`Session check error for ${platform}: ${message}`);
    return false;
  }
}
