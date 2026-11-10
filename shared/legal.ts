export interface LegalContent {
  reviewed: boolean;
  sections: { id: string; title: string; paragraphs: string[] }[];
}
