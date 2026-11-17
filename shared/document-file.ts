/** Safe download name with the extension matching the stored MIME type. */
export function downloadName(document: { name: string; type?: string | null }, index?: number) {
  const extensions: Record<string, string> = {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/png": ".png",
  };
  const extension = extensions[document.type ?? ""] ?? "";
  let name = document.name.replace(/[<>:"/\\|?*\p{Cc}]/gu, "-").replace(/[. ]+$/, "").slice(0, 140) || "document";
  if (extension && !/\.(pdf|jpe?g|png)$/i.test(name)) name += extension;
  return index === undefined ? name : `${String(index + 1).padStart(2, "0")}-${name}`;
}
