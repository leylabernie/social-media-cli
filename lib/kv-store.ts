/**
 * @file Vercel KV storage module for session persistence and post history.
 * Uses @vercel/kv for all key-value operations in the serverless environment.
 * @module @/lib/kv-store
 */

import { createClient } from '@vercel/kv';
import type { PostRecord, PostResult } from '@/lib/types';

/** Vercel KV client instance */
const kv = createClient({
  url: process.env.KV_REST_API_URL ?? '',
  token: process.env.KV_REST_API_TOKEN ?? '',
});

/** Key prefix for cookie storage */
const COOKIES_PREFIX = 'cookies';
/** Key for the posts history list */
const POSTS_KEY = 'posts:history';
/** Maximum number of posts to keep in history */
const MAX_POSTS_HISTORY = 100;

/**
 * Get stored cookies for a given platform.
 * @param platform - Platform identifier (e.g., 'x', 'instagram')
 * @returns Record of cookie name-value pairs, or empty object if none found
 */
export async function getCookies(platform: string): Promise<Record<string, string>> {
  try {
    const cookies = await kv.hgetall<Record<string, string>>(`${COOKIES_PREFIX}:${platform}`);
    return cookies ?? {};
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[KV] Failed to get cookies for ${platform}:`, message);
    return {};
  }
}

/**
 * Store cookies for a given platform.
 * @param platform - Platform identifier (e.g., 'x', 'instagram')
 * @param cookies - Record of cookie name-value pairs to store
 */
export async function setCookies(platform: string, cookies: Record<string, string>): Promise<void> {
  try {
    const key = `${COOKIES_PREFIX}:${platform}`;
    // Delete existing hash and recreate with new values
    await kv.del(key);
    if (Object.keys(cookies).length > 0) {
      await kv.hset(key, cookies);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[KV] Failed to set cookies for ${platform}:`, message);
    throw new Error(`Failed to persist cookies for ${platform}: ${message}`);
  }
}

/**
 * Save a post record to the history list.
 * Stores the individual record and prepends its ID to the history list,
 * trimming to MAX_POSTS_HISTORY if needed.
 * @param record - The PostRecord to save
 */
export async function savePost(record: PostRecord): Promise<void> {
  try {
    // Store the individual post record
    await kv.set(`post:${record.id}`, record);

    // Prepend to the history list
    await kv.lpush(POSTS_KEY, record.id);

    // Trim the list to keep only the most recent entries
    await kv.ltrim(POSTS_KEY, 0, MAX_POSTS_HISTORY - 1);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[KV] Failed to save post record:`, message);
    throw new Error(`Failed to save post record: ${message}`);
  }
}

/**
 * Retrieve the most recent posts from history.
 * @param limit - Maximum number of posts to retrieve (default: 20)
 * @returns Array of PostRecord objects, most recent first
 */
export async function getPosts(limit: number = 20): Promise<PostRecord[]> {
  try {
    // Get the IDs from the history list
    const ids = await kv.lrange<string>(POSTS_KEY, 0, limit - 1);

    if (!ids || ids.length === 0) {
      return [];
    }

    // Fetch each post record by ID
    const records = await Promise.all(
      ids.map((id) => kv.get<PostRecord>(`post:${id}`))
    );

    // Filter out any null entries (in case a record was deleted)
    return records.filter((r): r is PostRecord => r !== null && r !== undefined);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[KV] Failed to get posts:`, message);
    return [];
  }
}

/**
 * Update the status and results of an existing post record.
 * @param id - The unique post record ID
 * @param status - New status value
 * @param results - Updated array of PostResult objects
 */
export async function updatePostStatus(
  id: string,
  status: string,
  results: PostResult[]
): Promise<void> {
  try {
    const key = `post:${id}`;
    const existing = await kv.get<PostRecord>(key);

    if (!existing) {
      throw new Error(`Post record not found: ${id}`);
    }

    const updated: PostRecord = {
      ...existing,
      status: status as PostRecord['status'],
      results,
    };

    await kv.set(key, updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[KV] Failed to update post status:`, message);
    throw new Error(`Failed to update post status: ${message}`);
  }
}
