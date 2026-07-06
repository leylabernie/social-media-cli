/**
 * Pinterest platform automation module.
 *
 * Handles login via credentials, cookie persistence, pin creation with
n * image upload, title, description, destination URL, and board selection
 * on pinterest.com. Designed for serverless execution with Playwright.
 */

import type { Browser, Page } from "playwright-core";
import {
  launchBrowser,
  humanDelay,
  humanType,
  humanClick,
} from "@/lib/browser";
import { getCookies, setCookies } from "@/lib/kv-store";

const PLATFORM_KEY = "pinterest";
const PIN_BUILDER_URL = "https://www.pinterest.com/pin-builder/";
const LOGIN_URL = "https://www.pinterest.com/login/";

/**
 * Create a new Pin on Pinterest with an image, title, description,
 * and destination link.
 *
 * @param caption   - The pin description text.
 * @param imageBuffer - Raw JPEG/PNG image data.
 * @param productUrl  - The destination URL the pin should link to.
 * @param title     - The pin title (truncated to 100 chars).
 * @returns The absolute URL of the published pin.
 * @throws If pin creation fails after all retries.
 */
export async function postToPinterest(
  caption: string,
  imageBuffer: Buffer,
  productUrl: string,
  title: string
): Promise<string> {
  let browser: Browser | undefined;

  // Truncate title to Pinterest's 100-character limit
  const truncatedTitle = title.slice(0, 100);

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
          domain: ".pinterest.com",
          path: "/",
          httpOnly: false,
          secure: true,
          sameSite: "Lax" as const,
        }))
      );
    }

    const page = await context.newPage();

    // 2. Navigate to pin builder
    await page.goto(PIN_BUILDER_URL, {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    await humanDelay(2000, 3500);

    // 3. Check if login page is shown
    const isLoginPage =
      (await page.$('input[name="id"]')) !== null ||
      (await page.$('input[name="password"]')) !== null ||
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

      // Re-navigate to pin builder after login
      await page.goto(PIN_BUILDER_URL, {
        waitUntil: "networkidle",
        timeout: 30000,
      });
      await humanDelay(2000, 3500);
    }

    // 4. Upload image via file input
    const fileInputSelectors = [
      'input[type="file"][accept="image/*"]',
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
      // Try clicking the upload area first, then find input
      const uploadAreaSelectors = [
        'div[data-test-id="pinBuilder"] div[role="button"]',
        'div:has-text("Drag and drop")',
        'div:has-text("Click to upload")',
        'div:has-text("Upload")[role="button"]',
      ];

      for (const selector of uploadAreaSelectors) {
        const el = await page.$(selector);
        if (el && (await el.isVisible())) {
          await humanClick(page, selector);
          await humanDelay(500, 1000);
          break;
        }
      }

      // Re-try finding file input
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
    }
    if (!uploaded) {
      throw new Error("Could not find Pinterest image upload input");
    }

    // Wait for image preview
    await page
      .waitForSelector("img, [data-test-id=\"pinBuilder\"] img", {
        timeout: 15000,
      })
      .catch(() => null);
    await humanDelay(2000, 3000);

    // 5. Enter title
    const titleSelectors = [
      'input[name="title"]',
      'input[data-test-id="pin-title"]',
      'input[placeholder*="title" i]',
      'input[aria-label*="title" i]',
    ];

    let titleEntered = false;
    for (const selector of titleSelectors) {
      const el = await page.$(selector);
      if (el && (await el.isVisible())) {
        await humanType(page, selector, truncatedTitle);
        titleEntered = true;
        break;
      }
    }
    if (!titleEntered) {
      // Fallback: try finding any visible text input for title
      const inputs = await page.$$('input[type="text"], input:not([type])');
      for (const input of inputs) {
        if (await input.isVisible()) {
          await input.fill(truncatedTitle);
          titleEntered = true;
          break;
        }
      }
    }
    if (!titleEntered) {
      throw new Error("Could not find Pinterest title input");
    }
    await humanDelay(800, 1500);

    // 6. Enter description (caption)
    const descriptionSelectors = [
      'textarea[name="description"]',
      'textarea[data-test-id="pin-description"]',
      'textarea[placeholder*="description" i]',
      'div[contenteditable="true"][aria-label*="description" i]',
      'div[contenteditable="true"]',
    ];

    let descriptionEntered = false;
    for (const selector of descriptionSelectors) {
      const el = await page.$(selector);
      if (el && (await el.isVisible())) {
        await humanType(page, selector, caption);
        descriptionEntered = true;
        break;
      }
    }
    if (!descriptionEntered) {
      throw new Error("Could not find Pinterest description input");
    }
    await humanDelay(800, 1500);

    // 7. Enter destination link (productUrl)
    const linkSelectors = [
      'input[name="link"]',
      'input[data-test-id="pin-link"]',
      'input[placeholder*="link" i]',
      'input[placeholder*="destination" i]',
      'input[placeholder*="URL" i]',
      'input[aria-label*="link" i]',
    ];

    let linkEntered = false;
    for (const selector of linkSelectors) {
      const el = await page.$(selector);
      if (el && (await el.isVisible())) {
        await humanType(page, selector, productUrl);
        linkEntered = true;
        break;
      }
    }
    if (!linkEntered) {
      throw new Error("Could not find Pinterest destination link input");
    }
    await humanDelay(800, 1500);

    // 8. Select board
    const boardName = process.env.PINTEREST_BOARD_NAME;
    if (!boardName) {
      throw new Error(
        "PINTEREST_BOARD_NAME not configured. Set the board name in environment variables."
      );
    }

    await selectBoard(page, boardName);
    await humanDelay(1000, 2000);

    // 9. Click Publish
    const publishSelectors = [
      'button[data-test-id="board-dropdown-save-button"]',
      'button:has-text("Publish")',
      'button:has-text("Save")',
      'div[role="button"]:has-text("Publish")',
      'div[role="button"]:has-text("Save")',
      'button[type="submit"]',
    ];

    let published = false;
    for (const selector of publishSelectors) {
      const btn = await page.$(selector);
      if (btn && (await btn.isVisible())) {
        await humanClick(page, selector);
        published = true;
        break;
      }
    }
    if (!published) {
      throw new Error("Could not find or click Pinterest Publish button");
    }

    // 10. Wait for pin to be created and extract URL
    await humanDelay(5000, 8000);

    // Wait for redirect to pin page or success indicator
    const pinUrlSelectors = [
      'a[href*="/pin/"]',
      '[data-test-id="pin-url"]',
    ];

    // Check current URL first
    const currentUrl = page.url();
    if (currentUrl.includes("/pin/")) {
      return currentUrl;
    }

    for (const selector of pinUrlSelectors) {
      const link = await page.$(selector);
      if (link) {
        const href = await link.getAttribute("href");
        if (href) {
          const url = href.startsWith("http")
            ? href
            : `https://www.pinterest.com${href}`;
          return url;
        }
      }
    }

    // Navigate to profile/board to find the new pin
    await page.goto(
      `https://www.pinterest.com/${process.env.PINTEREST_EMAIL?.split("@")[0] || ""}/${boardName.toLowerCase().replace(/\s+/g, "-")}/`,
      { waitUntil: "networkidle", timeout: 30000 }
    );
    await humanDelay(2000, 3000);

    const pinLink = await page.$('a[href*="/pin/"]');
    if (pinLink) {
      const href = await pinLink.getAttribute("href");
      if (href) {
        return href.startsWith("http")
          ? href
          : `https://www.pinterest.com${href}`;
      }
    }

    throw new Error("Could not extract Pinterest pin URL after publishing");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    // Attempt screenshot on failure
    try {
      const pages = browser?.contexts()[0]?.pages();
      const page = pages?.[pages.length - 1];
      if (page) {
        await page.screenshot({
          path: "/tmp/pinterest-post-error.png",
          fullPage: true,
        });
      }
    } catch {
      // Ignore screenshot errors
    }

    throw new Error(`Pinterest pin creation failed: ${message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Handle Pinterest login flow.
 *
 * @param page - Playwright Page instance.
 */
async function handleLogin(page: Page): Promise<void> {
  const email = process.env.PINTEREST_EMAIL;
  const password = process.env.PINTEREST_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "Pinterest credentials not configured. Set PINTEREST_EMAIL and PINTEREST_PASSWORD environment variables."
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
    'input[name="id"]',
    'input[name="username"]',
    'input[name="email"]',
    'input[id="email"]',
    'input[type="email"]',
    'input[autocomplete="username"]',
    'input[placeholder*="email" i]',
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
    throw new Error("Could not find Pinterest email input");
  }
  await humanDelay(800, 1500);

  // Enter password
  const passwordSelectors = [
    'input[name="password"]',
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
    throw new Error("Could not find Pinterest password input");
  }
  await humanDelay(800, 1500);

  // Click Log in
  const loginButtonSelectors = [
    'button[type="submit"]',
    'button:has-text("Log in")',
    'button:has-text("Log In")',
    'div[role="button"]:has-text("Log in")',
    'button[data-test-id="login-button"]',
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

  // Check for 2FA / security challenges
  const pageText = await page
    .$eval("body", (b) => b.textContent || "")
    .catch(() => "");
  if (
    pageText.includes("two-factor") ||
    pageText.includes("Two-factor") ||
    pageText.includes("verification code") ||
    pageText.includes("Enter the code")
  ) {
    throw new Error(
      "Pinterest account requires 2FA. Please disable 2FA or verify the account manually first."
    );
  }

  if (
    pageText.includes("suspicious") ||
    pageText.includes("unusual login") ||
    pageText.includes("security check")
  ) {
    throw new Error(
      "Pinterest detected suspicious login. Please verify the account manually first."
    );
  }
}

/**
 * Select a board from the dropdown on the pin builder page.
 *
 * @param page      - Playwright Page instance.
 * @param boardName - The name of the board to select.
 */
async function selectBoard(page: Page, boardName: string): Promise<void> {
  // Click board dropdown
  const dropdownSelectors = [
    'button[data-test-id="board-dropdown-select-button"]',
    'div[data-test-id="board-dropdown"]',
    'div[aria-label*="board" i]',
    'button:has-text("Select")',
    'div:has-text("Choose a board")',
    'div[role="button"]:has-text("board")',
  ];

  let dropdownClicked = false;
  for (const selector of dropdownSelectors) {
    const el = await page.$(selector);
    if (el && (await el.isVisible())) {
      await humanClick(page, selector);
      dropdownClicked = true;
      break;
    }
  }
  if (!dropdownClicked) {
    throw new Error("Could not find Pinterest board dropdown");
  }
  await humanDelay(1000, 2000);

  // Search for and select the board
  const boardSelectors = [
    `div:has-text("${boardName}")`,
    `div[role="option"]:has-text("${boardName}")`,
    `span:has-text("${boardName}")`,
  ];

  let boardSelected = false;
  for (const selector of boardSelectors) {
    try {
      const el = await page.waitForSelector(selector, { timeout: 5000 });
      if (el && (await el.isVisible())) {
        await humanClick(page, selector);
        boardSelected = true;
        break;
      }
    } catch {
      // Try next selector
    }
  }

  if (!boardSelected) {
    // Try typing the board name in a search field
    const searchSelectors = [
      'input[placeholder*="Search" i]',
      'input[type="search"]',
      'input[aria-label*="board" i]',
    ];

    for (const selector of searchSelectors) {
      const el = await page.$(selector);
      if (el && (await el.isVisible())) {
        await humanType(page, selector, boardName);
        await humanDelay(1000, 1500);

        // Click the matching result
        for (const boardSel of boardSelectors) {
          const result = await page.$(boardSel);
          if (result && (await result.isVisible())) {
            await humanClick(page, boardSel);
            boardSelected = true;
            break;
          }
        }
        if (boardSelected) break;
      }
    }
  }

  if (!boardSelected) {
    throw new Error(
      `Could not find Pinterest board "${boardName}". Ensure the board exists.`
    );
  }
}
