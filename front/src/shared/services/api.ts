import type {
  Animal,
  AnimalInput,
  AnimalEvent,
  Reminder,
  ReminderInput,
  Document,
  DocumentInput,
  Person,
  PersonInput,
  AssociationInput,
  ShareInput,
  ShareResult,
  Dashboard,
  EmergencySettings,
  EmergencySheet,
  Notification,
  ReceivedShare,
  ExtractedValues,
} from "../../../../shared/models.ts";
import type {
  AuthUser,
  Profile,
  ProfileInput,
  DirectoryData,
  Booking,
  BookingInput,
  ExportCategory,
} from "../../../../shared/account.ts";
import type {
  SocialData,
  CommunityInput,
  EventInput,
  ThreadInput,
  MessageInput,
  FriendAction,
  ReportInput,
  ThreadUpdate,
} from "../../../../shared/social.ts";
import type { LeadInput, LeadReceipt } from "../../../../shared/public.ts";
class RequestError extends Error {
  field?: string;
  fields?: Record<string, string>;
}
/** Erreur rattachée à un champ, comme celles renvoyées par l’API : le formulaire y place le focus. */
export function fieldError(field: string, message: string) {
  const error = new RequestError(message);
  error.field = field;
  return error;
}
export async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new Error(
      "Le serveur est inaccessible. Vérifiez que l’API est démarrée, puis réessayez.",
    );
  }
  if (response.status === 204) return undefined as T;
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error("Le serveur ne répond pas correctement. Réessayez.");
  }
  if (!response.ok) {
    if (
      response.status === 401 &&
      !path.startsWith("/auth/") &&
      !path.startsWith("/public/")
    )
      window.dispatchEvent(new Event("anivaya-session-expired"));
    const body = data as {
      error?: string;
      field?: string;
      fields?: Record<string, string>;
    };
    const error = new RequestError(
      body?.error || "La demande a échoué. Réessayez.",
    );
    error.field = body?.field;
    error.fields = body?.fields;
    throw error;
  }
  // L’API valide les données entrantes ; T décrit le contrat JSON de chaque route.
  return data as T;
}
const send = <T>(
  path: string,
  method: string,
  body: unknown,
  signal?: AbortSignal,
) => request<T>(path, { method, body: JSON.stringify(body), signal });
const remove = (path: string) => request<void>(path, { method: "DELETE" });
/** Crée la ressource sans identifiant, sinon la modifie. */
const save = <T>(path: string, id: string | undefined, body: unknown) =>
  send<T>(id ? `${path}/${id}` : path, id ? "PATCH" : "POST", body);

