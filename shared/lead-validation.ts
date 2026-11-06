import { leadKinds } from "./public.ts";
export type LeadErrors = Record<string, string>;
/** Règles communes au formulaire et à l’API ; toutes les erreurs sont renvoyées ensemble. */
export function validateLead(input: Record<string, unknown>): LeadErrors {
  const errors: LeadErrors = {};
  const kind = input.kind;
  const checkText = (
    field: string,
    label: string,
    max: number,
    required = true,
  ) => {
    const value = input[field] ?? "";
    if (typeof value !== "string" || (required && !value.trim()))
      errors[field] = `Renseignez ${label}.`;
    else if (value.trim().length > max)
      errors[field] = `Utilisez au maximum ${max} caractères.`;
    return typeof value === "string" ? value.trim() : "";
  };
  if (!leadKinds.includes(kind as (typeof leadKinds)[number]))
    errors.kind = "Choisissez un formulaire valide.";
  checkText("name", "votre nom", kind === "liste-attente" ? 60 : 80);
  const email = checkText("email", "votre adresse e-mail", 120);
  if (!errors.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    errors.email = "Indiquez une adresse e-mail valide.";
  const postal = checkText("postalCode", "un code postal valide", 5, false);
  if (!errors.postalCode && postal && !/^\d{5}$/.test(postal))
    errors.postalCode = "Indiquez un code postal à 5 chiffres.";
  if (input.consent !== true)
    errors.consent = "Cochez cette case pour envoyer votre demande.";
  if (kind === "liste-attente") {
    if (
      !["proprietaire", "professionnel", "clinique", "entreprise"].includes(
        String(input.profile),
      )
    )
      errors.profile = "Choisissez votre profil.";
    if (!["", "gratuit", "plus", "famille"].includes(String(input.plan ?? "")))
      errors.plan = "Choisissez une offre valide.";
    const animals = input.animals ?? [];
    if (
      !Array.isArray(animals) ||
      animals.length > 2 ||
      animals.some((a) => !["chien", "chat"].includes(a))
    )
      errors.animals = "Choisissez chien ou chat.";
  }
  if (
    kind === "pro" &&
    ![
      "pet-sitter",
      "promeneur",
      "educateur",
      "toiletteur",
      "pension",
      "autre",
    ].includes(String(input.activity))
  )
    errors.activity = "Choisissez votre activité.";
  if (kind === "clinique" || kind === "entreprise")
    checkText(
      "organization",
      kind === "clinique"
        ? "le nom de la clinique"
        : "le nom de votre organisation",
      120,
    );
  if (kind === "clinique") {
    const phone = checkText(
      "phone",
      "un numéro de téléphone valide",
      20,
      false,
    );
    if (!errors.phone && phone && !/^[+\d\s().-]{6,25}$/.test(phone))
      errors.phone = "Vérifiez votre numéro de téléphone.";
  }
  if (kind === "entreprise") {
    if (
      !["assureur", "mutuelle", "cse", "enseigne", "autre"].includes(
        String(input.organizationType),
      )
    )
      errors.organizationType = "Choisissez un type d’organisation.";
    checkText("message", "votre projet", 1500, false);
  }
  return errors;
}
