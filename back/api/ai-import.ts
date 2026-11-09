import * as z from "zod/v4";
import type { Input } from "../database/types.ts";
import type { ExtractedValues } from "../../shared/models.ts";
import { ApiError, documentFile } from "./validation.ts";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
/** Modèle gratuit lisant les images ; à remplacer par ex. anthropic/claude-haiku-5.5 en production. */
const DEFAULT_MODEL = "nvidia/nemotron-3.5-super-vl:free";
/** Lecture des PDF par OpenRouter : cloudflare-ai est gratuit, native laisse le modèle lire le fichier. */
const DEFAULT_PDF_ENGINE = "cloudflare-ai";
const TIMEOUT_MS = 120_000;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Ce que l’import propose de vérifier ; chaque champ reste vide s’il n’est pas lisible. */
const fields = {
  readable: z
    .boolean()
    .describe(
      "false si le document est illisible ou sans rapport avec un animal",
    ),
  title: z
    .string()
    .describe("Nom court du document, ex. « Carnet de vaccination »"),
  category: z.enum(["Santé", "Identité", "Assurance", "Autre"]),
  date: z.string().describe("Date du document au format AAAA-MM-JJ, ou vide"),
  name: z.string().describe("Nom de l’animal, ou vide"),
  species: z.enum(["Chien", "Chat", ""]),
  breed: z.string().describe("Race, ou vide"),
  sex: z.enum(["Femelle", "Mâle", "Non renseigné"]),
  dob: z.string().describe("Date de naissance AAAA-MM-JJ, ou vide"),
  identifier: z
    .string()
    .describe("Numéro d’identification (puce ou tatouage), ou vide"),
  eventType: z.enum(["Consultation", "Vaccination déclarée", "Pesée", "Autre"]),
  note: z
    .string()
    .describe(
      "Résumé factuel de ce que le document atteste (actes, vaccins, poids), sans conseil médical, ou vide",
    ),
  reminderName: z
    .string()
    .describe(
      "Prochaine échéance écrite sur le document (rappel de vaccin, contrôle), ou vide",
    ),
  reminderDate: z
    .string()
    .describe("Date de cette échéance AAAA-MM-JJ, ou vide"),
};
const Extraction = z.object(fields);
const { $schema: _, ...SCHEMA } = z.toJSONSchema(Extraction);

/** Valeur retenue quand le modèle omet un champ ou répond hors des choix prévus. */
const FALLBACK: ExtractedValues = {
  readable: true,
  title: "",
  category: "Autre",
  date: "",
  name: "",
  species: "",
  breed: "",
  sex: "Non renseigné",
  dob: "",
  identifier: "",
  eventType: "Autre",
  note: "",
  reminderName: "",
  reminderDate: "",
};
const DATES = new Set(["date", "dob", "reminderDate"]);

const SYSTEM = `Tu lis des documents de santé et d’identité d’animaux de compagnie (carnet de vaccination, compte rendu de consultation, passeport, certificat d’identification, facture vétérinaire) pour Anivaya, une application française.
Recopie uniquement ce qui est écrit et lisible sur le document : n’invente, ne complète et ne déduis jamais une valeur. Laisse le champ vide si l’information est absente, illisible ou incertaine.
Les dates sont au format AAAA-MM-JJ. Le résumé reste factuel, en français, sans interprétation ni conseil médical. La personne vérifiera chaque champ avant tout enregistrement.
Réponds uniquement par un objet JSON conforme à ce schéma, sans texte autour :
${JSON.stringify(SCHEMA)}`;

/**
 * Extraction des informations d’une photo ou d’un PDF via OpenRouter. La clé vient de
 * OPENROUTER_API_KEY, le modèle de OPENROUTER_MODEL ; rien n’est enregistré ici.
 */
