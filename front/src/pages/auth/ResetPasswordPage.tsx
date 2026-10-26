import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import Icon from "../../shared/ui/Icon.tsx";
import { AuthLayout } from "./AuthPage.tsx";

type Step = "request" | "sent" | "new" | "unavailable" | "success";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Même règle que la création de compte. */
const MIN_PASSWORD = 12;

/**
 * Parcours de réinitialisation simulé : aucun e-mail n’est envoyé et aucun mot de passe
 * n’est modifié, l’envoi d’e-mails n’étant pas configuré.
 */
export default function ResetPasswordPage({
  fromProfile,
  email: initialEmail = "",
}: {
  /** Ouverte depuis « Mot de passe » du profil : les liens ramènent au profil. */
  fromProfile: boolean;
  /** E-mail du compte connecté, proposé par défaut. */
  email?: string;
}) {
  const [step, setStep] = useState<Step>("request");
  const [expired, setExpired] = useState(false);
  const [email, setEmail] = useState(initialEmail);
  const [passwords, setPasswords] = useState({ password: "", confirm: "" });
  const [visible, setVisible] = useState({ password: false, confirm: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const title = useRef<HTMLHeadingElement>(null);
  const back = fromProfile ? "#profil" : "#connexion";
  // Chaque étape remplace le contenu : le titre reçoit le focus pour l’annoncer.
  useEffect(() => title.current?.focus(), [step]);

  function show(next: Step) {
    setStep(next);
    setErrors({});
    if (next !== "new") {
      setPasswords({ password: "", confirm: "" });
      setVisible({ password: false, confirm: false });
    }
  }
  function request(event: FormEvent) {
    event.preventDefault();
    if (!EMAIL.test(email.trim())) {
      setErrors({ email: "Indiquez une adresse e-mail valide." });
      document.getElementById("reset-email")?.focus();
      return;
    }
    show("sent");
  }
  function choose(event: FormEvent) {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (passwords.password.length < MIN_PASSWORD)
      found.password = `Utilisez au moins ${MIN_PASSWORD} caractères.`;
    if (!passwords.confirm || passwords.confirm !== passwords.password)
      found.confirm = "Les deux mots de passe doivent être identiques.";
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) document.getElementById("reset-" + first)?.focus();
    else show("success");
  }
  function unavailable(isExpired: boolean) {
    setExpired(isExpired);
    show("unavailable");
  }

  const titles: Record<Step, string> = {
    request: fromProfile
      ? "Changer votre mot de passe"
      : "Réinitialiser votre mot de passe",
    sent: "Vérifiez votre boîte e-mail",
    new: "Choisissez un nouveau mot de passe",
    unavailable: "Ce lien ne peut plus être utilisé",
    success: "Modification simulée",
  };
  const intro = {
    request: "Demandez un lien pour choisir un nouveau mot de passe.",
    new: "Choisissez un mot de passe et confirmez-le ci-dessous.",
  }[step as "request" | "new"];
  const passwordField = (
    key: "password" | "confirm",
    label: string,
    help?: string,
  ) => (
    <div className="field">
      <label htmlFor={"reset-" + key}>{label}</label>
      <div className="password-field">
        <input
          id={"reset-" + key}
          type={visible[key] ? "text" : "password"}
          autoComplete="new-password"
          maxLength={256}
          value={passwords[key]}
          onChange={(e) => {
            setPasswords({ ...passwords, [key]: e.target.value });
            setErrors({ ...errors, [key]: "" });
          }}
          aria-invalid={errors[key] ? true : undefined}
          aria-describedby={
            (help ? `reset-${key}-help ` : "") + `reset-${key}-error`
          }
          required
        />
        <button
          type="button"
          className="password-toggle"
          aria-pressed={visible[key]}
          aria-label={
            (visible[key] ? "Masquer" : "Afficher") +
            (key === "password"
              ? " le nouveau mot de passe"
              : " la confirmation")
          }
          onClick={() => setVisible({ ...visible, [key]: !visible[key] })}
        >
          <Icon name="eye" />
        </button>
      </div>
      {help && (
        <p className="field-help" id={`reset-${key}-help`}>
          {help}
        </p>
      )}
      <p className="field-error" id={`reset-${key}-error`} role="alert">
        {errors[key]}
      </p>
    </div>
  );

  return (
    <AuthLayout>
      <a className="reset-back" href={back}>
        <Icon name="back" />
        <span>
          {fromProfile ? "Retour à mon profil" : "Retour à la connexion"}
        </span>
      </a>
      <h1 id="auth-title" tabIndex={-1} ref={title}>
        {titles[step]}
      </h1>
      {intro && <p className="intro">{intro}</p>}

      {step === "request" && (
        <form noValidate onSubmit={request}>
          <div className="field">
            <label htmlFor="reset-email">Adresse e-mail</label>
            <input
              id="reset-email"
              type="email"
              autoComplete="email"
              maxLength={120}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setErrors({});
              }}
              aria-invalid={errors.email ? true : undefined}
              aria-describedby="reset-email-error"
              required
            />
            <p className="field-error" id="reset-email-error" role="alert">
              {errors.email}
            </p>
          </div>
          <button className="button submit" type="submit">
            Demander un lien de réinitialisation
          </button>
        </form>
      )}

      {step === "sent" && (
        <>
          <p>
            Si un compte correspond à cette adresse, un lien de réinitialisation
            lui sera envoyé lorsque l’envoi d’e-mails sera configuré.
          </p>
          <div className="demo-note">
            <strong>Demande simulée</strong>
            <p>
              Aucun e-mail n’a été envoyé. Utilisez le lien ci-dessous pour
              poursuivre le parcours.
            </p>
          </div>
          <button
            type="button"
            className="button submit"
            onClick={() => show("new")}
          >
            Ouvrir le lien de démonstration
          </button>
          <button
            type="button"
            className="text-button"
            onClick={() => show("request")}
          >
            Utiliser une autre adresse
          </button>
        </>
      )}

      {step === "new" && (
        <>
          <form noValidate onSubmit={choose}>
            {passwordField(
              "password",
              "Nouveau mot de passe",
              `Au moins ${MIN_PASSWORD} caractères.`,
            )}
            {passwordField("confirm", "Confirmer le nouveau mot de passe")}
            <button type="submit" className="button submit">
              Valider le nouveau mot de passe
            </button>
          </form>
          <details className="reset-demo-states">
            <summary>Tester les états du lien</summary>
            <div>
              <button
                className="text-button"
                type="button"
                onClick={() => unavailable(true)}
              >
                Lien expiré
              </button>
              <button
                className="text-button"
                type="button"
                onClick={() => unavailable(false)}
              >
                Lien invalide
              </button>
            </div>
          </details>
        </>
      )}

      {step === "unavailable" && (
        <>
          <p>
            {expired
              ? "Ce lien de démonstration a expiré. Demandez un nouveau lien pour continuer."
              : "Ce lien de démonstration est invalide ou a déjà été utilisé. Demandez un nouveau lien."}
          </p>
          <button
            type="button"
            className="button submit"
            onClick={() => show("request")}
          >
            Demander un nouveau lien
          </button>
        </>
      )}

      {step === "success" && (
        <>
          <p>
            Le parcours de changement de mot de passe est terminé. Aucun mot de
            passe n’a été modifié.
          </p>
          <a className="button submit" href={back}>
            {fromProfile ? "Revenir à mon profil" : "Revenir à la connexion"}
          </a>
        </>
      )}

      <p className="demo-note">
        Version de démonstration : aucun e-mail n’est envoyé et aucun mot de
        passe n’est enregistré ou transmis.
      </p>
    </AuthLayout>
  );
}
