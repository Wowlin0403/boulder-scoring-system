const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/scoring.db');

const fs = require('fs');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Migration: rebuild boulders/scores with per-category schema (one-time)
const bouldersInfo = db.prepare("PRAGMA table_info(boulders)").all();
const hasCategoryId = bouldersInfo.some(col => col.name === 'category_id');
if (!hasCategoryId) {
  db.pragma('foreign_keys = OFF');
  db.exec('DROP TABLE IF EXISTS scores');
  db.exec('DROP TABLE IF EXISTS boulders');
  db.pragma('foreign_keys = ON');
}

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'judge',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    date TEXT NOT NULL,
    rounds INTEGER NOT NULL DEFAULT 1,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#c8f135',
    rounds INTEGER NOT NULL DEFAULT 1,
    semi_quota INTEGER DEFAULT 0,
    final_quota INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS athletes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    bib TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS boulders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    round TEXT NOT NULL,
    number INTEGER NOT NULL,
    label TEXT NOT NULL,
    UNIQUE(category_id, round, number)
  );

  CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    athlete_id INTEGER NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    round TEXT NOT NULL,
    boulder_id INTEGER NOT NULL REFERENCES boulders(id) ON DELETE CASCADE,
    top INTEGER NOT NULL DEFAULT 0,
    top_attempts INTEGER NOT NULL DEFAULT 0,
    zone INTEGER NOT NULL DEFAULT 0,
    zone_attempts INTEGER NOT NULL DEFAULT 0,
    attempts INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now')),
    updated_by INTEGER REFERENCES users(id),
    UNIQUE(athlete_id, round, boulder_id)
  );
`);

// Existing DB migrations
try { db.exec('ALTER TABLE categories ADD COLUMN rounds INTEGER NOT NULL DEFAULT 1'); } catch {}
try { db.exec('ALTER TABLE categories ADD COLUMN semi_quota INTEGER DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE categories ADD COLUMN final_quota INTEGER DEFAULT 0'); } catch {}

const existing = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
if (!existing) {
  const hash = bcrypt.hashSync('admin1234', 10);
  db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run('admin', hash, 'admin');
}

module.exports = db;
