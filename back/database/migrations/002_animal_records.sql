ALTER TABLE animals ADD COLUMN deleted_at TEXT;
ALTER TABLE reminders ADD COLUMN repeat TEXT NOT NULL DEFAULT 'Aucune';
ALTER TABLE reminders ADD COLUMN deleted_at TEXT;
ALTER TABLE documents ADD COLUMN category TEXT NOT NULL DEFAULT 'Santé';
CREATE TABLE animal_profiles (
 animal TEXT PRIMARY KEY REFERENCES animals(id),
 breed TEXT NOT NULL DEFAULT '', sex TEXT NOT NULL DEFAULT 'Non renseigné',
 dob TEXT NOT NULL DEFAULT '', weight TEXT NOT NULL DEFAULT '', coat TEXT NOT NULL DEFAULT '',
 identifier TEXT NOT NULL DEFAULT '', neutered TEXT NOT NULL DEFAULT 'Non renseignée',
 food TEXT NOT NULL DEFAULT '', routine TEXT NOT NULL DEFAULT '', behavior TEXT NOT NULL DEFAULT '',
 medical TEXT NOT NULL DEFAULT '', contact TEXT NOT NULL DEFAULT '', vet TEXT NOT NULL DEFAULT '',
 photo BLOB, photo_type TEXT
);
CREATE TABLE events (
 id TEXT PRIMARY KEY, animal TEXT NOT NULL REFERENCES animals(id),
 type TEXT NOT NULL, date TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', deleted_at TEXT
);
CREATE INDEX events_animal_date ON events(animal,date);
CREATE TABLE emergency_sheets (
 animal TEXT PRIMARY KEY REFERENCES animals(id), settings TEXT NOT NULL,
 snapshot TEXT NOT NULL, updated_at TEXT NOT NULL
);
INSERT INTO animal_profiles (animal,breed,sex,dob,weight,coat,identifier,neutered,food,routine,behavior,medical,contact,vet)
 SELECT id,'Golden retriever','Femelle','2023-04-14','28','Dorée','250269604512387','Oui',
 'Deux repas par jour, matin et soir.','Une promenade le matin et une sortie en fin de journée.',
 'Sociable. Préfère être approchée calmement.','Informations à confirmer avec le vétérinaire.',
 'Camille Martin — 06 12 34 56 78','Clinique des Tilleuls — 12, allée des Tilleuls, Lyon 3e'
 FROM animals WHERE id='nala';
INSERT INTO animal_profiles (animal,breed,sex,dob,weight,coat,identifier,neutered,food,routine,behavior,medical,contact,vet)
 SELECT id,'Européen','Mâle','2024-06-08','4.5','Tigrée','250269604598214','Oui',
 'Repas en petites portions.','Vit à l’intérieur. Apprécie son coin tranquille.',
 'Timide avec les personnes inconnues.','Informations à confirmer avec le vétérinaire.',
 'Camille Martin — 06 12 34 56 78','Clinique des Tilleuls — 12, allée des Tilleuls, Lyon 3e'
 FROM animals WHERE id='milo';
INSERT INTO animal_profiles(animal) SELECT id FROM animals WHERE id NOT IN (SELECT animal FROM animal_profiles);
INSERT INTO events(id,animal,type,date,note)
 SELECT 'consultation-'||id,id,'Consultation','2026-10-12','Visite annuelle — événement déclaré par le propriétaire.' FROM animals WHERE id IN ('nala','milo');
INSERT INTO events(id,animal,type,date,note)
 SELECT 'pesee-'||id,id,'Pesée','2026-10-05',CASE WHEN id='milo' THEN 'Poids déclaré : 4,5 kg' ELSE 'Poids déclaré : 28 kg' END FROM animals WHERE id IN ('nala','milo');
UPDATE documents SET category='Identité' WHERE id='d2' AND name='Passeport';
