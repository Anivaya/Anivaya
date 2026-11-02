import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { Profile, ProfileInput } from "../../../../shared/account.ts";
import type { UploadedFile } from "../../../../shared/models.ts";
import { api, readFile } from "../../shared/services/api.ts";
import { errorMessage, errorField } from "../../shared/types.ts";
import type { FormError } from "../../shared/types.ts";
import Modal from "../../shared/ui/Modal.tsx";
import Tabs from "../../shared/ui/Tabs.tsx";
import { ExportPanel, DeletionPanel } from "./AccountPanels.tsx";
import MfaPanel from "./MfaPanel.tsx";
import { initials } from "../../shared/utils/format.ts";
const notices = {
  reminders: [
    "Rappels de vos animaux",
    "Vaccins, traitements et autres échéances à ne pas oublier.",
  ],
  reservations: [
    "Rendez-vous et réservations",
    "Confirmations, modifications et annulations de vos rendez-vous.",
  ],
  shares: [
    "Partages et personnes de confiance",
    "Les nouveautés concernant vos documents et les accès de vos proches.",
  ],
};
const profileTabs = [
  ["profile", "Profil"],
  ["notifications", "Notifications"],
  ["securite", "Sécurité"],
  ["exportation", "Exportation"],
  ["suppression", "Suppression du compte"],
] as const;
type ProfileTab = (typeof profileTabs)[number][0];

