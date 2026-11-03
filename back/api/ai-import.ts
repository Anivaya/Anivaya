import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod/v4";
import type { Input } from "../database/types.ts";
import type { ExtractedValues } from "../../shared/models.ts";
import { ApiError, documentFile } from "./validation.ts";

/** Ce que l’import propose de vérifier ; chaque champ reste vide s’il n’est pas lisible. */
const Extraction = z.object({
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
  breed: z.string(),
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
});

const SYSTEM = `Tu lis des documents de santé et d’identité d’animaux de compagnie (carnet de vaccination, compte rendu de consultation, passeport, certificat d’identification, facture vétérinaire) pour Anivaya, une application française.
Recopie uniquement ce qui est écrit et lisible sur le document : n’invente, ne complète et ne déduis jamais une valeur. Laisse le champ vide si l’information est absente, illisible ou incertaine.
Les dates sont au format AAAA-MM-JJ. Le résumé reste factuel, en français, sans interprétation ni conseil médical. La personne vérifiera chaque champ avant tout enregistrement.`;

let client: Anthropic | undefined;

/**
 * Extraction des informations d’une photo ou d’un PDF avec l’API Claude. La clé vient de
 * ANTHROPIC_API_KEY (ou d’un profil `ant auth login`) ; rien n’est enregistré ici.
 */
export async function extractDocument(data: Input): Promise<ExtractedValues> {
  const content = documentFile(data.type, data.content);
  const type = data.type as "application/pdf" | "image/png" | "image/jpeg";
  const base64 = Buffer.from(content).toString("base64");
  let message;
  try {
    client ??= new Anthropic();
    message = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      // Repli automatique sur un autre modèle si la demande est déclinée.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      output_config: {
        effort: "medium",
        format: betaZodOutputFormat(Extraction),
      },
      messages: [
        {
          role: "user",
          content: [
            type === "application/pdf"
              ? {
                  type: "document",
                  source: {
                    type: "base64",
                    media_type: "application/pdf",
                    data: base64,
                  },
                }
              : {
                  type: "image",
                  source: { type: "base64", media_type: type, data: base64 },
                },
            {
              type: "text",
              text: "Extrais les informations de ce document pour le carnet de l’animal.",
            },
          ],
        },
      ],
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError)
      throw new ApiError(
        503,
        "L’import par IA n’est pas configuré : ajoutez une clé ANTHROPIC_API_KEY valide.",
      );
    if (error instanceof Anthropic.RateLimitError)
      throw new ApiError(
        429,
        "Le service d’analyse est très sollicité. Réessayez dans un instant.",
      );
    if (error instanceof Anthropic.BadRequestError)
      throw new ApiError(
        400,
        "Ce document ne peut pas être analysé. Essayez une photo plus nette ou un autre PDF.",
        "file",
      );
    if (error instanceof Anthropic.APIError)
      throw new ApiError(
        502,
        "Le service d’analyse ne répond pas. Réessayez dans un instant.",
      );
    // Sans aucune clé, le SDK refuse de créer la requête.
    throw new ApiError(
      503,
      "L’import par IA n’est pas configuré : ajoutez une clé ANTHROPIC_API_KEY.",
    );
  }
  if (message.stop_reason === "refusal" || !message.parsed_output)
    throw new ApiError(
      422,
      "Ce document n’a pas pu être analysé. Complétez les informations vous-même.",
      "file",
    );
  return message.parsed_output;
}
