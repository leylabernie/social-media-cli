/**
 * Vercel KV helper functions for the Luxemia Social Dashboard.
 *
 * Vercel KV is a Redis-compatible key-value store.
 * These wrappers abstract token retrieval and history persistence.
 *
 * @see https://vercel.com/docs/storage/vercel-kv
 */

import { kv } from "@vercel/kv";
import type { Platform, PlatformToken, HistoryEntry, StoredToken } from "@/lib/types";

/**
 * Retrieve an OAuth token for a given platform from KV storage.
 *
 * Tokens are stored under the key pattern: `token:{platform}`
 * e.g. `token:instagram`, `token:facebook`
 *
 * @param platform - The social media platform identifier
 * @returns The parsed token object for the platform
 * @throws If no token is found or JSON parsing fails
 */
export async function getToken<T extends PlatformToken>(
  platform: Platform
): Promise<T> {
  const key = `token:${platform}`;
  const raw = await kv.get<string>(key);

  if (!raw) {
    throw new Error(
      `No token found for platform "${platform}". Please connect the account in settings.`
    );
  }

  try {
    // Vercel KV may return a parsed object or a JSON string depending on how it was stored
    const parsed = typeof raw === "string" ? (JSON.parse(raw) as T) : (raw as unknown as T);
    return parsed;
  } catch {
    throw new Error(
      `Failed to parse stored token for "${platform}". Re-authenticate the account.`
    );
  }
}

/**
 * Store an OAuth token for a given platform in KV storage.
 *
 * @param platform - The social media platform identifier
 * @param token - The token object to persist
 */
export async function setToken<T extends PlatformToken>(
  platform: Platform,
  token: T
): Promise<void> {
  const key = `token:${platform}`;
  await kv.set(key, JSON.stringify(token));
}

/**
 * Delete a stored token for a given platform.
 *
 * @param platform - The social media platform identifier
 */
export async function deleteToken(platform: Platform): Promise<void> {
  const key = `token:${platform}`;
  await kv.del(key);
}

/**
 * Append a history entry to the recent posts list in KV.
 * Keeps only the most recent 100 entries to prevent unbounded growth.
 *
 * @param entry - The history entry to store
 */
export async function addHistoryEntry(entry: HistoryEntry): Promise<void> {
  const key = "history:posts";
  const existing = await kv.lrange<HistoryEntry>(key, 0, 99);
  const updated = [entry, ...existing].slice(0, 100);
  await kv.del(key);
  if (updated.length > 0) {
    await kv.lpush(key, ...updated);
  }
}

/**
 * Retrieve recent post history from KV.
 *
 * @param limit - Maximum number of entries to return (default 50)
 * @returns Array of history entries, newest first
 */
export async function getHistory(limit = 50): Promise<HistoryEntry[]> {
  const key = "history:posts";
  const entries = await kv.lrange<HistoryEntry>(key, 0, limit - 1);
  return entries ?? [];
}

/**
 * Retrieve tokens for all supported platforms.
 * Returns an object with platform keys and token values.
 * Missing tokens are omitted — check with `if (tokens.instagram)`.
 *
 * @returns Record of platform → token for all found tokens
 */
export async function getAllTokens(): Promise<Record<string, StoredToken>> {
  const platforms: Platform[] = ['instagram', 'facebook', 'tiktok', 'pinterest'];
  const result: Record<string, StoredToken> = {};

  for (const platform of platforms) {
    try {
      const token = await getToken(platform);
      result[platform] = token;
    } catch {
      // Token not found for this platform — skip
    }
  }

  return result;
}

/**
 * Alias for deleteToken — removes a stored token.
 * Used by the disconnect API route.
 *
 * @param platform - The social media platform identifier
 */
export async function removeToken(platform: Platform): Promise<void> {
  return deleteToken(platform);
}

/**
 * Generate a random state string for OAuth CSRF protection.
 * Returns a 32-character hex string.
 *
 * @returns Random hex state string
 */
export function generateOAuthState(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
