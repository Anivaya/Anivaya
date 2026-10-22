import RecordAction from "../pages/animals/dialogs/RecordAction.jsx";
import SharingDialog from "../pages/sharing/dialogs/SharingDialog.jsx";
import { useState } from "react";
import Modal from "../shared/ui/Modal.jsx";
import AnimalDetails from "../pages/animals/dialogs/AnimalDetails.jsx";
import AnimalForm from "../pages/animals/dialogs/AnimalForm.jsx";
import ReminderDetails from "../pages/reminders/dialogs/ReminderDetails.jsx";
import ReminderForm from "../pages/reminders/dialogs/ReminderForm.jsx";
import DocumentDetails from "../pages/documents/dialogs/DocumentDetails.jsx";
import DocumentForm from "../pages/documents/dialogs/DocumentForm.jsx";
import DeleteDocument from "../pages/documents/dialogs/DeleteDocument.jsx";
import CloseDialogButton from "../shared/ui/CloseDialogButton.jsx";

const dialogs = {
  animal: AnimalDetails,
  "edit-animal": AnimalForm,
  "record-event": RecordAction,
  "edit-event": RecordAction,
  "view-event": RecordAction,
  "record-reminder": ReminderForm,
  "edit-reminder": ReminderForm,
  "add-person": SharingDialog,
  "edit-person": SharingDialog,
  "delete-person": SharingDialog,
  "remove-person": SharingDialog,
  "associate-people": SharingDialog,
  "share-document": SharingDialog,
  "share-documents": SharingDialog,
  "share-details": SharingDialog,
  "revoke-share": SharingDialog,
  habits: RecordAction,
  "delete-record-item": RecordAction,
  "add-animal": AnimalForm,
  reminder: ReminderDetails,
  "add-reminder": ReminderForm,
  document: DocumentDetails,
  "add-document": DocumentForm,
  "edit-document": DocumentForm,
  "delete-document": DeleteDocument,
  public: PublicSiteNotice,
};

export default function ActionDialog({
  modal,
  data,
  onClose,
  onSaved,
  onOpenRecord,
  onOpenDialog,
}) {
  const [busy, setBusy] = useState(false);
  const Content = dialogs[modal.kind];
  return (
    <Modal
      onClose={onClose}
      busy={busy}
      compact={modal.kind === "animal"}
      sharing={Content === SharingDialog}
    >
      <Content
        kind={modal.kind}
        onOpenRecord={onOpenRecord}
        onOpenDialog={onOpenDialog}
        item={modal.item}
        data={data}
        onClose={onClose}
        onSaved={onSaved}
        busy={busy}
        setBusy={setBusy}
      />
    </Modal>
  );
}

function PublicSiteNotice({ onClose }) {
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
