import { adminRecordTitle } from "../../../../shared/translations/admin.ts";
import { useText } from "../../shared/i18n/HomeLocale.tsx";
import EmptyState from "../../shared/ui/EmptyState.tsx";
import { useEffect, useState, useRef } from "react";
import type {
  AdminIndicator,
  AdminList,
  AdminRecord,
  AdminRole,
} from "../../../../shared/admin.ts";
import { adminApi } from "../../shared/services/admin.ts";
import { errorMessage } from "../../shared/types.ts";
import Modal from "../../shared/ui/Modal.tsx";
import AdminDialog from "./AdminDialog.tsx";
import {
  actionIcon,
  adminEmptyStates,
  actionsFor,
  adminLink,
  isDangerAction,
  statusTone,
} from "./config.ts";
import AdminIconButton from "./AdminIconButton.tsx";

/** Aperçu intermédiaire commun aux indicateurs et à la cloche. Le dossier s'ouvre au-dessus et revient ici. */
export default function AdminPreview({
  indicator,
  role,
  onClose,
  onChanged,
}: {
  indicator: AdminIndicator;
  role: AdminRole;
  onClose: () => void;
  onChanged: () => void;
}) {
  const tr = useText();
  const [result, setResult] = useState<{ data?: AdminList; error?: string }>(
    {},
  );
  const [revision, setRevision] = useState(0),
    [busy, setBusy] = useState(false);
  const [selection, setSelection] = useState<{
    row: AdminRecord;
    action: string;
  } | null>(null);
  const origin = useRef<HTMLElement | null>(null);
  function closeSelection() {
    setSelection(null);
    requestAnimationFrame(() => {
      if (origin.current?.isConnected) origin.current.focus();
      else document.getElementById("preview-title")?.focus();
    });
  }
  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams(indicator.query);
    query.set("pageSize", "5");
    adminApi
      .list(indicator.resource, query, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setResult({ data });
      })
      .catch((e) => {
        if (!controller.signal.aborted) setResult({ error: errorMessage(e) });
      });
    return () => controller.abort();
  }, [indicator, revision]);
  async function open(row: AdminRecord, action = "view") {
    if (busy) return;
    origin.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setBusy(true);
    try {
      const current = await adminApi.detail(indicator.resource, row.id);
      if (indicator.resource === "alerts" && !current.read) {
        await adminApi.act("alerts", row.id, { action: "read" });
        current.read = true;
        current.status = "Lue";
        onChanged();
        setRevision((n) => n + 1);
      }
      setSelection({ row: current, action });
    } catch (e) {
      setResult((r) => ({ ...r, error: errorMessage(e) }));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Modal
        className="admin-dialog admin-preview"
        header={false}
        labelledBy="preview-title"
        onClose={onClose}
        busy={busy}
      >
        <header className="admin-dialog-heading">
          <div>
            <h2 id="preview-title" tabIndex={-1} autoFocus>
              {tr(indicator.label)}
            </h2>
            {(!result.data || result.data.total > 0) && (
              <p className="muted">
                {result.data
                  ? tr("{0} sur {1} résultats", [
                      result.data.items.length,
                      result.data.total,
                    ])
                  : tr("Chargement de l’aperçu…")}
              </p>
            )}
          </div>
          <AdminIconButton
            icon="close"
            label={tr("Fermer l’aperçu")}
            danger
            className="admin-close"
            onClick={onClose}
          />
        </header>
        {result.error && (
          <div role="alert" className="admin-error">
            <p>{tr(result.error)}</p>
            <button
              className="button outline"
              onClick={() => {
                setResult({});
                setRevision((n) => n + 1);
              }}
            >
              {tr("Réessayer")}
            </button>
          </div>
        )}
        <div
          className="admin-preview-list"
          aria-busy={busy || (!result.data && !result.error)}
        >
          {result.data?.items.map((row) => (
            <article className="admin-preview-row" key={row.id}>
              <div>
                <button
                  className="admin-record-link"
                  disabled={busy}
                  onClick={() => void open(row)}
                >
                  {adminRecordTitle(indicator.resource, row, tr)}
                </button>
                <p>
                  {row.email || tr(row.category) || row.reference || row.city}
                </p>
                <span className={`admin-badge ${statusTone(row.status)}`}>
                  {tr(row.status)}
                </span>
              </div>
              <div className="admin-preview-actions">
                <AdminIconButton
                  icon="eye"
                  label={tr("Consulter {0}", [
                    adminRecordTitle(indicator.resource, row, tr),
                  ])}
                  disabled={busy}
                  onClick={() => void open(row)}
                />
                {actionsFor(indicator.resource, row, role)
                  .slice(0, 2)
                  .map((action) => (
                    <AdminIconButton
                      className="admin-text-button"
                      icon={actionIcon(
                        action.id,
                        indicator.resource,
                        action.label,
                      )}
                      label={`${tr(action.label)} — ${row.name}`}
                      danger={isDangerAction(action.id)}
                      disabled={busy}
                      key={action.id}
                      onClick={() => void open(row, action.id)}
                    />
                  ))}
              </div>
            </article>
          ))}
          {result.data && !result.data.total && (
            <EmptyState
              {...adminEmptyStates[indicator.resource]}
              compact
              className="admin-empty"
            />
          )}
          {!result.data && !result.error && (
            <p className="admin-empty" role="status">
              {tr("Chargement des dossiers…")}
            </p>
          )}
        </div>
        {!!result.data?.total && (
          <footer className="admin-dialog-actions">
            <a
              className="button"
              href={`${adminLink(indicator.resource)}?${indicator.query}${indicator.query ? "&" : ""}from=dashboard`}
            >
              {tr("Voir la page complète")}
            </a>
          </footer>
        )}
      </Modal>
      {selection && (
        <AdminDialog
          key={selection.row.id}
          row={selection.row}
          resource={indicator.resource}
          role={role}
          initialAction={selection.action}
          returnLabel={tr("Retour à l’aperçu")}
          onClose={closeSelection}
          onSaved={async () => {
            closeSelection();
            setRevision((n) => n + 1);
            onChanged();
          }}
        />
      )}
    </>
  );
}
