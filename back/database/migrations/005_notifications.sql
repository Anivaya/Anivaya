CREATE TABLE notifications (
 id TEXT PRIMARY KEY,
 category TEXT NOT NULL CHECK(category IN ('reminders','reservations','shares','documents','account')),
 title TEXT NOT NULL, text TEXT NOT NULL, href TEXT NOT NULL, action TEXT NOT NULL,
 created_at TEXT NOT NULL, read INTEGER NOT NULL DEFAULT 0
);
INSERT INTO notifications(id,category,title,text,href,action,created_at) VALUES
 ('bienvenue','account','Bienvenue dans votre espace Anivaya','Personnalisez votre photo et vos coordonnées pour vous sentir chez vous.','#profil','Gérer mon profil',strftime('%Y-%m-%dT%H:%M:%SZ','now'));
