import { useState } from "react";
import type {
  Actions,
  ReceivedAnimal,
  ReceivedDocument,
  ReceivedShare,
  ReceivedShareState,
} from "../../shared/types.ts";
import { errorMessage } from "../../shared/types.ts";
import { api } from "../../shared/services/api.ts";
import Icon from "../../shared/ui/Icon.tsx";
import Modal from "../../shared/ui/Modal.tsx";
import { fullDate, matches } from "../../shared/utils/format.ts";

const receivedLabels: Record<ReceivedShareState, string> = {
  pending: "Invitation en attente",
  accepted: "Accès actif",
  expired: "Accès expiré",
  revoked: "Accès retiré",
  declined: "Invitation refusée",
};
const unavailableText: Partial<Record<ReceivedShareState, string>> = {
  expired:
    "La date de fin est dépassée. Demandez une nouvelle invitation au propriétaire.",
  revoked:
    "Le propriétaire a retiré cet accès. Les informations ne sont plus consultables.",
  declined:
    "Vous avez refusé cette invitation. Le propriétaire peut vous en envoyer une nouvelle.",
};

/** Illustration de l’animal confié (image commune, cadrée par espèce). */
function AnimalPhoto({ animal }: { animal: ReceivedAnimal }) {
  return (
    <span
      className="received-animal-photo"
      role="img"
      aria-label={`Illustration : ${animal.species.toLowerCase()}`}
      style={{
        backgroundPosition: animal.species === "Chat" ? "80% 60%" : "32% 0%",
      }}
    />
  );
}

