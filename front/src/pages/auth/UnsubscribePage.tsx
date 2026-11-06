import { useState } from "react";
import { AuthLayout } from "./AuthPage.tsx";
import { api } from "../../shared/services/api.ts";
import { errorMessage } from "../../shared/types.ts";

export default function UnsubscribePage({ token }: { token?: string }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  return (
    <AuthLayout menuLogin>
      <h1 id="auth-title">
        {done && token ? "Vous êtes désinscrit." : "Liste d’attente"}
      </h1>
      {done ? (
        <p role="status">
          {token
            ? "Votre consentement est retiré. Vous ne recevrez plus les e-mails de lancement d’Anivaya. Votre compte et vos autres demandes restent inchangés."
            : "Si cette adresse est inscrite, un lien personnel de désinscription lui sera envoyé."}
        </p>
      ) : (
        <>
          <p className="intro">
            {token
              ? "Un clic suffit pour vous désinscrire des e-mails de lancement d’Anivaya."
              : "Recevez un lien personnel pour gérer votre inscription."}
          </p>
          <form
            aria-busy={busy}
            onSubmit={async (event) => {
              event.preventDefault();
              if (busy) return;
              setBusy(true);
              setError("");
              try {
                if (token) await api.unsubscribe(token);
                else await api.requestUnsubscribe(email);
                setDone(true);
              } catch (failure) {
                setError(errorMessage(failure));
              } finally {
                setBusy(false);
              }
            }}
          >
            {!token && (
              <div className="field">
                <label htmlFor="unsubscribe-email">Adresse e-mail</label>
                <input
                  id="unsubscribe-email"
                  type="email"
                  autoComplete="email"
                  maxLength={120}
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={busy}
                />
              </div>
            )}
            {error && (
              <p role="alert" className="form-message error">
                {error}
              </p>
            )}
            <button className="button submit" disabled={busy}>
              {busy
                ? "Traitement…"
                : token
                  ? "Me désinscrire"
                  : "Recevoir mon lien"}
            </button>
          </form>
          {token && error && (
            <p>
              <a href="#desinscription">Recevoir un nouveau lien</a>
            </p>
          )}
        </>
      )}
    </AuthLayout>
  );
}
