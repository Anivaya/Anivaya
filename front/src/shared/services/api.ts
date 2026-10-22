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
} from "../../../../shared/models.ts";
class RequestError extends Error {
  field?: string;
}
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
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
    const body = data as { error?: string; field?: string };
    const error = new RequestError(
      body?.error || "La demande a échoué. Réessayez.",
    );
    error.field = body?.field;
    throw error;
  }
  // L’API valide les données entrantes ; T décrit le contrat JSON de chaque route.
  return data as T;
}
const send = <T>(path: string, method: string, body: unknown) =>
  request<T>(path, { method, body: JSON.stringify(body) });
export const api = {
  dashboard: (signal?: AbortSignal) =>
    request<Dashboard>("/dashboard", { signal }),
  savePerson: (id: string | undefined, body: PersonInput) =>
    send<Person>(id ? `/people/${id}` : "/people", id ? "PATCH" : "POST", body),
  deletePerson: (id: string) =>
    request<void>(`/people/${id}`, { method: "DELETE" }),
  associate: (body: AssociationInput) =>
    send<Person[]>("/associations", "POST", body),
  share: (body: ShareInput) => send<ShareResult>("/shares", "POST", body),
  revoke: (id: string) => request<void>(`/shares/${id}`, { method: "DELETE" }),
  addAnimal: (body: AnimalInput) => send<Animal>("/animals", "POST", body),
  editAnimal: (id: string, body: AnimalInput) =>
    send<Animal>(`/animals/${id}`, "PATCH", body),
  deleteAnimal: (id: string) =>
    request<void>(`/animals/${id}`, { method: "DELETE" }),
  saveEvent: (id: string | undefined, body: Partial<AnimalEvent>) =>
    send<AnimalEvent>(
      id ? `/events/${id}` : "/events",
      id ? "PATCH" : "POST",
      body,
    ),
  deleteEvent: (id: string) =>
    request<void>(`/events/${id}`, { method: "DELETE" }),
  addReminder: (body: ReminderInput) =>
    send<Reminder>("/reminders", "POST", body),
  editReminder: (id: string, body: ReminderInput) =>
    send<Reminder>(`/reminders/${id}`, "PATCH", body),
  setReminder: (id: string, done: boolean) =>
    send<Reminder>(`/reminders/${id}`, "PATCH", { done }),
  deleteReminder: (id: string) =>
    request<void>(`/reminders/${id}`, { method: "DELETE" }),
  addDocument: (body: DocumentInput) =>
    send<Document>("/documents", "POST", body),
  editDocument: (id: string, body: DocumentInput) =>
    send<Document>(`/documents/${id}`, "PATCH", body),
  deleteDocument: (id: string) =>
    request<void>(`/documents/${id}`, { method: "DELETE" }),
  saveEmergency: (id: string, body: EmergencySettings) =>
    send<EmergencySheet>(`/animals/${id}/emergency`, "PUT", body),
  previewEmergency: (
    id: string,
    body: EmergencySettings,
    signal: AbortSignal,
  ) =>
    request<EmergencySheet>(`/animals/${id}/emergency/preview`, {
      method: "POST",
      body: JSON.stringify(body),
      signal,
    }),
  deleteEmergency: (id: string) =>
    request<void>(`/animals/${id}/emergency`, { method: "DELETE" }),
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
