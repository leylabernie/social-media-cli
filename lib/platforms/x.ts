/**
 * X (Twitter) platform automation module.
 *
 * Handles login via credentials, cookie persistence, media upload, and
 * post publishing for x.com. Designed for serverless execution with
 * Playwright.
 */

import type { Browser, Page } from "playwright-core";
import {
  launchBrowser,
  humanDelay,
  humanType,
  humanClick,
} from "@/lib/browser";
import { getCookies, setCookies } from "@/lib/kv-store";

const PLATFORM_KEY = "x";
const LOGIN_URL = "https://x.com/i/flow/login";
const COMPOSE_URL = "https://x.com/compose/post";

/**
 * Post a captioned image to X (Twitter).
 *
 * @param caption   - The tweet text content.
 * @param imageBuffer - Raw JPEG/PNG image data.
 * @returns The absolute URL of the published tweet.
 * @throws If posting fails after all retries.
 */
export async function postToX(
  caption: string,
  imageBuffer: Buffer
): Promise<string> {
  let browser: Browser | undefined;

  try {
    browser = await launchBrowser();
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });

    // 1. Load saved cookies
    const savedCookies = await getCookies(PLATFORM_KEY);
    if (savedCookies && Object.keys(savedCookies).length > 0) {
      await context.addCookies(
        Object.entries(savedCookies).map(([name, value]) => ({
          name,
          value,
          domain: ".x.com",
          path: "/",
          httpOnly: false,
          secure: true,
          sameSite: "Lax" as const,
        }))
      );
    }

    const page = await context.newPage();

    // 2. Navigate to compose page
    await page.goto(COMPOSE_URL, { waitUntil: "networkidle", timeout: 30000 });
    await humanDelay(1200, 2000);

    // 3. Handle login if redirected
    if (page.url().includes("/login") || page.url().includes("/i/flow/login")) {
      await handleLogin(page);

      // Save cookies after successful login
      const cookies = await context.cookies();
      const cookieRecord: Record<string, string> = {};
      cookies.forEach((c) => {
        cookieRecord[c.name] = c.value;
      });
      await setCookies(PLATFORM_KEY, cookieRecord);

      // Navigate to compose after login
      await page.goto(COMPOSE_URL, {
        waitUntil: "networkidle",
        timeout: 30000,
      });
      await humanDelay(1200, 2000);
    }

    // 4. Type caption
    const textareaSelectors = [
      '[data-testid="tweetTextarea_0"]',
      '[data-testid="tweetTextarea_0RichInput"]',
      "div[contenteditable=\"true\"][role=\"textbox\"]",
      'div[data-testid="tweetTextarea_0"] div[contenteditable="true"]',
    ];

    let textareaFound = false;
    for (const selector of textareaSelectors) {
      const el = await page.$(selector);
      if (el) {
        await humanType(page, selector, caption);
        textareaFound = true;
        break;
      }
    }
    if (!textareaFound) {
      throw new Error("Could not find X compose textarea");
    }
    await humanDelay(800, 1500);

    // 5. Upload image
    const fileInputSelectors = [
      'input[type="file"][accept*="image"]',
      'input[type="file"][accept="image/*,image/heic,image/heif"]',
      'input[type="file"]',
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
      throw new Error("Could not find X image upload input");
    }

    // Wait for image preview to appear
    await page
      .waitForSelector('[data-testid="attachments"] img, [data-testid="tile"] img', {
        timeout: 15000,
      })
      .catch(() => null);
    await humanDelay(1500, 2500);

    // 6. Click Post button
    const postButtonSelectors = [
      '[data-testid="tweetButton"]',
      '[data-testid="tweetButtonInline"]',
      'button[type="button"]:has-text("Post")',
      'button:has-text("Post")',
    ];

    let posted = false;
    for (const selector of postButtonSelectors) {
      const btn = await page.$(selector);
      if (btn) {
        const disabled = await btn.evaluate((el) =>
          el.hasAttribute("disabled")
        );
        if (!disabled) {
          await humanClick(page, selector);
          posted = true;
          break;
        }
      }
    }
    if (!posted) {
      throw new Error("Could not find or click X Post button");
    }

    // 7. Wait for tweet to be published and extract URL
    await humanDelay(3000, 5000);

    // Wait for the tweet to appear in the timeline or redirect
    const statusLink = await page
      .waitForSelector('a[href*="/status/"]', {
        timeout: 20000,
      })
      .catch(() => null);

    if (statusLink) {
      const href = await statusLink.getAttribute("href");
      if (href) {
        const url = href.startsWith("http") ? href : `https://x.com${href}`;
        return url;
      }
    }

    // Fallback: check current URL for status ID
    const currentUrl = page.url();
    if (currentUrl.includes("/status/")) {
      return currentUrl;
    }

    throw new Error("Could not extract X tweet URL after posting");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    // Attempt screenshot on failure
    try {
      const pages = browser?.contexts()[0]?.pages();
      const page = pages?.[pages.length - 1];
      if (page) {
        await page.screenshot({
          path: "/tmp/x-post-error.png",
          fullPage: true,
        });
      }
    } catch {
      // Ignore screenshot errors
    }

    throw new Error(`X post failed: ${message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Handle X login flow including 2FA detection.
 *
 * @param page - Playwright Page instance.
 */
async function handleLogin(page: Page): Promise<void> {
  const username = process.env.X_USERNAME;
  const password = process.env.X_PASSWORD;

  if (!username || !password) {
    throw new Error(
      "X credentials not configured. Set X_USERNAME and X_PASSWORD environment variables."
    );
  }

  // Step 1: Enter username
  const usernameSelectors = [
    'input[autocomplete="username"]',
    'input[name="text"]',
    'input[type="text"]',
    'input[autocapitalize="sentences"]',
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
    throw new Error("Could not find X username input field");
  }
  await humanDelay(800, 1500);

  // Click "Next" after username
  const nextButtonSelectors = [
    "button:has-text('Next')",
    "button:has-text('next')",
    'button[role="button"]:has-text("Next")',
    'div[role="button"]:has-text("Next")',
  ];

  for (const selector of nextButtonSelectors) {
    const btn = await page.$(selector);
    if (btn) {
      await humanClick(page, selector);
      break;
    }
  }
  await humanDelay(1500, 2500);

  // Step 2: Enter password
  const passwordSelectors = [
    'input[name="password"]',
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
    throw new Error("Could not find X password input field");
  }
  await humanDelay(800, 1500);

  // Click "Log in"
  const loginButtonSelectors = [
    "button:has-text('Log in')",
    "button:has-text('log in')",
    "button:has-text('Sign in')",
    'button[data-testid="LoginForm_Login_Button"]',
    'button[type="submit"]',
  ];

  for (const selector of loginButtonSelectors) {
    const btn = await page.$(selector);
    if (btn) {
      await humanClick(page, selector);
      break;
    }
  }
  await humanDelay(2500, 4000);

  // Check for 2FA challenge
  const twoFASelectors = [
    'input[data-testid="ocfEnterTextTextInput"]',
    'input[name="text"]',
    'input[placeholder*="code" i]',
    'input[placeholder*="verification" i]',
    'input[autocomplete="one-time-code"]',
    'input[type="number"]',
  ];

  for (const selector of twoFASelectors) {
    const el = await page.$(selector);
    if (el && (await el.isVisible())) {
      throw new Error(
        "X account requires 2FA verification. Please disable 2FA on this account or use a different authentication method."
      );
    }
  }

  // Check for suspicious login verification
  const suspiciousText = await page
    .$eval("body", (body) => body.textContent || "")
    .catch(() => "");
  if (
    suspiciousText.includes("suspicious") ||
    suspiciousText.includes("unusual login") ||
    suspiciousText.includes("verify") ||
    suspiciousText.includes("challenge")
  ) {
    throw new Error(
      "X detected suspicious login activity. Please verify the account manually first."
    );
  }

  // Wait for navigation to complete
  await page
    .waitForLoadState("networkidle", { timeout: 15000 })
    .catch(() => null);
  await humanDelay(1000, 2000);
}
