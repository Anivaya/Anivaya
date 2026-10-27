CREATE TABLE received_shares (
 id TEXT PRIMARY KEY,
 title TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('animal','document')),
 animal_name TEXT NOT NULL,
 sender TEXT NOT NULL, email TEXT NOT NULL,
 permission TEXT NOT NULL DEFAULT 'Lecture seule',
 status TEXT NOT NULL CHECK(status IN ('pending','accepted','declined','revoked')),
 until TEXT NOT NULL,
 content TEXT,
 created_at TEXT NOT NULL,
 responded_at TEXT
);
