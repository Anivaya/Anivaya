import type { Dashboard, DialogControls } from "./types.ts";
import { errorMessage } from "./types.ts";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./services/api.ts";

/** Charge l’espace ; un nouveau chargement annule le précédent. `reload` rejette en cas d’échec. */
export function useDashboard() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const load = useCallback(() => {
    controller.current?.abort();
    const next = new AbortController();
    controller.current = next;
    return api
      .dashboard(next.signal)
      .then(
        (result) => {
          if (next.signal.aborted) return;
          setData(result);
          setError("");
        },
        (failure) => {
          if (failure instanceof Error && failure.name === "AbortError") return;
          setError(errorMessage(failure));
          throw failure;
        },
      )
      .finally(() => {
        if (!next.signal.aborted) setLoading(false);
      });
  }, []);
  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    await load();
  }, [load]);
  useEffect(() => {
    load().catch(() => {});
    return () => controller.current?.abort();
  }, [load]);
  return { data, loading, error, reload };
}

/** Action d’une fenêtre sans formulaire (suppression, changement de statut). */
export function useDialogAction(setBusy: DialogControls["setBusy"]) {
  const [error, setError] = useState("");
  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  return { error, run };
}

/** Vrai tant que la requête média correspond (suit les changements de taille d’écran). */
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const media = matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);
  return matches;
}
