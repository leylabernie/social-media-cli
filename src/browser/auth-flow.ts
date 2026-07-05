/**
 * @file First-run authentication flow for social media platforms.
 * Launches a headed browser so the user can manually log in.
 * @module luxemia-social/browser/auth-flow
 */

import { input } from '@inquirer/prompts';
import { launchForAuth } from './launch.js';
import { info, success, error } from '../utils/logger.js';

/**
 * Run the manual authentication flow for a platform.
 * Opens a headed browser, navigates to the login URL, and waits
 * for the user to complete login before saving the session.
 * @param platform - Platform identifier (e.g., 'x', 'instagram')
 * @param loginUrl - URL of the platform's login page
 * @param displayName - Human-readable platform name for prompts
 * @returns Promise that resolves when auth is complete
 */
export async function runAuthFlow(
  platform: string,
  loginUrl: string,
  displayName: string
): Promise<void> {
  info(`Starting authentication flow for ${displayName}...`);

  let context;
  try {
    context = await launchForAuth(platform);
    const page = context.pages()[0] ?? (await context.newPage());

    info(`Navigating to ${loginUrl}...`);
    await page.goto(loginUrl, { waitUntil: 'networkidle' });

    success(`Browser opened for ${displayName}. Please log in manually.`);

    await input({
      message: `Press Enter after you've logged in to ${displayName}...`,
    });

    success(`Session saved for ${displayName}!`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    error(`Authentication flow failed for ${displayName}: ${message}`);
    throw err;
  } finally {
    if (context) {
      await context.close();
    }
  }
}
