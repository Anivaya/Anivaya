import type { Dispatch, SetStateAction, InputHTMLAttributes } from "react";
import type {
  Animal,
  AnimalEvent,
  Document,
  Person,
  Reminder,
  Share,
  Dashboard,
  FormError,
} from "../../../shared/models.ts";
export type {
  Animal,
  AnimalEvent,
  Document,
  Person,
  Reminder,
  Share,
  Dashboard,
  FormError,
  EmergencySettings,
  EmergencySheet,
} from "../../../shared/models.ts";
export { errorMessage, errorField } from "../../../shared/models.ts";
export type DialogKind =
  | "animal"
  | "edit-animal"
  | "record-event"
  | "edit-event"
  | "view-event"
  | "record-reminder"
  | "edit-reminder"
  | "habits"
  | "delete-record-item"
  | "add-animal"
  | "reminder"
  | "add-reminder"
  | "document"
  | "add-document"
  | "edit-document"
  | "delete-document"
  | "add-person"
  | "edit-person"
  | "delete-person"
  | "remove-person"
  | "associate-people"
  | "share-document"
  | "share-documents"
  | "share-details"
  | "revoke-share";
export type DialogItem = Partial<
  Omit<Animal, "photo"> &
    Reminder &
    Omit<AnimalEvent, "type"> &
    Omit<Document, "type"> &
    Person &
    Omit<Share, "person">
> & {
  type?: string | null;
  photo?: string | null;
  person?: string | null;
  entity?: "animal" | "event" | "reminder" | "emergency" | "document";
};
export interface DialogState {
  kind: DialogKind;
  item?: DialogItem;
}
export type OpenDialog = (kind: DialogKind, item?: DialogItem) => void;
export interface Actions {
  add: (kind: "animal" | "document" | "reminder", animal?: string) => void;
  openAnimal: (item: Animal) => void;
  openRecord: (item: Pick<Animal, "id">) => void;
  openDialog: OpenDialog;
  saved: (message: string) => Promise<void>;
  toggleReminder: (item: Reminder) => Promise<void>;
}
export interface PageProps {
  data: Dashboard;
  actions: Actions;
  pending: string | null;
  /** Segments du hash après le nom de la page, par exemple [id, onglet]. */
  params: string[];
}
export interface DialogControls {
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
  busy: boolean;
  setBusy: Dispatch<SetStateAction<boolean>>;
}
export interface DialogProps<T = DialogItem> extends DialogControls {
  item: T;
  kind: DialogKind;
  data: Dashboard;
  onOpenDialog: OpenDialog;
  onOpenRecord: Actions["openRecord"];
}
export interface ValidationState {
  error: FormError | null;
  invalid: (
    name: string,
  ) => Pick<
    InputHTMLAttributes<HTMLInputElement>,
    "aria-invalid" | "aria-describedby"
  >;
}
