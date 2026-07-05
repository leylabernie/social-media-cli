/**
 * @file Schedule command — schedule a post for later execution.
 * Uses the cron scheduler to queue posts at a specified time.
 * @module luxemia-social/commands/schedule
 */

import { v4 as uuidv4 } from 'uuid';
import type { Command } from 'commander';
import { schedulePost, isValidSchedule } from '../scheduler/cron.js';
import { scrapeProduct } from '../scraper/product.js';
import { header, info, success, error, warn } from '../utils/logger.js';
import env from '../utils/env.js';

/**
 * Options for the schedule command.
 */
interface ScheduleOptions {
  /** ISO datetime or cron expression */
  at: string;
  /** Comma-separated platform list */
  platforms?: string;
}

/**
 * Execute a scheduled post.
 * @param post - Scheduled post details
 */
async function executeScheduledPost(post: {
  productUrl: string;
  platforms: string[];
}): Promise<void> {
  // Re-import dynamically to avoid circular deps
  const { scrapeProduct: scrape } = await import('../scraper/product.js');
  const { generateCaption: genCaption } = await import('../ai/caption-generator.js');
  const { processImage } = await import('../image/processor.js');
  const { launchForPosting } = await import('../browser/launch.js');
  const { checkSession } = await import('../browser/session-check.js');
  const { humanDelay } = await import('../browser/human.js');

  const product = await scrape(post.productUrl);

  for (const platform of post.platforms) {
    try {
      const caption = await genCaption(product, platform);
      const imagePath = await processImage(product.imageUrl, platform);

      const context = await launchForPosting(platform);
      try {
        const page = context.pages()[0] ?? (await context.newPage());
        const valid = await checkSession(platform, page);
        if (!valid) {
          warn(`Session invalid for ${platform}, skipping`);
          continue;
        }

        // Dynamic import of platform module
        try {
          const modulePath = `../platforms/${platform}.js`;
          const platformModule = await import(modulePath);
          await platformModule.default.post(page, {
            product,
            caption,
            imagePath,
          });
          success(`Scheduled post to ${platform} completed`);
        } catch {
          warn(`Platform module not found: ${platform}`);
        }
      } finally {
        await context.close();
        await humanDelay(500, 1000);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      error(`Failed to post to ${platform}: ${message}`);
    }
  }
}

/**
 * Register the schedule command with the CLI.
 * @param program - Commander program instance
 */
export function registerScheduleCommand(program: Command): void {
  program
    .command('schedule <url>')
    .description('Schedule a product post for later')
    .requiredOption('-a, --at <time>', 'ISO datetime (e.g., 2024-12-25T09:00:00Z) or cron expression')
    .option('-p, --platforms <list>', 'Comma-separated platforms (default: env DEFAULT_PLATFORMS)')
    .action(async (url: string, options: ScheduleOptions) => {
      try {
        header('Luxemia Social — Schedule Post');

        // Validate schedule time
        if (!isValidSchedule(options.at)) {
          error('Invalid schedule time. Use ISO datetime or valid cron expression.');
          process.exit(1);
        }

        // Determine platforms
        const platformList = options.platforms
          ? options.platforms.split(',').map((p) => p.trim()).filter(Boolean)
          : env.DEFAULT_PLATFORMS;

        // Validate URL by scraping
        info(`Validating product URL: ${url}`);
        const product = await scrapeProduct(url);
        success(`Product: "${product.title}"`);

        // Schedule the post
        const postId = uuidv4();
        await schedulePost(
          {
            id: postId,
            productUrl: url,
            platforms: platformList,
            scheduledAt: options.at,
          },
          executeScheduledPost
        );

        success(`\nPost scheduled successfully!`);
        info(`Post ID: ${postId}`);
        info(`Scheduled for: ${options.at}`);
        info(`Platforms: ${platformList.join(', ')}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        error(`Schedule command failed: ${message}`);
        process.exit(1);
      }
    });
}
