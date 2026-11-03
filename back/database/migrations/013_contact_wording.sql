-- Coordonnées d’exemple sans mention de test, y compris dans les fiches d’urgence déjà
-- sauvegardées et les anciens identifiants d’exemple.
UPDATE animal_profiles SET contact='Camille Martin — 06 12 34 56 78' WHERE contact='Camille — contact de démonstration';
UPDATE animal_profiles SET vet='Clinique des Tilleuls — 12, allée des Tilleuls, Lyon 3e' WHERE vet='Clinique de démonstration — coordonnées non renseignées';
UPDATE emergency_sheets SET snapshot=replace(replace(replace(replace(snapshot,
  'Camille — contact de démonstration','Camille Martin — 06 12 34 56 78'),
  'Clinique de démonstration — coordonnées non renseignées','Clinique des Tilleuls — 12, allée des Tilleuls, Lyon 3e'),
  'EXEMPLE-NALA-001','250269604512387'),
  'EXEMPLE-MILO-001','250269604598214');
