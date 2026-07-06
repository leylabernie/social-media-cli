/**
 * Instagram platform automation module.
 *
 * Handles login via credentials, cookie persistence, media upload,
 * caption entry, and post publishing for instagram.com.
 * Designed for serverless execution with Playwright.
 */

import type { Browser, Page } from "playwright-core";
import {
  launchBrowser,
  humanDelay,
  humanType,
  humanClick,
} from "@/lib/browser";
import { getCookies, setCookies } from "@/lib/kv-store";

const PLATFORM_KEY = "instagram";
const HOME_URL = "https://www.instagram.com/";
const LOGIN_URL = "https://www.instagram.com/accounts/login/";

/**
 * Post a captioned image to Instagram.
 *
 * @param caption     - The post caption text.
 * @param imageBuffer - Raw JPEG/PNG image data.
 * @returns The absolute URL of the published post.
 * @throws If posting fails after all retries.
 */
export async function postToInstagram(
  caption: string,
  imageBuffer: Buffer
): Promise<string> {
  let browser: Browser | undefined;

  try {
    browser = await launchBrowser();
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1",
    });

    // 1. Load saved cookies
    const savedCookies = await getCookies(PLATFORM_KEY);
    if (savedCookies && Object.keys(savedCookies).length > 0) {
      await context.addCookies(
        Object.entries(savedCookies).map(([name, value]) => ({
          name,
          value,
          domain: ".instagram.com",
          path: "/",
          httpOnly: false,
          secure: true,
          sameSite: "Lax" as const,
        }))
      );
    }

    const page = await context.newPage();

    // 2. Navigate to Instagram
    await page.goto(HOME_URL, { waitUntil: "networkidle", timeout: 30000 });
    await humanDelay(2000, 3500);

    // 3. Check if login page is shown
    const isLoginPage =
      (await page.$("input[name=\"username\"]")) !== null ||
      (await page.$("input[name=\"password\"]")) !== null ||
      page.url().includes("/accounts/login/");

    if (isLoginPage) {
      await handleLogin(page);

      // Save cookies after successful login
      const cookies = await context.cookies();
      const cookieRecord: Record<string, string> = {};
      cookies.forEach((c) => {
        cookieRecord[c.name] = c.value;
      });
      await setCookies(PLATFORM_KEY, cookieRecord);

      await humanDelay(2000, 3000);
    }

    // 4. Dismiss "Save login info?" modal if present
    await dismissSaveLoginModal(page);

    // 5. Dismiss "Turn on Notifications" modal if present
    await dismissNotificationModal(page);

    // 6. Click create button
    const createButtonSelectors = [
      '[aria-label="New post"]',
      'a[href="/create/select/"]',
      'a[href="/create/style/"]',
      'svg[aria-label="New post"]',
      'svg[aria-label="New"]',
      '[aria-label="New reel"]',
      'a[href="/create/select/"] svg',
    ];

    let createClicked = false;
    for (const selector of createButtonSelectors) {
      const el = await page.$(selector);
      if (el) {
        await humanClick(page, selector);
        createClicked = true;
        break;
      }
    }
    if (!createClicked) {
      // Try navigating directly to create page
      await page.goto("https://www.instagram.com/create/select/", {
        waitUntil: "networkidle",
        timeout: 20000,
      });
    }
    await humanDelay(1500, 2500);

    // 7. Select "Post" option (if menu appears)
    const postOptionSelectors = [
      'button:has-text("Post")',
      'div[role="button"]:has-text("Post")',
      'div:has-text("Post"):not(:has-text("Reel"))',
    ];

    for (const selector of postOptionSelectors) {
      const el = await page.$(selector);
      if (el && (await el.isVisible())) {
        await humanClick(page, selector);
        await humanDelay(800, 1500);
        break;
      }
    }

    // 8. Upload image via file input
    const fileInputSelectors = [
      'input[type="file"][accept="image/*,video/*"]',
      'input[type="file"][accept*="image"]',
      'input[type="file"]',
      'input[accept*="image"]',
    ];

    let uploaded = false;
    for (const selector of fileInputSelectors) {
      const input = await page.$(selector);
      if (input) {
        await input.setInputFiles({
          name: "image.jpg",
          mimeType: "image/jpeg",
          buffer: imageBuffer,
        });
        uploaded = true;
        break;
      }
    }
    if (!uploaded) {
      throw new Error("Could not find Instagram image upload input");
    }

    // Wait for image preview
    await page
      .waitForSelector("img, canvas, [role=\"dialog\"] img", {
        timeout: 15000,
      })
      .catch(() => null);
    await humanDelay(2000, 3000);

    // 9. Click "Next" to skip crop step
    await clickButtonWithText(page, "Next");
    await humanDelay(1500, 2500);

    // 10. Click "Next" again to skip filters step
    await clickButtonWithText(page, "Next");
    await humanDelay(1500, 2500);

    // 11. Type caption
    const captionSelectors = [
      '[aria-label="Write a caption..."]',
      '[aria-label="Write a caption"]',
      'textarea[aria-label*="caption" i]',
      'div[contenteditable="true"][aria-label*="caption" i]',
      'textarea[placeholder*="caption" i]',
      'div[contenteditable="true"]',
    ];

    let captionTyped = false;
    for (const selector of captionSelectors) {
      const el = await page.$(selector);
      if (el && (await el.isVisible())) {
        await humanType(page, selector, caption);
        captionTyped = true;
        break;
      }
    }
    if (!captionTyped) {
      throw new Error("Could not find Instagram caption input");
    }
    await humanDelay(1000, 2000);

    // 12. Click "Share" button
    await clickButtonWithText(page, "Share");
    await humanDelay(4000, 6000);

    // 13. Wait for success - look for confirmation or navigate to profile
    const successIndicators = [
      'img[alt*="profile picture"]',
      'a[href*="/p/"]',
      '[aria-label="Post shared"]',
    ];

    for (const selector of successIndicators) {
      try {
        await page.waitForSelector(selector, { timeout: 15000 });
        break;
      } catch {
        // Continue to next indicator
      }
    }

    // 14. Navigate to profile to extract most recent post URL
    const username = process.env.INSTAGRAM_USERNAME;
    if (!username) {
      throw new Error(
        "INSTAGRAM_USERNAME not set; cannot determine profile URL"
      );
    }

    await page.goto(`https://www.instagram.com/${username}/`, {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    await humanDelay(2000, 3000);

    // Extract most recent post URL
    const postLinkSelectors = [
      'a[href*="/p/"]',
      'a[href*="/reel/"]',
      'article a[href^="/p/"]',
    ];

    for (const selector of postLinkSelectors) {
      const link = await page.$(selector);
      if (link) {
        const href = await link.getAttribute("href");
        if (href) {
          const url = href.startsWith("http")
            ? href
            : `https://www.instagram.com${href}`;
          return url;
        }
      }
    }

    throw new Error("Could not extract Instagram post URL after posting");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    // Attempt screenshot on failure
    try {
      const pages = browser?.contexts()[0]?.pages();
      const page = pages?.[pages.length - 1];
      if (page) {
        await page.screenshot({
          path: "/tmp/instagram-post-error.png",
          fullPage: true,
        });
      }
    } catch {
      // Ignore screenshot errors
    }

    throw new Error(`Instagram post failed: ${message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Handle Instagram login flow.
 *
 * @param page - Playwright Page instance.
 */
async function handleLogin(page: Page): Promise<void> {
  const username = process.env.INSTAGRAM_USERNAME;
  const password = process.env.INSTAGRAM_PASSWORD;

  if (!username || !password) {
    throw new Error(
      "Instagram credentials not configured. Set INSTAGRAM_USERNAME and INSTAGRAM_PASSWORD environment variables."
    );
  }

  // Navigate to login page if not already there
  if (!page.url().includes("/accounts/login/")) {
    await page.goto(LOGIN_URL, {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    await humanDelay(1500, 2500);
  }

  // Enter username
  const usernameSelectors = [
    'input[name="username"]',
    'input[aria-label="Phone number, username, or email"]',
    'input[autocomplete="username"]',
    'input[type="text"]',
  ];

  let usernameEntered = false;
  for (const selector of usernameSelectors) {
    const el = await page.$(selector);
    if (el) {
      await humanType(page, selector, username);
      usernameEntered = true;
      break;
    }
  }
  if (!usernameEntered) {
    throw new Error("Could not find Instagram username input");
  }
  await humanDelay(800, 1500);

  // Enter password
  const passwordSelectors = [
    'input[name="password"]',
    'input[aria-label="Password"]',
    'input[type="password"]',
    'input[autocomplete="current-password"]',
  ];

  let passwordEntered = false;
  for (const selector of passwordSelectors) {
    const el = await page.$(selector);
    if (el) {
      await humanType(page, selector, password);
      passwordEntered = true;
      break;
    }
  }
  if (!passwordEntered) {
    throw new Error("Could not find Instagram password input");
  }
  await humanDelay(800, 1500);

  // Click Log in
  const loginButtonSelectors = [
    'button[type="submit"]',
    'button:has-text("Log in")',
    'button:has-text("Log In")',
    'div[role="button"]:has-text("Log in")',
  ];

  for (const selector of loginButtonSelectors) {
    const btn = await page.$(selector);
    if (btn) {
      await humanClick(page, selector);
      break;
    }
  }

  // Wait for navigation
  await page
    .waitForNavigation({ waitUntil: "networkidle", timeout: 30000 })
    .catch(() => null);
  await humanDelay(2000, 3500);

  // Check for suspicious login / 2FA
  const pageText = await page
    .$eval("body", (b) => b.textContent || "")
    .catch(() => "");
  if (
    pageText.includes("Enter the 6-digit code") ||
    pageText.includes("Two-Factor Authentication") ||
    pageText.includes("two-factor") ||
    pageText.includes("security code")
  ) {
    throw new Error(
      "Instagram account requires 2FA. Please disable 2FA or verify the account manually first."
    );
  }

  if (
    pageText.includes("suspicious") ||
    pageText.includes("unusual login attempt") ||
    pageText.includes("confirm your identity")
  ) {
    throw new Error(
      "Instagram detected suspicious login. Please verify the account manually first."
    );
  }
}

/**
 * Dismiss "Save login info?" modal if present.
 *
 * @param page - Playwright Page instance.
 */
async function dismissSaveLoginModal(page: Page): Promise<void> {
  const dismissSelectors = [
    'button:has-text("Not Now")',
    'div[role="button"]:has-text("Not Now")',
    'button:has-text("Not now")',
    'div:has-text("Not Now"):not(:has-text("Save"))',
  ];

  for (const selector of dismissSelectors) {
    try {
      const el = await page.waitForSelector(selector, { timeout: 5000 });
      if (el) {
        await humanClick(page, selector);
        await humanDelay(800, 1200);
        break;
      }
    } catch {
      // Modal not present, continue
    }
  }
}

/**
 * Dismiss "Turn on Notifications" modal if present.
 *
 * @param page - Playwright Page instance.
 */
async function dismissNotificationModal(page: Page): Promise<void> {
  const dismissSelectors = [
    'button:has-text("Not Now")',
    'div[role="button"]:has-text("Not Now")',
    'button:has-text("Not now")',
  ];

  for (const selector of dismissSelectors) {
    try {
      const el = await page.waitForSelector(selector, { timeout: 4000 });
      if (el) {
        await humanClick(page, selector);
        await humanDelay(800, 1200);
        break;
      }
    } catch {
      // Modal not present, continue
    }
  }
}

/**
 * Click a button containing specific text.
 *
 * @param page - Playwright Page instance.
 * @param text - The text to search for in buttons.
 */
async function clickButtonWithText(
  page: Page,
  text: string
): Promise<void> {
  const selectors = [
    `button:has-text("${text}")`,
    `div[role="button"]:has-text("${text}")`,
    `span:has-text("${text}")`,
  ];

  for (const selector of selectors) {
    const el = await page.$(selector);
    if (el && (await el.isVisible())) {
      await humanClick(page, selector);
      return;
    }
  }

  // Fallback: try evaluating
  await page.evaluate((btnText) => {
    const buttons = Array.from(
      document.querySelectorAll('button, div[role="button"]')
    );
    const btn = buttons.find((b) =>
      b.textContent?.trim().includes(btnText)
    );
    if (btn) {
      (btn as HTMLElement).click();
    }
  }, text);
}
