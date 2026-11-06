import { useSyncExternalStore } from "react";

export const languages = [
  { code: "fr", name: "Français" },
  { code: "en", name: "English" },
] as const;
export type Language = (typeof languages)[number]["code"];
const key = "anivaya-preferred-language";
const changed = "anivaya-language-changed";
let memory: Language = "fr";
let storageAvailable = true;
export function getLanguage(): Language {
  if (!storageAvailable) return memory;
  try {
    const value = localStorage.getItem(key);
    memory = value === "en" ? "en" : "fr";
  } catch {
    storageAvailable = false;
  }
  return memory;
}
function subscribe(notify: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key === key || event.key === null) notify();
  };
  window.addEventListener(changed, notify);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener(changed, notify);
    window.removeEventListener("storage", storage);
  };
}
export function useLanguage() {
  const language = useSyncExternalStore(
    subscribe,
    getLanguage,
    () => "fr" as Language,
  );
  return [
    language,
    (value: Language) => {
      memory = value;
      try {
        if (storageAvailable) localStorage.setItem(key, value);
      } catch {
        storageAvailable = false;
      }
      window.dispatchEvent(new Event(changed));
    },
  ] as const;
}
