import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const dataDir = process.env.PULSE_DATA_DIR || path.join(process.cwd(), ".data");
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, "pulse.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL DEFAULT '',
    avatar_color TEXT NOT NULL DEFAULT '#2563eb',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS settings (
    profile_id TEXT PRIMARY KEY,
    preferences TEXT NOT NULL DEFAULT '{}',
    ollama TEXT NOT NULL DEFAULT '{}',
    active_profile INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS feeds (
    profile_id TEXT NOT NULL,
    url TEXT NOT NULL,
    title TEXT NOT NULL,
    color TEXT NOT NULL,
    PRIMARY KEY (profile_id, url)
  );
  CREATE TABLE IF NOT EXISTS feed_lists (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    name TEXT NOT NULL,
    feed_urls TEXT NOT NULL DEFAULT '[]'
  );
  CREATE TABLE IF NOT EXISTS watched_keywords (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    query TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    link TEXT NOT NULL DEFAULT '',
    unread INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS feed_health (
    url TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    error TEXT NOT NULL DEFAULT '',
    article_count INTEGER NOT NULL DEFAULT 0,
    checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS reading_state (
    profile_id TEXT PRIMARY KEY,
    data TEXT NOT NULL DEFAULT '{}'
  );
  CREATE TABLE IF NOT EXISTS daily_digests (
    profile_id TEXT NOT NULL,
    day TEXT NOT NULL,
    result TEXT NOT NULL,
    generated_at TEXT NOT NULL,
    PRIMARY KEY (profile_id, day)
  );
`);

export default db;
