import type { Document } from "../../shared/types.ts";

const extensions: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
};

/** Nom de fichier sûr, numéroté pour garder l’ordre dans l’archive. */
export function downloadName(document: Document, index?: number) {
  const extension = extensions[document.type ?? ""] ?? "";
  let name =
    document.name
      .replace(/[<>:"/\\|?*\p{Cc}]/gu, "-")
      .replace(/[. ]+$/, "")
      .slice(0, 140) || "document";
  if (extension && !/\.(pdf|jpe?g|png)$/i.test(name)) name += extension;
  return index === undefined
    ? name
    : `${String(index + 1).padStart(2, "0")}-${name}`;
}

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = Object.assign(window.document.createElement("a"), {
    href: url,
    download: name,
  });
  window.document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

async function fetchFile(document: Document) {
  const response = await fetch(document.url!);
  if (!response.ok)
    throw new Error(`Le fichier « ${document.name} » est indisponible.`);
  return new Uint8Array(await response.arrayBuffer());
}

/** Un fichier : téléchargé tel quel. Plusieurs : réunis dans une archive ZIP. */
export async function downloadDocuments(documents: Document[]) {
  if (documents.length === 1) {
    const [document] = documents;
    save(
      new Blob([await fetchFile(document)], { type: document.type ?? "" }),
      downloadName(document),
    );
    return;
  }
  const files = [];
  for (const [index, document] of documents.entries())
    files.push({
      name: downloadName(document, index),
      bytes: await fetchFile(document),
    });
  save(zip(files), "anivaya-documents.zip");
}

let crcTable: Uint32Array | undefined;
function crc32(bytes: Uint8Array) {
  crcTable ??= Uint32Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Archive ZIP sans compression (méthode « stored »), noms en UTF-8. */
function zip(files: { name: string; bytes: Uint8Array }[]) {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const directory: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    const crc = crc32(file.bytes);
    const local = new Uint8Array(30 + name.length);
    const l = new DataView(local.buffer);
    l.setUint32(0, 0x04034b50, true);
    l.setUint16(4, 20, true);
    l.setUint16(6, 0x800, true);
    l.setUint16(12, 33, true); // 1er janvier 1980 : date DOS valide
    l.setUint32(14, crc, true);
    l.setUint32(18, file.bytes.length, true);
    l.setUint32(22, file.bytes.length, true);
    l.setUint16(26, name.length, true);
    local.set(name, 30);
    const entry = new Uint8Array(46 + name.length);
    const c = new DataView(entry.buffer);
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x800, true);
    c.setUint16(14, 33, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, file.bytes.length, true);
    c.setUint32(24, file.bytes.length, true);
    c.setUint16(28, name.length, true);
    c.setUint32(42, offset, true);
    entry.set(name, 46);
    parts.push(local, file.bytes);
    directory.push(entry);
    offset += local.length + file.bytes.length;
  }
  const size = directory.reduce((total, entry) => total + entry.length, 0);
  const end = new Uint8Array(22);
  const e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, files.length, true);
  e.setUint16(10, files.length, true);
  e.setUint32(12, size, true);
  e.setUint32(16, offset, true);
  return new Blob(
    [...parts, ...directory, end].map((p) => p.slice().buffer),
    {
      type: "application/zip",
    },
  );
}
