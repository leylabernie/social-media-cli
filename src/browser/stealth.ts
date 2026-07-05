/**
 * @file Anti-detection setup for Playwright browser.
 * Masks automation indicators and applies stealth scripts.
 * @module luxemia-social/browser/stealth
 */

import type { Page } from 'playwright-core';

declare const window: any;
declare const Element: any;
declare const Notification: any;
// Browser-only types used in page.addInitScript callbacks
type PermissionDescriptor = any;
type PermissionStatus = any;
type ShadowRootInit = any;

/**
 * Get the list of Chrome CLI arguments for stealth mode.
 * These flags disable automation indicators and common bot-detection vectors.
 * @returns Array of Chrome arguments
 */
export function getStealthArgs(): string[] {
  return [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',
    '--window-size=1280,720',
    '--disable-blink-features=AutomationControlled',
    '--disable-infobars',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-features=IsolateOrigins,site-per-process',
    '--no-first-run',
    '--no-default-browser-check',
    '--password-store=basic',
    '--use-mock-keychain',
    '--force-color-profile=srgb',
    '--lang=en-US,en',
  ];
}

/**
 * Apply stealth scripts to a page to mask automation indicators.
 * Adds init scripts that modify navigator properties and other detection vectors.
 * @param page - Playwright page to apply scripts to
 */
export async function applyStealthScripts(page: Page): Promise<void> {
  // Mask navigator.webdriver
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
  });

  // Set realistic languages
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });
  });

  // Fake plugins to appear like a real browser
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'plugins', {
      get: () => [
        {
          name: 'Chrome PDF Plugin',
          filename: 'internal-pdf-viewer',
          description: 'Portable Document Format',
          version: 'undefined',
          length: 1,
          item: () => ({ type: 'application/x-google-chrome-pdf' }),
          namedItem: () => ({ type: 'application/x-google-chrome-pdf' }),
        },
        {
          name: 'Native Client module',
          filename: 'internal-nacl-plugin',
          description: '',
          version: 'undefined',
          length: 2,
          item: () => null,
          namedItem: () => null,
        },
      ],
    });
  });

  // Override permissions query to avoid detection
  await page.addInitScript(() => {
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters: PermissionDescriptor) =>
      parameters.name === 'notifications'
        ? Promise.resolve({
            state: Notification.permission,
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => true,
          } as unknown as PermissionStatus)
        : originalQuery(parameters);
  });

  // Hide the automation-controlled flag from Chrome
  await page.addInitScript(() => {
    const originalAttachShadow = Element.prototype.attachShadow;
    if (originalAttachShadow) {
      Element.prototype.attachShadow = function (init: ShadowRootInit) {
        return originalAttachShadow.call(this, init);
      };
    }
  });

  // Override chrome.runtime to prevent detection
  await page.addInitScript(() => {
    if (!window.chrome) {
      (window as unknown as Record<string, unknown>).chrome = {};
    }
    if (!window.chrome.runtime) {
      (window.chrome as unknown as Record<string, unknown>).runtime = {};
    }
  });

  // Set a realistic user agent data
  await page.addInitScript(() => {
    if ('userAgentData' in navigator) {
      Object.defineProperty(navigator, 'userAgentData', {
        get: () => ({
          brands: [
            { brand: 'Not.A/Brand', version: '8' },
            { brand: 'Chromium', version: '120' },
            { brand: 'Google Chrome', version: '120' },
          ],
          mobile: false,
          platform: 'Windows',
          getHighEntropyValues: () =>
            Promise.resolve({
              platform: 'Windows',
              platformVersion: '15.0',
              architecture: 'x86',
              model: '',
              uaFullVersion: '120.0.0.0',
            }),
        }),
      });
    }
  });
}
