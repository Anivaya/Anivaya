-- Invitations d’exemple reçues par les comptes de démonstration (contenu fictif).
INSERT INTO received_shares(id,title,kind,animal_name,sender,email,status,until,content,created_at) VALUES
 ('received-document','Carnet de santé d’Oslo','document','Oslo','test','test@gmail.com','pending',date('now','+20 days'),
  '{"document":"Carnet de santé — exemple","description":"Document partagé par le propriétaire d’Oslo.","entries":["Consultation annuelle : visite de contrôle déclarée par le propriétaire.","Vaccination : se reporter au document original du vétérinaire."]}',
  strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 hours')),
 ('received-trusted','Prendre le relais pour Luna','animal','Luna','test','test@gmail.com','pending',date('now','+30 days'),
  '{"name":"Luna","species":"Chat","breed":"Européen","sex":"Femelle","identifier":"EXEMPLE-LUNA-002","instructions":"Laisser de l’eau fraîche. Respecter son coin tranquille et garder les fenêtres fermées.","contact":"test — test@gmail.com"}',
  strftime('%Y-%m-%dT%H:%M:%SZ','now','-2 hours')),
 ('received-active','Les habitudes d’Oslo','animal','Oslo','test','test@gmail.com','accepted',date('now','+15 days'),
  '{"name":"Oslo","species":"Chien","breed":"Labrador","sex":"Mâle","identifier":"EXEMPLE-OSLO-002","instructions":"Une promenade le matin et le soir. Approcher calmement et garder la laisse en extérieur.","contact":"test — test@gmail.com"}',
  strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 days')),
 ('received-expired','Document de garde de Luna','document','Luna','test','test@gmail.com','accepted',date('now','-2 days'),NULL,strftime('%Y-%m-%dT%H:%M:%SZ','now','-2 days')),
 ('received-revoked','Ancienne fiche d’Oslo','animal','Oslo','test','test@gmail.com','revoked',date('now','+10 days'),NULL,strftime('%Y-%m-%dT%H:%M:%SZ','now','-3 days')),
 ('received-declined','Invitation pour Luna','animal','Luna','test','test@gmail.com','declined',date('now','+10 days'),NULL,strftime('%Y-%m-%dT%H:%M:%SZ','now','-4 days'));
