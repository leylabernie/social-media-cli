/**
 * @file SQLite database module using better-sqlite3.
 * Handles persistence of posts and session events.
 * @module luxemia-social/storage/db
 */

import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Base directory for application data */
const DATA_DIR = path.resolve(process.cwd(), 'data');

/** Path to the SQLite database file */
const DB_PATH = path.join(DATA_DIR, 'luxemia.db');

/** Path to the schema SQL file */
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

/** Ensure the data directory exists */
function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Initialize the database connection and schema.
 * Creates tables if they don't exist.
 * @returns Connected better-sqlite3 Database instance
 */
function initDb(): Database.Database {
  ensureDataDir();
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  db.exec(schema);

  return db;
}

/** Singleton database instance */
const db = initDb();

/**
 * Record representing a stored post in the database.
 */
export interface PostRecord {
  /** Unique post ID (UUID) */
  id: string;
  /** URL of the product being posted */
  productUrl: string;
  /** Product title */
  productTitle?: string;
  /** URL of the product image */
  productImageUrl?: string;
  /** ISO timestamp when the record was created */
  createdAt: string;
  /** ISO timestamp when the post is scheduled (null if immediate) */
  scheduledAt?: string;
  /** Post status: 'pending' | 'posted' | 'failed' | 'scheduled' */
  status: string;
  /** JSON string of platform results */
  platformsJson: string;
}

/**
 * Save a new post record to the database.
 * @param post - The post record to save
 */
export function savePost(post: PostRecord): void {
  const stmt = db.prepare(
    `INSERT INTO posts (id, product_url, product_title, product_image_url, created_at, scheduled_at, status, platforms_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  stmt.run(
    post.id,
    post.productUrl,
    post.productTitle ?? null,
    post.productImageUrl ?? null,
    post.createdAt,
    post.scheduledAt ?? null,
    post.status,
    post.platformsJson
  );
}

/**
 * Retrieve recent posts from the database, ordered by creation date descending.
 * @param limit - Maximum number of posts to retrieve
 * @returns Array of post records
 */
export function getRecentPosts(limit: number): PostRecord[] {
  const stmt = db.prepare(
    `SELECT id, product_url as productUrl, product_title as productTitle,
            product_image_url as productImageUrl, created_at as createdAt,
            scheduled_at as scheduledAt, status, platforms_json as platformsJson
     FROM posts
     ORDER BY created_at DESC
     LIMIT ?`
  );
  return stmt.all(limit) as PostRecord[];
}

/**
 * Update the status and platform results of an existing post.
 * @param id - The post ID to update
 * @param status - New status value
 * @param platformsJson - Updated platform results as JSON string
 */
export function updatePostStatus(id: string, status: string, platformsJson: string): void {
  const stmt = db.prepare(
    `UPDATE posts SET status = ?, platforms_json = ? WHERE id = ?`
  );
  stmt.run(status, platformsJson, id);
}

/**
 * Log a session-related event for debugging.
 * @param platform - Platform name (e.g., 'x', 'instagram')
 * @param event - Event type (e.g., 'login', 'logout', 'check')
 * @param details - Optional details string
 */
export function logSessionEvent(platform: string, event: string, details?: string): void {
  const stmt = db.prepare(
    `INSERT INTO session_log (platform, event, details, timestamp)
     VALUES (?, ?, ?, ?)`
  );
  stmt.run(platform, event, details ?? null, new Date().toISOString());
}
