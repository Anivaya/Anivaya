import { exportCategories } from "../../shared/account.ts";
import type { ExportCategory } from "../../shared/account.ts";
import type { createRepository } from "./repository.ts";
import type { profileRepository } from "./profile.ts";
import type { directoryRepository } from "./directory.ts";
import { ApiError } from "./validation.ts";

function categoriesFrom(value: string | null): ExportCategory[] {
  const requested = (value ?? "").split(",").filter(Boolean);
  if (
    !requested.length ||
    requested.some((c) => !exportCategories.includes(c as ExportCategory))
  )
    throw new ApiError(400, "Choisissez au moins une catégorie valide.");
  return [...new Set(requested as ExportCategory[])];
}

/**
 * Export des données du compte, catégorie par catégorie. Les fichiers d’origine, les
 * mots de passe et le contenu appartenant à d’autres propriétaires sont exclus.
 */
export function exportAccount(
  sources: {
    repository: ReturnType<typeof createRepository>;
    profile: ReturnType<typeof profileRepository>;
    directory: ReturnType<typeof directoryRepository>;
    /** Communautés du compte connecté, si l’authentification est active. */
    socialExport?: () => unknown;
  },
  value: string | null,
) {
  const categories = categoriesFrom(value);
  const dashboard = sources.repository.dashboard();
  const data: Record<string, unknown> = {};
  if (categories.includes("profile")) {
    const { photo, ...profile } = sources.profile.get();
    data.profile = { ...profile, hasPhoto: Boolean(photo) };
  }
  if (categories.includes("animals"))
    data.animals = dashboard.animals.map(({ photo, ...animal }) => ({
      ...animal,
      hasPhoto: Boolean(photo),
      events: dashboard.events.filter((e) => e.animal === animal.id),
      emergencySheet:
        dashboard.emergencySheets.find((s) => s.animal === animal.id)
          ?.settings ?? null,
    }));
  if (categories.includes("documents")) {
    data.documents = dashboard.documents.map(
      ({ url, ...document }) => document,
    );
    data.reminders = dashboard.reminders;
  }
  if (categories.includes("sharing"))
    data.sharing = {
      sent: dashboard.shares,
      people: dashboard.people,
      received: dashboard.receivedShares.map(({ content, ...share }) => share),
    };
  if (categories.includes("bookings"))
    data.bookings = sources.directory.all().bookings;
  if (categories.includes("social"))
    data.social = sources.socialExport?.() ?? null;
  return {
    format: "anivaya-export",
    version: 1,
    exportedAt: new Date().toISOString(),
    categories,
    originalFilesIncluded: false,
    otherOwnersContentIncluded: false,
    data,
  };
}
