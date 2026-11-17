import type { LegalContent } from "./legal.ts";

export interface PublicSettings {
  legal: LegalContent | null;
  emailFormsAvailable: boolean;
  aiImportAvailable: boolean;
  testingPreview: boolean;
}
