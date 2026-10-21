import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../services/api.js";
export function useDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const controller = useRef(null);
  const reload = useCallback(async () => {
    controller.current?.abort();
    const next = new AbortController();
    controller.current = next;
    setLoading(true);
    setError("");
    try {
      const result = await api.dashboard(next.signal);
      if (!next.signal.aborted) setData(result);
    } catch (failure) {
      if (failure.name !== "AbortError") {
        setError(failure.message);
        throw failure;
      }
    } finally {
      if (!next.signal.aborted) setLoading(false);
    }
  }, []);
  useEffect(() => {
    const initial = new AbortController();
    controller.current = initial;
    api
      .dashboard(initial.signal)
      .then((result) => {
        if (!initial.signal.aborted) {
          setData(result);
          setError("");
        }
      })
      .catch((failure) => {
        if (failure.name !== "AbortError") setError(failure.message);
      })
      .finally(() => {
        if (!initial.signal.aborted) setLoading(false);
      });
    return () => controller.current?.abort();
  }, []);
  return { data, loading, error, reload };
}
