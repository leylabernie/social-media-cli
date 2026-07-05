/**
 * @file Status command — check session validity for all platforms.
 * Prints a colored table showing login state per platform.
 * @module luxemia-social/commands/status
 */

import type { Command } from 'commander';
import { chromium } from 'playwright-extra';
// playwright-extra chromium is an augmented BrowserType from playwright-core
import { checkSession } from '../browser/session-check.js';
import { getStealthArgs, applyStealthScripts } from '../browser/stealth.js';
import { profilePath } from '../browser/profile-manager.js';
import { header, info, success, error } from '../utils/logger.js';
import chalk from 'chalk';

/** Platform display names */
const PLATFORM_NAMES: Record<string, string> = {
  x: 'X (Twitter)',
  instagram: 'Instagram',
  facebook: 'Facebook',
  pinterest: 'Pinterest',
  linkedin: 'LinkedIn',
};

/** All platform identifiers to check */
const ALL_PLATFORMS = Object.keys(PLATFORM_NAMES);

/**
 * Check session for a single platform.
 * @param platform - Platform identifier
 * @returns True if session is valid
 */
async function checkPlatformSession(platform: string): Promise<boolean> {
  const profile = profilePath(platform);
  const args = getStealthArgs();

  const context = await chromium.launchPersistentContext(profile, {
    headless: true,
    args,
    viewport: { width: 1280, height: 720 },
  });

  try {
    const page = context.pages()[0] ?? (await context.newPage());
    await applyStealthScripts(page);
    return await checkSession(platform, page);
  } finally {
    await context.close();
  }
}

/**
 * Print a formatted status table.
 * @param results - Platform name -> valid boolean map
 */
function printStatusTable(results: Record<string, boolean>): void {
  info('\n');
  console.error(chalk.bold.white('Platform          Status'));
  console.error(chalk.gray('─────────────────────────────'));

  for (const [platform, valid] of Object.entries(results)) {
    const name = PLATFORM_NAMES[platform] ?? platform;
    const padded = name.padEnd(18, ' ');
    const status = valid
      ? chalk.green.bold('✓ Logged In')
      : chalk.red.bold('✗ Not Logged In');
    console.error(`${padded}${status}`);
  }
  console.error('');
}

/**
 * Register the status command with the CLI.
 * @param program - Commander program instance
 */
export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Check session validity for all platforms')
    .action(async () => {
      try {
        header('Luxemia Social — Session Status');
        info('Checking sessions...\n');

        const results: Record<string, boolean> = {};

        for (const platform of ALL_PLATFORMS) {
          try {
            const isValid = await checkPlatformSession(platform);
            results[platform] = isValid;
          } catch {
            results[platform] = false;
          }
        }

        printStatusTable(results);

        const allValid = Object.values(results).every((v) => v);
        if (allValid) {
          success('All platforms are authenticated!');
        } else {
          error('Some platforms need authentication. Run: luxemia-social auth <platform>');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        error(`Status check failed: ${message}`);
        process.exit(1);
      }
    });
}
