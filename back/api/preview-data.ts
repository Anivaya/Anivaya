import { readFileSync } from "node:fs";
import type { Database } from "../database/types.ts";
import { transaction } from "../database/connection.ts";
import { createRepository } from "./repository.ts";
import { localToday } from "./validation.ts";

const version = "preview-rich-data-v1";
const fixtures = [
  ["consultation", "Compte rendu fictif d’Oslo", "preview-oslo", "Santé", "consultation-oslo.pdf"],
  ["identite", "Identité fictive de Luna", "preview-luna", "Identité", "identite-luna.pdf"],
  ["assurance", "Assurance fictive d’Oslo", "preview-oslo", "Assurance", "assurance-oslo.pdf"],
  ["garde", "Consignes de garde de Luna", "preview-luna", "Autre", "garde-luna.pdf"],
] as const;

/** Additive, once per filled preview account. Never used by ordinary or empty accounts. */
export async function seedPreviewData(db: Database) {
  if (db.previewDemo !== "sample" || process.env.ANIVAYA_TESTING_PREVIEW !== "1") return;
  if (db.prepare("SELECT name FROM schema_migrations WHERE name=?").get(version)) return;
  const today = localToday();
  const day = (offset: number) => {
    const value = new Date(today + "T12:00:00Z");
    value.setUTCDate(value.getUTCDate() + offset);
    return value.toISOString().slice(0, 10);
  };
  const now = new Date().toISOString();
  transaction(db, () => {
    for (const [id, name, species, breed, sex, weight, style] of [
      ["preview-oslo", "Oslo", "Chien", "Labrador", "Mâle", "24", "dog"],
      ["preview-luna", "Luna", "Chat", "Européen", "Femelle", "4", "cat"],
    ]) {
      db.prepare("INSERT INTO animals(id,name,species,description,style) VALUES (?,?,?,?,?) ON CONFLICT(id) DO NOTHING")
        .run(id, name, species, `${breed} · Animal fictif`, style);
      db.prepare("INSERT INTO animal_profiles(animal,breed,sex,dob,weight,coat,neutered,food,routine,behavior,medical,contact,vet) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(animal) DO NOTHING")
        .run(id, breed, sex, "2024-06-08", weight, species === "Chat" ? "Grise" : "Sable", "Oui",
          "Deux repas par jour, eau fraîche disponible.", "Promenade ou jeux calmes matin et soir.",
          "Animal fictif sociable, à approcher calmement.", "Données de démonstration, aucun diagnostic réel.",
          "Camille Exemple · camille@example.test", "Établissement fictif · aucune consultation réelle");
      for (const [suffix, type, offset, note] of [
        ["consultation", "Consultation", -14, "Visite de suivi fictive, sans valeur médicale."],
        ["pesee", "Pesée", -7, `Poids déclaré fictif : ${weight} kg.`],
        ["vaccination", "Vaccination déclarée", -30, "Vaccination fictive pour tester l’historique."],
      ] as const)
        db.prepare("INSERT INTO events(id,animal,type,date,note) VALUES (?,?,?,?,?) ON CONFLICT(id) DO NOTHING")
          .run(`${id}-${suffix}`, id, type, day(offset), note);
    }
    for (const [id, name, animal, offset, done, repeat] of [
      ["retard", "Contrôle fictif en retard", "preview-oslo", -3, 0, "Aucune"],
      ["aujourdhui", "Préparer la garde de Luna", "preview-luna", 0, 0, "Aucune"],
      ["prochain", "Visite fictive à venir", "preview-oslo", 7, 0, "Chaque année"],
      ["termine", "Pesée fictive effectuée", "preview-luna", -1, 1, "Aucune"],
      ["recurrent", "Vérifier les accessoires", "preview-oslo", 14, 0, "Chaque mois"],
    ] as const)
      db.prepare("INSERT INTO reminders(id,name,animal,date,done,repeat,notice,note) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING")
        .run(`preview-${id}`, name, animal, day(offset), done, repeat, "Le jour même", "Rappel fictif, aucun envoi externe.");
    for (const [id, name, animal, category, filename] of fixtures)
      db.prepare("INSERT INTO documents(id,name,animal,type,content,example,category) VALUES (?,?,?,?,?,0,?) ON CONFLICT(id) DO NOTHING")
        .run(`preview-doc-${id}`, name, animal, "application/pdf", readFileSync(new URL(`../database/fixtures/${filename}`, import.meta.url)), category);
    for (const [id, name, role] of [["camille", "Camille Exemple", "Famille"], ["alex", "Alex Exemple", "Garde"], ["lou", "Lou Exemple", "Proche"]]) {
      const person = `preview-person-${id}`;
      db.prepare("INSERT INTO trusted_people(id,name,role,email,phone,note) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING")
        .run(person, name, role, `${id}@example.test`, "", "Personne entièrement fictive.");
      db.prepare("INSERT INTO person_animals(person,animal) VALUES (?,?) ON CONFLICT(person,animal) DO NOTHING").run(person, "preview-oslo");
      db.prepare("INSERT INTO person_animals(person,animal) VALUES (?,?) ON CONFLICT(person,animal) DO NOTHING").run(person, "preview-luna");
    }
    for (const [state, offset, revoked] of [["actif", 14, 0], ["expire", -2, 0], ["revoque", 14, 1]] as const)
      db.prepare("INSERT INTO document_shares(id,doc,person,recipient,email,until,revoked,created_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING")
        .run(`preview-share-${state}`, "preview-doc-consultation", "preview-person-camille", "Camille Exemple", "camille@example.test", day(offset), revoked, now);
    for (const professional of ["tilleuls", "bulle"])
      db.prepare("INSERT INTO professional_favorites(professional) VALUES (?) ON CONFLICT(professional) DO NOTHING").run(professional);
    db.prepare("INSERT INTO notifications(id,category,title,text,href,action,created_at,read) VALUES (?,?,?,?,?,?,?,0) ON CONFLICT(id) DO NOTHING")
      .run("preview-data-ready", "documents", "Vos exemples sont disponibles", "Retrouvez Oslo, Luna et leurs documents fictifs dans les carnets.", "#animaux", "Voir les animaux", now);
  });
  const records = createRepository(db);
  for (const [animal, active] of [["preview-oslo", true], ["preview-luna", false]] as const) {
    // A partially completed seed must never overwrite a sheet already edited by the tester.
    if (!records.emergency.get(animal)) await records.emergency.save(animal, {
      active, photo: true, details: true, notes: true, contact: true, vet: false,
    });
  }
  db.prepare("INSERT INTO schema_migrations(name) VALUES (?) ON CONFLICT(name) DO NOTHING").run(version);
}
