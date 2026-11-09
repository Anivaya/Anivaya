import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { AuthUser } from "../../../../shared/account.ts";
import { PASSWORD_RULE, passwordProblem } from "../../../../shared/account.ts";
import { errorMessage, errorField } from "../../shared/types.ts";
import type { FormError } from "../../shared/types.ts";
import { api } from "../../shared/services/api.ts";
import PublicHeader from "../../shared/layout/PublicHeader.tsx";
import Icon from "../../shared/ui/Icon.tsx";
import { useText } from "../../shared/i18n/HomeLocale.tsx";
export default function AuthPage({
  register: requestedRegister,
  onAuthenticated,
}: {
  register: boolean;
  onAuthenticated: (user: AuthUser) => void;
}) {
  const tr = useText();
  const [register, setRegister] = useState(requestedRegister);
  const [mfaCode, setMfaCode] = useState(""),
    [mfaRequired, setMfaRequired] = useState(false);
  useEffect(() => {
    if (mfaRequired) document.getElementById("auth-mfaCode")?.focus();
  }, [mfaRequired]);
  const previousMode = useRef(register);
  const card = useRef<HTMLElement>(null);
  // Changement d’onglet : le logo glisse verticalement jusqu’au centre du nouveau formulaire.
  const logoTop = useRef<number | null>(null);
  useLayoutEffect(() => {
    const halves = [
      ...(card.current
        ?.closest(".auth-shell")
        ?.querySelectorAll<HTMLElement>(".brand-half") ?? []),
    ];
    const previous = logoTop.current;
    const top = halves[0]?.offsetTop ?? null;
    logoTop.current = top;
    if (
      previous === null ||
      top === null ||
      previous === top ||
      !matchMedia(
        "(min-width:1024px) and (prefers-reduced-motion:no-preference)",
      ).matches
    )
      return;
    const animations = halves.map((half) =>
      half.animate(
        [
          { transform: `translateY(${previous - top}px)` },
          { transform: "translateY(0)" },
        ],
        { duration: 700, easing: "cubic-bezier(.4,0,.2,1)" },
      ),
    );
    return () => animations.forEach((animation) => animation.cancel());
  }, [register]);
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
      postalCode: "",
      email: "",
      password: "",
      confirmPassword: "",
    }),
    [visible, setVisible] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<FormError | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || switching) return;
    setError(null);
    // La règle du mot de passe est vérifiée avant l’envoi (et de nouveau par l’API).
    const problem = register ? passwordProblem(form.password) : null;
    if (problem) {
      setError({ message: problem, field: "password" });
      document.getElementById("auth-password")?.focus();
      return;
    }
    setBusy(true);
    try {
      const user = register
        ? await api.register(form)
        : await api.login({ ...form, remember: false, mfaCode });
      onAuthenticated(user);
    } catch (e) {
      const field = errorField(e);
      if (field === "mfaCode") setMfaRequired(true);
      setError({ message: errorMessage(e), field });
      if (field) document.getElementById("auth-" + field)?.focus();
    } finally {
      setBusy(false);
    }
  }
  const names = register
    ? (["name", "postalCode", "email", "password", "confirmPassword"] as const)
    : (["email", "password"] as const);
  const labels = {
    name: "Nom affiché",
    postalCode: "Code postal (facultatif)",
    email: "Adresse e-mail",
    password: "Mot de passe",
    confirmPassword: "Confirmer le mot de passe",
  };
  return (
    <AuthLayout cardRef={card} opening={opening} switching={switching} aligned>
      <nav className="auth-tabs" aria-label={tr("Accéder à mon espace")}>
        <a
          href="#connexion"
          onClick={() => setError(null)}
          aria-current={!register ? "page" : undefined}
        >
          {tr("Connexion")}
        </a>
        <a
          href="#inscription"
          onClick={() => setError(null)}
          aria-current={register ? "page" : undefined}
        >
          {tr("Inscription")}
        </a>
      </nav>
      <h1 id="auth-title">
        {tr(register ? "Créer mon compte" : "Heureux de vous retrouver.")}
      </h1>
      <p className="intro">
        {tr(
          register
            ? "Un espace pour vous et vos compagnons."
            : "Connectez-vous pour retrouver vos compagnons et leur quotidien.",
        )}
      </p>
      <form
        className={register ? "registration-fields" : undefined}
        noValidate
        onSubmit={submit}
        aria-busy={busy}
      >
        {names.map((name) => {
          const password = name === "password" || name === "confirmPassword";
          return (
            <div className={"field auth-field-" + name} key={name}>
              <label htmlFor={"auth-" + name}>{tr(labels[name])}</label>
              <div className={password ? "password-field" : undefined}>
                <input
                  id={"auth-" + name}
                  name={name}
                  inputMode={name === "postalCode" ? "numeric" : undefined}
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
                  maxLength={name === "postalCode" ? 5 : password ? 256 : 120}
                  autoComplete={
                    password
                      ? register
                        ? "new-password"
                        : "current-password"
                      : name === "postalCode"
                        ? "postal-code"
                        : name === "name"
                          ? "name"
                          : "email"
                  }
                  aria-invalid={error?.field === name || undefined}
                  aria-describedby={
                    error?.field === name ? "auth-error" : undefined
                  }
                  required={name !== "postalCode"}
                />
                {password && (
                  <button
                    className="password-toggle"
                    type="button"
                    onClick={() => setVisible(!visible)}
                    aria-label={tr(
                      visible
                        ? "Masquer le mot de passe"
                        : "Afficher le mot de passe",
                    )}
                    aria-pressed={visible}
                  >
                    <Icon name={visible ? "eye-off" : "eye"} />
                  </button>
                )}
              </div>
              {register && name === "password" && (
                <p className="field-help">{tr(PASSWORD_RULE)}</p>
              )}
            </div>
          );
        })}
        {!register && (
          <div className="forgot-line">
            <a className="text-button" href="#reinitialisation">
              {tr("Mot de passe oublié ?")}
            </a>
          </div>
        )}
        {!register && mfaRequired && (
          <div className="field">
            <label htmlFor="auth-mfaCode">
              {tr("Code de vérification ou code de secours")}
            </label>
            <input
              id="auth-mfaCode"
              name="mfaCode"
              autoComplete="one-time-code"
              maxLength={32}
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value)}
              aria-invalid={error?.field === "mfaCode" || undefined}
              aria-describedby={
                error?.field === "mfaCode" ? "auth-error" : undefined
              }
            />
          </div>
        )}
        {error && (
          <p id="auth-error" className="form-message error" role="alert">
            {tr(error.message)}
          </p>
        )}
        <button className="button submit" disabled={busy}>
          {tr(
            busy
              ? register
                ? "Création du compte…"
                : "Connexion en cours…"
              : register
                ? "Créer mon compte"
                : "Se connecter",
          )}
        </button>
      </form>
      <p className="switch-page">
        {tr(register ? "Déjà un compte ?" : "Pas encore de compte ?")}{" "}
        <a
          onClick={() => setError(null)}
          href={register ? "#connexion" : "#inscription"}
        >
          {tr(register ? "Se connecter" : "Créer mon compte")}
        </a>
      </p>
    </AuthLayout>
  );
}

