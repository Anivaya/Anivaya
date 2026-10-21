PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS household (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  label TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS animals (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  species TEXT NOT NULL CHECK(species IN ('Chien','Chat')),
  description TEXT NOT NULL,
  style TEXT NOT NULL DEFAULT 'new'
);
CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  animal TEXT NOT NULL REFERENCES animals(id),
  date TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0 CHECK(done IN (0,1))
);
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  animal TEXT NOT NULL REFERENCES animals(id),
  type TEXT,
  content BLOB,
  example INTEGER NOT NULL DEFAULT 0 CHECK(example IN (0,1)),
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS reminders_date ON reminders(date);