export async function extractDocument(data: Input): Promise<ExtractedValues> {
  const content = documentFile(data.type, data.content);
  const type = data.type as "application/pdf" | "image/png" | "image/jpeg";
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key)
    throw new ApiError(
      503,
      "L’import par IA n’est pas configuré : ajoutez une clé OPENROUTER_API_KEY.",
    );
  const url = `data:${type};base64,${Buffer.from(content).toString("base64")}`;
  const pdf = type === "application/pdf";

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.APP_URL || "http://127.0.0.1:5173",
        "X-Title": "Anivaya",
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL,
        max_tokens: 16000,
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: [
              pdf
                ? {
                    type: "file",
                    file: { filename: "document.pdf", file_data: url },
                  }
                : { type: "image_url", image_url: { url } },
              {
                type: "text",
                text: "Extrais les informations de ce document pour le carnet de l’animal.",
              },
            ],
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "extraction", strict: true, schema: SCHEMA },
        },
        ...(pdf && {
          plugins: [
            {
              id: "file-parser",
              pdf: {
                engine:
                  process.env.OPENROUTER_PDF_ENGINE?.trim() ||
                  DEFAULT_PDF_ENGINE,
              },
            },
          ],
        }),
      }),
    });
  } catch {
    // Délai dépassé ou réseau coupé.
    throw new ApiError(
      502,
      "Le service d’analyse ne répond pas. Réessayez dans un instant.",
    );
  }

  const body = (await response.json().catch(() => null)) as {
    error?: { code?: number; message?: string };
    choices?: { finish_reason?: string; message?: { content?: string } }[];
  } | null;
  // Une erreur peut aussi arriver dans une réponse 200, une fois le modèle lancé.
  const status = body?.error ? Number(body.error.code) || 502 : response.status;
  if (!response.ok || body?.error) {
    console.error(
      `OpenRouter ${status} : ${body?.error?.message ?? response.statusText}`,
    );
    throw failure(status);
  }

  const choice = body?.choices?.[0];
  const values = choice && parse(choice.message?.content);
  if (!values || choice.finish_reason === "content_filter")
    throw new ApiError(
      422,
      "Ce document n’a pas pu être analysé. Complétez les informations vous-même.",
      "file",
    );
  return values;
}

/** Message affiché selon l’erreur d’OpenRouter (le détail reste dans les journaux du serveur). */
function failure(status: number) {
  if (status === 401 || status === 403)
    return new ApiError(
      503,
      "L’import par IA n’est pas configuré : ajoutez une clé OPENROUTER_API_KEY valide.",
    );
  if (status === 402)
    return new ApiError(
      503,
      "L’import par IA est indisponible : le crédit OpenRouter est épuisé.",
    );
  if (status === 404)
    return new ApiError(
      503,
      "L’import par IA n’est pas configuré : le modèle OPENROUTER_MODEL est introuvable ou refusé par vos réglages OpenRouter.",
    );
  if (status === 429)
    return new ApiError(
      429,
      "Le service d’analyse est très sollicité. Réessayez dans un instant.",
    );
  if (status === 400)
    return new ApiError(
      400,
      "Ce document ne peut pas être analysé. Essayez une photo plus nette ou un autre PDF.",
      "file",
    );
  return new ApiError(
    502,
    "Le service d’analyse ne répond pas. Réessayez dans un instant.",
  );
}

/**
 * Lecture de la réponse du modèle. Les modèles gratuits respectent moins bien le schéma :
 * un champ manquant, hors des choix prévus ou une date mal formée reste vide plutôt que faux.
 */
function parse(text: string | undefined): ExtractedValues | null {
  const json = text?.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  let raw: unknown;
  try {
    raw = JSON.parse(json || "");
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  const values = { ...FALLBACK } as Record<string, unknown>;
  for (const [name, schema] of Object.entries(fields)) {
    let value = (raw as Record<string, unknown>)[name];
    if (typeof value === "string") value = value.trim();
    if (DATES.has(name) && typeof value === "string" && !DATE.test(value))
      continue;
    if (schema.safeParse(value).success) values[name] = value;
  }
  return values as unknown as ExtractedValues;
}
