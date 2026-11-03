import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { databasePath } from "../database/connection.ts";

export interface Mail {
  to: string;
  subject: string;
  /** Texte brut ; le HTML est produit à partir de ces paragraphes. */
  text: string;
  /** Lien principal, affiché comme bouton dans la version HTML. */
  action?: { label: string; url: string };
}

/**
 * Adresses auxquelles aucun e-mail n’est jamais envoyé : domaines réservés aux exemples
 * (RFC 2606) et adresses explicitement exclues (comptes de démonstration).
 */
const reserved = /@([a-z0-9-]+\.)*(example|test|invalid|localhost)$/i;
const excluded = new Set<string>();
/** Exclut des adresses de tout envoi (comptes de démonstration, dont l’adresse n’est pas à nous). */
export function excludeFromMail(addresses: string[]) {
  for (const address of addresses) excluded.add(address.toLowerCase());
}

let transporter: Transporter | null | undefined;
function smtp() {
  if (transporter !== undefined) return transporter;
  const host = process.env.SMTP_HOST;
  transporter = host
    ? nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === "true",
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
          : undefined,
      })
    : null;
  return transporter;
}

/** Adresse publique du site, pour les liens des e-mails. */
export const appUrl = () =>
  (process.env.APP_URL || "http://127.0.0.1:5173").replace(/\/$/, "");

const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

function html(mail: Mail) {
  const paragraphs = mail.text
    .split(/\n{2,}/)
    .map(
      (p) =>
        `<p style="margin:0 0 14px">${escape(p).replace(/\n/g, "<br>")}</p>`,
    )
    .join("");
  const button = mail.action
    ? `<p style="margin:22px 0"><a href="${escape(mail.action.url)}" style="background:#1b3b8e;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">${escape(mail.action.label)}</a></p>`
    : "";
  return `<div style="font-family:Segoe UI,Arial,sans-serif;color:#132e5c;font-size:15px;line-height:1.6;max-width:560px">${paragraphs}${button}<p style="color:#65748b;font-size:12px;margin-top:28px">Anivaya · Toute leur vie, à vos côtés.</p></div>`;
}

/**
 * Envoie un e-mail. Avec `SMTP_HOST`, il part réellement ; sans configuration, il est
 * déposé dans la boîte locale (`MAIL_OUTBOX`, par défaut `database/data/outbox`) pour
 * être consulté. Un échec d’envoi est journalisé sans interrompre l’action de l’utilisateur.
 */
export async function sendMail(
  mail: Mail,
): Promise<"sent" | "outbox" | "skipped" | "failed"> {
  const to = mail.to.trim().toLowerCase();
  if (!to || reserved.test(to) || excluded.has(to)) return "skipped";
  const from = process.env.MAIL_FROM || "Anivaya <no-reply@anivaya.fr>";
  const text = mail.action
    ? `${mail.text}\n\n${mail.action.label} : ${mail.action.url}`
    : mail.text;
  const transport = smtp();
  try {
    if (transport) {
      await transport.sendMail({
        from,
        to,
        subject: mail.subject,
        text,
        html: html(mail),
      });
      return "sent";
    }
    const outbox =
      process.env.MAIL_OUTBOX || join(dirname(databasePath()), "outbox");
    mkdirSync(outbox, { recursive: true });
    const file = join(
      outbox,
      `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}.eml`,
    );
    writeFileSync(
      file,
      `From: ${from}\nTo: ${to}\nSubject: ${mail.subject}\nContent-Type: text/plain; charset=utf-8\n\n${text}\n`,
    );
    return "outbox";
  } catch (error) {
    console.error("Envoi d’e-mail impossible :", (error as Error).message);
    return "failed";
  }
}
