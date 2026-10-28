import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { AuthUser, DemoAccount } from "../../../../shared/account.ts";
import { errorMessage, errorField } from "../../shared/types.ts";
import type { FormError } from "../../shared/types.ts";
import { api } from "../../shared/services/api.ts";
import PublicHeader from "../../shared/layout/PublicHeader.tsx";
import Icon from "../../shared/ui/Icon.tsx";
export default function AuthPage({
  register: requestedRegister,
  onAuthenticated,
}: {
  register: boolean;
  onAuthenticated: (user: AuthUser) => void;
}) {
  const [register, setRegister] = useState(requestedRegister);
  const previousMode = useRef(register);
  const card = useRef<HTMLElement>(null);
  const [opening] = useState(!requestedRegister);
  const switching = register !== requestedRegister;
  useLayoutEffect(() => {
    const element = card.current;
    if (!element) return;
    const motion = matchMedia(
      "(min-width:1024px) and (prefers-reduced-motion:no-preference)",
    );
    let cancelled = false;
    let animation: Animation | undefined;
    const direction = requestedRegister ? -1 : 1;
    if (switching) {
      const commit = () => {
        if (!cancelled) setRegister(requestedRegister);
      };
      if (motion.matches) {
        animation = element.animate(
          [
            { transform: "rotateY(0deg)", opacity: 1 },
            { transform: `rotateY(${direction * 90}deg)`, opacity: 0.3 },
          ],
          {
            duration: 250,
            easing: "cubic-bezier(.4,0,.2,1)",
            fill: "forwards",
          },
        );
        void animation.finished.then(commit).catch(() => {});
      } else commit();
    } else if (previousMode.current !== register) {
      if (motion.matches)
        animation = element.animate(
          [
            { transform: `rotateY(${-direction * 90}deg)`, opacity: 0.3 },
            { transform: "rotateY(0deg)", opacity: 1 },
          ],
          { duration: 250, easing: "cubic-bezier(.4,0,.2,1)" },
        );
      element
        .querySelector<HTMLElement>('.auth-tabs [aria-current="page"]')
        ?.focus({ preventScroll: true });
    }
    previousMode.current = register;
    const finish = () => animation?.finish();
    motion.addEventListener("change", finish);
    return () => {
      cancelled = true;
      animation?.cancel();
      motion.removeEventListener("change", finish);
    };
  }, [register, requestedRegister, switching]);
  const [form, setForm] = useState({
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    }),
    [visible, setVisible] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<FormError | null>(null),
    [demoAccounts, setDemoAccounts] = useState<DemoAccount[]>([]);
  useEffect(() => {
    let active = true;
    api
      .demo()
      .then((accounts) => {
        if (active) setDemoAccounts(accounts);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || switching) return;
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
    <AuthLayout cardRef={card} opening={opening} switching={switching}>
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
      {demoAccounts.length > 0 && (
        <section
          className="demo-accounts"
          aria-labelledby="demo-accounts-title"
        >
          <h2 id="demo-accounts-title">Comptes de démonstration</h2>
          <p>
            Choisissez un compte pour explorer les fonctionnalités. Chacun
            dispose de son propre espace d’exemple.
          </p>
          <ul>
            {demoAccounts.map((account, index) => (
              <li className="demo-account" key={account.email}>
                <div>
                  <strong>
                    Compte {index + 1} · {account.name}
                  </strong>
                  <span>
                    Identifiant : <b>{account.email}</b>
                  </span>
                  <span>
                    Mot de passe : <code>{account.password}</code>
                  </span>
                </div>
                <button
                  className="text-button"
                  type="button"
                  aria-label={`Utiliser le compte ${account.name}`}
                  onClick={() => {
                    setError(null);
                    setForm({
                      name: account.name,
                      email: account.email,
                      password: account.password,
                      confirmPassword: account.password,
                    });
                    if (register) window.location.hash = "connexion";
                    else document.getElementById("auth-email")?.focus();
                  }}
                >
                  Utiliser ce compte
                </button>
              </li>
            ))}
          </ul>
          <p className="demo-disclaimer">
            Leurs données sont fictives. Votre compte personnel possède son
            propre espace.
          </p>
        </section>
      )}
    </AuthLayout>
  );
}

/** Mise en page des pages de compte : en-tête public, logo en deux moitiés et carte centrale. */
export function AuthLayout({
  children,
  cardRef,
  opening = false,
  switching = false,
}: {
  children: ReactNode;
  cardRef?: React.RefObject<HTMLElement | null>;
  opening?: boolean;
  switching?: boolean;
}) {
  return (
    <div className={`auth-page${opening ? " auth-opening" : ""}`}>
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
          <section
            className="auth-card"
            aria-labelledby="auth-title"
            ref={cardRef}
            inert={switching}
          >
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
