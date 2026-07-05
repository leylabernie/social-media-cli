/**
 * @file Human-like browser behavior utilities.
 * Provides realistic delays, typing, clicking, and scrolling to avoid bot detection.
 * @module luxemia-social/browser/human
 */

import type { Page } from 'playwright-core';

/**
 * Generate a random integer between min and max (inclusive).
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Random integer
 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Sleep for a random duration between minMs and maxMs.
 * @param minMs - Minimum milliseconds (default: 800)
 * @param maxMs - Maximum milliseconds (default: 2400)
 * @returns Promise that resolves after the delay
 */
export async function humanDelay(minMs = 800, maxMs = 2400): Promise<void> {
  const ms = randomInt(minMs, maxMs);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Type text into a form field like a human — character by character
 * with variable speed and occasional pauses.
 * @param page - Playwright page
 * @param selector - CSS selector for the input field
 * @param text - Text to type
 */
export async function humanType(page: Page, selector: string, text: string): Promise<void> {
  await page.focus(selector);
  await humanDelay(100, 300);

  for (const char of text) {
    await page.keyboard.type(char, { delay: randomInt(40, 150) });

    // Occasional pause while typing (1% chance per character)
    if (Math.random() < 0.01) {
      await humanDelay(200, 600);
    }
  }

  await humanDelay(100, 300);
}

/**
 * Click an element like a human — hover first, then click with a delay.
 * @param page - Playwright page
 * @param selector - CSS selector for the element
 */
export async function humanClick(page: Page, selector: string): Promise<void> {
  // Hover over the element first
  await page.hover(selector, { timeout: 5000 });
  await humanDelay(200, 500);

  // Click with a slight offset variation
  const box = await page.locator(selector).boundingBox();
  if (box) {
    const x = box.x + randomInt(2, Math.max(3, Math.floor(box.width) - 2));
    const y = box.y + randomInt(2, Math.max(3, Math.floor(box.height) - 2));
    await page.mouse.click(x, y);
  } else {
    await page.click(selector);
  }

  await humanDelay(300, 700);
}

/**
 * Scroll the page in a human-like manner — multiple small scrolls
 * with pauses between them.
 * @param page - Playwright page
 */
export async function humanScroll(page: Page): Promise<void> {
  const scrollCount = randomInt(2, 5);

  for (let i = 0; i < scrollCount; i++) {
    const amount = randomInt(100, 400);
    await page.evaluate((scrollY: number) => { (globalThis as any).scrollBy(0, scrollY); }, amount);
    await humanDelay(300, 800);
  }
}

/**
 * Perform random mouse movements across the page to simulate
 * human-like cursor behavior.
 * @param page - Playwright page
 */
export async function randomMouseMovement(page: Page): Promise<void> {
  const viewport = page.viewportSize() ?? { width: 1280, height: 720 };
  const moves = randomInt(3, 8);

  for (let i = 0; i < moves; i++) {
    const x = randomInt(50, viewport.width - 50);
    const y = randomInt(50, viewport.height - 50);
    await page.mouse.move(x, y, { steps: randomInt(5, 15) });
    await humanDelay(50, 200);
  }
}
