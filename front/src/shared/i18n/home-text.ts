import { homeEnglish } from "./home.en.ts";

/** Translate presentation text only; API values and user-entered data stay intact. */
export function homeText(text: string, language: "fr" | "en"): string {
  if (language === "fr") return text;
  if (Object.hasOwn(homeEnglish, text)) return homeEnglish[text];
  const limit = /^Utilisez au maximum (\d+) caractères\.$/.exec(text);
  if (limit) return `Use no more than ${limit[1]} characters.`;
  return text;
}
