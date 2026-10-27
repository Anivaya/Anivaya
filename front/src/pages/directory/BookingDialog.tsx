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
    [payment, setPayment] = useState<"success" | "declined">("success"),
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
        : await api.book({ ...form, professional: p.id, payment });
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
          ? "Déplacer le rendez-vous"
          : step === 3
            ? "Votre rendez-vous est confirmé"
            : "Prendre rendez-vous"}
      </h2>
      <p className="muted">{p.name}</p>
      <ol className="stepper">
        {[
          "Rendez-vous",
          booking ? "Vérification" : "Paiement",
          "Confirmation",
        ].map((label, i) => (
          <li key={label} aria-current={step === i + 1 ? "step" : undefined}>
            {label}
          </li>
        ))}
      </ol>
      {step === 1 && (
        <form
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
              <label htmlFor="service">Prestation</label>
              <select
                id="service"
                value={form.service}
                disabled={!!booking}
                onChange={(e) => edit("service", Number(e.target.value))}
              >
                {p.services.map((s, i) => (
                  <option key={s.name} value={i}>
                    {s.name} — {s.duration} min · {money(s.price)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="animal">Pour quel animal ?</label>
              <select
                id="animal"
                value={form.animal}
                disabled={!!booking}
                required
                onChange={(e) => edit("animal", e.target.value)}
              >
                <option value="" disabled>
                  Choisir un animal
                </option>
                {eligible.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} · {a.species}
                  </option>
                ))}
              </select>
              {!eligible.length && (
                <p className="field-help">
                  Aucun animal compatible.{" "}
                  <a href="#animaux" onClick={onClose}>
                    Ajouter un animal
                  </a>
                </p>
              )}
            </div>
            <div className="field">
              <label htmlFor="date">Date souhaitée</label>
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
              <legend>Choisissez un horaire</legend>
              {loading ? (
                <p role="status" className="slots-loading">
                  Recherche des disponibilités…
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
                Horaires de Paris. Les créneaux grisés ne sont pas disponibles.
              </p>
            </fieldset>
            {!booking && (
              <>
                <div className="field">
                  <label htmlFor="contactName">Votre nom</label>
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
                  <label htmlFor="email">Votre e-mail</label>
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
                    Un mot pour le professionnel (facultatif)
                  </label>
                  <textarea
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
              {error}
            </p>
          )}
          <div className="dialog-actions">
            <button
              type="button"
              className="button outline back"
              onClick={onClose}
            >
              Annuler
            </button>
            <button
              className="button"
              disabled={loading || (!booking && !eligible.length)}
            >
              Continuer <Icon name="arrow" />
            </button>
          </div>
        </form>
      )}
      {step === 2 && (
        <>
          <dl className="detail-grid">
            <div>
              <dt>Prestation</dt>
              <dd>{p.services[form.service].name}</dd>
            </div>
            <div>
              <dt>Animal</dt>
              <dd>
                {booking?.animalName ||
                  eligible.find((a) => a.id === form.animal)?.name}
              </dd>
            </div>
            <div>
              <dt>Date</dt>
              <dd>
                {fullDate(form.date)} à {form.time}
              </dd>
            </div>
            <div>
              <dt>Lieu</dt>
              <dd>
                {p.mode === "En visio" ? "En visioconférence" : p.address}
              </dd>
            </div>
          </dl>
          <div className="total">
            <span>Total</span>
            <strong>{money(p.services[form.service].price)}</strong>
          </div>
          {!booking && (
            <>
              <div className="payment-card">
                <Icon name="card" />
                <p>
                  Paiement de démonstration
                  <small>
                    Aucune carte bancaire demandée. Aucun débit réel.
                  </small>
                </p>
              </div>
              <div className="field">
                <label htmlFor="payment">Scénario de paiement</label>
                <select
                  id="payment"
                  value={payment}
                  disabled={busy}
                  onChange={(e) => {
                    setPayment(e.target.value as "success" | "declined");
                    setError("");
                  }}
                >
                  <option value="success">Paiement accepté</option>
                  <option value="declined">Paiement refusé</option>
                </select>
              </div>
            </>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            <button
              className="button outline back"
              disabled={busy}
              onClick={() => {
                setError("");
                setStep(1);
              }}
            >
              Retour
            </button>
            <button
              className="button"
              disabled={busy}
              onClick={() => void submit()}
            >
              {busy
                ? "Enregistrement…"
                : booking
                  ? "Confirmer le déplacement"
                  : "Confirmer et payer (simulation)"}
            </button>
          </div>
        </>
      )}
      {step === 3 && result && (
        <div className="confirmation">
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <Icon name="check" />
          <h3>{booking ? "Rendez-vous déplacé" : "C’est réservé !"}</h3>
          <p>
            {p.services[result.service].name} pour {result.animalName}
            <br />
            {fullDate(result.date)} à {result.time}
          </p>
          <p className="muted">
            La réservation est enregistrée dans votre espace. Le professionnel
            est fictif ; aucun e-mail ni paiement réel n’a été envoyé.
          </p>
          <div className="dialog-actions">
            <button className="button outline close-action" onClick={onClose}>
              Fermer
            </button>
            <a className="button" href="#reservations" onClick={onClose}>
              Mes réservations
            </a>
          </div>
        </div>
      )}
    </Modal>
  );
}
