import type {
  DatabaseSync,
  StatementSync,
  SQLInputValue,
  SQLOutputValue,
} from "node:sqlite";
import type {
  Animal,
  Reminder,
  Document,
  Person,
  Share,
  AnimalEvent,
  Household,
  Dashboard,
} from "../../shared/models.ts";
export type {
  Animal,
  Reminder,
  Document,
  Person,
  Share,
  AnimalEvent,
  Household,
  Dashboard,
};
export type Input = Record<string, unknown>;
/** Types des projections SQL : chaque requête précise la forme de ses colonnes. */
export type Database = Omit<DatabaseSync, "prepare"> & {
  prepare(sql: string): Omit<StatementSync, "get" | "all"> & {
    get<T = Record<string, SQLOutputValue>>(
      ...params: SQLInputValue[]
    ): T | undefined;
    all<T = Record<string, SQLOutputValue>>(...params: SQLInputValue[]): T[];
  };
};
export type AnimalRow = Omit<Animal, "photo"> & {
  deleted_at: string | null;
  hasPhoto: number | null;
};
export type ReminderRow = Omit<Reminder, "done"> & {
  done: number;
  deleted_at: string | null;
};
export type DocumentRow = Omit<Document, "example" | "hasFile" | "url"> & {
  example: number;
  content: Uint8Array | number | null;
  deleted_at: string | null;
};
export type PersonRow = Omit<Person, "animals"> & { deleted_at: string | null };
export type ShareRow = Omit<Share, "revoked" | "status"> & { revoked: number };
export interface EmergencyRow {
  animal: string;
  settings: string;
  snapshot: string;
  updated_at: string;
}
