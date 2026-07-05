/**
 * @file Interactive caption review using inquirer prompts.
 * Lets the user approve, skip, or edit platform captions before posting.
 * @module luxemia-social/review/interactive
 */

import { checkbox, input, confirm } from '@inquirer/prompts';
import { info, success, warn, header } from '../utils/logger.js';

/**
 * Single platform caption result for review.
 */
export interface ReviewItem {
  /** Platform identifier */
  platform: string;
  /** Generated caption text */
  caption: string;
}

/**
 * Review decision for a single platform.
 */
export interface ReviewDecision {
  /** Whether the caption is approved for posting */
  approved: boolean;
  /** Edited caption text (if user made changes) */
  editedCaption?: string;
}

/**
 * Present an interactive review interface for all generated captions.
 * Users can approve platforms via checkbox and optionally edit captions.
 * @param results - Array of platform/caption pairs to review
 * @returns Record mapping platform name to review decision
 */
export async function reviewCaptions(
  results: ReviewItem[]
): Promise<Record<string, ReviewDecision>> {
  header('Review Captions');

  // Display all captions
  for (const { platform, caption } of results) {
    info(`\n[${platform.toUpperCase()}] (${caption.length} chars)`);
    console.error(`  ${caption}\n`);
  }

  // Let user select which platforms to approve
  const approvedPlatforms = await checkbox({
    message: 'Select platforms to post to (Space to toggle, Enter to confirm):',
    choices: results.map((r) => ({
      name: `${r.platform} — ${r.caption.substring(0, 50)}...`,
      value: r.platform,
      checked: true,
    })),
  });

  const decisions: Record<string, ReviewDecision> = {};

  for (const { platform, caption } of results) {
    const approved = approvedPlatforms.includes(platform);

    if (!approved) {
      warn(`Skipping ${platform}`);
      decisions[platform] = { approved: false };
      continue;
    }

    // Ask if user wants to edit this caption
    const shouldEdit = await confirm({
      message: `Edit caption for ${platform}?`,
      default: false,
    });

    if (shouldEdit) {
      const edited = await input({
        message: `Edit caption for ${platform}:`,
        default: caption,
      });
      decisions[platform] = { approved: true, editedCaption: edited.trim() || caption };
      success(`Caption updated for ${platform}`);
    } else {
      decisions[platform] = { approved: true };
      success(`${platform} approved`);
    }
  }

  return decisions;
}