export const api = {
  submitLead: (body: LeadInput, signal?: AbortSignal) =>
    send<LeadReceipt>("/public/leads", "POST", body, signal),
  unsubscribe: (token: string) =>
    send<LeadReceipt>("/public/unsubscribe", "POST", { token }),
  requestUnsubscribe: (email: string) =>
    send<LeadReceipt>("/public/unsubscribe-link", "POST", { email }),
  // Compte et session
  session: (signal?: AbortSignal) =>
    request<AuthUser | null>("/auth/session", { signal }),
  login: (body: {
    email: string;
    password: string;
    remember: boolean;
    mfaCode?: string;
  }) => send<AuthUser>("/auth/login", "POST", body),
  /** Mot de passe oublié : la réponse est la même que l’adresse existe ou non. */
  requestPasswordReset: (email: string) =>
    send<void>("/auth/password-reset", "POST", { email }),
  passwordResetStatus: (token: string) =>
    request<{ valid: boolean }>(
      `/auth/password-reset/${encodeURIComponent(token)}`,
    ),
  resetPassword: (body: {
    token: string;
    password: string;
    confirmPassword: string;
  }) => send<void>("/auth/password-reset/confirm", "POST", body),
  /** Depuis la gestion de profil : lien envoyé à l’adresse du compte connecté. */
  requestOwnPasswordReset: () =>
    send<void>("/account/password-reset", "POST", {}),
  register: (body: {
    name: string;
    postalCode?: string;
    email: string;
    password: string;
    confirmPassword: string;
  }) => send<AuthUser>("/auth/register", "POST", body),
  logout: () => send<void>("/auth/logout", "POST", {}),
  acceptInvitation: (token: string) => send<AuthUser>("/account/invitation", "POST", { token }),
  legal: (signal?: AbortSignal) => request<import("../../../../shared/legal.ts").LegalContent | null>("/public/legal", { signal }),
  saveProfile: (body: ProfileInput) => send<Profile>("/profile", "PATCH", body),
  exportData: (categories: ExportCategory[]) =>
    request<unknown>(`/export?categories=${categories.join(",")}`),
  deleteAccount: (confirmation: string) =>
    request<void>("/account", {
      method: "DELETE",
      body: JSON.stringify({ confirmation }),
    }),

  // Annuaire et réservations
  directory: (signal?: AbortSignal) =>
    request<DirectoryData>("/directory", { signal }),
  favorite: (id: string, favorite: boolean) =>
    send<void>(`/professionals/${id}/favorite`, "PUT", { favorite }),
  slots: (
    id: string,
    date: string,
    ignore: string | undefined,
    signal: AbortSignal,
  ) =>
    request<{ time: string; available: boolean }[]>(
      `/professionals/${id}/slots?${new URLSearchParams(ignore ? { date, ignore } : { date })}`,
      { signal },
    ),
  book: (body: BookingInput) => send<Booking>("/bookings", "POST", body),
  changeBooking: (
    id: string,
    body: { date?: string; time?: string; status?: "cancelled" },
  ) => send<Booking>(`/bookings/${id}`, "PATCH", body),

  // Espace : animaux, carnets, documents et partages
  dashboard: (signal?: AbortSignal) =>
    request<Dashboard>("/dashboard", { signal }),
  addAnimal: (body: AnimalInput) => send<Animal>("/animals", "POST", body),
  editAnimal: (id: string, body: AnimalInput) =>
    send<Animal>(`/animals/${id}`, "PATCH", body),
  deleteAnimal: (id: string) => remove(`/animals/${id}`),
  saveEvent: (id: string | undefined, body: Partial<AnimalEvent>) =>
    save<AnimalEvent>("/events", id, body),
  deleteEvent: (id: string) => remove(`/events/${id}`),
  addReminder: (body: ReminderInput) =>
    send<Reminder>("/reminders", "POST", body),
  editReminder: (id: string, body: ReminderInput) =>
    send<Reminder>(`/reminders/${id}`, "PATCH", body),
  setReminder: (id: string, done: boolean) =>
    send<Reminder>(`/reminders/${id}`, "PATCH", { done }),
  deleteReminder: (id: string) => remove(`/reminders/${id}`),
  /** Lecture d’un document par l’IA ; rien n’est enregistré avant validation. */
  extractDocument: (body: { type: string; content: string }) =>
    send<ExtractedValues>("/imports/extract", "POST", body),
  addDocument: (body: DocumentInput) =>
    send<Document>("/documents", "POST", body),
  editDocument: (id: string, body: DocumentInput) =>
    send<Document>(`/documents/${id}`, "PATCH", body),
  deleteDocument: (id: string) => remove(`/documents/${id}`),
  saveEmergency: (id: string, body: EmergencySettings) =>
    send<EmergencySheet>(`/animals/${id}/emergency`, "PUT", body),
  previewEmergency: (
    id: string,
    body: EmergencySettings,
    signal: AbortSignal,
  ) =>
    send<EmergencySheet>(
      `/animals/${id}/emergency/preview`,
      "POST",
      body,
      signal,
    ),
  deleteEmergency: (id: string) => remove(`/animals/${id}/emergency`),
  savePerson: (id: string | undefined, body: PersonInput) =>
    save<Person>("/people", id, body),
  deletePerson: (id: string) => remove(`/people/${id}`),
  associate: (body: AssociationInput) =>
    send<Person[]>("/associations", "POST", body),
  share: (body: ShareInput) => send<ShareResult>("/shares", "POST", body),
  revoke: (id: string) => remove(`/shares/${id}`),
  // Communautés, événements et messagerie (données partagées entre comptes)
  social: (signal?: AbortSignal) => request<SocialData>("/social", { signal }),
  saveCommunity: (id: string | undefined, body: CommunityInput) =>
    save<{ id: string }>("/social/communities", id, body),
  deleteCommunity: (id: string) => remove(`/social/communities/${id}`),
  joinCommunity: (id: string, join: boolean) =>
    send<void>(
      `/social/communities/${id}/${join ? "join" : "leave"}`,
      "POST",
      {},
    ),
  saveSocialEvent: (id: string | undefined, body: EventInput) =>
    save<{ id: string }>("/social/events", id, body),
  cancelSocialEvent: (id: string) =>
    send<void>(`/social/events/${id}/cancel`, "POST", {}),
  attendSocialEvent: (id: string, join: boolean) =>
    send<void>(`/social/events/${id}/participation`, "POST", { join }),
  createThread: (body: ThreadInput) =>
    send<{ id: string }>("/social/threads", "POST", body),
  inviteToThread: (id: string, people: string[]) =>
    send<void>(`/social/threads/${id}/members`, "POST", { people }),
  updateThread: (id: string, body: ThreadUpdate) =>
    send<void>(`/social/threads/${id}`, "PATCH", body),
  leaveThread: (id: string) =>
    send<void>(`/social/threads/${id}/leave`, "POST", {}),
  sendMessage: (id: string, body: MessageInput) =>
    send<void>(`/social/threads/${id}/messages`, "POST", body),
  deleteMessage: (thread: string, message: string) =>
    remove(`/social/threads/${thread}/messages/${message}`),
  markThreadRead: (id: string) =>
    send<void>(`/social/threads/${id}/read`, "POST", {}),
  friend: (person: string, action: FriendAction) =>
    send<void>(`/social/friends/${encodeURIComponent(person)}`, "PUT", {
      action,
    }),
  block: (person: string, blocked: boolean) =>
    send<void>(`/social/blocks/${encodeURIComponent(person)}`, "PUT", {
      blocked,
    }),
  report: (body: ReportInput) => send<void>("/social/reports", "POST", body),
  respondReceived: (id: string, status: "accepted" | "declined") =>
    send<ReceivedShare>(`/received-shares/${id}`, "PATCH", { status }),
  setNotification: (id: string, read: boolean) =>
    send<Notification>(`/notifications/${id}`, "PATCH", { read }),
  readAllNotifications: () =>
    send<Notification[]>("/notifications/read-all", "POST", {}),
};
export function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string")
        resolve(reader.result.split(",")[1]);
      else reject(new Error("Fichier illisible."));
    };
    reader.onerror = () =>
      reject(
        new Error(
          "Ce fichier ne peut pas être lu. Choisissez un autre fichier.",
        ),
      );
    reader.readAsDataURL(file);
  });
}
