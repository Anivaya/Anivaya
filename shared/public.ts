export const leadKinds = [
  "liste-attente",
  "pro",
  "clinique",
  "entreprise",
] as const;
export type LeadKind = (typeof leadKinds)[number];
export interface LeadInput {
  kind: LeadKind;
  name: string;
  email: string;
  postalCode?: string;
  profile?: string;
  animals?: string[];
  plan?: string;
  activity?: string;
  organization?: string;
  organizationType?: string;
  phone?: string;
  message?: string;
  consent: boolean;
  requestId: string;
}
export interface LeadReceipt {
  accepted: true;
}
