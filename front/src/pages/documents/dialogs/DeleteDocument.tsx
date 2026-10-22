import { errorMessage } from "../../../shared/types.ts";
import type { Document, DialogProps } from "../../../shared/types.ts";
import { useState } from "react";
import { api } from "../../../shared/services/api.ts";
import { animalName } from "../../../shared/utils/format.ts";
export default function DeleteDocument({
  item,
  data,
  onClose,
  onSaved,
  busy,
  setBusy,
}: DialogProps<Document>) {
  const [error, setError] = useState("");
  const animals = data.animals;
  return (
    <>
      <h2 id="action-title" className="dialog-title">
        Supprimer ce document ?
      </h2>
      <p className="dialog-copy">
        « {item.name} » sera retiré du carnet de{" "}
        {animalName(animals, item.animal)}. Le fichier d’origine sur votre
        ordinateur sera conservé. Les partages de ce document seront révoqués.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="dialog-actions">
        <button className="button outline" onClick={onClose} disabled={busy}>
          Annuler
        </button>
        <button
          className="button danger"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await api.deleteDocument(item.id);
              await onSaved("Document retiré du carnet.");
            } catch (failure) {
              setError(errorMessage(failure));
              setBusy(false);
            }
          }}
        >
          {busy ? "Suppression…" : "Supprimer le document"}
        </button>
      </div>
    </>
  );
}
