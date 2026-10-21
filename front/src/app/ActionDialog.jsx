import { useState } from "react";
import Modal from "../shared/ui/Modal.jsx";
import AnimalDetails from "../pages/animals/dialogs/AnimalDetails.jsx";
import AnimalForm from "../pages/animals/dialogs/AnimalForm.jsx";
import ReminderDetails from "../pages/reminders/dialogs/ReminderDetails.jsx";
import ReminderForm from "../pages/reminders/dialogs/ReminderForm.jsx";
import DocumentDetails from "../pages/documents/dialogs/DocumentDetails.jsx";
import DocumentForm from "../pages/documents/dialogs/DocumentForm.jsx";
import DeleteDocument from "../pages/documents/dialogs/DeleteDocument.jsx";
import PublicSiteNotice from "../pages/public/PublicSiteNotice.jsx";

const dialogs = {
  animal: AnimalDetails,
  "add-animal": AnimalForm,
  reminder: ReminderDetails,
  "add-reminder": ReminderForm,
  document: DocumentDetails,
  "add-document": DocumentForm,
  "edit-document": DocumentForm,
  "delete-document": DeleteDocument,
  public: PublicSiteNotice,
};

export default function ActionDialog({ modal, data, onClose, onSaved }) {
  const [busy, setBusy] = useState(false);
  const Content = dialogs[modal.kind];
  return (
    <Modal onClose={onClose} busy={busy}>
      <Content
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
