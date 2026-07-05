/**
 * @file Authentication command — run first-login flows for platforms.
 * Supports single platform or all platforms at once.
 * @module luxemia-social/commands/auth
 */

import type { Command } from 'commander';
import { runAuthFlow } from '../browser/auth-flow.js';
import { header, info, success, error } from '../utils/logger.js';

/** Supported platforms and their login URLs */
const PLATFORM_AUTH_URLS: Record<string, { url: string; displayName: string }> = {
  x: {
    url: 'https://x.com/i/flow/login',
    displayName: 'X (Twitter)',
  },
  instagram: {
    url: 'https://www.instagram.com/accounts/login/',
    displayName: 'Instagram',
  },
  facebook: {
    url: 'https://www.facebook.com/login/',
    displayName: 'Facebook',
  },
  pinterest: {
    url: 'https://www.pinterest.com/login/',
    displayName: 'Pinterest',
  },
  linkedin: {
    url: 'https://www.linkedin.com/login',
    displayName: 'LinkedIn',
  },
};

/** All supported platform identifiers */
const ALL_PLATFORMS = Object.keys(PLATFORM_AUTH_URLS);

/**
 * Run authentication flow for a single platform.
 * @param platform - Platform identifier
 * @returns Promise that resolves when auth is complete
 * @throws Error if platform is unknown
 */
async function authPlatform(platform: string): Promise<void> {
  const config = PLATFORM_AUTH_URLS[platform];
  if (!config) {
    throw new Error(
      `Unknown platform: ${platform}. Supported: ${ALL_PLATFORMS.join(', ')}`
    );
  }

  await runAuthFlow(platform, config.url, config.displayName);
}

/**
 * Register the auth command with the CLI.
 * @param program - Commander program instance
 */
export function registerAuthCommand(program: Command): void {
  program
    .command('auth <platform>')
    .description('Authenticate with a social media platform (or "all" for all platforms)')
    .action(async (platform: string) => {
      try {
        header('Luxemia Social — Authentication');

        if (platform === 'all') {
          info(`Authenticating all platforms: ${ALL_PLATFORMS.join(', ')}`);

          for (const p of ALL_PLATFORMS) {
            info(`\n--- ${PLATFORM_AUTH_URLS[p].displayName} ---`);
            try {
              await authPlatform(p);
              success(`${PLATFORM_AUTH_URLS[p].displayName} authenticated`);
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              error(`Failed to authenticate ${p}: ${message}`);
            }
          }

          success('\nAll authentication flows completed!');
        } else {
          await authPlatform(platform);
          success(`Authentication complete for ${platform}!`);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        error(`Auth command failed: ${message}`);
        process.exit(1);
      }
    });
}
