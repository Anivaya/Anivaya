import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// L’ordre des feuilles fixe la cascade : les styles de domaine surchargent global.css.
import "./css/global.css";
import "./css/public.css";
import "./css/auth.css";
import "./css/profile.css";
import "./css/directory.css";
import "./css/public-emergency.css";
import "./css/account.css";
import "./css/dashboard.css";
import "./css/animals.css";
import "./css/record.css";
import "./css/sharing.css";
import "./css/collections.css";
import "./css/secondary.css";
import "./css/communities.css";
import "./css/ai-import.css";
import "./css/admin.css";
import "./css/buttons.css";
import "./pages/home/landing.css";
import "./css/harmony.css";
import "./css/footer.css";
import "./css/language.css";
import "./css/scrollbars.css";
import App from "./App.tsx";
import { startWideZoom } from "./shared/wideZoom.ts";
import { startResponsiveScrollbars } from "./shared/scrollbars.ts";
import { startPageTitles } from "./shared/layout/startPageTitles.ts";

// Un rafraîchissement rouvre la page tout en haut au lieu de reprendre l’ancienne position.
// Les discussions (messagerie, communautés, événements) se placent elles-mêmes sur leurs messages.
if ("scrollRestoration" in history) history.scrollRestoration = "manual";

// Cases à cocher et interrupteurs : un court effet d’activation ou de désactivation à chaque
// changement (bool-on / bool-off, voir global.css), jamais au chargement de la page.
document.addEventListener("change", (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || input.type !== "checkbox") return;
  input.classList.remove("bool-on", "bool-off");
  void input.offsetWidth;
  input.classList.add(input.checked ? "bool-on" : "bool-off");
  input.addEventListener(
    "animationend",
    () => input.classList.remove("bool-on", "bool-off"),
    { once: true },
  );
});

// Onglets dépliables (<details>) : la classe « opening » rejoue l’effet d’ouverture à chaque
// fois ; sans elle, le navigateur ne le joue qu’à la première ouverture.
document.addEventListener(
  "toggle",
  (event) => {
    const details = event.target;
    if (!(details instanceof HTMLDetailsElement)) return;
    details.classList.remove("opening");
    if (!details.open) return;
    void details.offsetWidth;
    details.classList.add("opening");
    details.addEventListener(
      "animationend",
      () => details.classList.remove("opening"),
      { once: true },
    );
  },
  true,
);

// Écrans plus larges que 1440 px : mise en page de 1440 px agrandie (voir wideZoom.ts).
startWideZoom();
const stopResponsiveScrollbars = startResponsiveScrollbars();
const stopPageTitles = startPageTitles();
if (import.meta.hot) import.meta.hot.dispose(stopPageTitles);
if (import.meta.hot) import.meta.hot.dispose(stopResponsiveScrollbars);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
