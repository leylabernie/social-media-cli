/**
 * Facebook platform automation module.
 *
 * Handles login via credentials, cookie persistence, page navigation,
 * photo/video upload, caption entry, and post publishing for facebook.com.
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

const PLATFORM_KEY = "facebook";
const HOME_URL = "https://www.facebook.com/";
const LOGIN_URL = "https://www.facebook.com/login/";

/**
 * Post a captioned image to a Facebook Page.
 *
 * @param caption     - The post text content.
 * @param imageBuffer - Raw JPEG/PNG image data.
 * @returns The absolute URL of the published post.
 * @throws If posting fails after all retries.
 */
export async function postToFacebook(
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
          domain: ".facebook.com",
          path: "/",
          httpOnly: false,
          secure: true,
          sameSite: "Lax" as const,
        }))
      );
    }

    const page = await context.newPage();

    // 2. Navigate to Facebook
    await page.goto(HOME_URL, { waitUntil: "networkidle", timeout: 30000 });
    await humanDelay(2000, 3500);

    // 3. Check if login page is shown
    const isLoginPage =
      (await page.$('input[name="email"]')) !== null ||
      (await page.$('input[name="pass"]')) !== null ||
      (await page.$('input[type="password"]')) !== null ||
      page.url().includes("/login");

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

    // 4. Navigate to the Facebook Page
    const pageUrl = process.env.FB_PAGE_URL;
    if (!pageUrl) {
      throw new Error(
        "FB_PAGE_URL not configured. Set the Facebook Page URL in environment variables."
      );
    }

    await page.goto(pageUrl, {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    await humanDelay(2000, 3000);

    // 5. Click composer
    const composerSelectors = [
      'div[aria-label="Create post"]',
      'div[aria-label="Create a post"]',
      'div[role="button"][aria-label*="post" i]',
      'div[role="button"]:has-text("What")',
      'div[contenteditable="true"][aria-label*="post" i]',
      'div[contenteditable="true"][role="button"]',
      'span:has-text("What\'s on your mind?")',
      'span:has-text("Create post")',
    ];

    let composerClicked = false;
    for (const selector of composerSelectors) {
      const el = await page.$(selector);
      if (el && (await el.isVisible())) {
        await humanClick(page, selector);
        composerClicked = true;
        break;
      }
    }
    if (!composerClicked) {
      throw new Error("Could not find Facebook composer element");
    }
    await humanDelay(1500, 2500);

    // 6. Click Photo/Video tab (if in modal with tabs)
    const photoVideoSelectors = [
      'div[aria-label="Photo/Video"]',
      'div[role="button"]:has-text("Photo/Video")',
      'div:has-text("Photo/video")',
      'span:has-text("Photo/Video")',
      'span:has-text("Photo/video")',
    ];

    for (const selector of photoVideoSelectors) {
      const el = await page.$(selector);
      if (el && (await el.isVisible())) {
        await humanClick(page, selector);
        await humanDelay(1000, 1500);
        break;
      }
    }

    // 7. Upload image via file input
    const fileInputSelectors = [
      'input[type="file"][accept*="image/*"][accept*="video/*"]',
      'input[type="file"][accept*="image"]',
      'input[type="file"][multiple]',
      'input[type="file"]',
      '[role="dialog"] input[type="file"]',
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
      throw new Error("Could not find Facebook image upload input");
    }

    // Wait for image preview
    await page
      .waitForSelector("img[alt*="photo" i], [role=\"dialog\"] img", {
        timeout: 15000,
      })
      .catch(() => null);
    await humanDelay(2000, 3000);

    // 8. Type caption in contenteditable
    const captionSelectors = [
      'div[contenteditable="true"][aria-label*="post" i]',
      'div[contenteditable="true"][aria-label*="What" i]',
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"]',
      '[role="dialog"] div[contenteditable="true"]',
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
      throw new Error("Could not find Facebook caption input");
    }
    await humanDelay(1000, 2000);

    // 9. Click Post button
    const postButtonSelectors = [
      'div[aria-label="Post"]',
      'div[role="button"][aria-label="Post"]',
      'button[type="submit"]:has-text("Post")',
      'div[role="button"]:has-text("Post")',
      'div:has-text("Post")[role="button"]',
    ];

    let posted = false;
    for (const selector of postButtonSelectors) {
      const btn = await page.$(selector);
      if (btn && (await btn.isVisible())) {
        await humanClick(page, selector);
        posted = true;
        break;
      }
    }
    if (!posted) {
      throw new Error("Could not find or click Facebook Post button");
    }

    // 10. Wait for post to appear
    await humanDelay(5000, 8000);

    // Try to extract the new post URL
    const postLinkSelectors = [
      'a[href*="/posts/"]',
      'a[href*="/photos/"]',
      'span[role="presentation"] a[href*="fbid"]',
      'a[href*="permalink"]',
    ];

    for (const selector of postLinkSelectors) {
      const link = await page.$(selector);
      if (link) {
        const href = await link.getAttribute("href");
        if (href) {
          const url = href.startsWith("http")
            ? href
            : `https://www.facebook.com${href}`;
          return url;
        }
      }
    }

    // Fallback: navigate to page and get most recent post
    await page.goto(pageUrl, {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    await humanDelay(2000, 3000);

    for (const selector of postLinkSelectors) {
      const link = await page.$(selector);
      if (link) {
        const href = await link.getAttribute("href");
        if (href) {
          const url = href.startsWith("http")
            ? href
            : `https://www.facebook.com${href}`;
          return url;
        }
      }
    }

    // Last resort: return the page URL
    return pageUrl;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    // Attempt screenshot on failure
    try {
      const pages = browser?.contexts()[0]?.pages();
      const page = pages?.[pages.length - 1];
      if (page) {
        await page.screenshot({
          path: "/tmp/facebook-post-error.png",
          fullPage: true,
        });
      }
    } catch {
      // Ignore screenshot errors
    }

    throw new Error(`Facebook post failed: ${message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Handle Facebook login flow.
 *
 * @param page - Playwright Page instance.
 */
async function handleLogin(page: Page): Promise<void> {
  const email = process.env.FACEBOOK_EMAIL;
  const password = process.env.FACEBOOK_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "Facebook credentials not configured. Set FACEBOOK_EMAIL and FACEBOOK_PASSWORD environment variables."
    );
  }

  // Navigate to login page if not already there
  if (!page.url().includes("/login")) {
    await page.goto(LOGIN_URL, {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    await humanDelay(1500, 2500);
  }

  // Enter email
  const emailSelectors = [
    'input[name="email"]',
    'input[id="email"]',
    'input[autocomplete="username"]',
    'input[type="text"]',
  ];

  let emailEntered = false;
  for (const selector of emailSelectors) {
    const el = await page.$(selector);
    if (el) {
      await humanType(page, selector, email);
      emailEntered = true;
      break;
    }
  }
  if (!emailEntered) {
    throw new Error("Could not find Facebook email input");
  }
  await humanDelay(800, 1500);

  // Enter password
  const passwordSelectors = [
    'input[name="pass"]',
    'input[id="pass"]',
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
    throw new Error("Could not find Facebook password input");
  }
  await humanDelay(800, 1500);

  // Click Log in
  const loginButtonSelectors = [
    'button[name="login"]',
    'button[type="submit"]',
    'button:has-text("Log in")',
    'button:has-text("Log In")',
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

  // Check for 2FA / security check
  const pageText = await page
    .$eval("body", (b) => b.textContent || "")
    .catch(() => "");
  if (
    pageText.includes("Two-factor authentication") ||
    pageText.includes("Enter login code") ||
    pageText.includes("security code") ||
    pageText.includes("Authentication code")
  ) {
    throw new Error(
      "Facebook account requires 2FA. Please disable 2FA or verify the account manually first."
    );
  }

  if (
    pageText.includes("suspicious") ||
    pageText.includes("unusual login") ||
    pageText.includes("checkpoint") ||
    pageText.includes("security check")
  ) {
    throw new Error(
      "Facebook detected suspicious login. Please verify the account manually first."
    );
  }

  // Dismiss "Save your login info?" if present
  const notNowSelectors = [
    'button:has-text("Not Now")',
    'div[role="button"]:has-text("Not Now")',
  ];
  for (const selector of notNowSelectors) {
    try {
      const el = await page.waitForSelector(selector, { timeout: 5000 });
      if (el) {
        await humanClick(page, selector);
        await humanDelay(800, 1200);
      }
    } catch {
      // Not present
    }
  }
}
