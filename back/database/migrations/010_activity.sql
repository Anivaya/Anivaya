-- Journal d’activité par animal, alimenté par des déclencheurs : sert aux indicateurs
-- d’activation et de rétention du pilotage. Aucune donnée de contenu n’y est copiée.
CREATE TABLE IF NOT EXISTS activity (
 animal TEXT NOT NULL, kind TEXT NOT NULL, at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS activity_animal_at ON activity(animal, at);
CREATE TRIGGER IF NOT EXISTS activity_animal_insert AFTER INSERT ON animals BEGIN
 INSERT INTO activity VALUES (NEW.id,'animal-created',strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
CREATE TRIGGER IF NOT EXISTS activity_animal_update AFTER UPDATE ON animals BEGIN
 INSERT INTO activity VALUES (NEW.id,'animal',strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
CREATE TRIGGER IF NOT EXISTS activity_profile_insert AFTER INSERT ON animal_profiles BEGIN
 INSERT INTO activity VALUES (NEW.animal,'profile',strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
CREATE TRIGGER IF NOT EXISTS activity_profile_update AFTER UPDATE ON animal_profiles BEGIN
 INSERT INTO activity VALUES (NEW.animal,'profile',strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
CREATE TRIGGER IF NOT EXISTS activity_reminder_insert AFTER INSERT ON reminders BEGIN
 INSERT INTO activity VALUES (NEW.animal,'reminder-created',strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
CREATE TRIGGER IF NOT EXISTS activity_reminder_update AFTER UPDATE ON reminders BEGIN
 INSERT INTO activity VALUES (NEW.animal,'reminder',strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
CREATE TRIGGER IF NOT EXISTS activity_event_insert AFTER INSERT ON events BEGIN
 INSERT INTO activity VALUES (NEW.animal,'event',strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
CREATE TRIGGER IF NOT EXISTS activity_event_update AFTER UPDATE ON events BEGIN
 INSERT INTO activity VALUES (NEW.animal,'event',strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
CREATE TRIGGER IF NOT EXISTS activity_document_insert AFTER INSERT ON documents BEGIN
 INSERT INTO activity VALUES (NEW.animal,'document',strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
CREATE TRIGGER IF NOT EXISTS activity_document_update AFTER UPDATE ON documents BEGIN
 INSERT INTO activity VALUES (NEW.animal,'document',strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
-- Les carnets déjà présents comptent comme actifs à la mise en place du suivi.
INSERT INTO activity SELECT id,'migration',strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM animals WHERE deleted_at IS NULL;
