import { useState } from "react";
import type { AuthUser } from "../../../../shared/account.ts";
import { AuthLayout } from "./AuthPage.tsx";
import { api } from "../../shared/services/api.ts";
import { errorMessage } from "../../shared/types.ts";
import { useText } from "../../shared/i18n/HomeLocale.tsx";

export default function InvitationPage({ token, user, onAccepted, onLogout }: {
  token: string;
  user: AuthUser | null;
  onAccepted: (user: AuthUser) => void;
  onLogout: () => Promise<void>;
}) {
  const tr = useText();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const valid = /^[a-f0-9]{64}$/.test(token);
  async function accept() {
    if (busy) return;
    setBusy(true);
    setError("");
    try { onAccepted(await api.acceptInvitation(token)); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }
  return <AuthLayout opening menuLogin>
    <h1 id="auth-title">{tr("Invitation à rejoindre l’équipe")}</h1>
    {!valid ? <p role="alert">{tr("Invitation invalide ou expirée.")}</p> : <>
      <p>{tr("Connectez-vous avec l’adresse destinataire, puis confirmez votre accès à l’équipe.")}</p>
      {user ? <>
        <p>{user.profile.email}</p>
        <button className="button submit" disabled={busy} onClick={() => void accept()}>
          {tr(busy ? "Enregistrement…" : "Confirmer l’invitation")}
        </button>
        <button className="text-button" disabled={busy} onClick={() => {
          setBusy(true);
          void onLogout().then(() => { window.location.hash = `connexion/invitation/${token}`; })
            .catch(e => setError(errorMessage(e))).finally(() => setBusy(false));
        }}>{tr("Utiliser un autre compte")}</button>
      </> : <div className="dialog-actions">
        <a className="button" href={`#connexion/invitation/${token}`}>{tr("Se connecter")}</a>
        <a className="button outline" href={`#inscription/invitation/${token}`}>{tr("Créer un compte")}</a>
      </div>}
    </>}
    {error && <p className="error" role="alert">{tr(error)}</p>}
  </AuthLayout>;
}
