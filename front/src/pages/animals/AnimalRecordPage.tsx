import { useText } from "../../shared/i18n/HomeLocale.tsx";
import EmptyState from "../../shared/ui/EmptyState.tsx";
import type { EmptyKind } from "../../shared/ui/EmptyIllustration.tsx";
import { useLayoutEffect, useState } from "react";
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
  shortDate,
  svgImage,
  reminderState,
  reminderLabels,
  byReminderOrder,
} from "../../shared/utils/format.ts";
import EmergencySheet, { QrDialog } from "./components/EmergencySheet.tsx";
import { PeopleList } from "../sharing/SharingPage.tsx";
import { AiImportButton } from "../documents/AiImport.tsx";
import { useMediaQuery } from "../../shared/hooks.ts";

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
  const tr = useText();
  const [enlarged, setEnlarged] = useState(false);
  const mobile = useMediaQuery("(max-width: 620px)");
  const pet = data.animals.find((a) => a.id === id);
  // Opening another record starts at its heading; changing tabs preserves the position.
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [id]);
  if (!pet)
    return (
      <div className="empty">
        <h1>{tr("Animal introuvable")}</h1>
        <p>{tr("Ce carnet n’est plus disponible.")}</p>
        <a className="button" href="#animaux">
          {tr("Retour à mes animaux")}
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
    ["Espèce", tr(pet.species)],
    ["Race", pet.breed],
    ["Sexe", tr(pet.sex)],
    ["Poids déclaré", pet.weight ? `${pet.weight} kg` : ""],
    ["Stérilisation déclarée", tr(pet.neutered)],
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
        <EmptyState
          kind={
            kind === "document"
              ? "documents"
              : kind === "reminder"
                ? "reminders"
                : "events"
          }
          compact
        />
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
            aria-label={tr("Marquer {0} comme {1}", [
              item.name,
              item.done ? tr("à faire") : tr("fait"),
            ])}
          />
        ) : (
          <span className="tile">
            <Icon name={kind === "document" ? "file" : "paw"} />
          </span>
        )}
        <button
          className="row-body row-open"
          onClick={() => open(kind === "event" ? "view-event" : kind, item)}
          aria-label={tr("Ouvrir {0}", [
            kind === "event" ? tr(item.type) : item.name,
          ])}
        >
          <strong>{kind === "event" ? tr(item.type) : item.name}</strong>
          {kind === "reminder" ? (
            <>
              <small>
                {tr(
                  reminderLabels[reminderState(item as Reminder, data.today)],
                )}
              </small>
              <small>
                {mobile ? shortDate(item.date!) : fullDate(item.date!)}
              </small>
            </>
          ) : (
            <small>
              {kind === "document" ? (
                `${tr(item.category)} · ${tr(item.example ? "Sans fichier" : "Fichier enregistré")}`
              ) : kind === "event" ? (
                <>
                  {fullDate(item.date!)}
                  <br />
                  {item.note}
                </>
              ) : null}
            </small>
          )}
        </button>
        {!limit && (
          <div className="row-actions">
            {kind === "document" && (
              <button
                className="icon-btn"
                onClick={() => open("share-document", item)}
                aria-label={tr("Partager {0}", [item.name])}
                title={tr("Partager")}
              >
                <Icon name="share" />
              </button>
            )}
            {kind === "document" && (
              <button
                className="icon-btn"
                onClick={() => open("document", item)}
                aria-label={tr("Voir {0}", [item.name])}
                title={tr("Voir")}
              >
                <Icon name="eye" />
              </button>
            )}
            <button
              className="icon-btn"
              onClick={() => open(`edit-${kind}`, item)}
              aria-label={tr("Modifier {0}", [
                kind === "event" ? tr(item.type) : item.name,
              ])}
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
              aria-label={tr("Supprimer {0}", [
                kind === "event" ? tr(item.type) : item.name,
              ])}
            >
              <Icon name="trash" />
            </button>
          </div>
        )}
      </div>
    ));
  }
  function panel(
    title: string,
    content: ReactNode,
    cta: ReactNode,
    empty?: EmptyKind,
  ) {
    return (
      <section className="panel">
        <div className="panel-head">
          <h2>{tr(title)}</h2>
          {cta}
        </div>
        {empty ? <EmptyState kind={empty} compact /> : content}
      </section>
    );
  }
  const datums = (values: string[][]) => (
    <dl className="info-grid">
      {values.map(([label, value]) => (
        <div className="datum" key={label}>
          <dt>{tr(label)}</dt>
          <dd>{value || tr("Non renseigné")}</dd>
        </div>
      ))}
    </dl>
  );
  const addButton = (kind: "event" | "reminder", label: string) => (
    <button className="button" onClick={() => open(`record-${kind}`, {})}>
      {tr(label)}
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
            {tr("Télécharger le QR")}
          </a>
          <a
            className="button"
            href={link("urgence")}
            onClick={() => setEnlarged(false)}
          >
            {tr("Gérer sa fiche")}
          </a>
        </QrDialog>
      )}
      {emergency && <a
        className="back"
        href={link("apercu")}
        aria-label={tr("Retour au carnet")}
      >
        <Icon name="back" />
      </a>}
      {!emergency && (
        <div className="pet-header">
          <Portrait pet={pet} />
          <a className="back" href="#animaux" aria-label={tr("Retour à mes animaux")}>
            <Icon name="back" />
          </a>
          <div className="pet-summary">
            <h1>{pet.name}</h1>
            <p>
              {pet.breed || tr("Race non renseignée")} ·{" "}
              {tr(pet.sex) || tr("Sexe non renseigné")} · {age(pet.dob, tr)}
            </p>
            {(!pet.breed || !pet.dob || !pet.identifier) && (
              <p className="muted">
                {tr(
                  "Profil incomplet : complétez les informations avec « Modifier le profil ».",
                )}
              </p>
            )}
            {/* Le statut vient en dernier, après l’éventuel message de profil incomplet. */}
            <span className="badge">{tr("Dossier privé")}</span>
          </div>
          <div className="actions">
            <a className="button" href={link("urgence")}>
              {tr("Fiche d’urgence et QR")}
            </a>
            <button
              className="button outline"
              onClick={() => open("edit-animal", pet)}
            >
              {tr("Modifier le profil")}
            </button>
            <AiImportButton
              icon={false}
              onClick={() => open("ai-import", {})}
            />
            <button
              className="button danger"
              onClick={() =>
                open("delete-record-item", { ...pet, entity: "animal" })
              }
            >
              {tr("Supprimer l’animal")}
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
          <nav className="page-tabs" aria-label={tr("Sections du carnet")}>
            {Object.entries(tabs).map(([key, label]) => (
              <a
                key={key}
                href={link(key)}
                aria-current={active === key ? "page" : undefined}
              >
                {tr(label)}
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
                    ["Identification", tr("Conservée dans le dossier privé")],
                  ]),
                  <a className="text-button" href={link("identite")}>
                    {tr("Voir l’identité")}
                  </a>,
                )}
                {panel(
                  "Historique récent",
                  rows("event", events, 3),
                  <a className="text-button" href={link("suivi")}>
                    {tr("Tout voir")}
                  </a>,
                  !events.length ? "events" : undefined,
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
                    {tr("Gérer les contacts")}
                  </a>,
                  !people.length ? "people" : undefined,
                )}
              </div>
              <div className="stack">
                {panel(
                  "Prochains rappels",
                  rows("reminder", reminders, 2),
                  <a className="text-button" href={link("rappels")}>
                    {tr("Tout voir")}
                  </a>,
                  !reminders.length ? "reminders" : undefined,
                )}
                {sheet ? (
                  <section className="panel emergency-inline">
                    <h2>{tr("Fiche d’urgence et QR")}</h2>
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
                              aria-label={tr("Modifier la fiche d’urgence")}
                              title={tr("Modifier")}
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
                              aria-label={tr("Supprimer la fiche d’urgence")}
                              title={tr("Supprimer")}
                            >
                              <Icon name="trash" />
                            </button>
                          </div>
                        </div>
                        <p className="muted">
                          {sheet.snapshot.details || tr(sheet.snapshot.species)}
                        </p>
                        <p className="muted sheet-identifier">
                          {tr("Identifiant : ")}
                          {pet.identifier || tr("Non renseigné")}
                        </p>
                      </div>
                    </div>
                    {sheet.snapshot.notes && (
                      <>
                        <h3>{tr("Consignes")}</h3>
                        <p className="muted inline-notes">
                          {sheet.snapshot.notes}
                        </p>
                      </>
                    )}
                    {(sheet.snapshot.contact || sheet.snapshot.vet) && (
                      <h3>{tr("Contacts")}</h3>
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
                          aria-label={tr("Agrandir le QR de {0}", [pet.name])}
                        >
                          <img
                            src={svgImage(sheet.snapshot.qrSvg)}
                            alt={tr("QR sauvegardé de {0}", [pet.name])}
                          />
                        </button>
                        <p className="muted">{tr("QR sauvegardé")}</p>
                        {sheet.snapshot.payload?.startsWith("http") && (
                          <a
                            className="text-button"
                            href={sheet.snapshot.payload}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {tr("Voir la fiche publique")}
                          </a>
                        )}
                      </div>
                    )}
                  </section>
                ) : (
                  <section className="panel emergency-teaser">
                    <h2>{tr("Fiche d’urgence et QR")}</h2>
                    <EmptyState
                      kind="documents"
                      compact
                      title={tr(
                        "La fiche d’urgence et le QR code ne sont pas encore générés",
                      )}
                      description={tr(
                        "Créez sa fiche pour rendre ses informations essentielles accessibles en cas d’urgence.",
                      )}
                    />
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
                  {tr("Ces informations sont déclaratives.")}
                </p>
              </>,
              <button
                className="button outline"
                onClick={() => open("edit-animal", pet)}
              >
                {tr("Modifier")}
              </button>,
            )}
          {active === "suivi" &&
            panel(
              "Son suivi",
              <>
                <p className="muted">
                  {tr(
                    "Un historique déclaratif. Les événements ne constituent pas un dossier médical certifié.",
                  )}
                </p>
                {rows("event", events)}
              </>,
              addButton("event", "Ajouter un événement"),
              !events.length ? "events" : undefined,
            )}
          {active === "documents" &&
            panel(
              "Ses documents",
              <>
                <p className="muted">
                  {tr(
                    "PDF, JPEG ou PNG · 10 Mo maximum · Conservés dans votre espace privé.",
                  )}
                </p>
                {rows("document", documents)}
                <a className="text-button" href={`#partage/partages/${id}`}>
                  {tr("Partager et gérer les accès →")}
                </a>
              </>,
              <div className="heading-actions">
                <AiImportButton
                  icon={false}
                  onClick={() => open("ai-import", {})}
                />
                <button
                  className="button"
                  onClick={() => actions.add("document", id)}
                >
                  {tr("Ajouter un document")}
                </button>
              </div>,
              !documents.length ? "documents" : undefined,
            )}
          {active === "rappels" &&
            panel(
              "Ses rappels",
              <>
                <p className="muted">
                  {tr(
                    "Vous êtes prévenu par notification et par e-mail, selon le délai choisi.",
                  )}
                </p>
                {rows("reminder", reminders)}
              </>,
              addButton("reminder", "Ajouter un rappel"),
              !reminders.length ? "reminders" : undefined,
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
                {tr("Modifier les habitudes")}
              </button>,
              ![
                pet.food,
                pet.routine,
                pet.behavior,
                pet.medical,
                pet.contact,
                pet.vet,
              ].some(Boolean)
                ? "data"
                : undefined,
            )}
          {active === "confiance" &&
            panel(
              "Ses personnes de confiance",
              <>
                <p className="muted">
                  {tr(
                    "Des proches et professionnels à retrouver facilement. L’association à ce carnet ne donne pas accès aux documents.",
                  )}
                </p>
                <PeopleList
                  people={people}
                  animals={data.animals}
                  actions={actions}
                  animal={id}
                />
                <a className="text-button" href={`#partage/personnes/${id}`}>
                  {tr("Gérer les personnes et les partages →")}
                </a>
              </>,
              <div className="row-buttons">
                <button
                  className="button outline"
                  onClick={() =>
                    actions.openDialog("associate-people", { animal: id })
                  }
                >
                  {tr("Associer une personne")}
                </button>
                <button
                  className="button"
                  onClick={() =>
                    actions.openDialog("add-person", { animal: id })
                  }
                >
                  {tr("Ajouter une personne")}
                </button>
              </div>,
              !people.length ? "people" : undefined,
            )}
        </>
      )}
    </div>
  );
}
function age(
  dob: string,
  tr: import("../../../../shared/translations.ts").Translator,
) {
  if (!dob) return tr("Âge non renseigné");
  const now = new Date(),
    birth = new Date(`${dob}T12:00:00`);
  let years = now.getFullYear() - birth.getFullYear();
  if (
    now.getMonth() < birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())
  )
    years--;
  return tr(years === 1 ? "{0} an" : "{0} ans", [Math.max(0, years)]);
}
