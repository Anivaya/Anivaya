CREATE TABLE user_profile (
 id INTEGER PRIMARY KEY CHECK(id=1), name TEXT NOT NULL, email TEXT NOT NULL DEFAULT '',
 phone TEXT NOT NULL DEFAULT '', city TEXT NOT NULL DEFAULT '', photo BLOB, photo_type TEXT,
 notifications TEXT NOT NULL DEFAULT '{"reminders":true,"reservations":true,"shares":true}',
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO user_profile(id,name) SELECT 1,first_name||' '||last_name FROM household WHERE id=1;
CREATE TABLE professionals (id TEXT PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE professional_favorites (professional TEXT PRIMARY KEY REFERENCES professionals(id));
CREATE TABLE bookings (
 id TEXT PRIMARY KEY, professional TEXT NOT NULL REFERENCES professionals(id),
 animal TEXT NOT NULL REFERENCES animals(id), animal_name TEXT NOT NULL,
 service INTEGER NOT NULL, date TEXT NOT NULL, time TEXT NOT NULL, price INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'confirmed' CHECK(status IN ('confirmed','cancelled')),
 contact_name TEXT NOT NULL, email TEXT NOT NULL, note TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, cancelled_at TEXT
);
CREATE UNIQUE INDEX bookings_available_slot ON bookings(professional,date,time) WHERE status='confirmed';
