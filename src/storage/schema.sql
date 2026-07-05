-- SQLite schema for luxemia-social
-- Run on first startup to initialize the database

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  product_url TEXT NOT NULL,
  product_title TEXT,
  product_image_url TEXT,
  created_at TEXT NOT NULL,
  scheduled_at TEXT,
  status TEXT NOT NULL,
  platforms_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS session_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL,
  event TEXT NOT NULL,
  details TEXT,
  timestamp TEXT NOT NULL
);
