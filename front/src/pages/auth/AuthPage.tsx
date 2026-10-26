import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { AuthUser } from "../../../../shared/account.ts";
import { errorMessage, errorField } from "../../shared/types.ts";
import type { FormError } from "../../shared/types.ts";
import { api } from "../../shared/services/api.ts";
import PublicHeader from "../../shared/layout/PublicHeader.tsx";
import Icon from "../../shared/ui/Icon.tsx";
export default function AuthPage({
  register,
  onAuthenticated,
}: {
  register: boolean;
  onAuthenticated: (user: AuthUser) => void;
}) {
  const [form, setForm] = useState({
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    }),
    [visible, setVisible] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<FormError | null>(null),
    [demo, setDemo] = useState<{ email: string; password: string } | null>(
      null,
    );
  useEffect(() => {
    let active = true;
    api
      .demo()
      .then((d) => {
        if (active) setDemo(d);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const user = register
        ? await api.register(form)
        : await api.login({ ...form, remember: false });
      onAuthenticated(user);
    } catch (e) {
      const field = errorField(e);
      setError({ message: errorMessage(e), field });
      if (field) document.getElementById("auth-" + field)?.focus();
    } finally {
      setBusy(false);
    }
  }
  const names = register
    ? (["name", "email", "password", "confirmPassword"] as const)
    : (["email", "password"] as const);
  const labels = {
    name: "Nom affiché",
    email: "Adresse e-mail",
    password: "Mot de passe",
    confirmPassword: "Confirmer le mot de passe",
  };
  return (
    <AuthLayout>
      <nav className="auth-tabs" aria-label="Accéder à mon espace">
        <a
          href="#connexion"
          onClick={() => setError(null)}
          aria-current={!register ? "page" : undefined}
        >
          Connexion
        </a>
        <a
          href="#inscription"
          onClick={() => setError(null)}
          aria-current={register ? "page" : undefined}
        >
          Inscription
        </a>
      </nav>
      <h1 id="auth-title">
        {register ? "Créer mon compte" : "Heureux de vous retrouver."}
      </h1>
      <p className="intro">
        {register
          ? "Un espace pour vous et vos compagnons."
          : "Connectez-vous pour retrouver vos compagnons et leur quotidien."}
      </p>
      <form noValidate onSubmit={submit} aria-busy={busy}>
        {names.map((name) => {
          const password = name === "password" || name === "confirmPassword";
          return (
            <div className="field" key={name}>
              <label htmlFor={"auth-" + name}>{labels[name]}</label>
              <div className={password ? "password-field" : undefined}>
                <input
                  id={"auth-" + name}
                  name={name}
                  type={
                    password
                      ? visible
                        ? "text"
                        : "password"
                      : name === "email"
                        ? "email"
                        : "text"
                  }
                  value={form[name]}
                  onChange={(e) => setForm({ ...form, [name]: e.target.value })}
                  maxLength={password ? 256 : 120}
                  autoComplete={
                    password
                      ? register
                        ? "new-password"
                        : "current-password"
                      : name === "name"
                        ? "name"
                        : "email"
                  }
                  aria-invalid={error?.field === name || undefined}
                  aria-describedby={
                    error?.field === name ? "auth-error" : undefined
                  }
                  required
                />
                {password && (
                  <button
                    className="password-toggle"
                    type="button"
                    onClick={() => setVisible(!visible)}
                    aria-label={
                      visible
                        ? "Masquer le mot de passe"
                        : "Afficher le mot de passe"
                    }
                    aria-pressed={visible}
                  >
                    <Icon name="eye" />
                  </button>
                )}
              </div>
              {register && name === "password" && (
                <p className="field-help">Au moins 12 caractères.</p>
              )}
            </div>
          );
        })}
        {!register && (
          <div className="forgot-line">
            <a className="text-button" href="#reinitialisation">
              Mot de passe oublié ?
            </a>
          </div>
        )}
        {error && (
          <p id="auth-error" className="form-message error" role="alert">
            {error.message}
          </p>
        )}
        <button className="button submit" disabled={busy}>
          {busy
            ? register
              ? "Création du compte…"
              : "Connexion en cours…"
            : register
              ? "Créer mon compte"
              : "Se connecter"}
        </button>
      </form>
      <p className="switch-page">
        {register ? "Déjà un compte ? " : "Pas encore de compte ? "}
        <a
          onClick={() => setError(null)}
          href={register ? "#connexion" : "#inscription"}
        >
          {register ? "Se connecter" : "Créer mon compte"}
        </a>
      </p>
      <div className="demo-note">
        <p>
          <strong>Essayer avec le compte de démonstration.</strong> Ses données
          sont fictives. Votre compte personnel possède son propre espace.
        </p>
        {demo && (
          <button
            type="button"
            className="demo-credentials"
            onClick={() => {
              setError(null);
              setForm({
                name: "Camille Martin",
                email: demo.email,
                password: demo.password,
                confirmPassword: demo.password,
              });
              if (register) window.location.hash = "connexion";
              else document.getElementById("auth-email")?.focus();
            }}
          >
            <span>{demo.email}</span>
            <span>{demo.password}</span>
            <small>Cliquer pour remplir les champs</small>
          </button>
        )}
      </div>
    </AuthLayout>
  );
}

/** Mise en page des pages de compte : en-tête public, logo en deux moitiés et carte centrale. */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-page">
      <a
        className="skip"
        href="#auth-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("auth-content")?.focus();
        }}
      >
        Aller au formulaire
      </a>
      <div className="auth-shell">
        <PublicHeader />
        <div className="brand-half dog" aria-hidden="true">
          <img src="/images/maquettes/91243d045c59766a.png" alt="" />
        </div>
        <div className="brand-half cat" aria-hidden="true">
          <img src="/images/maquettes/91243d045c59766a.png" alt="" />
        </div>
        <img
          className="brand-whole"
          src="/images/maquettes/91243d045c59766a.png"
          alt=""
          aria-hidden="true"
        />
        <main className="auth-layout" id="auth-content" tabIndex={-1}>
          <section className="auth-card" aria-labelledby="auth-title">
            {children}
          </section>
        </main>
        <footer className="auth-footer">
          Anivaya · Votre espace personnel.
          <a href="#accueil">Retour à l’accueil</a>
          <a href="#contact">Contact et informations</a>
        </footer>
      </div>
    </div>
  );
}
