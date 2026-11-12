import type { UploadedFile } from "./models.ts";
export interface Profile {
  name: string;
  email: string;
  postalCode?: string;
  phone: string;
  city: string;
  photo: string | null;
  notifications: { reminders: boolean; reservations: boolean; shares: boolean };
}
export type ProfileInput = Omit<Profile, "photo"> & {
  photo?: UploadedFile | null;
};
export interface Professional {
  id: string;
  fictional?: boolean;
  verification?: string;
  name: string;
  category: string;
  city: string;
  district: string;
  address: string;
  species: string[];
  mode: string;
  icon: string;
  intro: string;
  about: string;
  hours: string;
  services: { name: string; price: number; duration: number }[];
}
export interface Booking {
  id: string;
  professional: string;
  animal: string;
  animalName: string;
  service: number;
  date: string;
  time: string;
  price: number;
  status: "confirmed" | "cancelled";
  contactName: string;
  email: string;
  note: string;
  createdAt: string;
  cancelledAt: string | null;
}
export interface BookingInput {
  professional: string;
  animal: string;
  service: number;
  date: string;
  time: string;
  contactName: string;
  email: string;
  note: string;
}
export interface DirectoryData {
  professionals: Professional[];
  favorites: string[];
  bookings: Booking[];
  today: string;
}

export const exportCategories = [
  "profile",
  "animals",
  "documents",
  "sharing",
  "bookings",
  "social",
] as const;
export type ExportCategory = (typeof exportCategories)[number];

export interface AuthUser {
  id: string;
  adminRole?: import("./admin.ts").AdminRole;
  /** Compte de démonstration : sa suppression recrée un espace d’exemple. */
  demo: boolean;
  profile: Profile;
}

/** Règle des nouveaux mots de passe, appliquée à l’inscription et à la réinitialisation. */
export const PASSWORD_RULE =
  "Au moins 8 caractères, dont une majuscule, une minuscule et un caractère spécial.";
/** Message d’erreur si le mot de passe ne respecte pas la règle, sinon null. */
export function passwordProblem(password: string): string | null {
  if (
    password.length < 8 ||
    !/\p{Lu}/u.test(password) ||
    !/\p{Ll}/u.test(password) ||
    !/[^\p{L}\p{N}\s]/u.test(password)
  )
    return `Utilisez ${PASSWORD_RULE.charAt(0).toLowerCase()}${PASSWORD_RULE.slice(1)}`;
  return null;
}
