import { useEffect, useState } from "react";
import { request } from "../../shared/services/api.ts";
import { errorMessage } from "../../shared/types.ts";
import Modal from "../../shared/ui/Modal.tsx";
import SubmissionForm, { Field } from "../../shared/forms/SubmissionForm.tsx";
interface Status {
  enabled: boolean;
  recoveryRemaining: number;
}
export default function MfaPanel() {
  const [status, setStatus] = useState<Status | null>(null),
    [error, setError] = useState(""),
    [mode, setMode] = useState(""),
    [busy, setBusy] = useState(false),
    [visible, setVisible] = useState(false),
    [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null),
    [codes, setCodes] = useState<string[]>([]),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    request<Status>("/account/mfa", { signal: controller.signal })
      .then((s) => {
        if (!controller.signal.aborted) {
          setStatus(s);
          setError("");
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(errorMessage(e));
      });
    return () => controller.abort();
  }, [retry]);
  function download() {
    const url = URL.createObjectURL(
        new Blob([codes.join("\n")], { type: "text/plain;charset=utf-8" }),
      ),
      link = document.createElement("a");
    link.href = url;
    link.download = "anivaya-codes-secours.txt";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const labels: Record<string, string> = {
    setup: "Configurer la double authentification",
    enable: "Activer la double authentification",
    renew: "Renouveler les codes de secours",
    disable: "Désactiver la double authentification",
  };
  return (
    <section className="admin-panel">
      <h2>Double authentification</h2>
      <p>
        Ajoutez un code de votre application d’authentification à chaque
        connexion.
      </p>
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
      ) : !status ? (
        <p role="status">Chargement de la sécurité…</p>
      ) : (
        <>
          <p>
            <span className="admin-badge">
              {status.enabled ? "Activée" : "Désactivée"}
            </span>
            {status.enabled &&
              ` · ${status.recoveryRemaining} codes de secours disponibles`}
          </p>
          <div className="admin-dialog-actions">
            {(status.enabled ? ["renew", "disable"] : ["setup"]).map(
              (action) => (
                <button
                  className="button outline"
                  key={action}
                  onClick={() => {
                    setMode(action);
                    setSetup(null);
                    setVisible(false);
                    setCodes([]);
                  }}
                >
                  {labels[action]}
                </button>
              ),
            )}
          </div>
        </>
      )}
      {!!codes.length && (
        <div className="admin-proof" role="status">
          <h3>Conservez vos codes de secours</h3>
          <p>
            Ils sont affichés une seule fois. Chaque code peut être utilisé une
            seule fois.
          </p>
          <pre>{codes.join("\n")}</pre>
          <button className="button outline" onClick={download}>
            Télécharger les codes
          </button>
          <button className="button outline" onClick={() => setCodes([])}>
            J’ai conservé mes codes
          </button>
        </div>
      )}
      {mode && (
        <Modal
          busy={busy}
          onClose={() => {
            setMode("");
            setSetup(null);
          }}
          className="admin-dialog"
        >
          <SubmissionForm
            key={mode}
            title={labels[mode]}
            description={
              mode === "disable"
                ? "La connexion ne demandera plus de seconde vérification. Vos autres sessions seront fermées."
                : mode === "renew"
                  ? "Les anciens codes de secours seront invalidés. Vos autres sessions seront fermées."
                  : "Confirmez avec votre mot de passe actuel. La configuration expire après 10 minutes."
            }
            submitLabel={
              mode === "setup" ? "Préparer la configuration" : "Confirmer"
            }
            danger={mode === "disable"}
            busy={busy}
            setBusy={setBusy}
            onClose={() => {
              setMode("");
              setSetup(null);
            }}
            onSaved={async () => {
              if (mode !== "setup") {
                setMode("");
                setSetup(null);
                setRetry((n) => n + 1);
              }
            }}
            onSubmit={async (values) => {
              const result = await request<{
                secret?: string;
                qr?: string;
                codes?: string[];
              }>("/account/mfa", {
                method: "POST",
                body: JSON.stringify({ ...values, action: mode }),
              });
              if (result.qr && result.secret) {
                setSetup({ qr: result.qr, secret: result.secret });
                setMode("enable");
              }
              if (result.codes) setCodes(result.codes);
            }}
          >
            {({ error, invalid }) => (
              <>
                {setup && (
                  <div>
                    <p>
                      Scannez ce QR dans votre application d’authentification,
                      puis saisissez le code obtenu.
                    </p>
                    <img
                      src={setup.qr}
                      width="240"
                      height="240"
                      alt="QR de configuration de votre application d’authentification"
                    />
                    <details>
                      <summary>Configurer sans QR</summary>
                      <code>{setup.secret}</code>
                    </details>
                  </div>
                )}
                <Field
                  name="password"
                  label="Mot de passe actuel"
                  error={error}
                >
                  <div className="password-field">
                    <input
                      id="password"
                      name="password"
                      type={visible ? "text" : "password"}
                      autoComplete="current-password"
                      {...invalid("password")}
                    />
                    <button
                      className="password-toggle"
                      type="button"
                      aria-label={
                        visible
                          ? "Masquer le mot de passe"
                          : "Afficher le mot de passe"
                      }
                      aria-pressed={visible}
                      onClick={() => setVisible(!visible)}
                    >
                      {visible ? "Masquer" : "Voir"}
                    </button>
                  </div>
                </Field>
                {mode !== "setup" && (
                  <Field
                    name="mfaCode"
                    label="Code de vérification ou code de secours"
                    error={error}
                  >
                    <input
                      id="mfaCode"
                      name="mfaCode"
                      autoComplete="one-time-code"
                      maxLength={32}
                      {...invalid("mfaCode")}
                    />
                  </Field>
                )}
              </>
            )}
          </SubmissionForm>
        </Modal>
      )}
    </section>
  );
}
