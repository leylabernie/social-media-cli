/**
 * LinkedIn platform automation module.
 *
 * Handles login via credentials, cookie persistence, post creation with
 * image upload, and publishing on linkedin.com. Designed for serverless
 * execution with Playwright.
 */

import type { Browser, Page } from "playwright-core";
import {
  launchBrowser,
  humanDelay,
  humanType,
  humanClick,
} from "@/lib/browser";
import { getCookies, setCookies } from "@/lib/kv-store";

const PLATFORM_KEY = "linkedin";
const FEED_URL = "https://www.linkedin.com/feed/";
const LOGIN_URL = "https://www.linkedin.com/login";

/**
 * Post a captioned image to LinkedIn.
 *
 * @param caption     - The post text content.
 * @param imageBuffer - Raw JPEG/PNG image data.
 * @returns The absolute URL of the published post.
 * @throws If posting fails after all retries.
 */
export async function postToLinkedIn(
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
          domain: ".linkedin.com",
          path: "/",
          httpOnly: false,
          secure: true,
          sameSite: "Lax" as const,
        }))
      );
    }

    const page = await context.newPage();

    // 2. Navigate to LinkedIn feed
    await page.goto(FEED_URL, { waitUntil: "networkidle", timeout: 30000 });
    await humanDelay(2000, 3500);

    // 3. Check if login page is shown
    const isLoginPage =
      (await page.$('input[name="session_key"]')) !== null ||
      (await page.$('input[name="session_password"]')) !== null ||
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

      // Navigate to feed after login
      await page.goto(FEED_URL, {
        waitUntil: "networkidle",
        timeout: 30000,
      });
      await humanDelay(2000, 3500);
    }

    // 4. Click "Start a post" button
    const startPostSelectors = [
      'button:has-text("Start a post")',
      'button:has-text("Start a post,")',
      'div[role="button"]:has-text("Start a post")',
      'span:has-text("Start a post")',
      'button[aria-label*="post" i]',
      'div[contenteditable="true"][role="button"]',
      'div.share-box-feed-entry__top-bar',
      'div.share-box-open-button',
    ];

    let postButtonClicked = false;
    for (const selector of startPostSelectors) {
      const el = await page.$(selector);
      if (el && (await el.isVisible())) {
        await humanClick(page, selector);
        postButtonClicked = true;
        break;
      }
    }
    if (!postButtonClicked) {
      throw new Error('Could not find LinkedIn "Start a post" button');
    }
    await humanDelay(1500, 2500);

    // 5. Type caption in contenteditable (inside the modal)
    const captionSelectors = [
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"][data-placeholder*="What" i]',
      'div[contenteditable="true"][aria-label*="post" i]',
      'div.ql-editor[contenteditable="true"]',
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
      throw new Error("Could not find LinkedIn caption input");
    }
    await humanDelay(1000, 2000);

    // 6. Click image icon
    const imageIconSelectors = [
      'button[aria-label*="Add a photo" i]',
      'button[aria-label*="photo" i]',
      'button[aria-label*="image" i]',
      'button:has-text("Photo")',
      'span:has-text("Photo")',
      'button svg[aria-label*="photo" i]',
      'li-icon[type="image-icon"]',
      'button:has([aria-label*="media" i])',
      'button[aria-label*="media" i]',
    ];

    let imageIconClicked = false;
    for (const selector of imageIconSelectors) {
      const el = await page.$(selector);
      if (el && (await el.isVisible())) {
        await humanClick(page, selector);
        imageIconClicked = true;
        break;
      }
    }
    if (!imageIconClicked) {
      throw new Error("Could not find LinkedIn image icon button");
    }
    await humanDelay(1500, 2500);

    // 7. Upload image via file input
    const fileInputSelectors = [
      'input[type="file"][accept="image/*"]',
      'input[type="file"][accept*="image"]',
      'input[type="file"][multiple]',
      'input[type="file"]',
      'input[name="file"]',
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
      throw new Error("Could not find LinkedIn image upload input");
    }

    // Wait for image preview
    await page
      .waitForSelector("img[alt*="upload" i], img[class*="uploaded" i]", {
        timeout: 15000,
      })
      .catch(() => null);
    await humanDelay(2000, 3000);

    // 8. Click Post button
    const postButtonSelectors = [
      'button:has-text("Post")',
      'button:has-text("Publish")',
      'button[aria-label="Post"]',
      'div[role="button"]:has-text("Post")',
      'button.mlA',
      'button.share-actions__primary-action',
      'button:has-text("Done")',
    ];

    let posted = false;
    for (const selector of postButtonSelectors) {
      const btn = await page.$(selector);
      if (btn && (await btn.isVisible())) {
        const disabled = await btn.evaluate(
          (el) =>
            el.hasAttribute("disabled") ||
            el.getAttribute("aria-disabled") === "true"
        );
        if (!disabled) {
          await humanClick(page, selector);
          posted = true;
          break;
        }
      }
    }
    if (!posted) {
      throw new Error("Could not find or click LinkedIn Post button");
    }

    // 9. Wait for post to appear and extract URL from timestamp link
    await humanDelay(5000, 8000);

    // Look for the new post in the feed - the timestamp link contains the post URL
    const timestampSelectors = [
      'a[href*="/feed/update/urn:li:activity:"]',
      'a[href*="/feed/update/"]',
      'a[href*="/posts/"]',
      'span[dir="ltr"] a[href*="/feed/update/"]',
      'time a[href*="/feed/update/"]',
    ];

    for (const selector of timestampSelectors) {
      const link = await page.$(selector);
      if (link) {
        const href = await link.getAttribute("href");
        if (href) {
          const url = href.startsWith("http")
            ? href
            : `https://www.linkedin.com${href}`;
          return url;
        }
      }
    }

    // Navigate to recent activity to find the post
    const profileUrl = page.url().includes("/in/")
      ? page.url().split("?")[0]
      : null;

    if (profileUrl) {
      await page.goto(`${profileUrl}/recent-activity/all/`, {
        waitUntil: "networkidle",
        timeout: 30000,
      });
      await humanDelay(2000, 3000);

      for (const selector of timestampSelectors) {
        const link = await page.$(selector);
        if (link) {
          const href = await link.getAttribute("href");
          if (href) {
            const url = href.startsWith("http")
              ? href
              : `https://www.linkedin.com${href}`;
            return url;
          }
        }
      }
    }

    // Last resort: return the feed URL
    return FEED_URL;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    // Attempt screenshot on failure
    try {
      const pages = browser?.contexts()[0]?.pages();
      const page = pages?.[pages.length - 1];
      if (page) {
        await page.screenshot({
          path: "/tmp/linkedin-post-error.png",
          fullPage: true,
        });
      }
    } catch {
      // Ignore screenshot errors
    }

    throw new Error(`LinkedIn post failed: ${message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Handle LinkedIn login flow.
 *
 * @param page - Playwright Page instance.
 */
async function handleLogin(page: Page): Promise<void> {
  const email = process.env.LINKEDIN_EMAIL;
  const password = process.env.LINKEDIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "LinkedIn credentials not configured. Set LINKEDIN_EMAIL and LINKEDIN_PASSWORD environment variables."
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
    'input[name="session_key"]',
    'input[id="username"]',
    'input[type="email"]',
    'input[autocomplete="username"]',
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
    throw new Error("Could not find LinkedIn email input");
  }
  await humanDelay(800, 1500);

  // Enter password
  const passwordSelectors = [
    'input[name="session_password"]',
    'input[id="password"]',
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
    throw new Error("Could not find LinkedIn password input");
  }
  await humanDelay(800, 1500);

  // Click Sign in
  const loginButtonSelectors = [
    'button[type="submit"]',
    'button:has-text("Sign in")',
    'button:has-text("Sign In")',
    'button:has-text("Log in")',
    'button:has-text("Login")',
    'button[aria-label="Sign in"]',
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

  // Check for 2FA / security verification
  const pageText = await page
    .$eval("body", (b) => b.textContent || "")
    .catch(() => "");
  if (
    pageText.includes("two-factor authentication") ||
    pageText.includes("Two-factor authentication") ||
    pageText.includes("verification code") ||
    pageText.includes("Enter the code") ||
    pageText.includes("security verification")
  ) {
    throw new Error(
      "LinkedIn account requires 2FA. Please disable 2FA or verify the account manually first."
    );
  }

  if (
    pageText.includes("suspicious") ||
    pageText.includes("unusual sign-in") ||
    pageText.includes("verify your identity") ||
    pageText.includes("security challenge")
  ) {
    throw new Error(
      "LinkedIn detected suspicious login. Please verify the account manually first."
    );
  }

  // Check for PIN/email verification step
  const pinInput = await page.$('input[name="pin"]');
  const verificationInput = await page.$('input[autocomplete="one-time-code"]');
  if (pinInput || verificationInput) {
    throw new Error(
      "LinkedIn requires email verification. Please verify the account manually first."
    );
  }
}