/** Onglet « Partage avec moi » : ce que d’autres propriétaires vous confient. */
export default function ReceivedShares({
  shares,
  actions,
}: {
  shares: ReceivedShare[];
  actions: Actions;
}) {
  const [search, setSearch] = useState("");
  const [state, setState] = useState<ReceivedShareState | "">("");
  const [openId, setOpenId] = useState<string | null>(null);
  const visible = shares.filter(
    (s) =>
      (!state || s.state === state) &&
      matches(`${s.title} ${s.animalName} ${s.sender} ${s.email}`, search),
  );
  const open = shares.find((s) => s.id === openId);
  return (
    <section className="sharing-panel">
      <div className="sharing-heading">
        <div>
          <h2>Partage avec moi</h2>
          <p className="muted">
            Les invitations et les informations que d’autres propriétaires vous
            confient.
          </p>
        </div>
      </div>
      <div className="received-filters">
        <label>
          Rechercher
          <input
            type="search"
            placeholder="Un animal, un document, une personne…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label>
          Statut
          <select
            value={state}
            onChange={(e) => setState(e.target.value as ReceivedShareState)}
          >
            <option value="">Tous les statuts</option>
            {Object.entries(receivedLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="muted" role="status">
        {visible.length} partage(s) reçu(s)
      </p>
      {visible.map((share) => (
        <article className="access-row received-row" key={share.id}>
          {share.state === "accepted" && share.kind === "animal" ? (
            <AnimalPhoto animal={share.content as ReceivedAnimal} />
          ) : (
            <span className="doc-icon">
              <Icon name={share.kind === "animal" ? "paw" : "file"} />
            </span>
          )}
          <div className="person-info">
            <h3>{share.title}</h3>
            <p>
              De {share.sender} · {share.email}
            </p>
            <p>
              {share.kind === "animal"
                ? "Informations de l’animal sélectionnées par son propriétaire"
                : "Un document uniquement"}{" "}
              · {share.permission}
            </p>
            <p>Jusqu’au {fullDate(share.until)}</p>
            <span className={`received-state ${share.state}`}>
              {receivedLabels[share.state]}
            </span>
          </div>
          <div className="row-buttons">
            <button onClick={() => setOpenId(share.id)}>
              {share.state === "pending"
                ? "Voir l’invitation"
                : share.state === "accepted"
                  ? "Consulter"
                  : "Voir le statut"}
            </button>
          </div>
        </article>
      ))}
      {!visible.length && (
        <div className="share-empty">
          <h3>Aucun partage pour le moment</h3>
          <p>
            {shares.length
              ? "Aucun résultat ne correspond à votre recherche."
              : "Les invitations d’autres propriétaires apparaîtront ici."}
          </p>
          {shares.length > 0 && (
            <button
              className="button outline"
              onClick={() => {
                setSearch("");
                setState("");
              }}
            >
              Réinitialiser les filtres
            </button>
          )}
        </div>
      )}
      {open && (
        <ReceivedDetail
          key={open.id}
          share={open}
          actions={actions}
          onClose={() => setOpenId(null)}
        />
      )}
    </section>
  );
}

function ReceivedDetail({
  share,
  actions,
  onClose,
}: {
  share: ReceivedShare;
  actions: Actions;
  onClose: () => void;
}) {
  const [declining, setDeclining] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function respond(status: "accepted" | "declined") {
    setBusy(true);
    setError("");
    try {
      await api.respondReceived(share.id, status);
      // Après acceptation, la fenêtre reste ouverte sur le contenu devenu visible.
      if (status === "declined") onClose();
      setDeclining(false);
      await actions.saved(
        status === "accepted"
          ? "Invitation acceptée. Le contenu est disponible en lecture seule."
          : "Invitation refusée.",
      );
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  const animal =
    share.kind === "animal" ? (share.content as ReceivedAnimal | null) : null;
  const document =
    share.kind === "document"
      ? (share.content as ReceivedDocument | null)
      : null;

  if (declining)
    return (
      <Modal busy={busy} onClose={onClose} className="sharing-modal">
        <h2 id="action-title">Refuser cette invitation ?</h2>
        <p className="dialog-copy">
          Vous n’aurez pas accès à {share.title}. Aucune donnée de votre espace
          ne sera modifiée.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button
            className="button outline"
            disabled={busy}
            onClick={() => setDeclining(false)}
          >
            Revenir à l’invitation
          </button>
          <button
            className="button danger"
            disabled={busy}
            onClick={() => respond("declined")}
          >
            Refuser l’invitation
          </button>
        </div>
      </Modal>
    );

  return (
    <Modal busy={busy} onClose={onClose} className="sharing-modal">
      <h2 id="action-title">{share.title}</h2>
      <p className="dialog-copy">
        De <strong>{share.sender}</strong> · {share.email}
        <br />
        Pour {share.animalName} · Jusqu’au {fullDate(share.until)}
      </p>
      <p className="share-note">
        {share.kind === "animal"
          ? "Le propriétaire vous propose de devenir une personne de confiance. Seules les informations sélectionnées ci-dessous sont accessibles après acceptation."
          : "Ce partage concerne un seul document. Le reste du carnet reste inaccessible."}{" "}
        Lecture seule.
      </p>
      {share.state === "pending" && (
        <>
          <p className="dialog-copy">
            {share.kind === "animal"
              ? "Informations proposées : identité, consignes et contact du propriétaire."
              : `Document proposé : ${share.title}.`}{" "}
            Accepter cette invitation ne l’ajoute pas à vos propres animaux.
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            <button
              className="button outline"
              disabled={busy}
              onClick={() => setDeclining(true)}
            >
              Refuser
            </button>
            <button
              className="button"
              disabled={busy}
              onClick={() => respond("accepted")}
            >
              Accepter l’invitation
            </button>
          </div>
        </>
      )}
      {share.state === "accepted" && animal && (
        <section className="received-preview">
          <div className="received-animal-heading">
            <AnimalPhoto animal={animal} />
            <div className="received-animal-identity">
              <h3>{animal.name}</h3>
              <p>
                {animal.species} · {animal.breed} · {animal.sex}
              </p>
              <p>Identifiant : {animal.identifier}</p>
            </div>
            <span className="received-state accepted received-sheet-status">
              <span>Fiche partagée</span>
              <span>Lecture seule</span>
            </span>
          </div>
          <h3>Consignes</h3>
          <p>{animal.instructions}</p>
          <h3>Contact</h3>
          <p>{animal.contact}</p>
        </section>
      )}
      {share.state === "accepted" && document && (
        <section className="received-preview">
          <span className="received-state accepted">
            Document partagé · Lecture seule
          </span>
          <h3>{document.document}</h3>
          <p>{document.description}</p>
          {document.entries.length > 0 && (
            <ul>
              {document.entries.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
          {document.file ? (
            <a
              className="button outline"
              href={document.file}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon name="eye" />
              Ouvrir le document
            </a>
          ) : (
            <p className="muted">Aucun fichier n’est joint à ce document.</p>
          )}
        </section>
      )}
      {share.state !== "pending" && !share.content && (
        <div className="received-unavailable">
          <h3>{receivedLabels[share.state]}</h3>
          <p>
            {unavailableText[share.state] ??
              "Le contenu de ce partage n’est pas disponible."}
          </p>
        </div>
      )}
      {share.state !== "pending" && (
        <div className="dialog-actions">
          <button className="button outline close-action" onClick={onClose}>
            Fermer
          </button>
        </div>
      )}
    </Modal>
  );
}
