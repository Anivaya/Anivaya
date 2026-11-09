import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { Database, Input } from "../database/types.ts";
import type { LeadReceipt } from "../../shared/public.ts";
import { leadKinds } from "../../shared/public.ts";
import { validateLead } from "../../shared/lead-validation.ts";
import { appUrl, sendMail } from "./mail.ts";
import { centralMigration, transaction } from "../database/connection.ts";
import {
  ApiError,
  clientAddress,
  text,
  emailAddress,
  isPhone,
  oneOf,
  postalCode,
} from "./validation.ts";

/** Les formulaires publics créent une demande, jamais un compte ou un droit d'accès. */
export function publicService(db: Database) {
  db.exec(centralMigration("015_public_leads.sql"));
  db.exec(centralMigration("016_public_unsubscribe.sql"));
  const attempts = new Map<string, { count: number; until: number }>();
  function rate(request: IncomingMessage) {
    const now = Date.now();
    for (const [key, value] of attempts)
      if (value.until <= now) attempts.delete(key);
    const key = clientAddress(request);
    const bucket = attempts.get(key) || { count: 0, until: now + 15 * 60_000 };
    if (bucket.count >= 20)
      throw new ApiError(
        429,
        "Trop de demandes. Réessayez dans quelques minutes.",
      );
    bucket.count++;
    attempts.set(key, bucket);
  }
  return {
    async requestUnsubscribe(input: Input, request: IncomingMessage) {
      rate(request);
      const email = emailAddress(input.email);
      const lead = db
        .prepare(
          "SELECT id FROM public_leads WHERE email=? AND kind='liste-attente' LIMIT 1",
        )
        .get(email);
      if (lead) {
        const token = randomBytes(32).toString("hex"),
          date = new Date().toISOString();
        transaction(db, () => {
          db.prepare(
            "INSERT INTO public_waitlist_subscriptions(email,subscribed_at) VALUES (?,?) ON CONFLICT(email) DO NOTHING",
          ).run(email, date);
          db.prepare(
            "INSERT INTO public_unsubscribe_tokens(token_hash,email,created_at) VALUES (?,?,?)",
          ).run(createHash("sha256").update(token).digest("hex"), email, date);
        });
        await sendMail({
          to: email,
          subject: "Votre lien de désinscription Anivaya",
          text: "Vous pouvez retirer votre consentement aux e-mails de lancement depuis ce lien personnel. Si vous n’avez pas demandé ce lien, vous pouvez ignorer ce message.",
          action: {
            label: "Gérer mon inscription",
            url: `${appUrl()}/#desinscription/${token}`,
          },
        });
      }
      // La réponse ne révèle jamais si une adresse est inscrite.
      return { accepted: true as const };
    },
    async submit(input: Input, request: IncomingMessage): Promise<LeadReceipt> {
      rate(request);
      const fields = validateLead(input);
      const first = Object.keys(fields)[0];
      if (first) throw new ApiError(400, fields[first], first, fields);
      const kind = oneOf(
        text(input.kind, "kind", 20),
        leadKinds,
        "kind",
        "Choisissez un formulaire valide.",
      );
      const name = text(input.name, "name", kind === "liste-attente" ? 60 : 80);
      const email = emailAddress(input.email);
      const requestId = text(input.requestId, "requestId", 36);
      if (!/^[a-f0-9-]{36}$/i.test(requestId))
        throw new ApiError(400, "Rechargez le formulaire puis réessayez.");
      if (input.consent !== true)
        throw new ApiError(
          400,
          "Cochez cette case pour envoyer votre demande.",
          "consent",
        );
      const optional = (field: string, max: number) =>
        text(input[field] ?? "", field, max, false);
      const profile =
        kind === "liste-attente"
          ? oneOf(
              text(input.profile, "profile", 25),
              ["proprietaire", "professionnel", "clinique", "entreprise"],
              "profile",
              "Choisissez votre profil.",
            )
          : kind === "pro"
            ? "professionnel"
            : kind;
      const plan = oneOf(
        optional("plan", 20),
        ["", "gratuit", "plus", "famille"],
        "plan",
        "Choisissez une offre valide.",
      );
      const animals = input.animals ?? [];
      if (
        !Array.isArray(animals) ||
        animals.length > 2 ||
        animals.some((a) => !["chien", "chat"].includes(a))
      )
        throw new ApiError(400, "Choisissez chien ou chat.", "animals");
      const activity =
        kind === "pro"
          ? oneOf(
              text(input.activity, "activity", 40),
              [
                "pet-sitter",
                "promeneur",
                "educateur",
                "toiletteur",
                "pension",
                "autre",
              ],
              "activity",
              "Choisissez votre activité.",
            )
          : "";
      const organization = ["clinique", "entreprise"].includes(kind)
        ? text(input.organization, "organization", 120)
        : "";
      const organizationType =
        kind === "entreprise"
          ? oneOf(
              text(input.organizationType, "organizationType", 30),
              ["assureur", "mutuelle", "cse", "enseigne", "autre"],
              "organizationType",
              "Choisissez un type d’organisation.",
            )
          : "";
      const phone = kind === "clinique" ? optional("phone", 20) : "";
      if (phone && !isPhone(phone))
        throw new ApiError(400, "Vérifiez votre numéro de téléphone.", "phone");
      const data = {
        kind,
        name,
        email,
        profile,
        plan: kind === "liste-attente" ? plan : "",
        postalCode: postalCode(input.postalCode),
        animals:
          kind === "liste-attente" && profile === "proprietaire"
            ? [...new Set(animals)]
            : [],
        activity,
        organization,
        organizationType,
        phone,
        message: kind === "entreprise" ? optional("message", 1500) : "",
        consent: true,
      };
      const encoded = JSON.stringify(data);
      const previous = db
        .prepare("SELECT data FROM public_leads WHERE request_id=?")
        .get<{ data: string }>(requestId);
      if (previous && previous.data !== encoded)
        throw new ApiError(
          409,
          "Cette demande a déjà été enregistrée avec un autre contenu. Rechargez le formulaire pour envoyer une nouvelle demande.",
        );
      // Même réponse pour un doublon ; aucune adresse ni donnée existante n'est exposée.
      const existing = db
        .prepare(
          "SELECT id FROM public_leads WHERE request_id=? OR (email=? AND kind=? AND data=? AND (kind!='liste-attente' OR NOT EXISTS (SELECT 1 FROM public_waitlist_subscriptions WHERE email=? AND withdrawn_at IS NOT NULL)))",
        )
        .get(requestId, email, kind, encoded, email);
      let unsubscribeToken = "";
      if (!existing)
        transaction(db, () => {
          const id = randomUUID(),
            date = new Date().toISOString();
          db.prepare(
            "INSERT INTO public_leads(id,request_id,kind,email,data,consent_version,created_at) VALUES (?,?,?,?,?,?,?)",
          ).run(id, requestId, kind, email, encoded, "2026-11-06", date);
          if (kind === "liste-attente") {
            unsubscribeToken = randomBytes(32).toString("hex");
            db.prepare(
              "INSERT INTO public_waitlist_subscriptions(email,subscribed_at,withdrawn_at) VALUES (?,?,NULL) ON CONFLICT(email) DO UPDATE SET subscribed_at=excluded.subscribed_at, withdrawn_at=NULL",
            ).run(email, date);
            db.prepare(
              "INSERT INTO public_unsubscribe_tokens(token_hash,email,created_at) VALUES (?,?,?)",
            ).run(
              createHash("sha256").update(unsubscribeToken).digest("hex"),
              email,
              date,
            );
          }
          // La rubrique Demandes existante conserve ses autorisations et son parcours de suivi.
          if (
            db
              .prepare(
                "SELECT name FROM sqlite_master WHERE name='admin_records'",
              )
              .get()
          ) {
            const titles: Record<string, string> = {
              "liste-attente": "Liste d’attente",
              pro: "Inscription professionnel",
              clinique: "Clinique pilote",
              entreprise: "Partenariat entreprise",
            };
            const message = [
              `Nom : ${name}`,
              `Profil : ${profile}`,
              data.postalCode && `Code postal : ${data.postalCode}`,
              organization && `Organisation : ${organization}`,
              activity && `Activité : ${activity}`,
              organizationType && `Type : ${organizationType}`,
              phone && `Téléphone : ${phone}`,
              data.plan && `Offre : ${data.plan}`,
              data.animals.length && `Animaux : ${data.animals.join(", ")}`,
              data.message,
              "Consentement recueilli via le formulaire public.",
            ]
              .filter(Boolean)
              .join("\n");
            db.prepare(
              "INSERT INTO admin_records(id,resource,name,status,data,created_at,updated_at) VALUES (?,'tickets',?,'Ouvert',?,?,?)",
            ).run(
              id,
              `${titles[kind]} — ${name}`,
              JSON.stringify({
                email,
                message,
                category: titles[kind],
                assignee: "Support",
                history: [
                  { date, actor: name, action: "Demande reçue", note: message },
                ],
              }),
              date,
              date,
            );
          }
        });
      if (unsubscribeToken) {
        await sendMail({
          to: email,
          subject: "Votre inscription à la liste d’attente Anivaya",
          text: "Votre inscription à la liste d’attente Anivaya est enregistrée.\n\nVous pouvez retirer votre consentement à tout moment depuis votre lien personnel. Sur la page ouverte, un clic sur « Me désinscrire » suffit. Si vous n’êtes pas à l’origine de cette inscription, vous pouvez également utiliser ce lien.",
          action: {
            label: "Gérer mon inscription",
            url: `${appUrl()}/#desinscription/${unsubscribeToken}`,
          },
        });
      }
      return { accepted: true };
    },
    unsubscribe(input: Input, request: IncomingMessage) {
      rate(request);
      const token = text(input.token, "token", 64);
      if (!/^[a-f0-9]{64}$/.test(token))
        throw new ApiError(400, "Ce lien de désinscription est invalide.");
      const subscription = db
        .prepare(
          "SELECT email FROM public_unsubscribe_tokens WHERE token_hash=?",
        )
        .get<{
          email: string;
        }>(createHash("sha256").update(token).digest("hex"));
      if (!subscription)
        throw new ApiError(400, "Ce lien de désinscription est invalide.");
      transaction(db, () => {
        const date = new Date().toISOString();
        db.prepare(
          "UPDATE public_waitlist_subscriptions SET withdrawn_at=COALESCE(withdrawn_at,?) WHERE email=?",
        ).run(date, subscription.email);
        // Toute demande correspondante est marquée pour que le support respecte le retrait.
        const rows = db
          .prepare(
            "SELECT id FROM public_leads WHERE email=? AND kind='liste-attente'",
          )
          .all<{ id: string }>(subscription.email);
        if (
          db
            .prepare(
              "SELECT name FROM sqlite_master WHERE name='admin_records'",
            )
            .get()
        ) {
          for (const row of rows) {
            const record = db
              .prepare(
                "SELECT data FROM admin_records WHERE id=? AND resource='tickets'",
              )
              .get<{ data: string }>(row.id);
            if (!record) continue;
            const data = JSON.parse(record.data);
            if (data.consentWithdrawnAt) continue;
            data.consentWithdrawnAt = date;
            data.message +=
              "\nConsentement retiré : ne plus contacter cette personne pour le lancement.";
            data.history = [
              ...(data.history || []),
              {
                date,
                actor: "Destinataire",
                action: "Désinscription",
                note: "Retrait du consentement via le lien personnel.",
              },
            ];
            db.prepare(
              "UPDATE admin_records SET data=?,updated_at=? WHERE id=?",
            ).run(JSON.stringify(data), date, row.id);
          }
        }
      });
      return { accepted: true as const };
    },
  };
}
