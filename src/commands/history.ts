/**
 * @file History command — show recent posts from the database.
 * Displays post status, platforms, and URLs in a formatted table.
 * @module luxemia-social/commands/history
 */

import type { Command } from 'commander';
import { getRecentPosts } from '../storage/db.js';
import { header, info, warn, error } from '../utils/logger.js';
import chalk from 'chalk';

/**
 * Format a post status with color.
 * @param status - Post status string
 * @returns Colored status string
 */
function formatStatus(status: string): string {
  switch (status) {
    case 'posted':
      return chalk.green.bold('✓ posted');
    case 'failed':
      return chalk.red.bold('✗ failed');
    case 'scheduled':
      return chalk.blue.bold('⏵ scheduled');
    case 'pending':
      return chalk.yellow.bold('◌ pending');
    case 'partial':
      return chalk.yellow.bold('◐ partial');
    case 'cancelled':
      return chalk.gray.bold('⊘ cancelled');
    default:
      return chalk.gray(status);
  }
}

/**
 * Format an ISO date string to a readable format.
 * @param iso - ISO 8601 date string
 * @returns Formatted date string
 */
function formatDate(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/**
 * Register the history command with the CLI.
 * @param program - Commander program instance
 */
export function registerHistoryCommand(program: Command): void {
  program
    .command('history')
    .description('Show recent posts and their status')
    .option('-l, --limit <n>', 'Number of posts to show', '10')
    .action(async (options: { limit?: string }) => {
      try {
        header('Luxemia Social — Post History');

        const limit = parseInt(options.limit ?? '10', 10);
        if (isNaN(limit) || limit < 1) {
          error('Invalid limit — must be a positive number');
          process.exit(1);
        }

        const posts = getRecentPosts(limit);

        if (posts.length === 0) {
          warn('No posts found in the database.');
          return;
        }

        info(`Showing ${posts.length} recent post(s):\n`);

        // Table header
        console.error(chalk.bold.white('ID                               Product                        Status       Date'));
        console.error(chalk.gray('─────────────────────────────────────────────────────────────────────────────────────────'));

        for (const post of posts) {
          const shortId = post.id.substring(0, 8);
          const title = (post.productTitle ?? 'Unknown').substring(0, 28).padEnd(30, ' ');
          const status = formatStatus(post.status).padEnd(18, ' ');
          const date = formatDate(post.createdAt);

          console.error(`${chalk.gray(shortId)}  ${title}${status}${date}`);

          // Show platform details if available
          try {
            const platforms = JSON.parse(post.platformsJson) as Array<{
              platform: string;
              postUrl?: string;
              error?: string;
            }>;
            for (const p of platforms) {
              const icon = p.postUrl ? chalk.green('•') : chalk.red('•');
              const url = p.postUrl ? chalk.blue(p.postUrl) : chalk.gray(p.error ?? 'no URL');
              console.error(`  ${icon} ${p.platform.padEnd(12, ' ')} ${url}`);
            }
          } catch {
            // platforms_json may not be parseable array
          }
        }

        console.error('');
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        error(`History command failed: ${message}`);
        process.exit(1);
      }
    });
}
