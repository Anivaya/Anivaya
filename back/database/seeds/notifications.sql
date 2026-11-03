-- Notifications d’exemple du compte de démonstration, datées par rapport au premier lancement.
INSERT INTO notifications(id,category,title,text,href,action,created_at) VALUES
 ('rappel-nala','reminders','Un rappel pour Nala','Retrouvez ses prochaines échéances dans vos rappels.','#rappels','Voir les rappels',strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 hours')),
 ('rendez-vous','reservations','Votre rendez-vous est confirmé','Consultez les détails de votre réservation.','#reservations','Voir mes réservations',strftime('%Y-%m-%dT%H:%M:%SZ','now','-3 hours')),
 ('partage','shares','Votre partage est prêt','Retrouvez les accès accordés et vos personnes de confiance.','#partage','Voir mes partages',strftime('%Y-%m-%dT%H:%M:%SZ','now','-22 hours'));
INSERT INTO notifications(id,category,title,text,href,action,created_at,read) VALUES
 ('documents','documents','Vos documents sont à portée de main','Le dossier de vos compagnons est disponible.','#documents','Voir les documents',strftime('%Y-%m-%dT%H:%M:%SZ','now','-28 hours'),1);
UPDATE notifications SET read=1,created_at=strftime('%Y-%m-%dT%H:%M:%SZ','now','-48 hours') WHERE id='bienvenue';
