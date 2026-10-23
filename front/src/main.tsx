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
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
