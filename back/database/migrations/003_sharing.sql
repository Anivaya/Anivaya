ALTER TABLE reminders ADD COLUMN notice TEXT NOT NULL DEFAULT 'Le jour même';
ALTER TABLE reminders ADD COLUMN note TEXT NOT NULL DEFAULT '';
CREATE TABLE trusted_people (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL, email TEXT NOT NULL DEFAULT '',
 phone TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '', deleted_at TEXT
);
CREATE UNIQUE INDEX people_email ON trusted_people(lower(email)) WHERE email <> '' AND deleted_at IS NULL;
CREATE TABLE person_animals (
 person TEXT NOT NULL REFERENCES trusted_people(id), animal TEXT NOT NULL REFERENCES animals(id),
 PRIMARY KEY(person, animal)
);
CREATE TABLE document_shares (
 id TEXT PRIMARY KEY, doc TEXT NOT NULL REFERENCES documents(id), person TEXT REFERENCES trusted_people(id),
 recipient TEXT NOT NULL, email TEXT NOT NULL, until TEXT NOT NULL, revoked INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX shares_document ON document_shares(doc);
CREATE INDEX shares_person ON document_shares(person);
