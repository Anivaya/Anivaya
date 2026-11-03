import { useEffect, useRef, useState } from "react";
import type {
  AdminList,
  AdminRecord,
  AdminResource,
  AdminRole,
} from "../../../../shared/admin.ts";
import { adminApi } from "../../shared/services/admin.ts";
import { errorMessage } from "../../shared/types.ts";
import AdminDialog from "./AdminDialog.tsx";
import AdminIconButton from "./AdminIconButton.tsx";
import {
  actionIcon,
  actionsFor,
  isDangerAction,
  statusTone,
} from "./config.ts";

/** Titre de la deuxième colonne (et de sa ligne dans les cartes mobiles). */
const detailLabels: Partial<Record<AdminResource, string>> = {
  users: "Type de compte",
  team: "Rôle",
  pros: "Spécialité / ville",
  tickets: "Attribution",
  reports: "Type",
  history: "Auteur",
  feedback: "Utilisateur",
  announcements: "Audience",
  library: "Version / relecture",
  deletions: "Adresse e-mail",
  imports: "Compte / source",
  security: "Nature",
  appeals: "Référence",
};

export default function AdminCollection({
  resource,
  role,
  query,
  onQuery,
  onChanged,
}: {
  resource: AdminResource;
  role: AdminRole;
  query: string;
  onQuery: (q: string) => void;
  onChanged: () => void;
}) {
  const params = new URLSearchParams(query),
    committed = params.get("q") || "";
  const [draft, setDraft] = useState({ query, value: committed }),
    [result, setResult] = useState<{
      key: string;
      data: AdminList | null;
      error: string;
    } | null>(null),
    [exportError, setExportError] = useState(""),
    [retry, setRetry] = useState(0),
    [notice, setNotice] = useState(""),
    [dialog, setDialog] = useState<{
      row: AdminRecord | null;
      action?: string;
    } | null>(null),
    [exporting, setExporting] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const resultNotice = useRef<HTMLDivElement>(null);
  const requestedRecord = params.get("record") || "";
  useEffect(() => {
    if (!requestedRecord) return;
    const controller = new AbortController();
    adminApi
      .detail(resource, requestedRecord, controller.signal)
      .then((row) => {
        if (!controller.signal.aborted) setDialog({ row });
      })
      .catch((e) => {
        if (!controller.signal.aborted) setExportError(errorMessage(e));
      });
    return () => controller.abort();
  }, [requestedRecord, resource]);
  async function openRecord(row: AdminRecord, action = "view") {
    try {
      const full = await adminApi.detail(resource, row.id);
      setDialog({ row: full, action });
    } catch (e) {
      setExportError(errorMessage(e));
    }
  }
  function closeDialog() {
    setDialog(null);
    if (requestedRecord) {
      const next = new URLSearchParams(query);
      next.delete("record");
      onQuery(next.toString());
    }
  }
  const [composing, setComposing] = useState(false);
  const search = draft.query === query ? draft.value : committed;
  const setSearch = (value: string) => setDraft({ query, value });
  const requestKey = `${resource}|${query}|${retry}`;
  const loading = result?.key !== requestKey;
  const data = result?.data;
  const detailLabel = detailLabels[resource] || "Informations";
  const error = exportError || (!loading ? result?.error : "");
  useEffect(() => {
    if (search === committed || composing) return;
    const timer = setTimeout(() => {
      const next = new URLSearchParams(query);
      next.set("q", search);
      next.delete("page");
      onQuery(next.toString());
    }, 300);
    return () => clearTimeout(timer);
  }, [search, committed, onQuery, query, composing]);
  useEffect(() => {
    const controller = new AbortController();
    adminApi
      .list(resource, new URLSearchParams(query), controller.signal)
      .then((next) => {
        if (!controller.signal.aborted)
          setResult({ key: requestKey, data: next, error: "" });
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setResult({ key: requestKey, data: null, error: errorMessage(e) });
      });
    return () => controller.abort();
  }, [resource, query, requestKey]);
  function change(name: string, value: string) {
    const next = new URLSearchParams(query);
    if (value) next.set(name, value);
    else next.delete(name);
    if (name !== "page") next.delete("page");
    onQuery(next.toString());
  }
  async function download() {
    setExporting(true);
    setExportError("");
    try {
      const items: AdminRecord[] = [];
      let page = 1,
        total = 0;
      do {
        const part = await adminApi.list(
          "history",
          new URLSearchParams({
            q: committed,
            page: String(page),
            pageSize: "50",
          }),
        );
        items.push(...part.items);
        total = part.total;
        page++;
      } while (items.length < total);
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(items, null, 2)], {
          type: "application/json",
        }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "anivaya-historique.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice("Historique exporté.");
    } catch (e) {
      setExportError(errorMessage(e));
    } finally {
      setExporting(false);
    }
  }
  const canCreate =
    (role === "Administrateur" &&
      ["team", "library", "announcements", "tickets"].includes(resource)) ||
    (role === "Support" && resource === "tickets");
  const hasFilters = Boolean(
    committed ||
    params.get("status") ||
    params.get("category") ||
    params.get("scope"),
  );
  const titleColumn =
    (
      {
        users: "Compte",
        deletions: "Compte",
        reports: "Signalement",
        history: "Historique",
        team: "Identité",
        tickets: "Demande",
        imports: "Importation",
        feedback: "Retour",
        appeals: "Recours",
        pros: "Établissement",
        announcements: "Annonce",
        library: "Contenu",
        alerts: "Notification",
      } as Partial<Record<AdminResource, string>>
    )[resource] || "Élément";
  function sortHeading(label: string, key: string) {
    const state =
      params.get("sort") === key
        ? params.get("direction") === "asc"
          ? "asc"
          : "desc"
        : "none";
    return (
      <th
        scope="col"
        aria-sort={
          state === "asc"
            ? "ascending"
            : state === "desc"
              ? "descending"
              : "none"
        }
      >
        <span className="admin-sort-heading">
          {label}
          <AdminIconButton
            icon={state === "asc" ? "up" : state === "desc" ? "down" : "sort"}
            label={`${label} : ${state === "none" ? "trier par ordre croissant" : state === "asc" ? "trier par ordre décroissant" : "rétablir l’ordre normal"}`}
            onClick={() => {
              const next = new URLSearchParams(query);
              next.delete("page");
              if (state === "desc") {
                next.delete("sort");
                next.delete("direction");
              } else {
                next.set("sort", key);
                next.set("direction", state === "none" ? "asc" : "desc");
              }
              onQuery(next.toString());
            }}
          />
        </span>
      </th>
    );
  }
  return (
    <>
      {resource === "library" && (
        <section className="admin-panel">
          <div className="admin-section-title">
            <h2>Bibliothèque éditoriale</h2>
            <a className="admin-text-button" href="#informations/ressources">
              Voir la bibliothèque publique →
            </a>
          </div>
          <p>
            Rédaction → relecture vétérinaire → validation → publication. Une
            nouvelle version conserve la dernière version publiée jusqu’à sa
            validation.
          </p>
        </section>
      )}
      <section className="admin-panel admin-list-panel" aria-busy={loading}>
        <div className="admin-toolbar">
          <div className="admin-search">
            <label className="sr-only" htmlFor="admin-search">
              Rechercher
            </label>
            <div>
              <input
                ref={input}
                id="admin-search"
                type="search"
                placeholder="Rechercher…"
                value={search}
                onCompositionStart={() => {
                  setComposing(true);
                }}
                onCompositionEnd={(e) => {
                  setComposing(false);
                  setSearch(e.currentTarget.value);
                }}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing)
                    change("q", search);
                }}
              />
              {search && (
                <button
                  type="button"
                  aria-label="Effacer la recherche"
                  onClick={() => {
                    setSearch("");
                    change("q", "");
                    input.current?.focus();
                  }}
                >
                  ×
                </button>
              )}
            </div>
          </div>
          <div className="field">
            <label className="sr-only" htmlFor="admin-status">
              État
            </label>
            <select
              id="admin-status"
              value={params.get("status") || ""}
              onChange={(e) => change("status", e.target.value)}
            >
              <option value="">Tous les statuts</option>
              {[
                ...new Set([
                  ...(data?.statuses || []),
                  params.get("status") || "",
                ]),
              ]
                .filter(Boolean)
                .map((s) => (
                  <option key={s}>{s}</option>
                ))}
            </select>
          </div>
          {resource === "alerts" && (
            <div className="field">
              <label className="sr-only" htmlFor="admin-category">
                Catégorie
              </label>
              <select
                id="admin-category"
                value={params.get("category") || ""}
                onChange={(e) => change("category", e.target.value)}
              >
                <option value="">Toutes les catégories</option>
                {[
                  ["pros", "Professionnels"],
                  ["reports", "Signalements"],
                  ["appeals", "Recours"],
                  ["tickets", "Assistance"],
                  ["feedback", "Retours"],
                  ["imports", "Imports"],
                  ["library", "Guides"],
                  ["deletions", "Suppressions"],
                ].map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="admin-toolbar-actions">
            {canCreate && (
              <AdminIconButton
                icon="plus"
                label={
                  resource === "team"
                    ? "Inviter un membre"
                    : resource === "library"
                      ? "Créer un guide"
                      : resource === "tickets"
                        ? "Créer une demande"
                        : "Créer une annonce"
                }
                onClick={() => setDialog({ row: null })}
              />
            )}
            {resource === "history" && (
              <AdminIconButton
                icon="download"
                label={exporting ? "Export en cours…" : "Exporter le journal"}
                disabled={exporting}
                onClick={() => void download()}
              />
            )}
            {resource === "alerts" && (
              <AdminIconButton
                icon="check"
                label="Tout marquer comme lu"
                onClick={async () => {
                  try {
                    await adminApi.act("alerts", "all", { action: "read-all" });
                    setNotice(
                      "Toutes les notifications sont marquées comme lues.",
                    );
                    setRetry((n) => n + 1);
                    onChanged();
                  } catch (e) {
                    setExportError(errorMessage(e));
                  }
                }}
              />
            )}
            <AdminIconButton
              icon="refresh"
              label="Actualiser"
              disabled={loading}
              onClick={() => setRetry((n) => n + 1)}
            />
          </div>
        </div>
        <div
          role="status"
          className="admin-feedback"
          ref={resultNotice}
          tabIndex={-1}
        >
          {notice}
        </div>
        {error && (
          <div className="admin-error" role="alert">
            <p>{error}</p>
            <button
              className="button outline"
              onClick={() => {
                setExportError("");
                setRetry((n) => n + 1);
              }}
            >
              Réessayer
            </button>
          </div>
        )}
        <div className="admin-table-panel">
          <header className="admin-table-heading">
            <strong>
              {loading
                ? "Chargement…"
                : `${data?.total ?? 0} résultat${data?.total === 1 ? "" : "s"}`}
            </strong>
          </header>
          <div
            className="admin-table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Liste des dossiers"
          >
            <table className={`admin-table-${resource}`}>
              <thead>
                <tr>
                  {sortHeading(titleColumn, "name")}
                  <th scope="col">{detailLabel}</th>
                  {resource === "reports" && (
                    <>
                      <th scope="col">Auteur</th>
                      <th scope="col">Délai</th>
                    </>
                  )}
                  <th scope="col">État</th>
                  {resource === "library" ? (
                    <th scope="col">Publication</th>
                  ) : (
                    sortHeading("Dernière activité", "date")
                  )}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {!loading &&
                  data?.items.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <button
                          className="admin-record-link"
                          title={row.name}
                          onClick={() => void openRecord(row)}
                        >
                          {row.name}
                        </button>
                        {row.email &&
                          resource !== "reports" &&
                          resource !== "history" &&
                          resource !== "deletions" && (
                            <small title={row.email}>{row.email}</small>
                          )}
                        {resource === "library" && (
                          <small>{row.versions?.at(-1)?.summary}</small>
                        )}
                      </td>
                      <td data-label={detailLabel}>
                        <span className="admin-cell-text">
                          {resource === "history"
                            ? row.email
                            : resource === "tickets"
                              ? row.assignee
                              : resource === "reports"
                                ? row.targetType === "pros"
                                  ? "Fiche professionnelle"
                                  : "Profil public"
                                : resource === "library"
                                  ? `Version ${row.versions?.at(-1)?.number || 1}`
                                  : resource === "deletions" ||
                                      resource === "imports"
                                    ? row.email || "Compte supprimé"
                                    : resource === "security"
                                      ? row.kind
                                      : resource === "users"
                                        ? row.accountType
                                        : row.role ||
                                          row.category ||
                                          row.audience ||
                                          row.reference ||
                                          row.priority ||
                                          "—"}
                        </span>
                        {row.city && <small>{row.city}</small>}
                        {resource === "tickets" && (
                          <small>{row.category}</small>
                        )}
                        {resource === "imports" && <small>{row.kind}</small>}
                        {resource === "users" &&
                          row.role &&
                          row.role !== "Particulier" && (
                            <small>Équipe : {row.role}</small>
                          )}
                        {resource === "alerts" && row.issue && (
                          <small>État du dossier : {row.issue}</small>
                        )}
                        {resource === "pros" && row.level && (
                          <small>{row.level}</small>
                        )}
                        {resource === "team" && row.invitation && (
                          <small>
                            Jusqu’au{" "}
                            {new Date(row.expiresAt!).toLocaleDateString(
                              "fr-FR",
                            )}
                          </small>
                        )}
                      </td>
                      {resource === "reports" && (
                        <>
                          <td data-label="Auteur">{row.email || "—"}</td>
                          <td data-label="Délai">
                            <span
                              className={`admin-badge ${row.priority === "Risque grave" ? "danger" : ""}`}
                            >
                              {row.priority}
                            </span>
                            <small>
                              {row.firstResponseAt
                                ? "Première réponse enregistrée"
                                : row.responseLate
                                  ? "Délai de 24 h dépassé"
                                  : "Réponse attendue sous 24 h"}
                            </small>
                          </td>
                        </>
                      )}
                      <td data-label="État">
                        <span
                          className={`admin-badge ${statusTone(row.status)}`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td
                        data-label={
                          resource === "library"
                            ? "Publication"
                            : "Dernière activité"
                        }
                      >
                        {resource === "library"
                          ? row.versions?.some((v) => v.status === "Publié")
                            ? `v${row.versions.find((v) => v.status === "Publié")!.number} en ligne`
                            : "Non publié"
                          : row.updatedAt
                            ? new Date(row.updatedAt).toLocaleDateString(
                                "fr-FR",
                              )
                            : "—"}
                      </td>
                      <td>
                        <div className="admin-row-actions">
                          <AdminIconButton
                            icon="eye"
                            label={`Consulter ${row.name}`}
                            onClick={() => void openRecord(row)}
                          />
                          {actionsFor(resource, row, role)
                            .filter((a) => !a.id.startsWith("proof:"))
                            .map((action) => (
                              <AdminIconButton
                                key={action.id}
                                icon={actionIcon(action.id, resource)}
                                label={`${action.label} — ${row.name}`}
                                danger={isDangerAction(action.id)}
                                onClick={() => void openRecord(row, action.id)}
                              />
                            ))}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {loading ? (
              <div className="admin-empty" role="status">
                Chargement des dossiers…
              </div>
            ) : !error && !data?.items.length ? (
              <div className="admin-empty">
                <h3>
                  {hasFilters
                    ? "Aucun résultat"
                    : "Aucun dossier pour le moment"}
                </h3>
                <p>
                  {hasFilters
                    ? "Essayez un autre terme ou retirez les filtres."
                    : resource === "imports"
                      ? "Les imports assistés par IA apparaîtront ici."
                      : "Les nouvelles demandes apparaîtront ici."}
                </p>
                {hasFilters && (
                  <button
                    className="button outline"
                    onClick={() => {
                      const next = new URLSearchParams(query);
                      ["q", "status", "category", "scope", "page"].forEach(
                        (k) => next.delete(k),
                      );
                      onQuery(next.toString());
                    }}
                  >
                    Effacer les filtres
                  </button>
                )}
              </div>
            ) : null}
          </div>
          <footer className="admin-pagination">
            <label>
              Par page{" "}
              <select
                value={params.get("pageSize") || "10"}
                onChange={(e) => change("pageSize", e.target.value)}
              >
                {[10, 20, 50].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <span>
              Page {data?.page || 1} sur{" "}
              {Math.max(
                1,
                Math.ceil((data?.total || 0) / (data?.pageSize || 10)),
              )}
            </span>
            <AdminIconButton
              icon="back"
              label="Page précédente"
              disabled={loading || !data || data.page <= 1}
              onClick={() => change("page", String(data!.page - 1))}
            />
            <AdminIconButton
              icon="arrow"
              label="Page suivante"
              disabled={
                loading || !data || data.page * data.pageSize >= data.total
              }
              onClick={() => change("page", String(data!.page + 1))}
            />
          </footer>
        </div>
      </section>
      {dialog && (
        <AdminDialog
          key={dialog.row?.id || "new"}
          role={role}
          resource={resource}
          row={dialog.row}
          initialAction={dialog.action}
          onClose={closeDialog}
          onSaved={async (message) => {
            closeDialog();
            setNotice(message);
            setRetry((n) => n + 1);
            onChanged();
            requestAnimationFrame(() => resultNotice.current?.focus());
          }}
        />
      )}
    </>
  );
}
