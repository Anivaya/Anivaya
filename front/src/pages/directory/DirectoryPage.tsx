import { useEffect, useState } from "react";
import type { Animal } from "../../../../shared/models.ts";
import type {
  Profile,
  Professional,
  DirectoryData,
  Booking,
} from "../../../../shared/account.ts";
import { api } from "../../shared/services/api.ts";
import { errorMessage } from "../../shared/types.ts";
import Icon from "../../shared/ui/Icon.tsx";
import Modal from "../../shared/ui/Modal.tsx";
import BookingDialog from "./BookingDialog.tsx";
import ReportDialog from "./ReportDialog.tsx";
import {
  fullDate,
  matches,
  money,
  parisNow,
} from "../../shared/utils/format.ts";
const noFilters = {
  q: "",
  category: "",
  city: "",
  species: "",
  favorite: false,
};
/** Icônes des métiers dont le nom diffère de celui de la bibliothèque. */
const icons: Record<string, string> = {
  medical: "medical",
  scissors: "scissors",
  house: "home",
  training: "training",
  leaf: "leaf",
  heart: "heart",
};
export default function DirectoryPage({
  animals,
  profile,
  reservations,
}: {
  animals: Animal[];
  profile: Profile;
  reservations: boolean;
}) {
  const [data, setData] = useState<DirectoryData | null>(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0),
    [busy, setBusy] = useState<string | null>(null);
  const [report, setReport] = useState<Professional | null>(null);
  const [filters, setFilters] = useState(noFilters),
    [bookingFilters, setBookingFilters] = useState({
      period: "upcoming",
      animal: "",
      status: "",
    });
  const [view, setView] = useState<Professional | null>(null),
    [book, setBook] = useState<{
      professional: Professional;
      service?: number;
      booking?: Booking;
    } | null>(null),
    [detail, setDetail] = useState<Booking | null>(null),
    [cancel, setCancel] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    api
      .directory(controller.signal)
      .then(setData)
      .catch((e) => {
        if (!controller.signal.aborted) setError(errorMessage(e));
      });
    return () => controller.abort();
  }, [retry]);
  async function reload() {
    setData(await api.directory());
  }
  async function favorite(p: Professional) {
    if (!data) return;
    setBusy(p.id);
    try {
      await api.favorite(p.id, !data.favorites.includes(p.id));
      await reload();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }
  async function cancelBooking() {
    if (!detail) return;
    setBusy(detail.id);
    try {
      const next = await api.changeBooking(detail.id, {
        status: "cancelled",
      });
      setDetail(next);
      setCancel(false);
      await reload();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }
  // Une réservation devient « passée » sans recharger la page.
  const [now, setNow] = useState(parisNow);
  useEffect(() => {
    const timer = setInterval(() => setNow(parisNow()), 30000);
    return () => clearInterval(timer);
  }, []);
  const isPast = (b: Booking) => b.date + " " + b.time <= now;
  const professional = (id: string) =>
    data?.professionals.find((p) => p.id === id);
  const list =
    data?.professionals.filter(
      (p) =>
        matches(p.name + " " + p.intro + " " + p.category, filters.q) &&
        (!filters.category || p.category === filters.category) &&
        (!filters.city || p.city === filters.city) &&
        (!filters.species || p.species.includes(filters.species)) &&
        (!filters.favorite || data.favorites.includes(p.id)),
    ) ?? [];
  const bookings =
    data?.bookings
      .filter(
        (b) =>
          (bookingFilters.period === "all" ||
            (bookingFilters.period === "past" ? isPast(b) : !isPast(b))) &&
          (!bookingFilters.animal || b.animal === bookingFilters.animal) &&
          (!bookingFilters.status || b.status === bookingFilters.status),
      )
      .sort((a, b) =>
        bookingFilters.period === "upcoming"
          ? (a.date + a.time).localeCompare(b.date + b.time)
          : (b.date + b.time).localeCompare(a.date + a.time),
      ) ?? [];
  return (
    <section className="directory-page">
      <div className="welcome">
        <div>
          <h1>Les bonnes personnes, pour eux.</h1>
          <p>
            Trouvez un professionnel pour les petits et les grands besoins de
            votre compagnon.
          </p>
        </div>
        <a className="button outline" href="#reservations">
          <Icon name="calendar" />
          Mes réservations
        </a>
      </div>
      <nav className="page-tabs" aria-label="Sections des professionnels">
        <a href="#annuaire" aria-current={!reservations ? "page" : undefined}>
          Annuaire des professionnels
        </a>
        <a
          href="#reservations"
          aria-current={reservations ? "page" : undefined}
        >
          Mes réservations (
          {data?.bookings.filter((b) => b.status === "confirmed" && !isPast(b))
            .length ?? 0}
          )
        </a>
      </nav>
      <div className="intro-note">
        <Icon name="info" />
        <span>
          Annuaire de démonstration : les professionnels, disponibilités et
          paiements sont fictifs. Vos favoris et réservations sont enregistrés
          dans votre compte.
        </span>
      </div>
      {error && (
        <div className="empty" role="alert">
          <p>{error}</p>
          <button
            className="button outline"
            onClick={() => {
              setError("");
              setRetry((v) => v + 1);
            }}
          >
            Réessayer
          </button>
        </div>
      )}
      {!data && !error && <p role="status">Chargement des professionnels…</p>}
      {data && !reservations && (
        <>
          <div className="filters">
            <div className="field">
              <label htmlFor="pro-search">Un nom, un service…</label>
              <div className="search-box">
                <input
                  id="pro-search"
                  type="search"
                  placeholder="Nom, spécialité…"
                  value={filters.q}
                  onChange={(e) =>
                    setFilters({ ...filters, q: e.target.value })
                  }
                />
              </div>
            </div>
            {(["category", "city", "species"] as const).map((key, i) => (
              <div className="field" key={key}>
                <label htmlFor={"filter-" + key}>
                  {["Métier", "Ville", "Pour mon animal"][i]}
                </label>
                <select
                  id={"filter-" + key}
                  value={filters[key]}
                  onChange={(e) =>
                    setFilters({ ...filters, [key]: e.target.value })
                  }
                >
                  <option value="">
                    {
                      [
                        "Tous les métiers",
                        "Toutes les villes",
                        "Chien ou chat",
                      ][i]
                    }
                  </option>
                  {[
                    ...new Set(
                      data.professionals.flatMap((p) =>
                        key === "species" ? p.species : p[key],
                      ),
                    ),
                  ].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div className="results-head">
            <p aria-live="polite">
              {list.length} professionnel{list.length !== 1 ? "s" : ""}
            </p>
            <label className="favorite-filter">
              <input
                type="checkbox"
                checked={filters.favorite}
                onChange={(e) =>
                  setFilters({ ...filters, favorite: e.target.checked })
                }
              />
              Mes favoris
            </label>
          </div>
          <div className="professional-grid">
            {list.map((p) => (
              <article className="pro-card" key={p.id}>
                <div className="pro-top">
                  <span className="profession-icon">
                    <Icon name={icons[p.icon] || p.icon} />
                  </span>
                  <button
                    className="icon-button"
                    aria-label={
                      (data.favorites.includes(p.id)
                        ? "Retirer des favoris : "
                        : "Ajouter aux favoris : ") + p.name
                    }
                    aria-pressed={data.favorites.includes(p.id)}
                    disabled={busy === p.id}
                    onClick={() => void favorite(p)}
                  >
                    <Icon name="heart" />
                  </button>
                </div>
                <div className="pro-body">
                  <p className="category">{p.category}</p>
                  <h3>{p.name}</h3>
                  <p className="location">
                    <Icon name="pin" />
                    {p.district}
                  </p>
                  <p className="description">{p.intro}</p>
                  <div className="tags">
                    {p.species.map((s) => (
                      <span key={s} className="tag">
                        {s}
                      </span>
                    ))}
                    <span className="tag">{p.mode}</span>
                  </div>
                  <div className="availability">
                    Créneaux de démonstration à partir de demain
                  </div>
                  <div className="price-line">
                    <span>À partir de</span>
                    <strong>
                      {money(Math.min(...p.services.map((s) => s.price)))}
                    </strong>
                  </div>
                  <div className="card-actions">
                    <button
                      className="button outline"
                      onClick={() => setView(p)}
                    >
                      Voir la fiche
                    </button>
                    <button
                      className="button"
                      onClick={() => setBook({ professional: p })}
                    >
                      Réserver
                    </button>
                  </div>
                </div>
              </article>
            ))}
            {!list.length && (
              <div className="empty">
                <h2>Aucun professionnel trouvé</h2>
                <p>Essayez une autre recherche ou élargissez vos filtres.</p>
                <button
                  className="button outline"
                  onClick={() => setFilters(noFilters)}
                >
                  Réinitialiser les filtres
                </button>
              </div>
            )}
          </div>
        </>
      )}
      {data && reservations && (
        <>
          <div className="filters booking-filters">
            <div className="field">
              <label htmlFor="period">Période</label>
              <select
                id="period"
                value={bookingFilters.period}
                onChange={(e) =>
                  setBookingFilters({
                    ...bookingFilters,
                    period: e.target.value,
                  })
                }
              >
                <option value="upcoming">À venir</option>
                <option value="past">Passées</option>
                <option value="all">Toutes les réservations</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="booking-animal">Animal</label>
              <select
                id="booking-animal"
                value={bookingFilters.animal}
                onChange={(e) =>
                  setBookingFilters({
                    ...bookingFilters,
                    animal: e.target.value,
                  })
                }
              >
                <option value="">Tous les animaux</option>
                {[
                  ...new Map([
                    ...animals.map((a) => [a.id, a.name] as const),
                    ...data.bookings.map(
                      (b) => [b.animal, b.animalName] as const,
                    ),
                  ]).entries(),
                ].map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="status">Statut</label>
              <select
                id="status"
                value={bookingFilters.status}
                onChange={(e) =>
                  setBookingFilters({
                    ...bookingFilters,
                    status: e.target.value,
                  })
                }
              >
                <option value="">Tous les statuts</option>
                <option value="confirmed">Confirmées</option>
                <option value="cancelled">Annulées</option>
              </select>
            </div>
          </div>
          <div className="booking-list">
            {bookings.map((b) => {
              const p = professional(b.professional)!;
              return (
                <article className="booking-row" key={b.id}>
                  <div className="date-tile">
                    <strong>{Number(b.date.slice(-2))}</strong>
                    <small>
                      {new Date(b.date + "T12:00:00").toLocaleDateString(
                        "fr-FR",
                        { month: "short" },
                      )}
                    </small>
                  </div>
                  <div className="booking-summary">
                    <h3>{p.services[b.service].name}</h3>
                    <p>
                      {p.name} · {b.animalName}
                    </p>
                    <small>
                      {fullDate(b.date)} à {b.time} · {money(b.price)}
                    </small>
                  </div>
                  <div className="booking-tail">
                    <span className={"badge " + b.status}>
                      {b.status === "cancelled"
                        ? "Annulée"
                        : isPast(b)
                          ? "Passée"
                          : "Confirmée"}
                    </span>
                    <div>
                      <button
                        className="button outline"
                        onClick={() => {
                          setError("");
                          setDetail(b);
                          setCancel(false);
                        }}
                      >
                        Voir le détail
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
            {!bookings.length && (
              <div className="empty">
                <Icon name="calendar" />
                <h2>Aucune réservation à afficher</h2>
                <p>Vos rendez-vous apparaîtront ici après confirmation.</p>
                <a href="#annuaire" className="button">
                  Trouver un professionnel
                </a>
              </div>
            )}
          </div>
        </>
      )}
      {view && (
        <Modal
          className="directory-dialog"
          busy={false}
          onClose={() => setView(null)}
        >
          <div className="profile-heading">
            <span className="profession-icon">
              <Icon name={icons[view.icon] || view.icon} />
            </span>
            <div>
              <p className="category">{view.category}</p>
              <h2 id="action-title">{view.name}</h2>
              <p className="location">
                <Icon name="pin" />
                {view.city} · {view.district}
              </p>
            </div>
          </div>
          <p>{view.about}</p>
          <p>
            <span className="admin-badge">
              {view.verification === "Validé"
                ? "Dossier vérifié"
                : "Vérification en cours"}
            </span>
          </p>
          <button
            className="button outline"
            onClick={() => {
              setReport(view);
              setView(null);
            }}
          >
            Signaler cette fiche
          </button>
          <dl className="detail-grid">
            <div>
              <dt>Adresse</dt>
              <dd>{view.address}</dd>
            </div>
            <div>
              <dt>Horaires</dt>
              <dd>{view.hours}</dd>
            </div>
          </dl>
          <h3>Prestations et tarifs</h3>
          {view.services.map((s, i) => (
            <div className="service-row" key={s.name}>
              <div>
                <strong>{s.name}</strong>
                <small>
                  {s.duration} min · {money(s.price)}
                </small>
              </div>
              <button
                className="button"
                onClick={() => {
                  setBook({ professional: view, service: i });
                  setView(null);
                }}
              >
                Choisir
              </button>
            </div>
          ))}
        </Modal>
      )}
      {report && (
        <ReportDialog
          id={report.id}
          name={report.name}
          onClose={() => setReport(null)}
        />
      )}
      {book && data && (
        <BookingDialog
          {...book}
          animals={animals}
          profile={profile}
          today={data.today}
          onClose={() => setBook(null)}
          onSaved={reload}
        />
      )}
      {detail && data && (
        <Modal
          className="directory-dialog"
          busy={busy === detail.id}
          onClose={() => setDetail(null)}
        >
          <h2 id="action-title">
            {cancel ? "Annuler le rendez-vous ?" : "Votre réservation"}
          </h2>
          <p>{professional(detail.professional)?.name}</p>
          <dl className="detail-grid">
            <div>
              <dt>Animal</dt>
              <dd>{detail.animalName}</dd>
            </div>
            <div>
              <dt>Rendez-vous</dt>
              <dd>
                {fullDate(detail.date)} à {detail.time}
              </dd>
            </div>
            <div>
              <dt>Statut</dt>
              <dd>{detail.status === "cancelled" ? "Annulé" : "Confirmé"}</dd>
            </div>
            <div>
              <dt>Montant (simulation)</dt>
              <dd>{money(detail.price)}</dd>
            </div>
            <div>
              <dt>Contact</dt>
              <dd>
                {detail.contactName}
                <br />
                {detail.email}
              </dd>
            </div>
            {detail.note && (
              <div>
                <dt>Votre message</dt>
                <dd>{detail.note}</dd>
              </div>
            )}
          </dl>
          {detail.status === "cancelled" && (
            <p className="muted">
              Remboursement simulé de {money(detail.price)}. Aucun mouvement
              bancaire réel.
            </p>
          )}
          {cancel && (
            <p>
              Le créneau sera libéré et le remboursement sera simulé. Cette
              action ne peut pas être annulée.
            </p>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            {cancel ? (
              <>
                <button
                  className="button outline"
                  disabled={!!busy}
                  onClick={() => setCancel(false)}
                >
                  Conserver
                </button>
                <button
                  className="button danger"
                  disabled={!!busy}
                  onClick={() => void cancelBooking()}
                >
                  {busy ? "Annulation…" : "Confirmer l’annulation"}
                </button>
              </>
            ) : (
              <>
                <button
                  className="button outline back close-action"
                  onClick={() => setDetail(null)}
                >
                  Fermer
                </button>
                {detail.status === "confirmed" && !isPast(detail) && (
                  <>
                    <button
                      className="button outline"
                      onClick={() => setCancel(true)}
                    >
                      Annuler le rendez-vous
                    </button>
                    <button
                      className="button"
                      onClick={() => {
                        setBook({
                          professional: professional(detail.professional)!,
                          booking: detail,
                        });
                        setDetail(null);
                      }}
                    >
                      Déplacer
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </Modal>
      )}
    </section>
  );
}
