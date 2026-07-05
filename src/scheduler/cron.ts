/**
 * @file Scheduling module using node-cron.
 * Manages scheduled posts and executes them at the specified time.
 * @module luxemia-social/scheduler/cron
 */

import cron from 'node-cron';
import { info, debug, error, success } from '../utils/logger.js';
import { savePost, updatePostStatus } from '../storage/db.js';

/** A scheduled post entry */
export interface ScheduledPost {
  /** Unique post ID */
  id: string;
  /** Product URL to post */
  productUrl: string;
  /** Platforms to post to */
  platforms: string[];
  /** ISO timestamp when the post should execute */
  scheduledAt: string;
  /** Optional pre-generated caption overrides */
  captions?: Record<string, string>;
}

/** Active cron jobs keyed by post ID */
const activeJobs = new Map<string, cron.ScheduledTask>();

/**
 * Validate that a cron expression or datetime string is valid.
 * Supports both cron syntax and ISO datetime strings.
 * @param schedule - Cron expression or ISO datetime
 * @returns True if valid
 */
export function isValidSchedule(schedule: string): boolean {
  // Check if it's a valid ISO datetime
  const date = new Date(schedule);
  if (!isNaN(date.getTime()) && schedule.includes('T')) {
    return date > new Date();
  }

  // Check if it's a valid cron expression
  return cron.validate(schedule);
}

/**
 * Convert an ISO datetime string to a cron expression.
 * @param isoString - ISO 8601 datetime string
 * @returns Cron expression (minute hour day month *)
 */
function isoToCron(isoString: string): string {
  const date = new Date(isoString);
  const minute = date.getMinutes();
  const hour = date.getHours();
  const day = date.getDate();
  const month = date.getMonth() + 1; // JS months are 0-indexed
  return `${minute} ${hour} ${day} ${month} *`;
}

/**
 * Schedule a post for later execution.
 * @param post - The scheduled post details
 * @param executeFn - Callback function to execute when the schedule fires
 * @returns The post ID
 */
export async function schedulePost(
  post: ScheduledPost,
  executeFn: (post: ScheduledPost) => Promise<void>
): Promise<string> {
  const { id, scheduledAt } = post;

  // Save to database first
  savePost({
    id,
    productUrl: post.productUrl,
    createdAt: new Date().toISOString(),
    scheduledAt,
    status: 'scheduled',
    platformsJson: JSON.stringify(post.platforms),
  });

  // Determine the cron expression
  let cronExpr: string;
  if (cron.validate(scheduledAt)) {
    cronExpr = scheduledAt;
  } else {
    cronExpr = isoToCron(scheduledAt);
  }

  if (!cron.validate(cronExpr)) {
    throw new Error(`Invalid schedule expression: ${scheduledAt}`);
  }

  // Create the cron job
  const task = cron.schedule(
    cronExpr,
    async () => {
      info(`Executing scheduled post: ${id}`);
      try {
        await executeFn(post);
        updatePostStatus(id, 'posted', JSON.stringify({ completed: true }));
        success(`Scheduled post completed: ${id}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        error(`Scheduled post failed: ${id} — ${message}`);
        updatePostStatus(id, 'failed', JSON.stringify({ error: message }));
      } finally {
        activeJobs.delete(id);
      }
    },
    { scheduled: true }
  );

  activeJobs.set(id, task);
  debug(`Post ${id} scheduled with cron: ${cronExpr}`);
  success(`Post scheduled for ${scheduledAt}`);

  return id;
}

/**
 * Cancel a scheduled post by ID.
 * @param postId - The ID of the scheduled post to cancel
 * @returns True if the post was found and cancelled
 */
export function cancelScheduledPost(postId: string): boolean {
  const task = activeJobs.get(postId);
  if (!task) {
    return false;
  }

  task.stop();
  activeJobs.delete(postId);
  updatePostStatus(postId, 'cancelled', '{}');
  success(`Cancelled scheduled post: ${postId}`);
  return true;
}

/**
 * List all currently scheduled (active) posts.
 * @returns Array of active post IDs
 */
export function listScheduledPosts(): string[] {
  return Array.from(activeJobs.keys());
}

/**
 * Stop all scheduled jobs. Call on process exit.
 */
export function stopAllSchedules(): void {
  for (const [id, task] of activeJobs) {
    task.stop();
    debug(`Stopped schedule: ${id}`);
  }
  activeJobs.clear();
}
