const Database = require('better-sqlite3');
const bcrypt    = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'sitenote.db');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(path.join(DATA_DIR, 'uploads'), { recursive: true });

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    client      TEXT    DEFAULT '',
    color       TEXT    DEFAULT '#3B82F6',
    created_at  TEXT    DEFAULT (datetime('now')),
    updated_at  TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS notes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id  INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    title       TEXT    NOT NULL DEFAULT 'Untitled Note',
    body        TEXT    DEFAULT '',
    tags        TEXT    DEFAULT '[]',
    template    TEXT    DEFAULT NULL,
    created_at  TEXT    DEFAULT (datetime('now')),
    updated_at  TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    note_id     INTEGER REFERENCES notes(id) ON DELETE CASCADE,
    text        TEXT    NOT NULL,
    completed   INTEGER DEFAULT 0,
    position    INTEGER DEFAULT 0,
    created_at  TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS attachments (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    note_id       INTEGER REFERENCES notes(id) ON DELETE CASCADE,
    filename      TEXT    NOT NULL,
    original_name TEXT    NOT NULL,
    mime_type     TEXT    DEFAULT 'application/octet-stream',
    size          INTEGER DEFAULT 0,
    created_at    TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
  );

  -- FTS5 for full-text search across notes
  CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
    title,
    body,
    tags,
    content=notes,
    content_rowid=id
  );

  -- Triggers to keep FTS in sync
  CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
    INSERT INTO notes_fts(rowid, title, body, tags)
    VALUES (new.id, new.title, new.body, new.tags);
  END;

  CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
    INSERT INTO notes_fts(notes_fts, rowid, title, body, tags)
    VALUES ('delete', old.id, old.title, old.body, old.tags);
  END;

  CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
    INSERT INTO notes_fts(notes_fts, rowid, title, body, tags)
    VALUES ('delete', old.id, old.title, old.body, old.tags);
    INSERT INTO notes_fts(rowid, title, body, tags)
    VALUES (new.id, new.title, new.body, new.tags);
  END;

  -- Auto-update updated_at on projects
  CREATE TRIGGER IF NOT EXISTS projects_updated_at AFTER UPDATE ON projects BEGIN
    UPDATE projects SET updated_at = datetime('now') WHERE id = new.id;
  END;

  -- Auto-update project updated_at when a note changes
  CREATE TRIGGER IF NOT EXISTS note_updates_project AFTER UPDATE ON notes BEGIN
    UPDATE projects SET updated_at = datetime('now') WHERE id = new.project_id;
  END;

  CREATE TRIGGER IF NOT EXISTS note_insert_updates_project AFTER INSERT ON notes BEGIN
    UPDATE projects SET updated_at = datetime('now') WHERE id = new.project_id;
  END;
`);

// Settings sourced from env vars — always overwrite on startup so .env changes take effect
const envSettings = {
  transcription_url:     process.env.TRANSCRIPTION_URL,
  transcription_api_key: process.env.TRANSCRIPTION_API_KEY,
  transcription_model:   process.env.TRANSCRIPTION_MODEL,
  anthropic_api_key:     process.env.ANTHROPIC_API_KEY,
  llm_url:               process.env.LLM_URL,
  llm_api_key:           process.env.LLM_API_KEY,
  llm_model:             process.env.LLM_MODEL,
  invoiceninja_url:      process.env.INVOICENINJA_URL,
  invoiceninja_api_key:  process.env.INVOICENINJA_API_KEY,
  google_client_id:      process.env.GOOGLE_CLIENT_ID,
  google_client_secret:  process.env.GOOGLE_CLIENT_SECRET,
};

// User-preference settings — only insert if missing, never overwrite user changes
const userDefaults = {
  transcription_url:        'http://localhost:8000/v1/audio/transcriptions',
  transcription_api_key:    '',
  transcription_model:      'whisper-1',
  anthropic_api_key:        '',
  llm_url:                  'http://localhost:11434/v1',
  llm_api_key:              '',
  llm_model:                'llama3',
  invoiceninja_url:         '',
  invoiceninja_api_key:     '',
  google_client_id:         '',
  google_client_secret:     '',
  dark_mode:                'system',
  app_name:                 'SiteNote',
  reminder_incomplete_bids: 'true',
  reminder_unscheduled:     'true',
  reminder_interval_hours:  '24',
};

const upsertSetting = db.prepare(
  'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
);
const insertSetting = db.prepare(
  'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
);

// Apply env vars first (always win)
for (const [key, value] of Object.entries(envSettings)) {
  if (value !== undefined && value !== '') upsertSetting.run(key, value);
}
// Then fill in any missing keys with defaults
for (const [key, value] of Object.entries(userDefaults)) {
  insertSetting.run(key, value);
}

// Materials buying-pattern reference
db.exec(`
  CREATE TABLE IF NOT EXISTS material_preferences (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    material    TEXT NOT NULL,
    preference  TEXT NOT NULL,
    created_at  TEXT DEFAULT (datetime('now'))
  )
`);

// Schema migrations — try/catch because SQLite has no IF NOT EXISTS for ADD COLUMN
try { db.exec("ALTER TABLE projects ADD COLUMN invoiceninja_client_id TEXT DEFAULT NULL"); } catch {}
try { db.exec("ALTER TABLE projects ADD COLUMN bid_items TEXT DEFAULT '[]'");              } catch {}
try { db.exec("ALTER TABLE notes    ADD COLUMN bid_items TEXT DEFAULT '[]'");              } catch {}

// Hash and store ADMIN_PASSWORD from env on every startup so password changes take effect
const adminPassword = process.env.ADMIN_PASSWORD;
if (adminPassword) {
  const hash = bcrypt.hashSync(adminPassword, 12);
  upsertSetting.run('admin_password_hash', hash);
}

module.exports = db;
