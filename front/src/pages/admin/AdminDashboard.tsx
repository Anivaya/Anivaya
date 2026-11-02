import { useState } from "react";
import type {
  AdminIndicator,
  AdminOverview,
  AdminResource,
} from "../../../../shared/admin.ts";
import Icon from "../../shared/ui/Icon.tsx";
import AdminPreview from "./AdminPreview.tsx";
import { adminLink, indicatorColumns, statusTone } from "./config.ts";

export default function AdminDashboard({
  overview,
  onChanged,
}: {
  overview: AdminOverview;
  onChanged: () => void;
}) {
  const [preview, setPreview] = useState<AdminIndicator | null>(null);
  const main = overview.indicators.filter(
    (i) => !["active-users", "validated-pros"].includes(i.id),
  );
  const state = overview.indicators.filter((i) =>
    ["active-users", "validated-pros"].includes(i.id),
  );
  const additional = overview.attention.filter(
    (i) =>
      !main.some(
        (m) => m.resource === i.resource && m.query === "scope=pending",
      ),
  );
  const indicators = additional.map((i) => ({
    id: "pending-" + i.resource,
    label: i.label,
    count: i.count,
    resource: i.resource,
    query: "scope=pending",
    icon: i.resource === "pros" ? "medical" : "file",
  }));
  const pending = overview.pending.filter((group) => group.total > 0);
  function card(item: AdminIndicator) {
    return (
      <button
        className="admin-stat"
        key={item.id}
        aria-haspopup="dialog"
        onClick={() => setPreview(item)}
      >
        <span className="admin-stat-icon">
          <Icon name={item.icon} />
        </span>
        <strong>{item.count}</strong>
        <span>{item.label}</span>
        <small>Voir l’aperçu →</small>
      </button>
    );
  }
  return (
    <>
      <div className="admin-stats" style={indicatorColumns(main.length)}>
        {main.map(card)}
      </div>
      {!!state.length && (
        <section className="admin-panel">
          <h2>État des comptes et de l’annuaire</h2>
          <div className="admin-state-metrics">
            {state.map((item) => (
              <button
                key={item.id}
                className="admin-metric-line"
                aria-haspopup="dialog"
                onClick={() => setPreview(item)}
              >
                <span>{item.label}</span>
                <strong>{item.count}</strong>
              </button>
            ))}
          </div>
          <p>
            Ces nombres décrivent les statuts des comptes, pas leur activité
            récente.
          </p>
        </section>
      )}
      {overview.role === "Administrateur" && (
        <section className="admin-panel admin-section-title admin-highlight">
          <div>
            <h2>Activation et rétention</h2>
            <p>
              Activation à 7 jours, suivi des animaux et rétention J30 / M3 /
              M6.
            </p>
          </div>
          <a className="button outline" href="#admin/pilotage?from=dashboard">
            Consulter les indicateurs
          </a>
        </section>
      )}
      {!!indicators.length && (
        <section className="admin-panel">
          <h2>Suivi complémentaire</h2>
          <div className="admin-state-metrics">
            {indicators.map((item) => (
              <button
                key={item.id}
                className="admin-metric-line"
                aria-haspopup="dialog"
                onClick={() => setPreview(item)}
              >
                <span>{item.label}</span>
                <strong>{item.count}</strong>
              </button>
            ))}
          </div>
        </section>
      )}
      <section className="admin-panel">
        <h2>Signalements et demandes en attente</h2>
        <div className="admin-dashboard-grid">
          {[true, false].map((reports) => (
            <section key={String(reports)}>
              <h3>{reports ? "Signalements" : "Demandes"}</h3>
              <div
                className="admin-pending-scroll"
                tabIndex={0}
                role="region"
                aria-label={
                  reports ? "Liste des signalements" : "Liste des demandes"
                }
              >
                {pending
                  .filter((g) => (g.resource === "reports") === reports)
                  .map((group) => (
                    <div key={group.resource} className="admin-pending-group">
                      <h4>
                        {group.label}{" "}
                        <span className="admin-badge">{group.total}</span>
                      </h4>
                      {group.items.map((row) => (
                        <a
                          className="admin-queue"
                          key={row.id}
                          href={`${adminLink(group.resource)}?record=${encodeURIComponent(row.id)}&from=dashboard`}
                        >
                          <span>
                            <strong>{row.name}</strong>
                            <small>
                              {row.priority ||
                                row.category ||
                                row.email ||
                                group.label}
                            </small>
                          </span>
                          <span
                            className={`admin-badge ${statusTone(row.status)}`}
                          >
                            {row.status}
                          </span>
                        </a>
                      ))}
                      {group.total > group.items.length && (
                        <a
                          className="admin-text-button"
                          href={`${adminLink(group.resource)}?scope=pending&from=dashboard`}
                        >
                          Voir les {group.total} dossiers →
                        </a>
                      )}
                    </div>
                  ))}
                {!pending.some(
                  (g) => (g.resource === "reports") === reports,
                ) && (
                  <p className="admin-empty">
                    {reports
                      ? "Aucun signalement à traiter."
                      : "Toutes les demandes sont traitées."}
                  </p>
                )}
              </div>
            </section>
          ))}
        </div>
      </section>
      <div className="admin-dashboard-grid">
        <section className="admin-panel">
          <div className="admin-section-title">
            <h2>Dernières actions</h2>
            {overview.role === "Administrateur" && (
              <a href="#admin/historique?from=dashboard">Voir l’historique →</a>
            )}
          </div>
          <div className="admin-timeline">
            {overview.recent.map((row) => (
              <article key={row.id}>
                <a
                  className="admin-record-link"
                  href={`${adminLink("history")}?record=${row.id}&from=dashboard`}
                >
                  {row.name}
                </a>
                <small>
                  {row.email} ·{" "}
                  {new Date(row.createdAt).toLocaleString("fr-FR")}
                </small>
              </article>
            ))}
            {!overview.recent.length && (
              <p>Aucune action récente à afficher pour votre rôle.</p>
            )}
          </div>
        </section>
        <section className="admin-panel">
          <h2>Accès rapides</h2>
          {[
            ["users", "Gérer les utilisateurs"],
            ["tickets", "Ouvrir l’assistance"],
            ["library", "Préparer les contenus"],
            ["team", "Consulter l’équipe"],
          ]
            .filter(([r]) => overview.counts[r as AdminResource] !== undefined)
            .map(([r, label]) => (
              <a
                key={r}
                className="admin-quick-link"
                href={adminLink(r as AdminResource)}
              >
                {label}
                <span>→</span>
              </a>
            ))}
        </section>
      </div>
      {preview && (
        <AdminPreview
          indicator={preview}
          role={overview.role}
          onClose={() => setPreview(null)}
          onChanged={onChanged}
        />
      )}
    </>
  );
}
