import EmptyState from "../../shared/ui/EmptyState.tsx";
import { useEffect, useState } from "react";
import { adminApi } from "../../shared/services/admin.ts";
import type { PublicResources } from "../../shared/services/admin.ts";
import { errorMessage } from "../../shared/types.ts";
export default function ResourcesPanel() {
  const [data, setData] = useState<PublicResources | null>(null),
    [query, setQuery] = useState(""),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    adminApi
      .resources(c.signal)
      .then((d) => {
        if (!c.signal.aborted) {
          setData(d);
          setError("");
        }
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(errorMessage(e));
      });
    return () => c.abort();
  }, [retry]);
  const guides =
    data?.guides.filter((g) =>
      (g.title + " " + g.summary)
        .toLocaleLowerCase("fr")
        .includes(query.toLocaleLowerCase("fr")),
    ) || [];
  return (
    <div className="profile-panel">
      <h2>Des repères pour le quotidien</h2>
      <p>
        Les guides publiés après relecture vétérinaire par l’équipe Anivaya.
      </p>
      {!!data?.guides.length && (
        <div className="admin-search">
          <label htmlFor="resource-search">Rechercher un guide</label>
          <div>
            <input
              id="resource-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Un rendez-vous, un relais…"
            />
            {query && (
              <button
                aria-label="Effacer la recherche de guides"
                onClick={() => {
                  setQuery("");
                  document.getElementById("resource-search")?.focus();
                }}
              >
                ×
              </button>
            )}
          </div>
        </div>
      )}
      {error ? (
        <div role="alert">
          <p>{error}</p>
          <button
            className="button outline"
            onClick={() => setRetry((n) => n + 1)}
          >
            Réessayer
          </button>
        </div>
      ) : !data ? (
        <p role="status">Chargement des guides…</p>
      ) : (
        <div className="resource-cards">
          {guides.map((g) => (
            <article key={g.id}>
              <h3>{g.title}</h3>
              <p>{g.summary}</p>
              <details>
                <summary className="toggle-summary">Lire le guide</summary>
                <p className="admin-preserve">{g.body}</p>
                <small>
                  Version {g.version} · Publié le{" "}
                  {new Date(g.publishedAt!).toLocaleDateString("fr-FR")}
                </small>
              </details>
            </article>
          ))}
          {!guides.length && (
            <EmptyState
              kind="documents"
              title="Aucun guide pour le moment"
              description="Les conseils validés pour vos compagnons apparaîtront ici."
              filtered={!!query}
            />
          )}
        </div>
      )}
      {!!data?.announcements.length && (
        <section className="resource-cards">
          <h2>Les nouvelles d’Anivaya</h2>
          {data.announcements.map((a) => (
            <article key={a.id}>
              <small>{a.audience}</small>
              <h3>{a.name}</h3>
              <p className="admin-preserve">{a.message}</p>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
