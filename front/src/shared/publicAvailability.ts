import { createContext, useContext, useEffect, useState } from "react";
import type { PublicSettings } from "../../../shared/public-settings.ts";
import { request } from "./services/api.ts";

const unavailable: PublicSettings = {
  legal: null, emailFormsAvailable: false, aiImportAvailable: false, testingPreview: false,
};
export const PublicAvailability = createContext<PublicSettings | undefined>(undefined);
export function usePublicAvailability() {
  const settings = useContext(PublicAvailability);
  const features = settings ?? unavailable;
  return {
    ...features,
    loading: settings === undefined,
    contactHref: features.emailFormsAvailable ? "#contact" : "mailto:contact@anivaya.fr",
  };
}
export function useLoadPublicSettings() {
  const [settings, setSettings] = useState<PublicSettings>();
  useEffect(() => {
    const controller = new AbortController();
    request<PublicSettings>("/public/settings", { signal: controller.signal })
      .then(value => { if (!controller.signal.aborted) setSettings(value); })
      .catch(() => { if (!controller.signal.aborted) setSettings(unavailable); });
    return () => controller.abort();
  }, []);
  return settings;
}
