import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useLanguage } from "../language.ts";
import { request } from "../services/api.ts";
import { translateMessage } from "../../../../shared/translations.ts";
import type {
  TranslationCatalogue,
  TranslationScope,
  Language,
  Translator,
} from "../../../../shared/translations.ts";

const cache = new Map<string, TranslationCatalogue>();
const requests = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();
const empty: Record<string, string> = {};
const subscribe = (notify: () => void) => {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
};
async function load(scope: TranslationScope, language: Language) {
  const key = `${scope}/${language}`;
  if (cache.has(key)) return;
  if (requests.has(key)) return requests.get(key);
  const pending = (async () => {
    let catalogue: TranslationCatalogue;
    try {
      catalogue = await request<TranslationCatalogue>(
        `/translations?scope=${scope}&lang=${language}`,
        { signal: AbortSignal.timeout(5000) },
      );
      if (
        catalogue.scope !== scope ||
        catalogue.language !== language ||
        !catalogue.messages ||
        typeof catalogue.messages !== "object" ||
        Array.isArray(catalogue.messages) ||
        Object.values(catalogue.messages).some(
          (value) => typeof value !== "string",
        )
      )
        throw new Error("Invalid translation catalogue");
    } catch {
      // Same versioned catalogue as the API, loaded only if the service is unavailable.
      const { translationCatalogue } = await import(
        "../../../../shared/translations/catalogue.ts"
      );
      catalogue = translationCatalogue(scope, language);
    }
    cache.set(key, catalogue);
    listeners.forEach((notify) => notify());
  })()
    .catch(() => {
      /* If both API and fallback chunk fail, keep the French source readable. */
    })
    .finally(() => requests.delete(key));
  requests.set(key, pending);
  return pending;
}

/** Cached, deduplicated catalogue request; no page remount or form reset on language changes. */
export function useTranslations(scope: TranslationScope | null): Translator {
  const [language] = useLanguage();
  const key = `${scope}/${language}`;
  const catalogue = useSyncExternalStore(
    subscribe,
    () => cache.get(key),
    () => undefined,
  );
  useEffect(() => {
    if (scope) void load(scope, language);
  }, [scope, language]);
  useEffect(() => {
    document.documentElement.lang = scope ? language : "fr";
    window.dispatchEvent(new Event("anivaya-page-title"));
  }, [scope, language]);
  return useCallback(
    (source, values) =>
      translateMessage(
        scope ? catalogue?.messages || empty : empty,
        source,
        values,
      ),
    [scope, catalogue],
  );
}
