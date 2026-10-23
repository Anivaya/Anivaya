-- Exemples ajoutés une seule fois au compte de démonstration, si les animaux initiaux existent encore.
INSERT OR IGNORE INTO bookings(id,professional,animal,animal_name,service,date,time,price,contact_name,email,note)
SELECT 'demo-upcoming','tilleuls',id,name,0,date('now','+3 days'),'10:30',45,'Camille Martin','test@gmail.com','Consultation de démonstration.' FROM animals WHERE id='nala' AND deleted_at IS NULL;
INSERT OR IGNORE INTO bookings(id,professional,animal,animal_name,service,date,time,price,contact_name,email,note)
SELECT 'demo-past','bulle',id,name,0,date('now','-14 days'),'14:00',40,'Camille Martin','test@gmail.com','Exemple de rendez-vous passé.' FROM animals WHERE id='nala' AND deleted_at IS NULL;
INSERT OR IGNORE INTO bookings(id,professional,animal,animal_name,service,date,time,price,status,contact_name,email,note,cancelled_at)
SELECT 'demo-cancelled','douce',id,name,0,date('now','-7 days'),'09:00',48,'cancelled','Camille Martin','test@gmail.com','Annulation et remboursement simulés.',datetime('now','-8 days') FROM animals WHERE id='milo' AND deleted_at IS NULL;
