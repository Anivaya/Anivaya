export class ApiError extends Error {
  status: number;
  field?: string;
  constructor(status: number, message: string, field?: string) {
    super(message);
    this.status = status;
    this.field = field;
  }
}
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
export function date(value: unknown) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number(value.slice(0, 4))
  )
    throw new ApiError(400, "Choisissez une date valide.", "date");
  const parsed = new Date(`${value}T12:00:00Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  )
    throw new ApiError(400, "Choisissez une date valide.", "date");
  return value;
}
export function documentFile(type: unknown, content: unknown) {
  if (
    typeof type !== "string" ||
    !["application/pdf", "image/png", "image/jpeg"].includes(type) ||
    typeof content !== "string" ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(content)
  )
    throw new ApiError(400, "Choisissez un PDF, JPEG ou PNG.", "file");
  const buffer = Buffer.from(content, "base64");
  if (!buffer.length || buffer.length > 10 * 1024 * 1024)
    throw new ApiError(
      400,
      "Le fichier doit faire entre 1 octet et 10 Mo.",
      "file",
    );
  const valid =
    type === "application/pdf"
      ? buffer.subarray(0, 5).toString() === "%PDF-"
      : type === "image/png"
        ? buffer
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
  if (!valid)
    throw new ApiError(
      400,
      "Le contenu du fichier ne correspond pas au format annoncé.",
      "file",
    );
  return buffer;
}
