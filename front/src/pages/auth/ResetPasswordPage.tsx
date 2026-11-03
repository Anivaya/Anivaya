import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { PASSWORD_RULE, passwordProblem } from "../../../../shared/account.ts";
import Icon from "../../shared/ui/Icon.tsx";
import { api } from "../../shared/services/api.ts";
import { errorMessage } from "../../shared/types.ts";
import { AuthLayout } from "./AuthPage.tsx";

type Step = "request" | "sent" | "checking" | "new" | "unavailable" | "success";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Mot de passe oublié : un lien valable une heure est envoyé par e-mail ; il ouvre cette
 * page avec son jeton (#mot-de-passe/<jeton>) pour choisir un nouveau mot de passe.
 */
export default function ResetPasswordPage({
  token,
  email: initialEmail = "",
}: {
  /** Jeton du lien reçu par e-mail ; absent pour la demande de lien. */
  token?: string;
  /** E-mail du compte connecté, proposé par défaut. */
  email?: string;
}) {
  const [step, setStep] = useState<Step>(
    token === undefined ? "request" : "checking",
  );
  const [email, setEmail] = useState(initialEmail);
  const [passwords, setPasswords] = useState({ password: "", confirm: "" });
  const [visible, setVisible] = useState({ password: false, confirm: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  // Chaque étape remplace le contenu : le titre reçoit le focus pour l’annoncer.
  useEffect(() => title.current?.focus(), [step]);
  // Le lien reçu est vérifié avant d’afficher le formulaire.
  useEffect(() => {
    if (token === undefined) return;
    let active = true;
    api
      .passwordResetStatus(token)
      .then(({ valid }) => active && setStep(valid ? "new" : "unavailable"))
      .catch(() => active && setStep("unavailable"));
    return () => {
      active = false;
    };
  }, [token]);

  function show(next: Step) {
    setStep(next);
    setErrors({});
    if (next !== "new") {
      setPasswords({ password: "", confirm: "" });
      setVisible({ password: false, confirm: false });
    }
  }
  async function request(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!EMAIL.test(email.trim())) {
      setErrors({ email: "Indiquez une adresse e-mail valide." });
      document.getElementById("reset-email")?.focus();
      return;
    }
    setBusy(true);
    try {
      await api.requestPasswordReset(email.trim());
      show("sent");
    } catch (failure) {
      setErrors({ email: errorMessage(failure) });
    } finally {
      setBusy(false);
    }
  }
  async function choose(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const found: Record<string, string> = {};
    // Même règle que la création de compte.
    const problem = passwordProblem(passwords.password);
    if (problem) found.password = problem;
    if (!passwords.confirm || passwords.confirm !== passwords.password)
      found.confirm = "Les deux mots de passe doivent être identiques.";
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      document.getElementById("reset-" + first)?.focus();
      return;
    }
    setBusy(true);
    try {
      await api.resetPassword({
        token: token ?? "",
        password: passwords.password,
        confirmPassword: passwords.confirm,
      });
      show("success");
    } catch (failure) {
      setErrors({ password: errorMessage(failure) });
    } finally {
      setBusy(false);
    }
  }

  const titles: Record<Step, string> = {
    request: "Réinitialiser votre mot de passe",
    sent: "Vérifiez votre boîte e-mail",
    checking: "Vérification du lien…",
    new: "Choisissez un nouveau mot de passe",
    unavailable: "Ce lien ne peut plus être utilisé",
    success: "Mot de passe modifié",
  };
  const intro = {
    request: "Recevez un lien par e-mail pour choisir un nouveau mot de passe.",
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
          <Icon name={visible[key] ? "eye-off" : "eye"} />
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
    <AuthLayout opening menuLogin>
      <a className="reset-back" href="#connexion" title="Retour à la connexion">
        <Icon name="back" />
        <span className="sr-only">Retour à la connexion</span>
      </a>
      <h1 id="auth-title" tabIndex={-1} ref={title}>
        {titles[step]}
      </h1>
      {intro && <p className="intro">{intro}</p>}

      {step === "request" && (
        <form noValidate onSubmit={request} aria-busy={busy}>
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
          <button className="button submit" type="submit" disabled={busy}>
            {busy ? "Envoi…" : "Recevoir un lien de réinitialisation"}
          </button>
        </form>
      )}

      {step === "sent" && (
        <>
          <p>
            Si un compte correspond à <strong>{email.trim()}</strong>, un lien
            vient de lui être envoyé. Il est valable une heure et ne fonctionne
            qu’une fois. Pensez à vérifier vos courriers indésirables.
          </p>
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
        <form noValidate onSubmit={choose} aria-busy={busy}>
          {passwordField("password", "Nouveau mot de passe", PASSWORD_RULE)}
          {passwordField("confirm", "Confirmer le nouveau mot de passe")}
          <button type="submit" className="button submit" disabled={busy}>
            {busy ? "Enregistrement…" : "Valider le nouveau mot de passe"}
          </button>
        </form>
      )}

      {step === "unavailable" && (
        <>
          <p>
            Ce lien a expiré, a déjà servi ou est incomplet. Demandez un nouveau
            lien pour continuer.
          </p>
          <a className="button submit" href="#reinitialisation">
            Demander un nouveau lien
          </a>
        </>
      )}

      {step === "success" && (
        <>
          <p>
            Votre mot de passe a été modifié et vos sessions ouvertes ont été
            fermées. Connectez-vous avec votre nouveau mot de passe.
          </p>
          <a className="button submit" href="#connexion">
            Se connecter
          </a>
        </>
      )}
    </AuthLayout>
  );
}