export default function ProfilePage({
  profile,
  demo,
  initialTab,
  onSaved,
  onDeleted,
  embedded = false,
  security,
}: {
  profile: Profile;
  demo: boolean;
  /** Onglet ouvert d’emblée, par exemple `notifications` (lien « Mes préférences »). */
  initialTab?: string;
  onSaved: (profile: Profile) => Promise<void>;
  onDeleted: () => void;
  /** Dans l’administration : sans titre de page, le titre étant celui de l’administration. */
  embedded?: boolean;
  /** Contenu de l’onglet Sécurité ; par défaut, la double authentification. */
  security?: ReactNode;
}) {
  const [photoLoading, setPhotoLoading] = useState(false);
  const logoutAction = useRef<(() => Promise<void>) | null>(null);
  const [form, setForm] = useState(profile),
    [photo, setPhoto] = useState<UploadedFile | null | undefined>(),
    [tab, setTab] = useState<ProfileTab>(
      profileTabs.find(([key]) => key === initialTab)?.[0] ?? "profile",
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<FormError | null>(null),
    [message, setMessage] = useState(""),
    [leave, setLeave] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null),
    allowLeave = useRef(false),
    photoVersion = useRef(0);
  const dirty =
    JSON.stringify(form) !== JSON.stringify(profile) || photo !== undefined;
  useEffect(() => {
    if (!dirty) return;
    const current = window.location.hash;
    const logout = (event: Event) => {
      event.preventDefault();
      logoutAction.current = (event as CustomEvent<() => Promise<void>>).detail;
      setLeave("logout");
    };
    window.addEventListener("anivaya-before-logout", logout);
    const before = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const click = (e: MouseEvent) => {
      const a = e.target instanceof Element ? e.target.closest("a") : null;
      if (a?.hash && a.hash !== current && a.origin === location.origin) {
        e.preventDefault();
        e.stopPropagation();
        setLeave(a.hash);
      }
    };
    const hash = () => {
      if (allowLeave.current) return;
      const target = location.hash;
      history.replaceState(null, "", current);
      setLeave(target);
    };
    window.addEventListener("beforeunload", before);
    document.addEventListener("click", click, true);
    window.addEventListener("hashchange", hash, true);
    return () => {
      window.removeEventListener("anivaya-before-logout", logout);
      window.removeEventListener("beforeunload", before);
      document.removeEventListener("click", click, true);
      window.removeEventListener("hashchange", hash, true);
    };
  }, [dirty]);
  function reset() {
    photoVersion.current++;
    setPhotoLoading(false);
    setForm(profile);
    setPhoto(undefined);
    setError(null);
    setMessage("");
    if (file.current) file.current.value = "";
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy || photoLoading) return;
    setBusy(true);
    setError(null);
    setMessage("");
    try {
      const body: ProfileInput = { ...form, photo };
      const saved = await api.saveProfile(body);
      setForm(saved);
      setPhoto(undefined);
      await onSaved(saved);
      setMessage("Vos modifications ont été enregistrées.");
    } catch (e) {
      const field = errorField(e);
      setError({ message: errorMessage(e), field });
      if (field) document.getElementById("profile-" + field)?.focus();
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="profile-page">
      {!embedded && (
        <div className="welcome">
          <div>
            <h1>Gestion de profil</h1>
            <p>Votre profil et vos préférences, au même endroit.</p>
          </div>
        </div>
      )}
      <Tabs
        label="Gestion de profil"
        tabs={profileTabs}
        active={tab}
        onChange={setTab}
      />
      <form
        noValidate
        onSubmit={save}
        aria-busy={busy || photoLoading}
        hidden={tab !== "profile" && tab !== "notifications"}
      >
        <fieldset className="profile-fieldset" disabled={busy || photoLoading}>
          <div
            id="panel-profile"
            role="tabpanel"
            aria-labelledby="tab-profile"
            hidden={tab !== "profile"}
          >
            <section className="profile-panel">
              <h2>Votre photo de profil</h2>
              <p className="muted">
                Choisissez la photo qui apparaîtra dans votre espace.
              </p>
              <div className="photo-editor">
                <div className="photo-preview">
                  {form.photo ? (
                    <img
                      src={form.photo}
                      alt="Aperçu de votre photo de profil"
                    />
                  ) : (
                    initials(form.name)
                  )}
                </div>
                <div>
                  <div className="photo-actions">
                    <button
                      type="button"
                      className="button outline"
                      onClick={() => file.current?.click()}
                      disabled={busy}
                    >
                      Changer la photo
                    </button>
                    {form.photo && (
                      <button
                        type="button"
                        className="button danger-link"
                        disabled={busy}
                        onClick={() => {
                          photoVersion.current++;
                          setPhoto(null);
                          setForm({ ...form, photo: null });
                        }}
                      >
                        Retirer la photo
                      </button>
                    )}
                  </div>
                  <input
                    ref={file}
                    id="profile-photo"
                    type="file"
                    hidden
                    accept="image/png,image/jpeg,image/webp"
                    aria-label="Choisir une photo de profil"
                    onChange={async (e) => {
                      const candidate = e.target.files?.[0];
                      if (!candidate) return;
                      const version = ++photoVersion.current;
                      setPhotoLoading(true);
                      setError(null);
                      try {
                        if (
                          !["image/png", "image/jpeg", "image/webp"].includes(
                            candidate.type,
                          ) ||
                          candidate.size > 5 * 1024 * 1024
                        )
                          throw new Error(
                            "Choisissez un JPG, PNG ou WebP de 5 Mo maximum.",
                          );
                        const content = await readFile(candidate);
                        if (version !== photoVersion.current) return;
                        setPhoto({ type: candidate.type, content });
                        setForm((previous) => ({
                          ...previous,
                          photo: `data:${candidate.type};base64,${content}`,
                        }));
                      } catch (e) {
                        if (version === photoVersion.current)
                          setError({
                            message: errorMessage(e),
                            field: "photo",
                          });
                      } finally {
                        if (version === photoVersion.current)
                          setPhotoLoading(false);
                      }
                    }}
                  />
                  <p className="field-help">
                    JPG, PNG ou WebP · 5 Mo maximum.
                    <br />
                    La photo sera recadrée au centre pour votre avatar.
                  </p>
                </div>
              </div>
            </section>
            <section className="profile-panel">
              <h2>Vos informations</h2>
              <p className="muted">
                Votre nom est affiché à côté de votre photo dans le menu.
              </p>
              <div className="profile-fields">
                {(["name", "email", "phone", "city"] as const).map((key) => (
                  <div className="field" key={key}>
                    <label htmlFor={"profile-" + key}>
                      {
                        {
                          name: "Nom affiché",
                          email: "Adresse e-mail",
                          phone: "Téléphone (facultatif)",
                          city: "Ville (facultatif)",
                        }[key]
                      }
                    </label>
                    <input
                      id={"profile-" + key}
                      value={form[key]}
                      onChange={(e) => {
                        setForm({ ...form, [key]: e.target.value });
                        setMessage("");
                      }}
                      type={
                        key === "email"
                          ? "email"
                          : key === "phone"
                            ? "tel"
                            : "text"
                      }
                      autoComplete={
                        {
                          name: "name",
                          email: "email",
                          phone: "tel",
                          city: "address-level2",
                        }[key]
                      }
                      maxLength={key === "phone" ? 25 : 120}
                      required={key === "name" || key === "email"}
                      aria-invalid={error?.field === key || undefined}
                      aria-describedby={
                        error?.field === key ? "profile-error" : undefined
                      }
                    />
                  </div>
                ))}
              </div>
            </section>
            <section className="profile-panel">
              <h2>Mot de passe</h2>
              <p className="muted">
                Demandez un lien par e-mail pour choisir un nouveau mot de
                passe.
              </p>
              <a className="button outline" href="#reinitialisation/profil">
                Changer mon mot de passe
              </a>
              <p className="field-help security-note">
                L’envoi d’e-mails n’est pas encore configuré : cette demande est
                simulée.
              </p>
            </section>
          </div>
          <section
            id="panel-notifications"
            role="tabpanel"
            aria-labelledby="tab-notifications"
            hidden={tab !== "notifications"}
          >
            <div className="profile-panel">
              <h2>Vos notifications</h2>
              <p className="muted">
                Choisissez les informations que vous souhaitez retrouver dans
                votre espace.
              </p>
              {(Object.keys(notices) as (keyof Profile["notifications"])[]).map(
                (key) => (
                  <label className="notification-row" key={key}>
                    <span>
                      <strong>{notices[key][0]}</strong>
                      <span id={"notify-" + key + "-help"}>
                        {notices[key][1]}
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      role="switch"
                      checked={form.notifications[key]}
                      aria-describedby={"notify-" + key + "-help"}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          notifications: {
                            ...form.notifications,
                            [key]: e.target.checked,
                          },
                        })
                      }
                    />
                    <span className="switch-track" aria-hidden="true" />
                  </label>
                ),
              )}
              <p className="notification-demo">
                Vos préférences sont enregistrées. Aucune notification réelle
                n’est envoyée pour le moment.
              </p>
            </div>
          </section>
          {error && (
            <p
              id="profile-error"
              className="profile-feedback error"
              role="alert"
            >
              {error.message}
            </p>
          )}
          {message && (
            <p className="profile-feedback success" role="status">
              {message}
            </p>
          )}
          <div className="profile-save">
            <span className="save-note">
              {dirty
                ? "Modifications non enregistrées"
                : "Vos paramètres sont à jour"}
            </span>
            <button
              type="button"
              className="button outline"
              disabled={busy}
              onClick={reset}
            >
              Annuler les modifications
            </button>
            <button className="button" disabled={busy}>
              {busy ? "Enregistrement…" : "Enregistrer les modifications"}
            </button>
          </div>
        </fieldset>
      </form>
      <section
        id="panel-securite"
        role="tabpanel"
        aria-labelledby="tab-securite"
        hidden={tab !== "securite"}
      >
        {tab === "securite" && (security ?? <MfaPanel />)}
      </section>
      <section
        id="panel-exportation"
        role="tabpanel"
        aria-labelledby="tab-exportation"
        hidden={tab !== "exportation"}
      >
        <ExportPanel />
      </section>
      <section
        id="panel-suppression"
        role="tabpanel"
        aria-labelledby="tab-suppression"
        hidden={tab !== "suppression"}
      >
        <DeletionPanel
          demo={demo}
          onExportFirst={() => {
            setTab("exportation");
            // Après l’affichage de l’onglet Exportation.
            setTimeout(() => document.getElementById("export-all")?.focus());
          }}
          onDeleted={() => {
            // Le compte n’existe plus : aucune confirmation de départ à demander.
            allowLeave.current = true;
            onDeleted();
          }}
        />
      </section>
      {leave && (
        <Modal busy={busy} onClose={() => setLeave(null)}>
          <h2 id="action-title">Quitter sans enregistrer ?</h2>
          <p className="dialog-copy">
            Les modifications de votre profil ne seront pas conservées.
          </p>
          <div className="dialog-actions">
            <button className="button outline" onClick={() => setLeave(null)}>
              Continuer la modification
            </button>
            <button
              className="button danger"
              onClick={async () => {
                allowLeave.current = true;
                if (leave === "logout") {
                  setLeave(null);
                  await logoutAction.current?.();
                } else window.location.hash = leave;
              }}
            >
              Quitter sans enregistrer
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
