import type { Input } from "../database/types.ts";

export class ApiError extends Error {
  status: number;
  field?: string;
  constructor(status: number, message: string, field?: string) {
    super(message);
    this.status = status;
    this.field = field;
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[+\d\s().-]{6,25}$/;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export const isEmail = (value: string) => EMAIL.test(value);
export const isPhone = (value: string) => PHONE.test(value);
export const isBase64 = (value: string) => BASE64.test(value);

/** Date du jour (AAAA-MM-JJ) à Paris, quel que soit le fuseau du serveur. */
export const localToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

export function text(
  value: unknown,
  field: string,
  max: number,
  required = true,
) {
  if (
    typeof value !== "string" ||
    (required && !value.trim()) ||
    value.trim().length > max
  ) {
    throw new ApiError(
      400,
      `Renseignez un champ valide (${max} caractères maximum).`,
      field,
    );
  }
  return value.trim();
}

export function oneOf(
  value: string,
  allowed: readonly string[],
  field: string,
  message: string,
) {
  if (!allowed.includes(value)) throw new ApiError(400, message, field);
  return value;
}

export function emailAddress(value: unknown) {
  const email = text(value, "email", 120).toLowerCase();
  if (!isEmail(email))
    throw new ApiError(400, "Vérifiez votre adresse e-mail.", "email");
  return email;
}

export function date(value: unknown, field = "date") {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number(value.slice(0, 4))
  )
    throw new ApiError(400, "Choisissez une date valide.", field);
  const parsed = new Date(`${value}T12:00:00Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  )
    throw new ApiError(400, "Choisissez une date valide.", field);
  return value;
}

/** Objet `{ type, content }` envoyé pour un fichier, ou erreur sur `field`. */
export function upload(value: unknown, message: string, field?: string) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ApiError(400, message, field);
  return value as Input;
}

export function documentFile(type: unknown, content: unknown, field = "file") {
  if (
    typeof type !== "string" ||
    !["application/pdf", "image/png", "image/jpeg"].includes(type) ||
    typeof content !== "string" ||
    !isBase64(content)
  )
    throw new ApiError(400, "Choisissez un PDF, JPEG ou PNG.", field);
  const buffer = Buffer.from(content, "base64");
  if (!buffer.length || buffer.length > 10 * 1024 * 1024)
    throw new ApiError(
      400,
      "Le fichier doit faire entre 1 octet et 10 Mo.",
      field,
    );
  const valid =
    type === "application/pdf"
      ? buffer.subarray(0, 5).toString() === "%PDF-"
      : type === "image/png"
        ? buffer.subarray(0, 8).equals(PNG_SIGNATURE)
        : buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
  if (!valid)
    throw new ApiError(
      400,
      "Le contenu du fichier ne correspond pas au format annoncé.",
      field,
    );
  return buffer;
}
