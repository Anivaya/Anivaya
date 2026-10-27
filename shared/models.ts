/** Contrats JSON communs à React et à l’API. Les entrées HTTP restent validées côté serveur. */
export interface Animal {
  id: string;
  name: string;
  species: string;
  description: string;
  style: string;
  photo: string | null;
  breed: string;
  sex: string;
  dob: string;
  weight: string;
  coat: string;
  identifier: string;
  neutered: string;
  food: string;
  routine: string;
  behavior: string;
  medical: string;
  contact: string;
  vet: string;
}
export interface Reminder {
  id: string;
  name: string;
  animal: string;
  date: string;
  done: boolean;
  repeat: string;
  notice: string;
  note: string;
}
export interface AnimalEvent {
  id: string;
  animal: string;
  type: string;
  date: string;
  note: string;
}
export interface Document {
  id: string;
  name: string;
  animal: string;
  type: string | null;
  example: boolean;
  category: string;
  hasFile: boolean;
  url: string | null;
}
export interface Person {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  note: string;
  animals: string[];
}
export type ShareStatus = "active" | "expired" | "revoked";
export interface Share {
  id: string;
  doc: string;
  person: string | null;
  recipient: string;
  email: string;
  until: string;
  revoked: boolean;
  status: ShareStatus;
  created_at: string;
}
export interface EmergencySettings {
  active: boolean;
  photo: boolean;
  details: boolean;
  notes: boolean;
  contact: boolean;
  vet: boolean;
}
export interface EmergencySnapshot {
  name: string;
  species?: string;
  photo?: string | null;
  style?: string | null;
  details?: string;
  notes?: string;
  contact?: string;
  vet?: string;
  payload?: string;
  qrSvg?: string;
}
export interface EmergencySheet {
  animal: string;
  settings: EmergencySettings;
  snapshot: EmergencySnapshot;
  updatedAt?: string;
}
export type NotificationCategory =
  "reminders" | "reservations" | "shares" | "documents" | "account" | "social";
export interface Notification {
  id: string;
  category: NotificationCategory;
  title: string;
  text: string;
  /** Lien interne vers la page concernée, par exemple `#rappels`. */
  href: string;
  action: string;
  date: string;
  read: boolean;
}
export type ReceivedShareState =
  "pending" | "accepted" | "expired" | "revoked" | "declined";
/** Informations confiées par un autre propriétaire, visibles une fois l’invitation acceptée. */
export interface ReceivedAnimal {
  name: string;
  species: string;
  breed: string;
  sex: string;
  identifier: string;
  instructions: string;
  contact: string;
}
export interface ReceivedDocument {
  document: string;
  description: string;
  entries: string[];
}
export interface ReceivedShare {
  id: string;
  title: string;
  kind: "animal" | "document";
  animalName: string;
  sender: string;
  email: string;
  permission: string;
  until: string;
  createdAt: string;
  respondedAt: string | null;
  state: ReceivedShareState;
  /** Présent seulement quand l’accès est actif. */
  content: ReceivedAnimal | ReceivedDocument | null;
}
export interface Household {
  firstName: string;
  lastName: string;
  label: string;
}
export interface Dashboard {
  today: string;
  household: Household;
  animals: Animal[];
  reminders: Reminder[];
  events: AnimalEvent[];
  documents: Document[];
  people: Person[];
  shares: Share[];
  emergencySheets: EmergencySheet[];
  notifications: Notification[];
  receivedShares: ReceivedShare[];
}
export interface UploadedFile {
  type: string;
  content: string;
}
export type AnimalInput = Partial<Omit<Animal, "id" | "photo">> & {
  photo?: UploadedFile;
};
export type ReminderInput = Partial<Omit<Reminder, "id">>;
export type DocumentInput = Partial<
  Pick<Document, "name" | "animal" | "category">
> & { type?: string; content?: string };
export type PersonInput = Partial<Omit<Person, "id">>;
export interface AssociationInput {
  people: string[];
  animals: string[];
  mode: string;
}
export interface ShareInput {
  documents: string[];
  people?: string[];
  recipient?: string;
  email?: string;
  until: string;
}
export interface ShareResult {
  created: number;
  skipped: number;
}
export interface FormError {
  message: string;
  field?: string;
}
export function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Une erreur inattendue est survenue.";
}
export function errorField(error: unknown): string | undefined {
  return error instanceof Error &&
    "field" in error &&
    typeof error.field === "string"
    ? error.field
    : undefined;
}
