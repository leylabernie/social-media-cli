/**
 * @file Browser launch utilities for posting and authentication.
 * Wraps Playwright with stealth plugins and persistent profiles.
 * @module luxemia-social/browser/launch
 */

import { chromium } from 'playwright-extra';
import type { BrowserContext, Page } from 'playwright-core';
import { profilePath } from './profile-manager.js';
import { getStealthArgs, applyStealthScripts } from './stealth.js';

/**
 * Launch a headless browser context for automated posting.
 * Uses a saved profile for session persistence.
 * @param platform - Platform identifier (e.g., 'x', 'instagram')
 * @returns Playwright BrowserContext ready for posting
 */
export async function launchForPosting(platform: string): Promise<BrowserContext> {
  const profile = profilePath(platform);
  const args = getStealthArgs();

  const context = await chromium.launchPersistentContext(profile, {
    headless: true,
    args,
    viewport: { width: 1280, height: 720 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
  });

  // Apply stealth scripts to all pages in the context
  context.on('page', async (page: Page) => {
    await applyStealthScripts(page);
  });

  // Apply to existing pages
  for (const page of context.pages()) {
    await applyStealthScripts(page);
  }

  return context;
}

/**
 * Launch a headed (visible) browser context for manual authentication.
 * Allows the user to interactively log in and save the session.
 * @param platform - Platform identifier (e.g., 'x', 'instagram')
 * @returns Playwright BrowserContext in headed mode
 */
export async function launchForAuth(platform: string): Promise<BrowserContext> {
  const profile = profilePath(platform);
  const args = getStealthArgs();

  const context = await chromium.launchPersistentContext(profile, {
    headless: false,
    args,
    viewport: { width: 1280, height: 720 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
  });

  // Apply stealth scripts to all pages
  context.on('page', async (page: Page) => {
    await applyStealthScripts(page);
  });

  for (const page of context.pages()) {
    await applyStealthScripts(page);
  }

  return context;
}
