import {
  adminHistoryAction,
  adminRecordTitle,
} from "../../../../shared/translations/admin.ts";
import { uiLocale } from "../../shared/i18n/locale.ts";
import { useText } from "../../shared/i18n/HomeLocale.tsx";
import EmptyState from "../../shared/ui/EmptyState.tsx";
import { useState } from "react";
import type {
  AdminIndicator,
  AdminOverview,
  AdminResource,
} from "../../../../shared/admin.ts";
import Icon from "../../shared/ui/Icon.tsx";
import AdminPreview from "./AdminPreview.tsx";
import {
  adminEmptyStates,
  adminLink,
  indicatorColumns,
  statusTone,
} from "./config.ts";

export default function AdminDashboard({
  overview,
  onChanged,
}: {
  overview: AdminOverview;
  onChanged: () => void;
}) {
  const tr = useText();
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
    if (!item.count)
      return (
        <section className="admin-stat admin-stat-empty" key={item.id}>
          <h2>{tr(item.label)}</h2>
          <EmptyState
            {...adminEmptyStates[item.resource]}
            description=""
            size="metric"
          />
        </section>
      );
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
        <span>{tr(item.label)}</span>
        <small>{tr("Voir l’aperçu →")}</small>
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
          <h2>{tr("État des comptes et de l’annuaire")}</h2>
          <div className="admin-state-metrics">
            {state.map((item) =>
              item.count ? (
                <button
                  key={item.id}
                  className="admin-metric-line"
                  aria-haspopup="dialog"
                  onClick={() => setPreview(item)}
                >
                  <span>{tr(item.label)}</span>
                  <strong>{item.count}</strong>
                </button>
              ) : (
                <section
                  className="admin-metric-line admin-metric-line-empty"
                  key={item.id}
                >
                  <span>{tr(item.label)}</span>
                  <EmptyState
                    kind="data"
                    title={tr("Aucune donnée")}
                    description=""
                    size="inline"
                  />
                </section>
              ),
            )}
          </div>
          <p>
            {tr(
              "Ces nombres décrivent les statuts des comptes, pas leur activité récente.",
            )}
          </p>
        </section>
      )}
      {overview.role === "Administrateur" && (
        <section className="admin-panel admin-section-title admin-highlight">
          <div>
            <h2>{tr("Activation et rétention")}</h2>
            <p>
              {tr(
                "Activation à 7 jours, suivi des animaux et rétention J30 / M3 / M6.",
              )}
            </p>
          </div>
          <a className="button outline" href="#admin/pilotage?from=dashboard">
            {tr("Consulter les indicateurs")}
          </a>
        </section>
      )}
      {!!indicators.length && (
        <section className="admin-panel">
          <h2>{tr("Suivi complémentaire")}</h2>
          <div className="admin-state-metrics">
            {indicators.map((item) =>
              item.count ? (
                <button
                  key={item.id}
                  className="admin-metric-line"
                  aria-haspopup="dialog"
                  onClick={() => setPreview(item)}
                >
                  <span>{tr(item.label)}</span>
                  <strong>{item.count}</strong>
                </button>
              ) : (
                <section
                  className="admin-metric-line admin-metric-line-empty"
                  key={item.id}
                >
                  <span>{tr(item.label)}</span>
                  <EmptyState
                    kind="actions"
                    title={tr("Aucune action en attente")}
                    description=""
                    size="inline"
                  />
                </section>
              ),
            )}
          </div>
        </section>
      )}
      <section className="admin-panel">
        <h2>{tr("Signalements et demandes en attente")}</h2>
        <div className="admin-dashboard-grid">
          {[true, false].map((reports) => (
            <section key={String(reports)}>
              <h3>{reports ? tr("Signalements") : tr("Demandes")}</h3>
              <div
                className="admin-pending-scroll"
                tabIndex={0}
                role="region"
                aria-label={
                  reports
                    ? tr("Liste des signalements")
                    : tr("Liste des demandes")
                }
              >
                {pending
                  .filter((g) => (g.resource === "reports") === reports)
                  .map((group) => (
                    <div key={group.resource} className="admin-pending-group">
                      <h4>
                        {tr(group.label)}{" "}
                        <span className="admin-badge">{group.total}</span>
                      </h4>
                      {group.items.map((row) => (
                        <a
                          className="admin-queue"
                          key={row.id}
                          href={`${adminLink(group.resource)}?record=${encodeURIComponent(row.id)}&from=dashboard`}
                        >
                          <span>
                            <strong>
                              {adminRecordTitle(group.resource, row, tr)}
                            </strong>
                            <small>
                              {tr(row.priority) ||
                                tr(row.category) ||
                                row.email ||
                                tr(group.label)}
                            </small>
                          </span>
                          <span
                            className={`admin-badge ${statusTone(row.status)}`}
                          >
                            {tr(row.status)}
                          </span>
                        </a>
                      ))}
                      {group.total > group.items.length && (
                        <a
                          className="admin-text-button"
                          href={`${adminLink(group.resource)}?scope=pending&from=dashboard`}
                        >
                          {tr("Voir les ")}
                          {group.total}
                          {tr(" dossiers →")}
                        </a>
                      )}
                    </div>
                  ))}
                {!pending.some(
                  (g) => (g.resource === "reports") === reports,
                ) && (
                  <EmptyState
                    kind="actions"
                    className="admin-empty"
                    compact
                    title={
                      reports
                        ? tr("Aucun signalement à traiter")
                        : tr("Aucune demande en attente")
                    }
                    description={tr("Les nouveaux dossiers apparaîtront ici.")}
                  />
                )}
              </div>
            </section>
          ))}
        </div>
      </section>
      <div className="admin-dashboard-grid">
        <section className="admin-panel">
          <div className="admin-section-title">
            <h2>{tr("Dernières actions")}</h2>
            {overview.role === "Administrateur" && (
              <a href="#admin/historique?from=dashboard">
                {tr("Voir l’historique →")}
              </a>
            )}
          </div>
          <div className="admin-timeline">
            {overview.recent.map((row) => (
              <article key={row.id}>
                <a
                  className="admin-record-link"
                  href={`${adminLink("history")}?record=${row.id}&from=dashboard`}
                >
                  {adminHistoryAction(row.name, tr)}
                </a>
                <small>
                  {row.email} ·{" "}
                  {new Date(row.createdAt).toLocaleString(uiLocale())}
                </small>
              </article>
            ))}
            {!overview.recent.length && (
              <EmptyState
                kind="actions"
                className="admin-empty"
                compact
                title={tr("Aucune action récente")}
                description={tr("L’activité de votre équipe apparaîtra ici.")}
              />
            )}
          </div>
        </section>
        <section className="admin-panel">
          <h2>{tr("Accès rapides")}</h2>
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
                {tr(label)}
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
