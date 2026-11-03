import { request } from "./api.ts";
import type {
  AdminList,
  AdminOverview,
  AdminRecord,
  AdminResource,
} from "../../../../shared/admin.ts";
const post = (body: unknown) => ({
  method: "POST",
  body: JSON.stringify(body),
});
export interface PublicResources {
  guides: {
    id: string;
    title: string;
    summary: string;
    body: string;
    version: number;
    publishedAt?: string;
  }[];
  announcements: {
    id: string;
    name: string;
    message: string;
    audience: string;
    updatedAt: string;
  }[];
}
export const adminApi = {
  overview: (signal?: AbortSignal) =>
    request<AdminOverview>("/admin/overview", { signal }),
  detail: (resource: AdminResource, id: string, signal?: AbortSignal) =>
    request<AdminRecord>(`/admin/${resource}/${encodeURIComponent(id)}`, {
      signal,
    }),
  list: (
    resource: AdminResource,
    query: URLSearchParams,
    signal?: AbortSignal,
  ) => request<AdminList>(`/admin/${resource}?${query}`, { signal }),
  create: (resource: AdminResource, data: unknown) =>
    request<AdminRecord>(`/admin/${resource}`, post(data)),
  act: (resource: AdminResource, id: string, data: unknown) =>
    request<AdminRecord | undefined>(
      `/admin/${resource}/${encodeURIComponent(id)}/actions`,
      post(data),
    ),
  resources: (signal?: AbortSignal) =>
    request<PublicResources>("/public/resources", { signal }),
  contact: (data: unknown) =>
    request<{ reference: string; status: string }>(
      "/public/contact",
      post(data),
    ),
  report: (data: unknown) =>
    request<{ reference: string }>("/reports", post(data)),
  appeal: (data: unknown) => request<AdminRecord>("/appeals", post(data)),
  support: (signal?: AbortSignal) =>
    request<AdminRecord[]>("/support", { signal }),
  feedback: (data: unknown) => request<AdminRecord>("/feedback", post(data)),
  /** Signalement d’une fiche d’urgence publique depuis son lien. */
  reportPublic: (token: string, data: unknown) =>
    request<{ reference: string }>(
      `/public/emergency/${encodeURIComponent(token)}/report`,
      post(data),
    ),
  requestDeletion: (message: string) =>
    request<{ id: string; status: string }>(
      "/account/deletion-request",
      post({ message }),
    ),
  registerImport: (data: {
    name: string;
    kind: string;
    status?: "Terminé" | "Échoué";
    issue?: string;
  }) => request<{ id: string; status: string }>("/imports", post(data)),
  proofFileUrl: (id: string, document: string) =>
    `/api/admin/pros/${encodeURIComponent(id)}/documents/${encodeURIComponent(document)}/file`,
};
