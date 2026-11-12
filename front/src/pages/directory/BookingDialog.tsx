import { useText } from "../../shared/i18n/HomeLocale.tsx";
import { addDays, fullDate, money } from "../../shared/utils/format.ts";
import { useEffect, useState } from "react";
import type { Animal } from "../../../../shared/models.ts";
import type {
  Professional,
  Profile,
  Booking,
} from "../../../../shared/account.ts";
import { api } from "../../shared/services/api.ts";
import { errorMessage } from "../../shared/types.ts";
import Modal from "../../shared/ui/Modal.tsx";
import Icon from "../../shared/ui/Icon.tsx";
export default function BookingDialog({
  professional: p,
  animals,
  profile,
  today,
  service = 0,
  booking,
  onClose,
  onSaved,
}: {
  professional: Professional;
  animals: Animal[];
  profile: Profile;
  today: string;
  service?: number;
  booking?: Booking;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const tr = useText();
  const eligible = animals.filter((a) => p.species.includes(a.species));
  const [form, setForm] = useState({
    service: booking?.service ?? service,
    animal: booking?.animal ?? eligible[0]?.id ?? "",
    date: booking?.date ?? addDays(today, 1),
    time: booking?.time ?? "",
    contactName: profile.name,
    email: profile.email,
    note: "",
  });
  const [step, setStep] = useState(1),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [availability, setAvailability] = useState<{
      key: string;
      slots: { time: string; available: boolean }[];
    } | null>(null),
    [retry, setRetry] = useState(0),
    [result, setResult] = useState<Booking | null>(null);
  const slotKey =
      p.id + ":" + form.date + ":" + (booking?.id || "") + ":" + retry,
    loading = availability?.key !== slotKey,
    slots = loading ? [] : availability!.slots;
  useEffect(() => {
    const controller = new AbortController();
    api
      .slots(p.id, form.date, booking?.id, controller.signal)
      .then((slots) => {
        if (!controller.signal.aborted)
          setAvailability({ key: slotKey, slots });
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setAvailability({ key: slotKey, slots: [] });
          setError(errorMessage(e));
        }
      });
    return () => controller.abort();
  }, [p.id, form.date, booking?.id, retry, slotKey]);
  function edit<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((old) => ({
      ...old,
      [key]: value,
      ...(key === "date" ? { time: "" } : {}),
    }));
    setError("");
  }
  async function submit() {
    setBusy(true);
    setError("");
    try {
      const saved = booking
        ? await api.changeBooking(booking.id, {
            date: form.date,
            time: form.time,
          })
        : await api.book({ ...form, professional: p.id });
      setResult(saved);
      setStep(3);
      await onSaved().catch(() =>
        setError(
          "Le rendez-vous est enregistré. Actualisez la liste pour retrouver sa dernière version.",
        ),
      );
    } catch (e) {
      setError(errorMessage(e));
      setRetry((v) => v + 1);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal className="directory-dialog" busy={busy} onClose={onClose}>
      <h2 id="action-title">
        {booking
          ? tr("Déplacer le rendez-vous")
          : step === 3
            ? tr("Votre rendez-vous est confirmé")
            : tr("Prendre rendez-vous")}
      </h2>
      <p className="muted">{p.name}</p>
      {p.fictional && (
        <p className="muted">
          {tr("Professionnel fictif : aucun rendez-vous réel ne sera organisé.")}
        </p>
      )}
      <ol className="stepper">
        {[
          "Rendez-vous",
          "Vérification",
          "Confirmation",
        ].map((label, i) => (
          <li key={label} aria-current={step === i + 1 ? "step" : undefined}>
            {tr(label)}
          </li>
        ))}
      </ol>
      {step === 1 && (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (
              !form.time ||
              !slots.some((s) => s.time === form.time && s.available)
            ) {
              setError("Choisissez un créneau disponible.");
              return;
            }
            setError("");
            setStep(2);
          }}
        >
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="service">{tr("Prestation")}</label>
              <select
                id="service"
                value={form.service}
                disabled={!!booking}
                onChange={(e) => edit("service", Number(e.target.value))}
              >
                {p.services.map((s, i) => (
                  <option key={s.name} value={i}>
                    {s.name} · {money(s.price)}
                  </option>
                ))}
              </select>
              {/* La durée sort de la liste pour qu’elle reste lisible sur mobile. */}
              <p className="field-help">
                {tr("Durée : ")}
                {p.services[form.service]?.duration}
                {tr(" min")}
              </p>
            </div>
            <div className="field">
              <label htmlFor="animal">{tr("Pour quel animal ?")}</label>
              <select
                id="animal"
                value={form.animal}
                disabled={!!booking}
                required
                onChange={(e) => edit("animal", e.target.value)}
              >
                <option value="" disabled>
                  {tr("Choisir un animal")}
                </option>
                {eligible.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} · {tr(a.species)}
                  </option>
                ))}
              </select>
              {!eligible.length && (
                <p className="field-help">
                  {tr("Aucun animal compatible.")}{" "}
                  <a href="#animaux" onClick={onClose}>
                    {tr("Ajouter un animal")}
                  </a>
                </p>
              )}
            </div>
            <div className="field">
              <label htmlFor="date">{tr("Date souhaitée")}</label>
              <input
                id="date"
                type="date"
                min={addDays(today, 1)}
                max={addDays(today, 60)}
                value={form.date}
                required
                onChange={(e) => edit("date", e.target.value)}
              />
            </div>
            <fieldset className="full">
              <legend>{tr("Choisissez un horaire")}</legend>
              {loading ? (
                <p role="status" className="slots-loading">
                  {tr("Recherche des disponibilités…")}
                </p>
              ) : (
                <div className="slots">
                  {slots.map((slot) => (
                    <label className="slot" key={slot.time}>
                      <input
                        type="radio"
                        name="time"
                        value={slot.time}
                        disabled={!slot.available}
                        checked={form.time === slot.time}
                        onChange={() => edit("time", slot.time)}
                      />
                      <span>{slot.time}</span>
                    </label>
                  ))}
                </div>
              )}
              <p className="field-help">
                {tr(
                  "Horaires de Paris. Les créneaux grisés ne sont pas disponibles.",
                )}
              </p>
            </fieldset>
            {!booking && (
              <>
                <div className="field">
                  <label htmlFor="contactName">{tr("Votre nom")}</label>
                  <input
                    id="contactName"
                    autoComplete="name"
                    maxLength={80}
                    required
                    value={form.contactName}
                    onChange={(e) => edit("contactName", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="email">{tr("Votre e-mail")}</label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    maxLength={120}
                    required
                    value={form.email}
                    onChange={(e) => edit("email", e.target.value)}
                  />
                </div>
                <div className="field full">
                  <label htmlFor="note">
                    {tr("Un mot pour le professionnel (facultatif)")}
                  </label>
                  <textarea
                    data-resize-none
                    id="note"
                    maxLength={500}
                    value={form.note}
                    onChange={(e) => edit("note", e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
          {error && (
            <p role="alert" className="error">
              {tr(error)}
            </p>
          )}
          <div className="dialog-actions">
            <button
              type="button"
              className="button outline back cancel"
              onClick={onClose}
            >
              {tr("Annuler")}
            </button>
            <button
              className="button"
              disabled={loading || (!booking && !eligible.length)}
            >
              {tr("Continuer ")}
              <Icon name="arrow" />
            </button>
          </div>
        </form>
      )}
      {step === 2 && (
        <>
          <dl className="detail-grid">
            <div>
              <dt>{tr("Prestation")}</dt>
              <dd>{p.services[form.service].name}</dd>
            </div>
            <div>
              <dt>{tr("Animal")}</dt>
              <dd>
                {booking?.animalName ||
                  eligible.find((a) => a.id === form.animal)?.name}
              </dd>
            </div>
            <div>
              <dt>{tr("Date")}</dt>
              <dd>
                {fullDate(form.date)}
                {tr(" à ")}
                {form.time}
              </dd>
            </div>
            <div>
              <dt>{tr("Lieu")}</dt>
              <dd>
                {p.mode === "En visio" ? tr("En visioconférence") : p.address}
              </dd>
            </div>
          </dl>
          <div className="total">
            <span>{tr("Total")}</span>
            <strong>{money(p.services[form.service].price)}</strong>
          </div>
          {!booking && (
            <div className="payment-card">
              <Icon name="card" />
              <p>
                {tr("Aucun paiement en ligne")}
                <small>
                  {tr("La confirmation est envoyée par e-mail à")}{" "}
                  {form.email || tr("votre adresse")}.
                </small>
              </p>
            </div>
          )}
          {error && (
            <p className="error" role="alert">
              {tr(error)}
            </p>
          )}
          <div className="dialog-actions">
            <button
              className="button outline back icon-back"
              disabled={busy}
              aria-label={tr("Revenir au choix du créneau")}
              onClick={() => {
                setError("");
                setStep(1);
              }}
            >
              <Icon name="back" />
            </button>
            <button
              className="button"
              disabled={busy}
              onClick={() => void submit()}
            >
              {busy
                ? tr("Enregistrement…")
                : booking
                  ? tr("Confirmer le déplacement")
                  : tr("Confirmer la réservation")}
            </button>
          </div>
        </>
      )}
      {step === 3 && result && (
        <div className="confirmation">
          {error && (
            <p className="error" role="alert">
              {tr(error)}
            </p>
          )}
          <Icon name="check" />
          <h3>{booking ? tr("Rendez-vous déplacé") : tr("C’est réservé !")}</h3>
          <p>
            {p.services[result.service].name}
            {tr(" pour ")}
            {result.animalName}
            <br />
            {fullDate(result.date)}
            {tr(" à ")}
            {result.time}
          </p>
          <p className="muted">
            {tr(
              "La réservation est enregistrée dans votre espace. La confirmation est adressée à ",
            )}
            {result.email}.
          </p>
          <div className="dialog-actions">
            <button className="button outline close-action" onClick={onClose}>
              {tr("Fermer")}
            </button>
            <a className="button" href="#reservations" onClick={onClose}>
              {tr("Mes réservations")}
            </a>
          </div>
        </div>
      )}
    </Modal>
  );
}
