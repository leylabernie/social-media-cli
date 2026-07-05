/**
 * @file Main post command — the core posting flow.
 * Validates URL, scrapes product, generates captions, processes images,
 * shows interactive review, and posts to approved platforms.
 * @module luxemia-social/commands/post
 */

import { v4 as uuidv4 } from 'uuid';
import type { Command } from 'commander';
import { scrapeProduct } from '../scraper/product.js';
import { generateCaption } from '../ai/caption-generator.js';
import { processImage } from '../image/processor.js';
import { reviewCaptions } from '../review/interactive.js';
import { savePost, updatePostStatus } from '../storage/db.js';
import { checkSession } from '../browser/session-check.js';
import { launchForPosting } from '../browser/launch.js';
import { humanDelay } from '../browser/human.js';
import { header, info, success, error, warn } from '../utils/logger.js';
import env from '../utils/env.js';
import type { ProductInfo, PlatformPostInput } from '../platforms/types.js';

/**
 * Options for the post command.
 */
interface PostOptions {
  /** Comma-separated list of platforms */
  platforms?: string;
  /** Run in dry-run mode (no actual posting) */
  dryRun?: boolean;
}

/**
 * Post a product to all approved platforms in parallel.
 * @param product - Scraped product info
 * @param platformList - List of platform identifiers
 * @param captions - Record of platform -> caption
 * @param imagePaths - Record of platform -> processed image path
 * @param dryRun - If true, skip actual posting
 * @returns Array of platform post results
 */
async function executePosts(
  product: ProductInfo,
  platformList: string[],
  captions: Record<string, string>,
  imagePaths: Record<string, string>,
  dryRun: boolean
): Promise<Array<{ platform: string; postUrl?: string; error?: string }>> {
  const results: Array<{ platform: string; postUrl?: string; error?: string }> = [];

  if (dryRun) {
    for (const platform of platformList) {
      info(`[DRY RUN] Would post to ${platform}`);
      results.push({ platform, postUrl: 'https://example.com/dry-run' });
    }
    return results;
  }

  // Post to platforms in parallel
  await Promise.all(
    platformList.map(async (platform) => {
      const context = await launchForPosting(platform);
      try {
        const page = context.pages()[0] ?? (await context.newPage());

        // Check session validity
        const isValid = await checkSession(platform, page);
        if (!isValid) {
          throw new Error(`Invalid session — run 'luxemia-social auth ${platform}' first`);
        }

        // Post via dynamic import of platform module
        try {
          const modulePath = `../platforms/${platform}.js`;
          const platformModule = await import(modulePath);
          const platformInstance = platformModule.default;

          const input: PlatformPostInput = {
            product,
            caption: captions[platform],
            imagePath: imagePaths[platform],
          };

          const postUrl = await platformInstance.post(page, input);
          results.push({ platform, postUrl });
          success(`Posted to ${platform}: ${postUrl}`);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          throw new Error(`Platform posting failed: ${message}`);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        error(`Failed to post to ${platform}: ${message}`);
        results.push({ platform, error: message });
      } finally {
        await context.close();
        await humanDelay(500, 1000);
      }
    })
  );

  return results;
}

/**
 * Register the post command with the CLI.
 * @param program - Commander program instance
 */
export function registerPostCommand(program: Command): void {
  program
    .command('post <url>')
    .description('Scrape a product and post to social media platforms')
    .option('-p, --platforms <list>', 'Comma-separated platforms (default: env DEFAULT_PLATFORMS)')
    .option('-d, --dry-run', 'Preview without posting', false)
    .action(async (url: string, options: PostOptions) => {
      const postId = uuidv4();
      const startTime = new Date().toISOString();

      try {
        header('Luxemia Social — Post');

        // 1. Determine platforms
        const platformList = options.platforms
          ? options.platforms.split(',').map((p) => p.trim()).filter(Boolean)
          : env.DEFAULT_PLATFORMS;

        info(`Platforms: ${platformList.join(', ')}`);
        if (options.dryRun) {
          warn('Running in DRY RUN mode — no actual posts will be made');
        }

        // 2. Scrape product
        info(`Scraping: ${url}`);
        const product = await scrapeProduct(url);
        success(`Product: "${product.title}" — ${product.price}`);

        // 3. Save initial post record
        savePost({
          id: postId,
          productUrl: url,
          productTitle: product.title,
          productImageUrl: product.imageUrl,
          createdAt: startTime,
          status: 'pending',
          platformsJson: JSON.stringify(platformList),
        });

        // 4. Generate captions
        header('Generating Captions');
        const captionResults: Array<{ platform: string; caption: string }> = [];
        const captions: Record<string, string> = {};

        for (const platform of platformList) {
          try {
            const caption = await generateCaption(product, platform);
            captionResults.push({ platform, caption });
            captions[platform] = caption;
            success(`Caption ready for ${platform}`);
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            error(`Caption failed for ${platform}: ${message}`);
            captions[platform] = `Check out ${product.title}! ${product.url}`;
            captionResults.push({ platform, caption: captions[platform] });
          }
        }

        // 5. Interactive review
        const decisions = await reviewCaptions(captionResults);
        const approvedPlatforms = Object.entries(decisions)
          .filter(([, d]) => d.approved)
          .map(([p]) => p);

        if (approvedPlatforms.length === 0) {
          warn('No platforms approved — aborting');
          updatePostStatus(postId, 'cancelled', '{}');
          return;
        }

        // Apply any caption edits
        for (const [platform, decision] of Object.entries(decisions)) {
          if (decision.editedCaption) {
            captions[platform] = decision.editedCaption;
          }
        }

        // 6. Process images
        header('Processing Images');
        const imagePaths: Record<string, string> = {};

        for (const platform of approvedPlatforms) {
          try {
            const imagePath = await processImage(product.imageUrl, platform);
            imagePaths[platform] = imagePath;
            success(`Image ready for ${platform}`);
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            error(`Image processing failed for ${platform}: ${message}`);
          }
        }

        // 7. Execute posts
        header('Posting to Platforms');
        const results = await executePosts(
          product,
          approvedPlatforms,
          captions,
          imagePaths,
          options.dryRun ?? false
        );

        // 8. Save results
        const platformsJson = JSON.stringify(
          results.map((r) => ({
            platform: r.platform,
            postUrl: r.postUrl,
            error: r.error,
          }))
        );

        const allSucceeded = results.every((r) => r.postUrl);
        updatePostStatus(
          postId,
          allSucceeded ? 'posted' : 'partial',
          platformsJson
        );

        // 9. Summary
        header('Summary');
        for (const r of results) {
          if (r.postUrl) {
            success(`${r.platform}: ${r.postUrl}`);
          } else {
            error(`${r.platform}: ${r.error ?? 'Unknown error'}`);
          }
        }

        success(`Post ID: ${postId}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        error(`Post command failed: ${message}`);
        updatePostStatus(postId, 'failed', JSON.stringify({ error: message }));
        process.exit(1);
      }
    });
}
