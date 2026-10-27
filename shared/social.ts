/** Contrats JSON des communautés : données partagées entre tous les comptes. */
import type { UploadedFile } from "./models.ts";

export const communityTopics = [
  "Balades",
  "Chats",
  "Entraide",
  "Éducation",
  "Autre",
] as const;
export type CommunityTopic = (typeof communityTopics)[number];
export type ThreadKind = "community" | "event" | "direct" | "private";
export const reportReasons = [
  "Comportement irrespectueux",
  "Contenu inapproprié",
  "Publicité ou spam",
  "Autre",
] as const;

/** Un membre : compte de l’application ou membre fictif de démonstration. */
export interface SocialPerson {
  id: string;
  name: string;
  city: string;
  animal: string;
}
export interface Community {
  id: string;
  name: string;
  city: string;
  topic: CommunityTopic;
  description: string;
  owner: string | null;
  tone: "gold" | "blue" | "sage";
  members: string[];
  thread: string;
}
export interface SocialEvent {
  id: string;
  name: string;
  city: string;
  place: string;
  /** Date et heure ISO. */
  date: string;
  capacity: number;
  description: string;
  /** Identifiant de la communauté, ou "" pour un événement ouvert à tous. */
  community: string;
  owner: string | null;
  participants: string[];
  thread: string;
  cancelled: boolean;
}
export interface SocialMessage {
  id: string;
  sender: string;
  text: string;
  /** URL de la photo jointe, servie par l’API avec contrôle d’accès. */
  photo: string | null;
  at: string;
}
/** Discussion lisible par le compte connecté ; les messages des personnes bloquées sont retirés. */
export interface Thread {
  id: string;
  kind: ThreadKind;
  /** Communauté ou événement lié, sinon "". */
  ref: string;
  /** Nom du groupe, de la communauté ou de l’événement ; "" pour un message privé. */
  name: string;
  owner: string | null;
  /** Photo de la discussion (groupe, communauté, événement), sinon null. */
  photo: string | null;
  members: string[];
  messages: SocialMessage[];
  unread: number;
  canSend: boolean;
  /** Le dernier message a été lu par un membre autre que son expéditeur : affiche « Lu ». */
  latestRead: boolean;
}
export interface Friendship {
  from: string;
  to: string;
  status: "pending" | "accepted";
  at: string;
}
export interface SocialData {
  me: string;
  people: SocialPerson[];
  communities: Community[];
  events: SocialEvent[];
  threads: Thread[];
  /** Relations qui concernent le compte connecté. */
  friends: Friendship[];
  /** Personnes bloquées par le compte connecté. */
  myBlocks: string[];
  /** Personnes avec qui un blocage existe, dans un sens ou dans l’autre. */
  blocked: string[];
}

export interface CommunityInput {
  name: string;
  city: string;
  topic: CommunityTopic;
  description: string;
}
export interface EventInput {
  name: string;
  city: string;
  place: string;
  date: string;
  capacity: number;
  community: string;
  description: string;
}
export interface ThreadInput {
  people: string[];
  /** Présent pour un groupe privé ; absent pour un message privé. */
  name?: string;
}
export interface ThreadUpdate {
  name?: string;
  /** null retire la photo. */
  photo?: UploadedFile | null;
}
export interface MessageInput {
  text: string;
  photo?: UploadedFile;
}
export type FriendAction = "request" | "accept" | "remove";
export interface ReportInput {
  type: "person" | "message";
  target: string;
  reason: string;
}
