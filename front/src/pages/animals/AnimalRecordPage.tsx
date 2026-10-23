import { useState } from "react";
import type { ReactNode } from "react";
import type {
  DialogKind,
  DialogItem,
  Reminder,
  Dashboard,
  Actions,
} from "../../shared/types.ts";
import Portrait from "./components/AnimalPortrait.tsx";
import Icon from "../../shared/ui/Icon.tsx";
import {
  fullDate,
  svgImage,
  reminderState,
  reminderLabels,
  byReminderOrder,
} from "../../shared/utils/format.ts";
import EmergencySheet, { QrDialog } from "./components/EmergencySheet.tsx";
import { PeopleList } from "../sharing/SharingPage.tsx";

const tabs: Record<string, string> = {
  apercu: "Vue d’ensemble",
  identite: "Identité",
  suivi: "Suivi",
  documents: "Documents",
  rappels: "Rappels",
  habitudes: "Habitudes",
  confiance: "Personnes de confiance",
};
export default function AnimalRecordPage({
  id,
  tab = "apercu",
  data,
  actions,
  pending,
}: {
  id: string;
  tab?: string;
  data: Dashboard;
  actions: Actions;
  pending: string | null;
}) {
  const [enlarged, setEnlarged] = useState(false);
  const pet = data.animals.find((a) => a.id === id);
  if (!pet)
    return (
      <div className="empty">
        <h1>Animal introuvable</h1>
        <p>Ce carnet n’est plus disponible.</p>
        <a className="button" href="#animaux">
          Retour à mes animaux
        </a>
      </div>
    );
  const active = tabs[tab] ? tab : "apercu";
  const emergency = tab.startsWith("urgence");
  const link = (section: string) => `#animaux/${id}/${section}`;
  const events = data.events.filter((e) => e.animal === id),
    reminders = data.reminders
      .filter((r) => r.animal === id)
      .sort(byReminderOrder),
    documents = data.documents.filter((d) => d.animal === id);
  const sheet = data.emergencySheets.find((s) => s.animal === id);
  const people = data.people.filter((p) => p.animals.includes(id));
  const open = (kind: DialogKind, item: DialogItem) =>
    actions.openDialog(kind, { ...item, animal: id });
  const identity = [
    ["Date de naissance", pet.dob ? fullDate(pet.dob) : ""],
    ["Espèce", pet.species],
    ["Race", pet.breed],
    ["Sexe", pet.sex],
    ["Poids déclaré", pet.weight ? `${pet.weight} kg` : ""],
    ["Stérilisation déclarée", pet.neutered],
    ["Robe", pet.coat],
    ["Identification", pet.identifier],
  ];
  function rows(
    kind: "event" | "reminder" | "document",
    list: DialogItem[],
    limit?: number,
  ) {
    const selected = limit ? list.slice(0, limit) : list;
    if (!selected.length)
      return (
        <p className="empty">
          Aucun{" "}
          {kind === "event"
            ? "événement"
            : kind === "reminder"
              ? "rappel"
              : "document"}{" "}
          pour le moment.
        </p>
      );
    return selected.map((item) => (
      <div className={`row ${item.done ? "done" : ""}`} key={item.id}>
        {kind === "reminder" ? (
          <input
            className="done-check"
            type="checkbox"
            checked={item.done}
            disabled={pending === item.id}
            onChange={() => actions.toggleReminder(item as Reminder)}
            aria-label={`Marquer ${item.name} comme ${item.done ? "à faire" : "fait"}`}
          />
        ) : (
          <span className="tile">
            <Icon name={kind === "document" ? "file" : "paw"} />
          </span>
        )}
        <button
          className="row-body row-open"
          onClick={() => open(kind === "event" ? "view-event" : kind, item)}
          aria-label={`Ouvrir ${kind === "event" ? item.type : item.name}`}
        >
          <strong>{kind === "event" ? item.type : item.name}</strong>
          <small>
            {kind === "document" ? (
              `${item.category} · ${item.example ? "Exemple" : "Fichier enregistré"}`
            ) : kind === "event" ? (
              <>
                {fullDate(item.date!)}
                <br />
                {item.note}
              </>
            ) : (
              `${fullDate(item.date!)} · ${reminderLabels[reminderState(item as Reminder, data.today)]} · ${item.repeat} · ${item.notice}`
            )}
          </small>
        </button>
        {!limit && (
          <div className="row-actions">
            {kind === "document" && (
              <button
                className="icon-btn"
                onClick={() => open("share-document", item)}
                aria-label={`Partager ${item.name}`}
                title="Partager"
              >
                <Icon name="share" />
              </button>
            )}
            {kind === "document" && (
              <button
                className="icon-btn"
                onClick={() => open("document", item)}
                aria-label={`Voir ${item.name}`}
                title="Voir"
              >
                <Icon name="eye" />
              </button>
            )}
            <button
              className="icon-btn"
              onClick={() => open(`edit-${kind}`, item)}
              aria-label={`Modifier ${kind === "event" ? item.type : item.name}`}
            >
              <Icon name="edit" />
            </button>
            <button
              className="icon-btn delete"
              onClick={() =>
                open(
                  kind === "document"
                    ? "delete-document"
                    : "delete-record-item",
                  { ...item, entity: kind },
                )
              }
              aria-label={`Supprimer ${kind === "event" ? item.type : item.name}`}
            >
              <Icon name="trash" />
            </button>
          </div>
        )}
      </div>
    ));
  }
  function panel(title: string, content: ReactNode, cta: ReactNode) {
    return (
      <section className="panel">
        <div className="panel-head">
          <h2>{title}</h2>
          {cta}
        </div>
        {content}
      </section>
    );
  }
  const datums = (values: string[][]) => (
    <dl className="info-grid">
      {values.map(([label, value]) => (
        <div className="datum" key={label}>
          <dt>{label}</dt>
          <dd>{value || "Non renseigné"}</dd>
        </div>
      ))}
    </dl>
  );
  const addButton = (kind: "event" | "reminder", label: string) => (
    <button className="button" onClick={() => open(`record-${kind}`, {})}>
      {label}
    </button>
  );
  return (
    <div className="record-page">
      {enlarged && sheet?.snapshot.qrSvg && (
        <QrDialog
          name={pet.name}
          qrSvg={sheet.snapshot.qrSvg}
          onClose={() => setEnlarged(false)}
        >
          <a
            className="button outline"
            href={svgImage(sheet.snapshot.qrSvg)}
            download={`anivaya-qr-${pet.id}.svg`}
          >
            Télécharger le QR
          </a>
          <a
            className="button"
            href={link("urgence")}
            onClick={() => setEnlarged(false)}
          >
            Gérer sa fiche
          </a>
        </QrDialog>
      )}
      <a
        className="back"
        href={emergency ? link("apercu") : "#animaux"}
        aria-label={emergency ? "Retour au carnet" : "Retour à mes animaux"}
      >
        <Icon name="back" />
      </a>
      {!emergency && (
        <div className="pet-header">
          <Portrait pet={pet} />
          <div className="pet-summary">
            <h1>{pet.name}</h1>
            <p>
              {pet.breed || "Race non renseignée"} ·{" "}
              {pet.sex || "Sexe non renseigné"} · {age(pet.dob)}
            </p>
            <span className="badge">Dossier privé</span>
            {(!pet.breed || !pet.dob || !pet.identifier) && (
              <p className="muted">
                Profil incomplet : complétez les informations avec « Modifier le
                profil ».
              </p>
            )}
          </div>
          <div className="actions">
            <a className="button" href={link("urgence")}>
              Fiche d’urgence et QR
            </a>
            <button
              className="button outline"
              onClick={() => open("edit-animal", pet)}
            >
              Modifier le profil
            </button>
            <button
              className="button danger"
              onClick={() =>
                open("delete-record-item", { ...pet, entity: "animal" })
              }
            >
              Supprimer l’animal
            </button>
          </div>
        </div>
      )}
      {emergency ? (
        <EmergencySheet
          key={`${pet.id}-${tab}-${Boolean(sheet)}`}
          pet={pet}
          saved={sheet}
          startEditing={tab === "urgence-modifier"}
          actions={actions}
        />
      ) : (
        <>
          <nav className="tabs" aria-label="Sections du carnet">
            {Object.entries(tabs).map(([key, label]) => (
              <a
                key={key}
                href={link(key)}
                aria-current={active === key ? "page" : undefined}
              >
                {label}
              </a>
            ))}
          </nav>
          {active === "apercu" && (
            <div className="grid">
              <div className="stack">
                {panel(
                  "Ses repères",
                  datums([
                    identity[0],
                    identity[4],
                    identity[1],
                    ["Identification", "Conservée dans le dossier privé"],
                  ]),
                  <a className="text-button" href={link("identite")}>
                    Voir l’identité
                  </a>,
                )}
                {panel(
                  "Historique récent",
                  rows("event", events, 3),
                  <a className="text-button" href={link("suivi")}>
                    Tout voir
                  </a>,
                )}
                {panel(
                  "Personnes de confiance",
                  <PeopleList
                    people={people.slice(0, 3)}
                    animals={data.animals}
                    actions={actions}
                    compact
                  />,
                  <a className="text-button" href={link("confiance")}>
                    Gérer les contacts
                  </a>,
                )}
              </div>
              <div className="stack">
                {panel(
                  "Prochains rappels",
                  rows("reminder", reminders, 2),
                  <a className="text-button" href={link("rappels")}>
                    Tout voir
                  </a>,
                )}
                {sheet ? (
                  <section className="panel emergency-inline">
                    <h2>Fiche d’urgence et QR</h2>
                    <div className="inline-sheet-heading">
                      {sheet.settings.photo && (
                        <Portrait
                          pet={{
                            ...pet,
                            photo: sheet.snapshot.photo,
                            style: sheet.snapshot.style,
                          }}
                        />
                      )}
                      <div className="inline-sheet-name">
                        <div className="inline-name-line">
                          <h3>{sheet.snapshot.name}</h3>
                          <div className="row-actions">
                            <a
                              className="icon-btn"
                              href={link("urgence-modifier")}
                              aria-label="Modifier la fiche d’urgence"
                              title="Modifier"
                            >
                              <Icon name="edit" />
                            </a>
                            <button
                              className="icon-btn delete"
                              onClick={() =>
                                open("delete-record-item", {
                                  entity: "emergency",
                                  id: pet.id,
                                  name: "la fiche et son QR",
                                })
                              }
                              aria-label="Supprimer la fiche d’urgence"
                              title="Supprimer"
                            >
                              <Icon name="trash" />
                            </button>
                          </div>
                        </div>
                        <p className="muted">
                          {sheet.snapshot.details || sheet.snapshot.species}
                        </p>
                        <p className="muted sheet-identifier">
                          Identifiant : {pet.identifier || "Non renseigné"}
                        </p>
                      </div>
                    </div>
                    {sheet.snapshot.notes && (
                      <>
                        <h3>Consignes</h3>
                        <p className="muted inline-notes">
                          {sheet.snapshot.notes}
                        </p>
                      </>
                    )}
                    {(sheet.snapshot.contact || sheet.snapshot.vet) && (
                      <h3>Contacts</h3>
                    )}
                    {sheet.snapshot.contact && (
                      <p className="muted">{sheet.snapshot.contact}</p>
                    )}
                    {sheet.snapshot.vet && (
                      <p className="muted">{sheet.snapshot.vet}</p>
                    )}
                    {sheet.snapshot.qrSvg && (
                      <div className="inline-sheet-qr">
                        <button
                          className="qr-enlarge"
                          onClick={() => setEnlarged(true)}
                          aria-label={`Agrandir le QR de ${pet.name}`}
                        >
                          <img
                            src={svgImage(sheet.snapshot.qrSvg)}
                            alt={`QR sauvegardé de ${pet.name}`}
                          />
                        </button>
                        <p className="muted">QR sauvegardé</p>
                        {sheet.snapshot.payload?.startsWith("http") && (
                          <a
                            className="text-button"
                            href={sheet.snapshot.payload}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Voir la fiche publique
                          </a>
                        )}
                      </div>
                    )}
                  </section>
                ) : (
                  <section className="panel emergency-teaser">
                    <h2>Fiche d’urgence et QR</h2>
                    <p>
                      Choisissez les informations utiles à montrer à une
                      personne qui retrouve votre animal.
                    </p>
                    <a className="button" href={link("urgence")}>
                      Préparer sa fiche
                    </a>
                  </section>
                )}
              </div>
            </div>
          )}
          {active === "identite" &&
            panel(
              "Son identité",
              <>
                {datums(identity)}
                <p className="note">
                  Ces informations sont déclaratives. Les identifiants de
                  démonstration sont fictifs.
                </p>
              </>,
              <button
                className="button outline"
                onClick={() => open("edit-animal", pet)}
              >
                Modifier
              </button>,
            )}
          {active === "suivi" &&
            panel(
              "Son suivi",
              <>
                <p className="muted">
                  Un historique déclaratif. Les événements ne constituent pas un
                  dossier médical certifié.
                </p>
                {rows("event", events)}
              </>,
              addButton("event", "Ajouter un événement"),
            )}
          {active === "documents" &&
            panel(
              "Ses documents",
              <>
                <p className="muted">
                  PDF, JPEG ou PNG · 10 Mo maximum · Enregistrés dans votre base
                  locale.
                </p>
                {rows("document", documents)}
                <a className="text-button" href={`#partage/partages/${id}`}>
                  Partager et gérer les accès →
                </a>
              </>,
              <button
                className="button"
                onClick={() => actions.add("document", id)}
              >
                Ajouter un document
              </button>,
            )}
          {active === "rappels" &&
            panel(
              "Ses rappels",
              <>
                <p className="muted">
                  Aucune notification réelle n’est envoyée.
                </p>
                {rows("reminder", reminders)}
              </>,
              addButton("reminder", "Ajouter un rappel"),
            )}
          {active === "habitudes" &&
            panel(
              "Ses habitudes et contacts",
              datums([
                ["Alimentation", pet.food],
                ["Rythme et sorties", pet.routine],
                ["Comportement et approche", pet.behavior],
                ["Consignes essentielles déclarées", pet.medical],
                ["Contact principal", pet.contact],
                ["Vétérinaire habituel", pet.vet],
              ]),
              <button
                className="button outline"
                onClick={() => open("habits", pet)}
              >
                Modifier les habitudes
              </button>,
            )}
          {active === "confiance" &&
            panel(
              "Ses personnes de confiance",
              <>
                <p className="muted">
                  Des proches et professionnels à retrouver facilement.
                  L’association à ce carnet ne donne pas accès aux documents.
                </p>
                <PeopleList
                  people={people}
                  animals={data.animals}
                  actions={actions}
                  animal={id}
                />
                <a className="text-button" href={`#partage/personnes/${id}`}>
                  Gérer les personnes et les partages →
                </a>
              </>,
              <div className="row-buttons">
                <button
                  className="button outline"
                  onClick={() =>
                    actions.openDialog("associate-people", { animal: id })
                  }
                >
                  Associer une personne
                </button>
                <button
                  className="button"
                  onClick={() =>
                    actions.openDialog("add-person", { animal: id })
                  }
                >
                  Ajouter une personne
                </button>
              </div>,
            )}
        </>
      )}
    </div>
  );
}
function age(dob: string) {
  if (!dob) return "Âge non renseigné";
  const now = new Date(),
    birth = new Date(`${dob}T12:00:00`);
  let years = now.getFullYear() - birth.getFullYear();
  if (
    now.getMonth() < birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())
  )
    years--;
  return `${Math.max(0, years)} ans`;
}
