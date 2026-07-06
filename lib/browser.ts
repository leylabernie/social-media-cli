/**
 * @file Serverless browser automation module using Playwright Core + @sparticuz/chromium.
 * Provides utilities for launching a headless browser and performing human-like interactions.
 * @module @/lib/browser
 */

import { chromium } from 'playwright-core';
import chromiumPackage from '@sparticuz/chromium';
import type { Page, Browser } from 'playwright-core';

/**
 * Launch a headless Chromium browser instance optimized for serverless environments.
 * Uses @sparticuz/chromium for AWS Lambda / Vercel compatibility.
 * @returns A Promise that resolves to a Playwright Browser instance
 * @throws Error if the browser fails to launch
 */
export async function launchBrowser(): Promise<Browser> {
  const executablePath = await chromiumPackage.executablePath();
  return chromium.launch({
    args: chromiumPackage.args,
    executablePath,
    headless: true,
  });
}

/**
 * Pause execution for a random duration to simulate human-like delays.
 * @param minMs - Minimum delay in milliseconds (default: 800)
 * @param maxMs - Maximum delay in milliseconds (default: 2400)
 * @returns A Promise that resolves after the random delay
 */
export async function humanDelay(minMs: number = 800, maxMs: number = 2400): Promise<void> {
  const delay = minMs + Math.random() * (maxMs - minMs);
  await new Promise((r) => setTimeout(r, delay));
}

/**
 * Type text into an input field character-by-character with human-like delays.
 * Occasionally inserts longer pauses to mimic natural typing patterns.
 * @param page - Playwright Page instance
 * @param selector - CSS selector for the input element
 * @param text - The text to type
 */
export async function humanType(page: Page, selector: string, text: string): Promise<void> {
  await page.click(selector);
  await humanDelay(300, 800);
  for (const char of text) {
    await page.type(selector, char, { delay: 50 + Math.random() * 100 });
    if (Math.random() < 0.05) await humanDelay(1000, 2500);
  }
}

/**
 * Hover over an element, pause briefly, then click it — simulating human cursor movement.
 * @param page - Playwright Page instance
 * @param selector - CSS selector for the element to click
 */
export async function humanClick(page: Page, selector: string): Promise<void> {
  await page.hover(selector);
  await humanDelay(200, 600);
  await page.click(selector);
}

/**
 * Apply stored cookies to a Playwright page context.
 * @param page - Playwright Page instance
 * @param cookies - Record of cookie name-value pairs
 * @param domain - Domain to set cookies for (default: '.twitter.com')
 */
export async function applyCookies(
  page: Page,
  cookies: Record<string, string>,
  domain: string
): Promise<void> {
  const cookieList = Object.entries(cookies).map(([name, value]) => ({
    name,
    value,
    domain,
    path: '/',
  }));

  if (cookieList.length > 0) {
    await page.context().addCookies(cookieList);
  }
}

/**
 * Extract all cookies from a Playwright page context for a given domain.
 * @param page - Playwright Page instance
 * @returns Record of cookie name-value pairs
 */
export async function extractCookies(page: Page): Promise<Record<string, string>> {
  const cookies = await page.context().cookies();
  const record: Record<string, string> = {};
  for (const cookie of cookies) {
    record[cookie.name] = cookie.value;
  }
  return record;
}
