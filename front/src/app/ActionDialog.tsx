import type {
  DialogState,
  Dashboard,
  DialogControls,
  Actions,
  OpenDialog,
  Animal,
  Reminder,
  Document,
} from "../shared/types.ts";
import RecordAction from "../pages/animals/dialogs/RecordAction.tsx";
import SharingDialog from "../pages/sharing/dialogs/SharingDialog.tsx";
import { useState } from "react";
import Modal from "../shared/ui/Modal.tsx";
import AnimalDetails from "../pages/animals/dialogs/AnimalDetails.tsx";
import AnimalForm from "../pages/animals/dialogs/AnimalForm.tsx";
import ReminderDetails from "../pages/reminders/dialogs/ReminderDetails.tsx";
import ReminderForm from "../pages/reminders/dialogs/ReminderForm.tsx";
import DocumentDetails from "../pages/documents/dialogs/DocumentDetails.tsx";
import DocumentForm from "../pages/documents/dialogs/DocumentForm.tsx";
import DeleteDocument from "../pages/documents/dialogs/DeleteDocument.tsx";
import CloseDialogButton from "../shared/ui/CloseDialogButton.tsx";

const sharingDialogs = new Set<DialogState["kind"]>([
  "add-person",
  "edit-person",
  "delete-person",
  "remove-person",
  "associate-people",
  "share-document",
  "share-documents",
  "share-details",
  "revoke-share",
]);

export default function ActionDialog({
  modal,
  data,
  onClose,
  onSaved,
  onOpenRecord,
  onOpenDialog,
}: {
  modal: DialogState;
  data: Dashboard;
  onClose: () => void;
  onSaved: DialogControls["onSaved"];
  onOpenRecord: Actions["openRecord"];
  onOpenDialog: OpenDialog;
}) {
  const [busy, setBusy] = useState(false);
  const props = {
    kind: modal.kind,
    onOpenRecord,
    onOpenDialog,
    data,
    onClose,
    onSaved,
    busy,
    setBusy,
  };
  const item = modal.item || {};
  let content;
  switch (modal.kind) {
    case "animal":
      content = <AnimalDetails {...props} item={item as Animal} />;
      break;
    case "add-animal":
    case "edit-animal":
      content = <AnimalForm {...props} item={item as Partial<Animal>} />;
      break;
    case "reminder":
      content = <ReminderDetails {...props} item={item as Reminder} />;
      break;
    case "record-reminder":
    case "add-reminder":
    case "edit-reminder":
      content = <ReminderForm {...props} item={item as Partial<Reminder>} />;
      break;
    case "document":
      content = <DocumentDetails {...props} item={item as Document} />;
      break;
    case "delete-document":
      content = <DeleteDocument {...props} item={item as Document} />;
      break;
    case "add-document":
    case "edit-document":
      content = <DocumentForm {...props} item={item as Partial<Document>} />;
      break;
    case "public":
      content = <PublicSiteNotice onClose={onClose} />;
      break;
    case "record-event":
    case "edit-event":
    case "view-event":
    case "habits":
    case "delete-record-item":
      content = <RecordAction {...props} item={item} />;
      break;
    default:
      content = <SharingDialog {...props} item={item} />;
  }
  return (
    <Modal
      onClose={onClose}
      busy={busy}
      compact={modal.kind === "animal"}
      sharing={sharingDialogs.has(modal.kind)}
    >
      {content}
    </Modal>
  );
}

function PublicSiteNotice({ onClose }: { onClose: () => void }) {
  return (
    <>
      <h2 id="action-title" className="dialog-title">
        Le site public
      </h2>
      <p className="dialog-copy">
        La page publique n’est pas encore intégrée en React. Votre espace reste
        disponible ici.
      </p>
      <CloseDialogButton onClose={onClose} />
    </>
  );
}
