/**
 * @file Retry command — retry a failed post by ID from the database.
 * Looks up the post, re-scrapes the product, and re-attempts posting.
 * @module luxemia-social/commands/retry
 */

import type { Command } from 'commander';
import { getRecentPosts, updatePostStatus } from '../storage/db.js';
import { scrapeProduct } from '../scraper/product.js';
import { generateCaption } from '../ai/caption-generator.js';
import { processImage } from '../image/processor.js';
import { launchForPosting } from '../browser/launch.js';
import { checkSession } from '../browser/session-check.js';
import { humanDelay } from '../browser/human.js';
import { header, info, success, error, warn } from '../utils/logger.js';

/**
 * Options for the retry command.
 */
interface RetryOptions {
  /** Skip interactive review */
  force?: boolean;
}

/**
 * Retry posting for a single platform.
 * @param productUrl - Product URL to re-scrape
 * @param platform - Platform to retry
 * @returns Result object with postUrl or error
 */
async function retryPlatform(
  productUrl: string,
  platform: string
): Promise<{ platform: string; postUrl?: string; error?: string }> {
  try {
    const product = await scrapeProduct(productUrl);
    const caption = await generateCaption(product, platform);
    const imagePath = await processImage(product.imageUrl, platform);

    const context = await launchForPosting(platform);
    try {
      const page = context.pages()[0] ?? (await context.newPage());
      const valid = await checkSession(platform, page);
      if (!valid) {
        return { platform, error: 'Session invalid — run auth first' };
      }

      try {
        const modulePath = `../platforms/${platform}.js`;
        const platformModule = await import(modulePath);
        const postUrl = await platformModule.default.post(page, {
          product,
          caption,
          imagePath,
        });
        return { platform, postUrl };
      } catch {
        return { platform, error: 'Platform module not found or posting failed' };
      }
    } finally {
      await context.close();
      await humanDelay(500, 1000);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { platform, error: message };
  }
}

/**
 * Register the retry command with the CLI.
 * @param program - Commander program instance
 */
export function registerRetryCommand(program: Command): void {
  program
    .command('retry <postId>')
    .description('Retry a failed post by its ID')
    .option('-f, --force', 'Skip confirmation prompt', false)
    .action(async (postId: string, options: RetryOptions) => {
      try {
        header('Luxemia Social — Retry Post');

        // Find the post in recent history
        const posts = getRecentPosts(50);
        const post = posts.find((p) => p.id === postId || p.id.startsWith(postId));

        if (!post) {
          error(`Post not found: ${postId}`);
          info('Use "history" command to see recent post IDs.');
          process.exit(1);
        }

        info(`Found post: ${post.productTitle ?? 'Unknown'}`);
        info(`Current status: ${post.status}`);
        info(`Product URL: ${post.productUrl}`);

        // Parse platforms from the stored record
        let platforms: string[] = [];
        try {
          const parsed = JSON.parse(post.platformsJson);
          if (Array.isArray(parsed)) {
            platforms = parsed.map((p: { platform?: string } | string) =>
              typeof p === 'string' ? p : p.platform ?? ''
            ).filter(Boolean);
          } else if (typeof parsed === 'object') {
            platforms = Object.keys(parsed);
          }
        } catch {
          warn('Could not parse platforms from record, using defaults');
          platforms = ['x', 'instagram', 'facebook', 'pinterest', 'linkedin'];
        }

        info(`Platforms to retry: ${platforms.join(', ')}\n`);

        if (!options.force) {
          const { confirm } = await import('@inquirer/prompts');
          const shouldProceed = await confirm({
            message: 'Retry this post now?',
            default: true,
          });
          if (!shouldProceed) {
            info('Retry cancelled.');
            return;
          }
        }

        // Retry each platform
        const results = await Promise.all(
          platforms.map((platform) => retryPlatform(post.productUrl, platform))
        );

        // Update status
        const allSucceeded = results.every((r) => r.postUrl);
        const platformsJson = JSON.stringify(
          results.map((r) => ({
            platform: r.platform,
            postUrl: r.postUrl,
            error: r.error,
          }))
        );

        updatePostStatus(
          post.id,
          allSucceeded ? 'posted' : 'partial',
          platformsJson
        );

        // Print results
        header('Retry Results');
        for (const r of results) {
          if (r.postUrl) {
            success(`${r.platform}: ${r.postUrl}`);
          } else {
            error(`${r.platform}: ${r.error ?? 'Unknown error'}`);
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        error(`Retry command failed: ${message}`);
        process.exit(1);
      }
    });
}
