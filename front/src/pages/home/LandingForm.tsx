import { useHomeText } from "../../shared/i18n/HomeLocale.tsx";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { LeadInput, LeadKind } from "../../../../shared/public.ts";
import { api } from "../../shared/services/api.ts";
import { errorField, errorMessage } from "../../shared/types.ts";
import type { FormError } from "../../shared/types.ts";
import { errorFields } from "../../../../shared/models.ts";
import { validateLead } from "../../../../shared/lead-validation.ts";

const activities = [
  ["pet-sitter", "Pet-sitter, garde à domicile"],
  ["promeneur", "Promeneur"],
  ["educateur", "Éducateur canin ou comportementaliste"],
  ["toiletteur", "Toiletteur"],
  ["pension", "Pension"],
  ["autre", "Autre"],
];
const organizations = [
  ["assureur", "Assureur"],
  ["mutuelle", "Mutuelle"],
  ["cse", "CSE ou employeur"],
  ["enseigne", "Enseigne ou distribution"],
  ["autre", "Autre"],
];
const profiles = [
  ["proprietaire", "Propriétaire d’un animal"],
  ["professionnel", "Professionnel animalier"],
  ["clinique", "Clinique vétérinaire"],
  ["entreprise", "Entreprise ou partenaire"],
];
const labels = {
  "liste-attente": "M’inscrire sur la liste d’attente",
  pro: "Inscrire mon activité",
  clinique: "Proposer ma clinique",
  entreprise: "Envoyer la demande",
};
const consentLabels = {
  "liste-attente":
    "J’accepte de recevoir des e-mails sur le lancement d’Anivaya.",
  pro: "J’accepte d’être contacté par Anivaya au sujet de mon inscription.",
  clinique:
    "J’accepte d’être contacté par Anivaya au sujet de la phase pilote.",
  entreprise: "J’accepte d’être contacté par Anivaya au sujet de ma demande.",
};

