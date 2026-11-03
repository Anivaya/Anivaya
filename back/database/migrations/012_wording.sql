-- Données d’exemple déjà enregistrées : formulations sans mention de test et
-- numéros d’identification au format réel (puce électronique, 15 chiffres).
UPDATE animal_profiles SET identifier='250269604512387' WHERE identifier='EXEMPLE-NALA-001';
UPDATE animal_profiles SET identifier='250269604598214' WHERE identifier='EXEMPLE-MILO-001';
UPDATE household SET label='Mon foyer' WHERE label='Foyer de démonstration';
UPDATE bookings SET note='Première consultation.' WHERE note='Consultation de démonstration.';
UPDATE bookings SET note='Annulé et remboursé.' WHERE note='Annulation et remboursement simulés.';
UPDATE bookings SET note='Contrôle annuel.' WHERE note='Exemple de rendez-vous passé.';
UPDATE notifications SET text='Consultez les détails de votre réservation.' WHERE text='Consultez les détails de votre réservation de démonstration.';
UPDATE notifications SET text='Le dossier de vos compagnons est disponible.' WHERE text='Le dossier de démonstration de vos compagnons est disponible.';
UPDATE received_shares SET content=replace(replace(replace(content,'Carnet de santé — exemple','Carnet de santé'),'EXEMPLE-LUNA-002','250269604733051'),'EXEMPLE-OSLO-002','250269604661902') WHERE content IS NOT NULL;