/**
 * Mise en page des pages de compte : en-tête public, logo en deux moitiés et carte centrale.
 * Le logo est centré sur le formulaire ; `aligned` (connexion) le garde sous l’en-tête,
 * sinon (mot de passe oublié) l’ensemble est centré dans la page avec un logo plus petit.
 */
export function AuthLayout({
  children,
  cardRef,
  opening = false,
  switching = false,
  aligned = false,
  menuLogin = false,
}: {
  children: ReactNode;
  cardRef?: React.RefObject<HTMLElement | null>;
  opening?: boolean;
  switching?: boolean;
  aligned?: boolean;
  /** Ajoute « Se connecter » au menu mobile (mot de passe oublié). */
  menuLogin?: boolean;
}) {
  const tr = useText();
  return (
    <div
      className={
        "auth-page" +
        (opening ? " auth-opening" : "") +
        (aligned ? " auth-aligned" : " auth-centered")
      }
    >
      <a
        className="skip"
        href="#auth-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("auth-content")?.focus();
        }}
      >
        {tr("Aller au formulaire")}
      </a>
      <div className="auth-shell">
        <PublicHeader account menuLogin={menuLogin} />
        <div className="brand-half dog" aria-hidden="true">
          <img src="/images/maquettes/91243d045c59766a.png" alt="" />
        </div>
        <div className="brand-half cat" aria-hidden="true">
          <img src="/images/maquettes/91243d045c59766a.png" alt="" />
        </div>
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
      </div>
    </div>
  );
}
