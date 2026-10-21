async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error(
      "Le serveur est inaccessible. Vérifiez que l’API est démarrée, puis réessayez.",
    );
  }
  if (response.status === 204) return null;
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("Le serveur ne répond pas correctement. Réessayez.");
  }
  if (!response.ok) {
    const error = new Error(data.error || "La demande a échoué. Réessayez.");
    error.field = data.field;
    throw error;
  }
  return data;
}
const send = (path, method, body) =>
  request(path, { method, body: JSON.stringify(body) });
export const api = {
  dashboard: (signal) => request("/dashboard", { signal }),
  addAnimal: (body) => send("/animals", "POST", body),
  editAnimal: (id, body) => send(`/animals/${id}`, "PATCH", body),
  deleteAnimal: (id) => request(`/animals/${id}`, { method: "DELETE" }),
  saveEvent: (id, body) =>
    send(id ? `/events/${id}` : "/events", id ? "PATCH" : "POST", body),
  deleteEvent: (id) => request(`/events/${id}`, { method: "DELETE" }),
  editReminder: (id, body) => send(`/reminders/${id}`, "PATCH", body),
  deleteReminder: (id) => request(`/reminders/${id}`, { method: "DELETE" }),
  saveEmergency: (id, body) => send(`/animals/${id}/emergency`, "PUT", body),
  previewEmergency: (id, body, signal) =>
    request(`/animals/${id}/emergency/preview`, {
      method: "POST",
      body: JSON.stringify(body),
      signal,
    }),
  deleteEmergency: (id) =>
    request(`/animals/${id}/emergency`, { method: "DELETE" }),
  addReminder: (body) => send("/reminders", "POST", body),
  setReminder: (id, done) => send(`/reminders/${id}`, "PATCH", { done }),
  addDocument: (body) => send("/documents", "POST", body),
  editDocument: (id, body) => send(`/documents/${id}`, "PATCH", body),
  deleteDocument: (id) => request(`/documents/${id}`, { method: "DELETE" }),
};
export function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = () =>
      reject(
        new Error(
          "Ce fichier ne peut pas être lu. Choisissez un autre fichier.",
        ),
      );
    reader.readAsDataURL(file);
  });
}
