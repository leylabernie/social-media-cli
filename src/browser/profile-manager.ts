/**
 * @file Persistent browser profile path management.
 * Each platform gets its own isolated profile directory.
 * @module luxemia-social/browser/profile-manager
 */

import path from 'node:path';
import fs from 'node:fs';

/** Base directory for all browser profiles */
const PROFILE_BASE = path.resolve(process.cwd(), '.browser-profiles');

/**
 * Ensure the profile base directory exists.
 */
function ensureProfileBase(): void {
  if (!fs.existsSync(PROFILE_BASE)) {
    fs.mkdirSync(PROFILE_BASE, { recursive: true });
  }
}

/**
 * Get the filesystem path for a platform's persistent browser profile.
 * Creates the directory if it doesn't exist.
 * @param platform - Platform identifier (e.g., 'x', 'instagram')
 * @returns Absolute path to the profile directory
 */
export function profilePath(platform: string): string {
  ensureProfileBase();
  const dir = path.join(PROFILE_BASE, platform);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * List all platforms that have existing profiles.
 * @returns Array of platform identifiers
 */
export function listProfiles(): string[] {
  if (!fs.existsSync(PROFILE_BASE)) return [];
  return fs
    .readdirSync(PROFILE_BASE, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

/**
 * Remove a platform's profile directory (forces re-auth).
 * @param platform - Platform identifier
 */
export function clearProfile(platform: string): void {
  const dir = path.join(PROFILE_BASE, platform);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