/** Variante vitrine : mêmes erreurs API que SubmissionForm, avec confirmation dans la page. */
export default function LandingForm({ kind }: { kind: LeadKind }) {
  const t = useHomeText();
  const form = useRef<HTMLFormElement>(null);
  const success = useRef<HTMLDivElement>(null);
  const pending = useRef<AbortController | null>(null);
  const requestId = useRef("");
  const [profile, setProfile] = useState("proprietaire");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [validated, setValidated] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<FormError | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  useEffect(() => {
    if (saved) {
      success.current?.focus({ preventScroll: true });
      success.current?.scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "center",
      });
    }
  }, [saved]);

  function valuesOf(element: HTMLFormElement): LeadInput {
    const values = new FormData(element);
    const value = (name: string) => String(values.get(name) ?? "");
    return {
      kind,
      requestId: requestId.current,
      name: value("name"),
      email: value("email"),
      postalCode: value("postalCode"),
      profile: value("profile") || "proprietaire",
      animals: values.getAll("animals").map(String),
      plan: value("offre_visee"),
      activity: value("activity"),
      organization: value("organization"),
      organizationType: value("organizationType"),
      phone: value("phone"),
      message: value("message"),
      consent: values.get("consent") === "yes",
    };
  }
  function focusField(field?: string) {
    requestAnimationFrame(() => {
      const first = form.current?.querySelector<HTMLElement>(
        '[aria-invalid="true"]',
      );
      if (first) {
        first.focus();
        return;
      }
      const target = field ? form.current?.elements.namedItem(field) : null;
      if (target instanceof HTMLElement) target.focus();
      else form.current?.querySelector<HTMLElement>('[role="alert"]')?.focus();
    });
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || saved) return;
    setValidated(true);
    setError(null);
    const input = valuesOf(event.currentTarget);
    const nextFields = validateLead({ ...input });
    setFields(nextFields);
    if (Object.keys(nextFields).length) {
      focusField(Object.keys(nextFields)[0]);
      return;
    }
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    requestId.current ||= crypto.randomUUID();
    input.requestId = requestId.current;
    try {
      await api.submitLead(input, controller.signal);
      if (!controller.signal.aborted) setSaved(true);
    } catch (failure) {
      if (controller.signal.aborted) return;
      const field = errorField(failure);
      const serverFields = errorFields(failure);
      if (field && !Object.keys(serverFields).length)
        serverFields[field] = errorMessage(failure);
      setFields(serverFields);
      setError(
        Object.keys(serverFields).length
          ? null
          : { message: errorMessage(failure) },
      );
      focusField(field);
    } finally {
      pending.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  const invalid = (name: string) => ({
    "aria-invalid": !!fields[name] || undefined,
    "aria-describedby": fields[name] ? `${kind}-${name}-error` : undefined,
  });
  const fieldMessage = (name: string) =>
    fields[name] ? (
      <p className="field__error" id={`${kind}-${name}-error`}>
        {t(fields[name])}
      </p>
    ) : null;
  function field(
    name: string,
    label: string,
    options: {
      optional?: boolean;
      type?: string;
      max?: number;
      autocomplete?: string;
      choices?: string[][];
    } = {},
  ) {
    return (
      <div className={"field" + (fields[name] ? " has-error" : "")}>
        <label htmlFor={`${kind}-${name}`}>
          {t(label)}
          {options.optional && (
            <span className="field__opt">{t(" (facultatif)")}</span>
          )}
        </label>
        {options.choices ? (
          <select
            id={`${kind}-${name}`}
            name={name}
            required
            {...invalid(name)}
            defaultValue=""
          >
            <option value="">{t("Choisir")}</option>
            {options.choices.map(([value, text]) => (
              <option key={value} value={value}>
                {t(text)}
              </option>
            ))}
          </select>
        ) : (
          <input
            id={`${kind}-${name}`}
            name={name}
            type={options.type || "text"}
            required={!options.optional}
            maxLength={options.max || 120}
            autoComplete={options.autocomplete}
            inputMode={name === "postalCode" ? "numeric" : undefined}
            {...invalid(name)}
          />
        )}
        {fieldMessage(name)}
      </div>
    );
  }
  const name = () =>
    field(
      "name",
      kind === "liste-attente"
        ? "Nom affiché"
        : kind === "pro"
          ? "Nom et prénom"
          : "Votre nom",
      { max: kind === "liste-attente" ? 60 : 80, autocomplete: "name" },
    );
  const email = () =>
    field(
      "email",
      ["clinique", "entreprise"].includes(kind)
        ? "E-mail professionnel"
        : "Adresse e-mail",
      { type: "email", autocomplete: "email" },
    );
  const postal = () =>
    field("postalCode", "Code postal", {
      optional: true,
      max: 5,
      autocomplete: "postal-code",
    });
  return (
    <>
      <form
        className="form"
        ref={form}
        onChange={(event) => {
          requestId.current = "";
          if (validated)
            setFields(validateLead({ ...valuesOf(event.currentTarget) }));
          setError(null);
        }}
        noValidate
        onSubmit={submit}
        aria-busy={busy}
        hidden={saved}
        data-form={kind}
      >
        <input type="hidden" name="offre_visee" defaultValue="" />
        <fieldset className="landing-fields" disabled={busy}>
          <legend className="visually-hidden">{t(labels[kind])}</legend>
          {kind === "liste-attente" && (
            <>
              <div className="form__row">
                {name()}
                {postal()}
              </div>
              {email()}
              <fieldset
                className={"field" + (fields.profile ? " has-error" : "")}
              >
                <legend className="field__legend">{t("Vous êtes")}</legend>
                <div className="chips">
                  {profiles.map(([value, label]) => (
                    <label className="chip" key={value}>
                      <input
                        type="radio"
                        name="profile"
                        value={value}
                        checked={profile === value}
                        onChange={() => setProfile(value)}
                        {...invalid("profile")}
                      />
                      <span>{t(label)}</span>
                    </label>
                  ))}
                </div>
                {fieldMessage("profile")}
              </fieldset>
              {profile === "proprietaire" && (
                <fieldset
                  className={"field" + (fields.animals ? " has-error" : "")}
                >
                  <legend className="field__legend">
                    {t("Vos animaux ")}
                    <span className="field__opt">{t("(facultatif)")}</span>
                  </legend>
                  <div className="chips">
                    {[
                      ["chien", "Chien", "dog"],
                      ["chat", "Chat", "cat"],
                    ].map(([value, label, icon]) => (
                      <label className="chip" key={value}>
                        <input
                          type="checkbox"
                          name="animals"
                          value={value}
                          {...invalid("animals")}
                        />
                        <span>
                          <svg className="ic" aria-hidden="true">
                            <use href={`#i-${icon}`} />
                          </svg>
                          {t(label)}
                        </span>
                      </label>
                    ))}
                  </div>
                  {fieldMessage("animals")}
                </fieldset>
              )}
            </>
          )}
          {kind === "pro" && (
            <>
              <div className="form__row">
                {name()}
                {field("activity", "Activité", { choices: activities })}
              </div>
              <div className="form__row">
                {email()}
                {postal()}
              </div>
            </>
          )}
          {kind === "clinique" && (
            <>
              {field("organization", "Nom de la clinique", {
                autocomplete: "organization",
              })}
              <div className="form__row">
                {name()}
                {postal()}
              </div>
              <div className="form__row">
                {email()}
                {field("phone", "Téléphone", {
                  optional: true,
                  type: "tel",
                  autocomplete: "tel",
                  max: 20,
                })}
              </div>
            </>
          )}
          {kind === "entreprise" && (
            <>
              <div className="form__row">
                {field("organization", "Organisation", {
                  autocomplete: "organization",
                })}
                {field("organizationType", "Type", { choices: organizations })}
              </div>
              <div className="form__row">
                {name()}
                {email()}
              </div>
              <div className={"field" + (fields.message ? " has-error" : "")}>
                <label htmlFor={`${kind}-message`}>
                  {t("Votre projet ")}
                  <span className="field__opt">{t("(facultatif)")}</span>
                </label>
                <textarea
                  id={`${kind}-message`}
                  name="message"
                  maxLength={1500}
                  rows={4}
                  style={{ resize: "none" }}
                  {...invalid("message")}
                />
                {fieldMessage("message")}
              </div>
            </>
          )}
          <div className={"field" + (fields.consent ? " has-error" : "")}>
            <label className={"consent" + (fields.consent ? " has-error" : "")}>
              <input
                type="checkbox"
                name="consent"
                value="yes"
                required
                {...invalid("consent")}
              />
              <span>
                {t(consentLabels[kind])}{" "}
                {kind === "liste-attente" ? (
                  <>
                    {t(
                      "Je peux me désinscrire en un clic depuis mon lien personnel.",
                    )}{" "}
                    <a href="#desinscription">{t("Gérer mon inscription")}</a>
                    {t(".")}
                  </>
                ) : (
                  <>
                    {t("Je peux retirer mon consentement en")}{" "}
                    <a href="#contact">{t("contactant l’équipe")}</a>
                    {t(".")}
                  </>
                )}{" "}
                <a href="#accueil/confidentialite">
                  {t("Politique de confidentialité")}
                </a>
              </span>
            </label>
            {fieldMessage("consent")}
          </div>
        </fieldset>
        <div className="landing-form-feedback" aria-live="polite">
          {Object.keys(fields).length > 0 && (
            <p role="alert" tabIndex={-1} className="form-error">
              {t("Vérifiez les champs indiqués avant d’envoyer le formulaire.")}
            </p>
          )}
          {error && (
            <p
              className="form-error"
              role="alert"
              id={`${kind}-error`}
              tabIndex={-1}
            >
              {t(error.message)}
            </p>
          )}
        </div>
        <button
          className="btn btn--primary btn--block form__submit"
          type="submit"
          disabled={busy}
        >
          {t(busy ? "Enregistrement…" : labels[kind])}
        </button>
      </form>
      {saved && (
        <div
          className="form-success is-visible"
          role="status"
          tabIndex={-1}
          ref={success}
        >
          <span className="form-success__icon">
            <svg className="ic" aria-hidden="true">
              <use href="#i-check" />
            </svg>
          </span>
          <h3>
            {t(
              kind === "liste-attente"
                ? "Merci pour votre inscription"
                : "Merci pour votre intérêt",
            )}
          </h3>
          <p>
            {t(
              kind === "liste-attente"
                ? "Votre inscription à la liste d’attente a bien été enregistrée."
                : "Votre demande a bien été enregistrée et transmise à l’équipe Anivaya.",
            )}
          </p>
          {kind === "liste-attente" && (
            <p>
              {t(
                "Vous pouvez gérer votre inscription depuis votre lien personnel de désinscription. ",
              )}
              <a href="#desinscription">{t("Recevoir un lien")}</a>
            </p>
          )}
        </div>
      )}
    </>
  );
}
