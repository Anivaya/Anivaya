import { useHomeText } from "../../shared/i18n/HomeLocale.tsx";
import LanguageMenu from "../../shared/ui/LanguageMenu.tsx";
import Icon from "../../shared/ui/Icon.tsx";
import { memo } from "react";
import type { AuthUser } from "../../../../shared/account.ts";
import { AccountMenu } from "../../shared/layout/Sidebar.tsx";
import PublicFooter from "../../shared/layout/PublicFooter.tsx";
import LandingForm from "./LandingForm.tsx";
import LegalContent from "./LegalContent.tsx";
/** Contenu de présentation fidèle à la maquette ; les formulaires utilisent l’API. */
export default memo(function LandingContent({
  user,
  onLogout,
}: {
  user?: AuthUser | null;
  onLogout: () => Promise<void>;
}) {
  const t = useHomeText();
  return (
    <>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: "none" }}
        aria-hidden="true"
      >
        <symbol id="i-arrow-right" viewBox="0 0 24 24">
          <path d="M5 12h14" /> <path d="m12 5 7 7-7 7" />
        </symbol>
        <symbol id="i-badge-check" viewBox="0 0 24 24">
          <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" />{" "}
          <path d="m16 9-5.5 5.5L8 12" />
        </symbol>
        <symbol id="i-ban" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" />{" "}
          <path d="M4.929 4.929 19.07 19.071" />
        </symbol>
        <symbol id="i-bell" viewBox="0 0 24 24">
          <path d="M10.268 21a2 2 0 0 0 3.464 0" />{" "}
          <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
        </symbol>
        <symbol id="i-book-open" viewBox="0 0 24 24">
          <path d="M12 5v16" />{" "}
          <path d="M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z" />
        </symbol>
        <symbol id="i-building-2" viewBox="0 0 24 24">
          <path d="M10 12h4" /> <path d="M10 8h4" />{" "}
          <path d="M14 21v-3a2 2 0 0 0-4 0v3" />{" "}
          <path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2" />{" "}
          <path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
        </symbol>
        <symbol id="i-calendar-check" viewBox="0 0 24 24">
          <path d="M8 2v3" /> <path d="M16 2v3" />{" "}
          <rect x="3" y="3" width="18" height="18" rx="2" />{" "}
          <path d="M3 9h18" /> <path d="m9 15 2 2 4-4" />
        </symbol>
        <symbol id="i-calendar-days" viewBox="0 0 24 24">
          <path d="M8 2v3" /> <path d="M16 2v3" />{" "}
          <rect x="3" y="3" width="18" height="18" rx="2" />{" "}
          <path d="M3 9h18" /> <path d="M8 13h.01" /> <path d="M12 13h.01" />{" "}
          <path d="M16 13h.01" /> <path d="M8 17h.01" /> <path d="M12 17h.01" />{" "}
          <path d="M16 17h.01" />
        </symbol>
        <symbol id="i-cat" viewBox="0 0 24 24">
          <path d="M12 5c.67 0 1.35.09 2 .26 1.78-2 5.03-2.84 6.42-2.26 1.4.58-.42 7-.42 7 .57 1.07 1 2.24 1 3.44C21 17.9 16.97 21 12 21s-9-3-9-7.56c0-1.25.5-2.4 1-3.44 0 0-1.89-6.42-.5-7 1.39-.58 4.72.23 6.5 2.23A9.04 9.04 0 0 1 12 5Z" />{" "}
          <path d="M8 14v.5" /> <path d="M16 14v.5" />{" "}
          <path d="M11.25 16.25h1.5L12 17l-.75-.75Z" />
        </symbol>
        <symbol id="i-chart-column" viewBox="0 0 24 24">
          <path d="M3 3v16a2 2 0 0 0 2 2h16" /> <path d="M18 17V9" />{" "}
          <path d="M13 17V5" /> <path d="M8 17v-3" />
        </symbol>
        <symbol id="i-check" viewBox="0 0 24 24">
          <path d="M20 6 9 17l-5-5" />
        </symbol>
        <symbol id="i-chevron-down" viewBox="0 0 24 24">
          <path d="m6 9 6 6 6-6" />
        </symbol>
        <symbol id="i-chevron-left" viewBox="0 0 24 24">
          <path d="m15 18-6-6 6-6" />
        </symbol>
        <symbol id="i-circle-check" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" /> <path d="m16 9-5.5 5.5L8 12" />
        </symbol>
        <symbol id="i-clipboard-list" viewBox="0 0 24 24">
          <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />{" "}
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />{" "}
          <path d="M12 11h4" /> <path d="M12 16h4" /> <path d="M8 11h.01" />{" "}
          <path d="M8 16h.01" />
        </symbol>
        <symbol id="i-credit-card" viewBox="0 0 24 24">
          <rect width="20" height="14" x="2" y="5" rx="2" />{" "}
          <line x1="2" x2="22" y1="10" y2="10" /> <path d="M6 14h2" />
        </symbol>
        <symbol id="i-dog" viewBox="0 0 24 24">
          <path d="M11.25 16.25h1.5L12 17z" /> <path d="M16 14v.5" />{" "}
          <path d="M4.42 11.247A13.152 13.152 0 0 0 4 14.556C4 18.728 7.582 21 12 21s8-2.272 8-6.444a11.702 11.702 0 0 0-.493-3.309" />{" "}
          <path d="M8 14v.5" />{" "}
          <path d="M8.5 8.5c-.384 1.05-1.083 2.028-2.344 2.5-1.931.722-3.576-.297-3.656-1-.113-.994 1.177-6.53 4-7 1.923-.321 3.651.845 3.651 2.235A7.497 7.497 0 0 1 14 5.277c0-1.39 1.844-2.598 3.767-2.277 2.823.47 4.113 6.006 4 7-.08.703-1.725 1.722-3.656 1-1.261-.472-1.855-1.45-2.239-2.5" />
        </symbol>
        <symbol id="i-eye-off" viewBox="0 0 24 24">
          <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />{" "}
          <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />{" "}
          <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />{" "}
          <path d="m2 2 20 20" />
        </symbol>
        <symbol id="i-folder-lock" viewBox="0 0 24 24">
          <rect width="8" height="5" x="14" y="17" rx="1" />{" "}
          <path d="M10 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v2.5" />{" "}
          <path d="M20 17v-2a2 2 0 1 0-4 0v2" />
        </symbol>
        <symbol id="i-hourglass" viewBox="0 0 24 24">
          <path d="M5 22h14" /> <path d="M5 2h14" />{" "}
          <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" />{" "}
          <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
        </symbol>
        <symbol id="i-house" viewBox="0 0 24 24">
          <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />{" "}
          <path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        </symbol>
        <symbol id="i-id-card" viewBox="0 0 24 24">
          <path d="M13 19a4 4 0 00-8 0" /> <path d="M16 10h2" />{" "}
          <path d="M16 14h2" /> <circle cx="9" cy="12" r="3" />{" "}
          <rect x="2" y="5" width="20" height="14" rx="2" />
        </symbol>
        <symbol id="i-lock" viewBox="0 0 24 24">
          <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />{" "}
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </symbol>
        <symbol id="i-map-pin" viewBox="0 0 24 24">
          <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />{" "}
          <circle cx="12" cy="10" r="3" />
        </symbol>
        <symbol id="i-menu" viewBox="0 0 24 24">
          <path d="M4 5h16" /> <path d="M4 12h16" /> <path d="M4 19h16" />
        </symbol>
        <symbol id="i-message-circle" viewBox="0 0 24 24">
          <path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" />
        </symbol>
        <symbol id="i-paw-print" viewBox="0 0 24 24">
          <circle cx="11" cy="4" r="2" /> <circle cx="18" cy="8" r="2" />{" "}
          <circle cx="20" cy="16" r="2" />{" "}
          <path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z" />
        </symbol>
        <symbol id="i-plane" viewBox="0 0 24 24">
          <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
        </symbol>
        <symbol id="i-plus" viewBox="0 0 24 24">
          <path d="M5 12h14" /> <path d="M12 5v14" />
        </symbol>
        <symbol id="i-qr-code" viewBox="0 0 24 24">
          <rect width="5" height="5" x="3" y="3" rx="1" />{" "}
          <rect width="5" height="5" x="16" y="3" rx="1" />{" "}
          <rect width="5" height="5" x="3" y="16" rx="1" />{" "}
          <path d="M21 16h-3a2 2 0 0 0-2 2v3" /> <path d="M21 21v.01" />{" "}
          <path d="M12 7v3a2 2 0 0 1-2 2H7" /> <path d="M3 12h.01" />{" "}
          <path d="M12 3h.01" /> <path d="M12 16v.01" /> <path d="M16 12h1" />{" "}
          <path d="M21 12v.01" /> <path d="M12 21v-1" />
        </symbol>
        <symbol id="i-scan-text" viewBox="0 0 24 24">
          <path d="M3 7V5a2 2 0 0 1 2-2h2" />{" "}
          <path d="M17 3h2a2 2 0 0 1 2 2v2" />{" "}
          <path d="M21 17v2a2 2 0 0 1-2 2h-2" />{" "}
          <path d="M7 21H5a2 2 0 0 1-2-2v-2" /> <path d="M7 8h8" />{" "}
          <path d="M7 12h10" /> <path d="M7 16h6" />
        </symbol>
        <symbol id="i-search" viewBox="0 0 24 24">
          <path d="m21 21-4.34-4.34" /> <circle cx="11" cy="11" r="8" />
        </symbol>
        <symbol id="i-share-2" viewBox="0 0 24 24">
          <circle cx="18" cy="5" r="3" /> <circle cx="6" cy="12" r="3" />{" "}
          <circle cx="18" cy="19" r="3" />{" "}
          <line x1="8.59" x2="15.42" y1="13.51" y2="17.49" />{" "}
          <line x1="15.41" x2="8.59" y1="6.51" y2="10.49" />
        </symbol>
        <symbol id="i-shield-check" viewBox="0 0 24 24">
          <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />{" "}
          <path d="m9 12 2 2 4-4" />
        </symbol>
        <symbol id="i-smartphone" viewBox="0 0 24 24">
          <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />{" "}
          <path d="M12 18h.01" />
        </symbol>
        <symbol id="i-star" viewBox="0 0 24 24">
          <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />
        </symbol>
        <symbol id="i-stethoscope" viewBox="0 0 24 24">
          <path d="M11 2v2" /> <path d="M5 2v2" />{" "}
          <path d="M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1" />{" "}
          <path d="M8 15a6 6 0 0 0 12 0v-3" /> <circle cx="20" cy="10" r="2" />
        </symbol>
        <symbol id="i-trees" viewBox="0 0 24 24">
          <path d="M10 10v.2A3 3 0 0 1 8.9 16H5a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0Z" />{" "}
          <path d="M7 16v6" /> <path d="M13 19v3" />{" "}
          <path d="M12 19h8.3a1 1 0 0 0 .7-1.7L18 14h.3a1 1 0 0 0 .7-1.7L16 9h.2a1 1 0 0 0 .8-1.7L13 3l-1.4 1.5" />
        </symbol>
        <symbol id="i-user-round" viewBox="0 0 24 24">
          <circle cx="12" cy="8" r="5" /> <path d="M20 21a8 8 0 0 0-16 0" />
        </symbol>
        <symbol id="i-users" viewBox="0 0 24 24">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />{" "}
          <path d="M16 3.128a4 4 0 0 1 0 7.744" />{" "}
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" /> <circle cx="9" cy="7" r="4" />
        </symbol>
        <symbol id="i-wallet" viewBox="0 0 24 24">
          <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />{" "}
          <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
        </symbol>
        <symbol id="i-x" viewBox="0 0 24 24">
          <path d="M18 6 6 18" /> <path d="m6 6 12 12" />
        </symbol>
        <symbol id="qr" viewBox="-4 -4 33 33">
          <path d="M0 0h1v1h-1zM1 0h1v1h-1zM2 0h1v1h-1zM3 0h1v1h-1zM4 0h1v1h-1zM5 0h1v1h-1zM6 0h1v1h-1zM8 0h1v1h-1zM9 0h1v1h-1zM11 0h1v1h-1zM13 0h1v1h-1zM14 0h1v1h-1zM16 0h1v1h-1zM18 0h1v1h-1zM19 0h1v1h-1zM20 0h1v1h-1zM21 0h1v1h-1zM22 0h1v1h-1zM23 0h1v1h-1zM24 0h1v1h-1zM0 1h1v1h-1zM6 1h1v1h-1zM8 1h1v1h-1zM9 1h1v1h-1zM10 1h1v1h-1zM11 1h1v1h-1zM13 1h1v1h-1zM14 1h1v1h-1zM18 1h1v1h-1zM24 1h1v1h-1zM0 2h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM4 2h1v1h-1zM6 2h1v1h-1zM9 2h1v1h-1zM11 2h1v1h-1zM13 2h1v1h-1zM14 2h1v1h-1zM15 2h1v1h-1zM16 2h1v1h-1zM18 2h1v1h-1zM20 2h1v1h-1zM21 2h1v1h-1zM22 2h1v1h-1zM24 2h1v1h-1zM0 3h1v1h-1zM2 3h1v1h-1zM3 3h1v1h-1zM4 3h1v1h-1zM6 3h1v1h-1zM9 3h1v1h-1zM12 3h1v1h-1zM14 3h1v1h-1zM15 3h1v1h-1zM16 3h1v1h-1zM18 3h1v1h-1zM20 3h1v1h-1zM21 3h1v1h-1zM22 3h1v1h-1zM24 3h1v1h-1zM0 4h1v1h-1zM2 4h1v1h-1zM3 4h1v1h-1zM4 4h1v1h-1zM6 4h1v1h-1zM9 4h1v1h-1zM10 4h1v1h-1zM12 4h1v1h-1zM13 4h1v1h-1zM16 4h1v1h-1zM18 4h1v1h-1zM20 4h1v1h-1zM21 4h1v1h-1zM22 4h1v1h-1zM24 4h1v1h-1zM0 5h1v1h-1zM6 5h1v1h-1zM12 5h1v1h-1zM14 5h1v1h-1zM15 5h1v1h-1zM18 5h1v1h-1zM24 5h1v1h-1zM0 6h1v1h-1zM1 6h1v1h-1zM2 6h1v1h-1zM3 6h1v1h-1zM4 6h1v1h-1zM5 6h1v1h-1zM6 6h1v1h-1zM8 6h1v1h-1zM10 6h1v1h-1zM15 6h1v1h-1zM18 6h1v1h-1zM19 6h1v1h-1zM20 6h1v1h-1zM21 6h1v1h-1zM22 6h1v1h-1zM23 6h1v1h-1zM24 6h1v1h-1zM10 7h1v1h-1zM15 7h1v1h-1zM3 8h1v1h-1zM4 8h1v1h-1zM6 8h1v1h-1zM7 8h1v1h-1zM8 8h1v1h-1zM9 8h1v1h-1zM10 8h1v1h-1zM12 8h1v1h-1zM13 8h1v1h-1zM14 8h1v1h-1zM16 8h1v1h-1zM17 8h1v1h-1zM22 8h1v1h-1zM23 8h1v1h-1zM24 8h1v1h-1zM2 9h1v1h-1zM3 9h1v1h-1zM4 9h1v1h-1zM5 9h1v1h-1zM8 9h1v1h-1zM9 9h1v1h-1zM10 9h1v1h-1zM11 9h1v1h-1zM18 9h1v1h-1zM23 9h1v1h-1zM24 9h1v1h-1zM0 10h1v1h-1zM2 10h1v1h-1zM3 10h1v1h-1zM4 10h1v1h-1zM5 10h1v1h-1zM6 10h1v1h-1zM7 10h1v1h-1zM8 10h1v1h-1zM9 10h1v1h-1zM10 10h1v1h-1zM11 10h1v1h-1zM12 10h1v1h-1zM15 10h1v1h-1zM16 10h1v1h-1zM17 10h1v1h-1zM18 10h1v1h-1zM19 10h1v1h-1zM22 10h1v1h-1zM24 10h1v1h-1zM0 11h1v1h-1zM1 11h1v1h-1zM2 11h1v1h-1zM4 11h1v1h-1zM5 11h1v1h-1zM8 11h1v1h-1zM10 11h1v1h-1zM15 11h1v1h-1zM16 11h1v1h-1zM17 11h1v1h-1zM21 11h1v1h-1zM22 11h1v1h-1zM4 12h1v1h-1zM6 12h1v1h-1zM7 12h1v1h-1zM8 12h1v1h-1zM9 12h1v1h-1zM10 12h1v1h-1zM13 12h1v1h-1zM17 12h1v1h-1zM18 12h1v1h-1zM19 12h1v1h-1zM20 12h1v1h-1zM21 12h1v1h-1zM3 13h1v1h-1zM9 13h1v1h-1zM11 13h1v1h-1zM14 13h1v1h-1zM15 13h1v1h-1zM18 13h1v1h-1zM19 13h1v1h-1zM20 13h1v1h-1zM23 13h1v1h-1zM2 14h1v1h-1zM4 14h1v1h-1zM5 14h1v1h-1zM10 14h1v1h-1zM13 14h1v1h-1zM14 14h1v1h-1zM15 14h1v1h-1zM16 14h1v1h-1zM18 14h1v1h-1zM19 14h1v1h-1zM20 14h1v1h-1zM22 14h1v1h-1zM23 14h1v1h-1zM1 15h1v1h-1zM6 15h1v1h-1zM7 15h1v1h-1zM8 15h1v1h-1zM9 15h1v1h-1zM11 15h1v1h-1zM15 15h1v1h-1zM19 15h1v1h-1zM21 15h1v1h-1zM22 15h1v1h-1zM3 16h1v1h-1zM8 16h1v1h-1zM15 16h1v1h-1zM19 16h1v1h-1zM20 16h1v1h-1zM21 16h1v1h-1zM22 16h1v1h-1zM23 16h1v1h-1zM24 16h1v1h-1zM11 17h1v1h-1zM14 17h1v1h-1zM17 17h1v1h-1zM19 17h1v1h-1zM23 17h1v1h-1zM24 17h1v1h-1zM0 18h1v1h-1zM1 18h1v1h-1zM2 18h1v1h-1zM3 18h1v1h-1zM4 18h1v1h-1zM5 18h1v1h-1zM6 18h1v1h-1zM9 18h1v1h-1zM10 18h1v1h-1zM11 18h1v1h-1zM13 18h1v1h-1zM15 18h1v1h-1zM16 18h1v1h-1zM17 18h1v1h-1zM20 18h1v1h-1zM24 18h1v1h-1zM0 19h1v1h-1zM6 19h1v1h-1zM8 19h1v1h-1zM9 19h1v1h-1zM11 19h1v1h-1zM12 19h1v1h-1zM13 19h1v1h-1zM16 19h1v1h-1zM17 19h1v1h-1zM21 19h1v1h-1zM22 19h1v1h-1zM24 19h1v1h-1zM0 20h1v1h-1zM2 20h1v1h-1zM3 20h1v1h-1zM4 20h1v1h-1zM6 20h1v1h-1zM8 20h1v1h-1zM12 20h1v1h-1zM14 20h1v1h-1zM16 20h1v1h-1zM17 20h1v1h-1zM20 20h1v1h-1zM21 20h1v1h-1zM23 20h1v1h-1zM24 20h1v1h-1zM0 21h1v1h-1zM2 21h1v1h-1zM3 21h1v1h-1zM4 21h1v1h-1zM6 21h1v1h-1zM8 21h1v1h-1zM9 21h1v1h-1zM10 21h1v1h-1zM11 21h1v1h-1zM12 21h1v1h-1zM14 21h1v1h-1zM16 21h1v1h-1zM17 21h1v1h-1zM18 21h1v1h-1zM19 21h1v1h-1zM20 21h1v1h-1zM23 21h1v1h-1zM0 22h1v1h-1zM2 22h1v1h-1zM3 22h1v1h-1zM4 22h1v1h-1zM6 22h1v1h-1zM9 22h1v1h-1zM11 22h1v1h-1zM14 22h1v1h-1zM18 22h1v1h-1zM22 22h1v1h-1zM23 22h1v1h-1zM24 22h1v1h-1zM0 23h1v1h-1zM6 23h1v1h-1zM8 23h1v1h-1zM9 23h1v1h-1zM11 23h1v1h-1zM12 23h1v1h-1zM13 23h1v1h-1zM17 23h1v1h-1zM18 23h1v1h-1zM19 23h1v1h-1zM20 23h1v1h-1zM21 23h1v1h-1zM22 23h1v1h-1zM23 23h1v1h-1zM0 24h1v1h-1zM1 24h1v1h-1zM2 24h1v1h-1zM3 24h1v1h-1zM4 24h1v1h-1zM5 24h1v1h-1zM6 24h1v1h-1zM10 24h1v1h-1zM12 24h1v1h-1zM13 24h1v1h-1zM14 24h1v1h-1zM15 24h1v1h-1zM18 24h1v1h-1zM20 24h1v1h-1zM21 24h1v1h-1zM22 24h1v1h-1zM23 24h1v1h-1zM24 24h1v1h-1z" />
        </symbol>
      </svg>

      <a className="skip-link" href="#accueil/contenu">
        {t("Aller au contenu")}
      </a>

      <header className="site-header" id="haut">
        <div className="wrap site-header__inner">
          <a
            className="brand"
            href="#accueil"
            aria-label={t("Anivaya, retour à l'accueil")}
          >
            <img
              className="brand__picto"
              src="/images/logo.png"
              alt=""
              width="320"
              height="242"
            />
            <img
              className="brand__word"
              src="/images/home/a30056ba300ecd42.webp"
              alt={t("Anivaya")}
              width="520"
              height="85"
            />
          </a>

          <button
            className="menu-btn"
            type="button"
            aria-expanded="false"
            aria-controls="menu"
            aria-label={t("Ouvrir le menu")}
          >
            <svg className="ic ic--open" aria-hidden="true">
              <use href="#i-menu" />
            </svg>
            <svg className="ic ic--close" aria-hidden="true">
              <use href="#i-x" />
            </svg>
          </button>

          {user && (
            <AccountMenu
              profile={user.profile}
              onLogout={onLogout}
              roleLabel={user.adminRole ? "Administrateur" : "Particulier"}
              profileHref={user.adminRole ? "#admin/profil" : "#profil"}
              mobile
            />
          )}
          <nav
            className="nav"
            id="menu"
            aria-label={t("Navigation principale")}
          >
            <ul className="nav__links">
              <li>
                <a href="#accueil/fonctionnalites">{t("Fonctionnalités")}</a>
              </li>
              <li>
                <a href="#accueil/tarifs">{t("Tarifs")}</a>
              </li>
              <li>
                <a href="#accueil/professionnels" data-nav="professionnels">
                  {t("Professionnels")}
                </a>
              </li>
              <li>
                <a href="#accueil/cliniques" data-nav="cliniques">
                  {t("Cliniques")}
                </a>
              </li>
              <li>
                <a href="#accueil/entreprises" data-nav="entreprises">
                  {t("Entreprises")}
                </a>
              </li>
              <li>
                <a href="#accueil/faq">{t("FAQ")}</a>
              </li>
              {!user?.adminRole && (
                <li className="mobile-help-nav">
                  <a href="#contact">{t("Nous contacter")}</a>
                </li>
              )}
              {!user?.adminRole && (
                <li className="mobile-help-nav">
                  <a href="#informations">
                    <Icon name="info" />
                    {t("Informations du service")}
                  </a>
                </li>
              )}
            </ul>
            {user ? (
              <AccountMenu
                profile={user.profile}
                onLogout={onLogout}
                roleLabel={user.adminRole ? "Administrateur" : "Particulier"}
                profileHref={user.adminRole ? "#admin/profil" : "#profil"}
              />
            ) : (
              <div className="public-guest-actions">
                <LanguageMenu variant="public" />
                <a
                  className="btn btn--primary btn--sm nav__cta"
                  href="#connexion"
                >
                  {t("Se connecter / S’inscrire")}
                </a>
              </div>
            )}
          </nav>
        </div>
      </header>

      <main id="contenu" tabIndex={-1}>
        <div
          className="view is-active"
          id="accueil"
          data-title="Anivaya, toute leur vie à vos côtés"
        >
          <section className="hero" aria-labelledby="hero-title">
            <div className="wrap hero__grid">
              <div className="hero__text">
                <p className="pill">{t("Bêta privée début 2027")}</p>
                <h1 className="hero__title" id="hero-title">
                  <span>{t("Toute leur vie,")}</span>{" "}
                  <span>{t("à vos côtés.")}</span>
                </h1>
                <p className="hero__lead">
                  {t(
                    "Le carnet, les rappels, les documents et les bons professionnels de votre chien ou de votre chat, réunis dans un seul dossier. Vous le partagez en un geste, vous en gardez le contrôle.",
                  )}
                </p>
                <div className="btn-row">
                  <a className="btn btn--primary" href="#accueil/inscription">
                    {t("Rejoindre la liste d'attente")}
                  </a>
                  <a className="btn btn--ghost" href="#accueil/comment">
                    {t("Voir comment ça marche")}
                  </a>
                </div>
                <p className="hero__fine">
                  <svg className="ic" aria-hidden="true">
                    <use href="#i-circle-check" />
                  </svg>
                  {t("Gratuit pour deux animaux, sans carte bancaire.")}
                </p>
              </div>

              <div className="stage" data-animal="dog">
                <div className="switch">
                  <div
                    className="switch__group"
                    role="group"
                    aria-label={t("Choisir le dossier affiché")}
                  >
                    <button
                      className="switch__btn"
                      type="button"
                      data-pet="dog"
                      aria-pressed="true"
                    >
                      <svg className="ic" aria-hidden="true">
                        <use href="#i-dog" />
                      </svg>
                      {t("Nala, le chien")}
                    </button>
                    <button
                      className="switch__btn"
                      type="button"
                      data-pet="cat"
                      aria-pressed="false"
                    >
                      <svg className="ic" aria-hidden="true">
                        <use href="#i-cat" />
                      </svg>
                      {t("Milo, le chat")}
                    </button>
                  </div>
                </div>

                <div className="stage__scene">
                  <div className="stage__panel" aria-hidden="true"></div>

                  <div
                    className="phone phone--real"
                    role="img"
                    aria-label={t(
                      "Le véritable carnet Anivaya, avec les dossiers de Nala et Milo.",
                    )}
                  >
                    <div className="phone__screen">
                      <img
                        className="app-capture"
                        data-screen="dog"
                        data-swap
                        src="/images/home/carnet-nala.jpg"
                        alt={t("Le carnet de Nala dans Anivaya Anivaya")}
                        width="390"
                        height="844"
                      />
                      <img
                        className="app-capture"
                        data-screen="cat"
                        data-swap
                        hidden
                        src="/images/home/carnet-milo.jpg"
                        alt={t("Le carnet de Milo dans Anivaya Anivaya")}
                        width="390"
                        height="844"
                      />
                    </div>
                  </div>

                  <div className="float float--a" data-swap aria-hidden="true">
                    <span className="float__icon float__icon--honey">
                      <svg className="ic">
                        <use href="#i-bell" />
                      </svg>
                    </span>
                    <p data-screen="dog">
                      <b>{t("Vaccin annuel de Nala")}</b>
                      <span>{t("Rappel dans 12 jours")}</span>
                    </p>
                    <p data-screen="cat" hidden>
                      <b>{t("Fiche urgence active")}</b>
                      <span>{t("QR prêt à imprimer")}</span>
                    </p>
                  </div>
                  <div className="float float--b" data-swap aria-hidden="true">
                    <span className="float__icon float__icon--blue">
                      <svg className="ic">
                        <use href="#i-clipboard-list" />
                      </svg>
                    </span>
                    <p data-screen="dog">
                      <b>{t("Fiche de garde partagée")}</b>
                      <span>{t("Avec Sofia, jusqu'au 24 août")}</span>
                    </p>
                    <p data-screen="cat" hidden>
                      <b>{t("Julien a validé une tâche")}</b>
                      <span>{t("Brossage de Milo")}</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section
            className="section section--mist constat"
            aria-labelledby="constat-title"
          >
            <div className="wrap constat__grid">
              <div className="constat__text">
                <h2 id="constat-title">
                  {t("Aujourd'hui, leur vie est éparpillée.")}
                </h2>
                <p>
                  {t(
                    "Un carnet chez le vétérinaire, le numéro de la pet-sitter dans un SMS, un groupe pour les promenades, des factures au fond d'un tiroir.",
                  )}
                </p>
                <p className="constat__punch">
                  {t(
                    "Pourquoi tout ce qui compte pour eux devrait-il être réparti entre dix services ?",
                  )}
                </p>
              </div>
              <div className="scraps" aria-hidden="true">
                <div className="scrap scrap--note">
                  {t("Vaccin de Nala… c'était en mars ou en avril ?")}
                </div>
                <div className="scrap scrap--sms">
                  <small>{t("Sofia, pet-sitter")}</small>
                  {t(
                    "Je passe à quelle heure samedi ? Et Milo mange combien de croquettes ?",
                  )}
                </div>
                <div className="scrap scrap--receipt">
                  <b>{t("Clinique vétérinaire")}</b>
                  <span>{t("Facture n° 2291")}</span>
                  <hr />
                  <div className="row">
                    <span>{t("Consultation")}</span>
                    <span>{t("48,00 €")}</span>
                  </div>
                  <div className="row">
                    <span>{t("Vaccin")}</span>
                    <span>{t("20,00 €")}</span>
                  </div>
                </div>
                <div className="scrap scrap--group">
                  <span className="dot">
                    <svg className="ic">
                      <use href="#i-message-circle" />
                    </svg>
                  </span>
                  <p>
                    <b>{t("Balades du dimanche")}</b>
                    <span>{t("37 messages non lus")}</span>
                  </p>
                </div>
                <div className="scrap scrap--card">
                  <b>{t("Toiletteur du quartier")}</b>
                  <span>{t("Carte trouvée dans la boîte aux lettres")}</span>
                </div>
                <div className="scrap scrap--tag">{t("Vermifuge ???")}</div>
              </div>
            </div>
          </section>

          <section
            className="section"
            id="fonctionnalites"
            aria-labelledby="features-title"
          >
            <div className="wrap">
              <div className="head head--split">
                <h2 id="features-title">
                  {t("Un seul dossier, utile dès le premier jour.")}
                </h2>
                <p className="head__lead">
                  {t(
                    "Pas besoin que vos voisins soient inscrits : Anivaya vous sert dès que vous ajoutez votre premier animal. Vous restez propriétaire de son dossier.",
                  )}
                </p>
              </div>
              <ul className="features">
                <li className="feature">
                  <span className="feature__icon">
                    <svg className="ic" aria-hidden="true">
                      <use href="#i-book-open" />
                    </svg>
                  </span>
                  <div>
                    <h3>{t("Carnet de santé numérique")}</h3>
                    <p>
                      {t(
                        "Photographiez le carnet papier : les dates de vaccins et de soins vous sont proposées, vous les vérifiez avant tout enregistrement.",
                      )}
                    </p>
                  </div>
                </li>
                <li className="feature">
                  <span className="feature__icon">
                    <svg className="ic" aria-hidden="true">
                      <use href="#i-bell" />
                    </svg>
                  </span>
                  <div>
                    <h3>{t("Rappels")}</h3>
                    <p>
                      {t(
                        "Vaccins, antiparasitaires, identification, visites : une notification avant chaque échéance, pour vous et pour votre foyer.",
                      )}
                    </p>
                  </div>
                </li>
                <li className="feature">
                  <span className="feature__icon">
                    <svg className="ic" aria-hidden="true">
                      <use href="#i-folder-lock" />
                    </svg>
                  </span>
                  <div>
                    <h3>{t("Documents rangés")}</h3>
                    <p>
                      {t(
                        "Factures, certificats, passeport, contrat d'assurance : tout au même endroit, chiffré et hébergé en Europe.",
                      )}
                    </p>
                  </div>
                </li>
                <li className="feature">
                  <span className="feature__icon">
                    <svg className="ic" aria-hidden="true">
                      <use href="#i-qr-code" />
                    </svg>
                  </span>
                  <div>
                    <h3>{t("Fiche urgence et QR animal perdu")}</h3>
                    <p>
                      {t(
                        "La personne qui retrouve votre animal scanne son QR et vous joint sans voir votre adresse. L'identification officielle reste celle de l'I-CAD.",
                      )}
                    </p>
                  </div>
                </li>
                <li className="feature">
                  <span className="feature__icon">
                    <svg className="ic" aria-hidden="true">
                      <use href="#i-map-pin" />
                    </svg>
                  </span>
                  <div>
                    <h3>{t("Annuaire de proximité")}</h3>
                    <p>
                      {t(
                        "Cliniques, pet-sitters, éducateurs et toiletteurs près de chez vous, avec des coordonnées vérifiées. Le rendez-vous se prend sur leur propre agenda.",
                      )}
                    </p>
                  </div>
                </li>
                <li className="feature">
                  <span className="feature__icon">
                    <svg className="ic" aria-hidden="true">
                      <use href="#i-clipboard-list" />
                    </svg>
                  </span>
                  <div>
                    <h3>
                      {t("Fiche de garde ")}
                      <span className="plan-tag">{t("Anivaya+")}</span>
                    </h3>
                    <p>
                      {t(
                        "Alimentation, habitudes, contacts, vétérinaire : la fiche se remplit depuis le dossier et se partage pour une durée limitée.",
                      )}
                    </p>
                  </div>
                </li>
                <li className="feature">
                  <span className="feature__icon">
                    <svg className="ic" aria-hidden="true">
                      <use href="#i-users" />
                    </svg>
                  </span>
                  <div>
                    <h3>
                      {t("Pass Famille ")}
                      <span className="plan-tag">{t("Famille")}</span>
                    </h3>
                    <p>
                      {t(
                        "Jusqu'à cinq membres, avec les tâches et les rappels répartis entre vous. Chacun sait qui s'occupe de quoi.",
                      )}
                    </p>
                  </div>
                </li>
                <li className="feature">
                  <span className="feature__icon">
                    <svg className="ic" aria-hidden="true">
                      <use href="#i-wallet" />
                    </svg>
                  </span>
                  <div>
                    <h3>
                      {t("Budget et souvenirs")}{" "}
                      <span className="plan-tag">{t("Anivaya+")}</span>
                    </h3>
                    <p>
                      {t(
                        "Suivez les dépenses et exportez-les. Gardez les photos et les grandes étapes de sa vie au même endroit.",
                      )}
                    </p>
                  </div>
                </li>
              </ul>
            </div>
          </section>

          <section
            className="section section--mist"
            id="comment"
            aria-labelledby="how-title"
          >
            <div className="wrap how__grid">
              <div>
                <div className="head">
                  <h2 id="how-title">{t("Trois minutes pour démarrer.")}</h2>
                </div>
                <ol className="steps">
                  <li>
                    <div>
                      <h3>{t("Créez le profil de votre animal")}</h3>
                      <p>
                        {t(
                          "Nom, espèce, race, date de naissance et numéro d'identification. C'est tout.",
                        )}
                      </p>
                    </div>
                  </li>
                  <li>
                    <div>
                      <h3>{t("Photographiez son carnet")}</h3>
                      <p>
                        {t(
                          "Anivaya repère les dates de vaccins et de rappels. Rien n'est enregistré tant que vous ne l'avez pas confirmé.",
                        )}
                      </p>
                    </div>
                  </li>
                  <li>
                    <div>
                      <h3>{t("Recevez vos rappels, partagez en un geste")}</h3>
                      <p>
                        {t(
                          "Une notification avant chaque échéance. Une fiche de garde ou d'urgence prête à envoyer quand vous en avez besoin.",
                        )}
                      </p>
                    </div>
                  </li>
                </ol>
              </div>

              <div
                className="carnet-demo"
                role="img"
                aria-label={t(
                  "Exemple : une page de carnet de vaccination photographiée, dont la date de rappel est repérée puis proposée à la confirmation du propriétaire.",
                )}
              >
                <div className="carnet" aria-hidden="true">
                  <p className="carnet__title">
                    {t("Vaccinations ")}
                    <small>{t("Carnet de santé")}</small>
                  </p>
                  <div className="carnet__row">
                    <span className="vignette">
                      <span>{t("LOT A4K21")}</span>
                      <i></i>
                      <span>{t("EXP 09/27")}</span>
                    </span>
                    <span className="hand">{t("Fait le 14/03/26")}</span>
                  </div>
                  <div className="carnet__row">
                    <span className="vignette">
                      <span>{t("LOT C7P02")}</span>
                      <i></i>
                      <span>{t("EXP 11/27")}</span>
                    </span>
                    <span>
                      <span className="hand hand--ai">
                        {t("Rappel le 14/03/27")}
                      </span>
                    </span>
                  </div>
                  <div className="carnet__row">
                    <span></span>
                    <span className="hand" style={{ opacity: ".55" }}>
                      &nbsp;
                    </span>
                  </div>
                  <span className="stamp">
                    {t("Cabinet")}
                    <br />
                    {t("vétérinaire")}
                    <br />
                    {t("du centre")}
                  </span>
                </div>
                <div className="reading reading--real">
                  <img
                    src="/images/home/import-carnet.jpg"
                    alt={t(
                      "Import d’un document dans Anivaya : choix du fichier, association à un animal et analyse",
                    )}
                    width="382"
                    height="814"
                  />
                </div>
              </div>
            </div>
          </section>

          <section
            className="section"
            id="partage"
            aria-labelledby="share-title"
          >
            <div className="wrap share__grid">
              <div className="share__visual">
                <div
                  className="phone phone--real"
                  role="img"
                  aria-label={t("Le véritable écran Partage Anivaya.")}
                >
                  <div className="phone__screen">
                    <img
                      className="app-capture"
                      src="/images/home/partage.jpg"
                      alt={t(
                        "Les invitations et les documents partagés dans Anivaya",
                      )}
                      width="390"
                      height="844"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h2
                  className="share__title"
                  id="share-title"
                  style={{ fontSize: "var(--fs-h2)" }}
                >
                  {t("Vous partagez. Vous gardez la main.")}
                </h2>
                <p className="lead" style={{ marginTop: "1.1rem" }}>
                  {t(
                    "La pet-sitter reçoit ce dont elle a besoin pour la semaine, la clinique ce que vous l'autorisez à voir. Le reste du dossier reste chez vous.",
                  )}
                </p>
                <ul className="rules">
                  <li className="rule">
                    <span className="feature__icon">
                      <svg className="ic" aria-hidden="true">
                        <use href="#i-hourglass" />
                      </svg>
                    </span>
                    <div>
                      <h3>{t("Un partage a toujours une fin")}</h3>
                      <p>
                        {t(
                          "Vous choisissez son contenu et sa durée, et vous pouvez le retirer à tout moment.",
                        )}
                      </p>
                    </div>
                  </li>
                  <li className="rule">
                    <span className="feature__icon">
                      <svg className="ic" aria-hidden="true">
                        <use href="#i-lock" />
                      </svg>
                    </span>
                    <div>
                      <h3>{t("Votre dossier reste privé")}</h3>
                      <p>
                        {t(
                          "Il est séparé de tout ce que la communauté peut voir.",
                        )}
                      </p>
                    </div>
                  </li>
                  <li className="rule">
                    <span className="feature__icon">
                      <svg className="ic" aria-hidden="true">
                        <use href="#i-eye-off" />
                      </svg>
                    </span>
                    <div>
                      <h3>{t("Jamais d'adresse exacte en public")}</h3>
                      <p>
                        {t(
                          "Sur une fiche publique, on voit au plus votre quartier.",
                        )}
                      </p>
                    </div>
                  </li>
                  <li className="rule">
                    <span className="feature__icon">
                      <svg className="ic" aria-hidden="true">
                        <use href="#i-shield-check" />
                      </svg>
                    </span>
                    <div>
                      <h3>{t("Vos données vous appartiennent")}</h3>
                      <p>
                        {t(
                          "Chiffrées, hébergées dans l'Union européenne, exportables et supprimables quand vous le souhaitez.",
                        )}
                      </p>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          <section
            className="section section--navy on-dark"
            id="sante"
            aria-labelledby="care-title"
          >
            <div className="wrap">
              <h2 className="care__title" id="care-title">
                <span>{t("Anivaya organise et oriente.")}</span>{" "}
                <span>{t("Les vétérinaires soignent.")}</span>
              </h2>
              <p className="care__lead">
                {t(
                  "La technologie rapproche et facilite. Chaque animal garde son histoire, chaque propriétaire garde sa liberté de choisir son vétérinaire.",
                )}
              </p>
              <div className="care__cols">
                <div className="care__col care__col--do">
                  <h3>{t("Ce que fait Anivaya")}</h3>
                  <ul className="ticks">
                    <li>
                      <svg className="ic" aria-hidden="true">
                        <use href="#i-check" />
                      </svg>
                      <span>
                        {t(
                          "Tenir le carnet que vous renseignez et vous rappeler les échéances qui y sont inscrites.",
                        )}
                      </span>
                    </li>
                    <li>
                      <svg className="ic" aria-hidden="true">
                        <use href="#i-check" />
                      </svg>
                      <span>
                        {t(
                          "Proposer des fiches d'information générale, relues par un vétérinaire référent.",
                        )}
                      </span>
                    </li>
                    <li>
                      <svg className="ic" aria-hidden="true">
                        <use href="#i-check" />
                      </svg>
                      <span>
                        {t(
                          "Vous orienter vers un vétérinaire dès qu'une question le demande.",
                        )}
                      </span>
                    </li>
                  </ul>
                </div>
                <div className="care__col care__col--dont">
                  <h3>{t("Ce qu'Anivaya ne fait pas")}</h3>
                  <ul className="ticks">
                    <li>
                      <svg className="ic" aria-hidden="true">
                        <use href="#i-ban" />
                      </svg>
                      <span>
                        {t(
                          "Poser un diagnostic ou remplacer une consultation.",
                        )}
                      </span>
                    </li>
                    <li>
                      <svg className="ic" aria-hidden="true">
                        <use href="#i-ban" />
                      </svg>
                      <span>{t("Prescrire ou vendre des médicaments.")}</span>
                    </li>
                    <li>
                      <svg className="ic" aria-hidden="true">
                        <use href="#i-ban" />
                      </svg>
                      <span>
                        {t(
                          "Vendre de la visibilité aux vétérinaires ou les rémunérer pour vous recommander.",
                        )}
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
              <p className="care__ai">
                <svg className="ic" aria-hidden="true">
                  <use href="#i-scan-text" />
                </svg>
                <span>
                  {t(
                    "Quand une intelligence artificielle vous aide, par exemple pour lire votre carnet, l'application l'indique clairement et vous demande toujours de confirmer.",
                  )}
                </span>
              </p>
            </div>
          </section>

          <section
            className="section"
            id="bientot"
            aria-labelledby="roadmap-title"
          >
            <div className="wrap">
              <div className="head">
                <h2 id="roadmap-title">
                  {t("Et ensuite, une communauté près de chez vous.")}
                </h2>
                <p className="head__lead">
                  {t(
                    "Les services de quartier ouvrent zone par zone, quand assez de membres et de professionnels vérifiés y sont présents pour qu'ils soient vraiment utiles.",
                  )}
                </p>
              </div>
              <ol className="timeline">
                <li className="milestone is-next">
                  <p className="milestone__when">{t("Début 2027")}</p>
                  <h3>{t("Bêta privée")}</h3>
                  <p>
                    {t(
                      "Les premiers foyers de deux zones pilotes testent le dossier, les rappels et l'annuaire.",
                    )}
                  </p>
                </li>
                <li className="milestone">
                  <p className="milestone__when">{t("Printemps 2027")}</p>
                  <h3>{t("Ouverture au public")}</h3>
                  <p>
                    {t(
                      "L'application web s'installe sur votre téléphone. Puis arrivent le Pass Famille, la fiche de garde et les balades de quartier.",
                    )}
                  </p>
                </li>
                <li className="milestone">
                  <p className="milestone__when">{t("Fin 2027")}</p>
                  <h3>{t("Réserver un professionnel")}</h3>
                  <p>
                    {t(
                      "Garde, visites, promenades, éducation et toilettage auprès de prestataires vérifiés, avec paiement sécurisé et garantie. La médaille QR arrive aussi.",
                    )}
                  </p>
                </li>
                <li className="milestone">
                  <p className="milestone__when">{t("À partir de 2028")}</p>
                  <h3>{t("Partout avec vous")}</h3>
                  <p>
                    {t(
                      "Applications iOS et Android, nouvelles villes, orientation vers l'adoption en refuge, lieux et voyages adaptés aux animaux.",
                    )}
                  </p>
                </li>
              </ol>
              <p className="note timeline-note">
                {t(
                  "Calendrier indicatif. Chaque étape ouvre quand la précédente a fait ses preuves.",
                )}
              </p>
            </div>
          </section>

          <section
            className="section section--mist"
            id="tarifs"
            aria-labelledby="pricing-title"
          >
            <div className="wrap">
              <div className="head head--split">
                <h2 id="pricing-title">{t("Gratuit pour commencer.")}</h2>
                <p className="head__lead">
                  {t(
                    "L'essentiel reste gratuit. Les offres payantes ajoutent le partage à plusieurs, la fiche de garde et les documents illimités.",
                  )}
                </p>
              </div>
              <div className="plans">
                <article className="plan">
                  <h3 className="plan__name">{t("Gratuit")}</h3>
                  <p className="plan__for">{t("Pour bien démarrer")}</p>
                  <p className="plan__price">
                    <strong>{t("0 €")}</strong>
                  </p>
                  <p className="plan__alt">{t("Sans carte bancaire")}</p>
                  <ul className="ticks">
                    <li>
                      <svg className="ic" aria-hidden="true">
                        <use href="#i-check" />
                      </svg>
                      <span>{t("Deux animaux")}</span>
                    </li>
                    <li>
                      <svg className="ic" aria-hidden="true">
                        <use href="#i-check" />
                      </svg>
                      <span>{t("Carnet numérique et rappels essentiels")}</span>
                    </li>
                    <li>
                      <svg className="ic" aria-hidden="true">
                        <use href="#i-check" />
                      </svg>
                      <span>{t("Cinq lectures de carnet par mois")}</span>
                    </li>
                    <li>
                      <svg className="ic" aria-hidden="true">
                        <use href="#i-check" />
                      </svg>
                      <span>{t("Fiche urgence avec QR")}</span>
                    </li>
                    <li>
                      <svg className="ic" aria-hidden="true">
                        <use href="#i-check" />
                      </svg>
                      <span>{t("Annuaire de proximité")}</span>
                    </li>
                  </ul>
                  <a
                    className="btn btn--ghost btn--block"
                    href="#accueil/inscription"
                    data-plan="gratuit"
                  >
                    {t("Rejoindre la liste d'attente")}
                  </a>
                </article>
                <article className="plan plan--featured">
                  <h3 className="plan__name">{t("Anivaya+")}</h3>
                  <p className="plan__for">{t("Pour tout suivre")}</p>
                  <p className="plan__price">
                    <strong>{t("5,99 €")}</strong>
                    <span>{t("par mois")}</span>
                  </p>
                  <p className="plan__alt">
                    {t("ou 54 € par an, soit 4,50 € par mois")}
                  </p>
                  <ul className="ticks">
                    <li>
                      <svg className="ic" aria-hidden="true">
                        <use href="#i-check" />
                      </svg>
                      <span>{t("Animaux et documents illimités")}</span>
                    </li>
                    <li>
                      <svg className="ic" aria-hidden="true">
                        <use href="#i-check" />
                      </svg>
                      <span>{t("Fiche de garde partageable")}</span>
                    </li>
                    <li>
                      <svg className="ic" aria-hidden="true">
                        <use href="#i-check" />
                      </svg>
                      <span>{t("Rappels avancés")}</span>
                    </li>
                    <li>
                      <svg className="ic" aria-hidden="true">
                        <use href="#i-check" />
                      </svg>
                      <span>{t("Budget animal et exports")}</span>
                    </li>
                    <li>
                      <svg className="ic" aria-hidden="true">
                        <use href="#i-check" />
                      </svg>
                      <span>{t("Souvenirs et grandes étapes")}</span>
                    </li>
                  </ul>
                  <a
                    className="btn btn--primary btn--block"
                    href="#accueil/inscription"
                    data-plan="plus"
                  >
                    {t("Rejoindre la liste d'attente")}
                  </a>
                </article>
                <article className="plan">
                  <h3 className="plan__name">{t("Famille")}</h3>
                  <p className="plan__for">
                    {t("Pour s'organiser à plusieurs")}
                  </p>
                  <p className="plan__price">
                    <strong>{t("9,99 €")}</strong>
                    <span>{t("par mois")}</span>
                  </p>
                  <p className="plan__alt">
                    {t("ou 89 € par an, soit 7,42 € par mois")}
                  </p>
                  <ul className="ticks">
                    <li>
                      <svg className="ic" aria-hidden="true">
                        <use href="#i-check" />
                      </svg>
                      <span>{t("Tout Anivaya+")}</span>
                    </li>
                    <li>
                      <svg className="ic" aria-hidden="true">
                        <use href="#i-check" />
                      </svg>
                      <span>{t("Jusqu'à cinq membres")}</span>
                    </li>
                    <li>
                      <svg className="ic" aria-hidden="true">
                        <use href="#i-check" />
                      </svg>
                      <span>{t("Tâches réparties et planning partagé")}</span>
                    </li>
                    <li>
                      <svg className="ic" aria-hidden="true">
                        <use href="#i-check" />
                      </svg>
                      <span>{t("Partages temporaires à des proches")}</span>
                    </li>
                  </ul>
                  <a
                    className="btn btn--ghost btn--block"
                    href="#accueil/inscription"
                    data-plan="famille"
                  >
                    {t("Rejoindre la liste d'attente")}
                  </a>
                </article>
              </div>
              <p className="note" style={{ marginTop: "1.5rem" }}>
                {t(
                  "Prix TTC indicatifs, susceptibles d'évoluer avant le lancement. Les inscrits à la liste d'attente seront consultés.",
                )}
              </p>
            </div>
          </section>

          <section
            className="section"
            id="pour-les-pros"
            aria-labelledby="doors-title"
          >
            <div className="wrap">
              <div className="head">
                <h2 id="doors-title">
                  {t("Vous travaillez avec les animaux ?")}
                </h2>
                <p className="head__lead">
                  {t(
                    "Anivaya relie les propriétaires aux professionnels de leur quartier, sans jamais prendre la place du vétérinaire.",
                  )}
                </p>
              </div>
              <div className="doors">
                <a className="door" href="#accueil/professionnels">
                  <span className="door__icon">
                    <svg className="ic" aria-hidden="true">
                      <use href="#i-paw-print" />
                    </svg>
                  </span>
                  <h3>{t("Pet-sitters, éducateurs, toiletteurs")}</h3>
                  <p>
                    {t(
                      "Une fiche vérifiée, des demandes de votre quartier et des paiements sécurisés.",
                    )}
                  </p>
                  <span className="textlink">
                    {t("Découvrir l'offre pro")}{" "}
                    <svg className="ic" aria-hidden="true">
                      <use href="#i-arrow-right" />
                    </svg>
                  </span>
                </a>
                <a className="door door--blue" href="#accueil/cliniques">
                  <span className="door__icon">
                    <svg className="ic" aria-hidden="true">
                      <use href="#i-stethoscope" />
                    </svg>
                  </span>
                  <h3>{t("Cliniques vétérinaires")}</h3>
                  <p>
                    {t(
                      "Des clients qui arrivent avec un carnet à jour. Gratuit, sans commission.",
                    )}
                  </p>
                  <span className="textlink">
                    {t("Découvrir l'accès clinique")}{" "}
                    <svg className="ic" aria-hidden="true">
                      <use href="#i-arrow-right" />
                    </svg>
                  </span>
                </a>
                <a className="door door--navy" href="#accueil/entreprises">
                  <span className="door__icon">
                    <svg className="ic" aria-hidden="true">
                      <use href="#i-building-2" />
                    </svg>
                  </span>
                  <h3>{t("Assureurs, mutuelles, CSE, enseignes")}</h3>
                  <p>
                    {t(
                      "Un service de prévention non médical, à vos couleurs, pour vos assurés, adhérents ou salariés.",
                    )}
                  </p>
                  <span className="textlink">
                    {t("Découvrir l'offre entreprises")}{" "}
                    <svg className="ic" aria-hidden="true">
                      <use href="#i-arrow-right" />
                    </svg>
                  </span>
                </a>
              </div>
            </div>
          </section>

          <section
            className="section section--mist"
            id="faq"
            aria-labelledby="faq-title"
          >
            <div className="wrap faq__grid">
              <div className="faq__aside">
                <h2 id="faq-title">{t("Vos questions.")}</h2>
                <p>
                  {t("Une autre question ? Écrivez-nous à")}{" "}
                  <a href="mailto:contact@anivaya.fr">
                    {t("contact@anivaya.fr")}
                  </a>
                  {t(".")}
                </p>
              </div>
              <div className="faq">
                <details>
                  <summary>
                    {t("Anivaya remplace-t-il mon vétérinaire ?")}
                    <svg className="ic" aria-hidden="true">
                      <use href="#i-chevron-down" />
                    </svg>
                  </summary>
                  <div>
                    <p>
                      {t(
                        "Non. Anivaya vous aide à tenir le carnet, à ne pas oublier les échéances et à trouver un professionnel. L'application ne pose aucun diagnostic et ne délivre aucune prescription. Pour toute question de santé, elle vous oriente vers un vétérinaire.",
                      )}
                    </p>
                  </div>
                </details>
                <details>
                  <summary>
                    {t("Comment fonctionne la lecture du carnet ?")}
                    <svg className="ic" aria-hidden="true">
                      <use href="#i-chevron-down" />
                    </svg>
                  </summary>
                  <div>
                    <p>
                      {t(
                        "Vous photographiez une page du carnet. Un système d'intelligence artificielle repère les dates et les noms des vaccins, puis vous les propose. Rien n'est enregistré tant que vous ne l'avez pas vérifié et confirmé. L'application indique toujours quand une IA intervient.",
                      )}
                    </p>
                  </div>
                </details>
                <details>
                  <summary>
                    {t("Où sont stockées mes données ?")}
                    <svg className="ic" aria-hidden="true">
                      <use href="#i-chevron-down" />
                    </svg>
                  </summary>
                  <div>
                    <p>
                      {t(
                        "Dans l'Union européenne, chiffrées. Votre dossier privé est séparé des informations publiques. Vous choisissez ce que vous partagez et pour combien de temps, et vous pouvez exporter ou supprimer vos données à tout moment.",
                      )}
                    </p>
                  </div>
                </details>
                <details>
                  <summary>
                    {t("Que se passe-t-il si mon animal se perd ?")}
                    <svg className="ic" aria-hidden="true">
                      <use href="#i-chevron-down" />
                    </svg>
                  </summary>
                  <div>
                    <p>
                      {t(
                        "La personne qui le trouve scanne le QR de sa fiche urgence et peut vous joindre sans voir votre adresse. L'identification officielle par puce ou tatouage, enregistrée auprès de l'I-CAD, reste la référence : la fiche y renvoie.",
                      )}
                    </p>
                  </div>
                </details>
                <details>
                  <summary>
                    {t("Anivaya est-il gratuit ?")}
                    <svg className="ic" aria-hidden="true">
                      <use href="#i-chevron-down" />
                    </svg>
                  </summary>
                  <div>
                    <p>
                      {t(
                        "Oui, pour deux animaux, avec le carnet, les rappels essentiels, la fiche urgence et l'annuaire. Les offres Anivaya+ et Famille ajoutent la fiche de garde, le partage à plusieurs, les documents illimités et le budget.",
                      )}
                    </p>
                  </div>
                </details>
                <details>
                  <summary>
                    {t("Quand pourrai-je l'utiliser ?")}
                    <svg className="ic" aria-hidden="true">
                      <use href="#i-chevron-down" />
                    </svg>
                  </summary>
                  <div>
                    <p>
                      {t(
                        "Une bêta privée ouvre début 2027 dans deux zones pilotes, puis le service s'étend ville par ville. Anivaya fonctionne d'abord comme une application web que vous installez sur l'écran d'accueil de votre téléphone. Des applications iOS et Android suivront.",
                      )}
                    </p>
                  </div>
                </details>
                <details>
                  <summary>
                    {t("Peut-on vendre ou donner un animal sur Anivaya ?")}
                    <svg className="ic" aria-hidden="true">
                      <use href="#i-chevron-down" />
                    </svg>
                  </summary>
                  <div>
                    <p>
                      {t(
                        "Non. Anivaya ne publie aucune annonce de vente ou de don d'animaux. Pour adopter, l'application vous orientera vers des refuges et des associations.",
                      )}
                    </p>
                  </div>
                </details>
                <details>
                  <summary>
                    {t("Quels animaux sont concernés ?")}
                    <svg className="ic" aria-hidden="true">
                      <use href="#i-chevron-down" />
                    </svg>
                  </summary>
                  <div>
                    <p>{t("Les chiens et les chats, pour commencer.")}</p>
                  </div>
                </details>
              </div>
            </div>
          </section>

          <section
            className="section"
            id="inscription"
            aria-labelledby="join-title"
          >
            <div className="wrap">
              <div className="join">
                <div className="join__intro">
                  <h2 id="join-title">
                    {t("Soyez parmi les premiers foyers.")}
                  </h2>
                  <p>
                    {t(
                      "Inscrivez-vous à la liste d'attente. Votre code postal nous aide à choisir les zones pilotes.",
                    )}
                  </p>
                  <ul className="ticks">
                    <li>
                      <svg className="ic" aria-hidden="true">
                        <use href="#i-check" />
                      </svg>
                      <span>
                        {t(
                          "Un accès prioritaire à la bêta si votre ville en fait partie",
                        )}
                      </span>
                    </li>
                    <li>
                      <svg className="ic" aria-hidden="true">
                        <use href="#i-check" />
                      </svg>
                      <span>
                        {t(
                          "Votre avis sur les fonctions et les prix avant le lancement",
                        )}
                      </span>
                    </li>
                    <li>
                      <svg className="ic" aria-hidden="true">
                        <use href="#i-check" />
                      </svg>
                      <span>
                        {t("Aucune publicité, désinscription en un clic")}
                      </span>
                    </li>
                  </ul>
                </div>
                <div className="join__form">
                  <LandingForm kind="liste-attente" />
                </div>
              </div>
            </div>
          </section>
        </div>

        <div
          className="view"
          id="professionnels"
          data-title="Professionnels animaliers, Anivaya"
        >
          <section className="page-hero" aria-labelledby="pro-title">
            <div className="wrap page-hero__grid">
              <div>
                <p className="pill">
                  {t("Inscriptions ouvertes dans les zones pilotes")}
                </p>
                <h1 id="pro-title">{t("Votre activité, mieux organisée.")}</h1>
                <p className="page-hero__lead">
                  {t(
                    "Recevez les demandes des propriétaires de votre quartier, gérez votre agenda et encaissez en toute sécurité. Les consignes de chaque animal arrivent avec la demande.",
                  )}
                </p>
                <ul className="audience" aria-label={t("Métiers concernés")}>
                  <li>{t("Pet-sitters")}</li>
                  <li>{t("Promeneurs")}</li>
                  <li>{t("Éducateurs")}</li>
                  <li>{t("Toiletteurs")}</li>
                  <li>{t("Pensions")}</li>
                </ul>
                <div className="btn-row">
                  <a
                    className="btn btn--primary"
                    href="#accueil/pro-inscription"
                  >
                    {t("Inscrire mon activité")}
                  </a>
                  <a className="btn btn--ghost" href="#accueil/pro-tarifs">
                    {t("Voir les offres")}
                  </a>
                </div>
              </div>
              <div className="page-hero__visual">
                <div
                  className="phone phone--real"
                  role="img"
                  aria-label={t("L’annuaire des professionnels Anivaya")}
                >
                  <div className="phone__screen">
                    <img
                      className="app-capture"
                      src="/images/home/professionnels.jpg"
                      alt={t("L’annuaire des professionnels Anivaya")}
                      width="390"
                      height="844"
                    />
                  </div>
                </div>
                <div className="float float--a" aria-hidden="true">
                  <span className="float__icon float__icon--honey">
                    <svg className="ic">
                      <use href="#i-badge-check" />
                    </svg>
                  </span>
                  <p>
                    <b>{t("Profil vérifié")}</b>
                    <span>{t("SIRET et RC Pro contrôlés")}</span>
                  </p>
                </div>
                <div className="float float--b" aria-hidden="true">
                  <span className="float__icon float__icon--blue">
                    <svg className="ic">
                      <use href="#i-credit-card" />
                    </svg>
                  </span>
                  <p>
                    <b>{t("Paiement sécurisé")}</b>
                    <span>{t("Versé après la prestation")}</span>
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section
            className="section section--mist"
            aria-labelledby="pro-features-title"
          >
            <div className="wrap">
              <div className="head head--split">
                <h2 id="pro-features-title">
                  {t("Moins d'administratif, plus de temps avec les animaux.")}
                </h2>
                <p className="head__lead">
                  {t(
                    "Un outil pensé pour les indépendants : vos demandes, vos clients et vos paiements au même endroit.",
                  )}
                </p>
              </div>
              <ul className="features">
                <li className="feature">
                  <span className="feature__icon">
                    <svg className="ic" aria-hidden="true">
                      <use href="#i-id-card" />
                    </svg>
                  </span>
                  <div>
                    <h3>{t("Fiche pro vérifiée")}</h3>
                    <p>
                      {t(
                        "Vos services, votre zone, vos tarifs et un badge qui indique clairement ce qui a été contrôlé.",
                      )}
                    </p>
                  </div>
                </li>
                <li className="feature">
                  <span className="feature__icon">
                    <svg className="ic" aria-hidden="true">
                      <use href="#i-message-circle" />
                    </svg>
                  </span>
                  <div>
                    <h3>{t("Demandes et messagerie")}</h3>
                    <p>
                      {t(
                        "Les propriétaires de votre quartier vous contactent dans l'application, sans échange de numéro au premier message.",
                      )}
                    </p>
                  </div>
                </li>
                <li className="feature">
                  <span className="feature__icon">
                    <svg className="ic" aria-hidden="true">
                      <use href="#i-clipboard-list" />
                    </svg>
                  </span>
                  <div>
                    <h3>{t("Consignes jointes à chaque garde")}</h3>
                    <p>
                      {t(
                        "Alimentation, habitudes, contacts et vétérinaire : la fiche de garde arrive avec la demande. Fini les consignes éparpillées.",
                      )}
                    </p>
                  </div>
                </li>
                <li className="feature">
                  <span className="feature__icon">
                    <svg className="ic" aria-hidden="true">
                      <use href="#i-credit-card" />
                    </svg>
                  </span>
                  <div>
                    <h3>{t("Encaissements sécurisés")}</h3>
                    <p>
                      {t(
                        "Le paiement passe par un prestataire de paiement agréé et vous est versé après la prestation.",
                      )}
                    </p>
                  </div>
                </li>
                <li className="feature">
                  <span className="feature__icon">
                    <svg className="ic" aria-hidden="true">
                      <use href="#i-calendar-check" />
                    </svg>
                  </span>
                  <div>
                    <h3>
                      {t("Agenda et suivi client")}{" "}
                      <span className="plan-tag">{t("Pro")}</span>
                    </h3>
                    <p>
                      {t(
                        "Vos disponibilités, vos réservations et l'historique de chaque client, sans tableur.",
                      )}
                    </p>
                  </div>
                </li>
                <li className="feature">
                  <span className="feature__icon">
                    <svg className="ic" aria-hidden="true">
                      <use href="#i-star" />
                    </svg>
                  </span>
                  <div>
                    <h3>
                      {t("Avis vérifiés ")}
                      <span className="plan-tag">{t("Pro")}</span>
                    </h3>
                    <p>
                      {t(
                        "Un avis ne peut être laissé qu'après une prestation réelle réservée sur Anivaya.",
                      )}
                    </p>
                  </div>
                </li>
              </ul>
            </div>
          </section>

          <section className="section" aria-labelledby="levels-title">
            <div className="wrap">
              <div className="head">
                <h2 id="levels-title">{t("La confiance se vérifie.")}</h2>
                <p className="head__lead">
                  {t(
                    "Chaque niveau donne accès à de nouvelles fonctions. Les documents sont contrôlés avant toute publication ou réservation.",
                  )}
                </p>
              </div>
              <ol className="levels">
                <li className="level">
                  <p className="level__step"></p>
                  <h3>{t("Compte")}</h3>
                  <p>{t("Adresse e-mail et numéro de téléphone contrôlés.")}</p>
                  <p className="level__unlocks">
                    {t("Dossier, rappels, annuaire")}
                  </p>
                </li>
                <li className="level">
                  <p className="level__step"></p>
                  <h3>{t("Membre vérifié")}</h3>
                  <p>{t("Identité et majorité vérifiées.")}</p>
                  <p className="level__unlocks">
                    {t("Messagerie, balades et clubs")}
                  </p>
                </li>
                <li className="level level--top">
                  <p className="level__step"></p>
                  <h3>{t("Prestataire vérifié")}</h3>
                  <p>
                    {t(
                      "SIRET, assurance RC Pro, compétences et déclarations applicables à votre activité, références.",
                    )}
                  </p>
                  <p className="level__unlocks">
                    {t("Réservations et outils professionnels")}
                  </p>
                </li>
              </ol>
              <p className="note" style={{ marginTop: "1.5rem" }}>
                {t(
                  "Le classement des résultats est expliqué publiquement. Aucun professionnel ne peut acheter sa place.",
                )}
              </p>
            </div>
          </section>

          <section
            className="section section--mist"
            id="pro-tarifs"
            aria-labelledby="pro-pricing-title"
          >
            <div className="wrap">
              <div className="head head--split">
                <h2 id="pro-pricing-title">{t("Commencez gratuitement.")}</h2>
                <p className="head__lead">
                  {t(
                    "Votre fiche dans l'annuaire est gratuite. Passez à une offre payante quand les demandes arrivent.",
                  )}
                </p>
              </div>
              <div className="plans">
                <article className="plan">
                  <h3 className="plan__name">{t("Profil")}</h3>
                  <p className="plan__for">{t("Pour être trouvé")}</p>
                  <p className="plan__price">
                    <strong>{t("0 €")}</strong>
                  </p>
                  <p className="plan__alt">&nbsp;</p>
                  <ul className="ticks">
                    <li>
                      <svg className="ic" aria-hidden="true">
                        <use href="#i-check" />
                      </svg>
                      <span>{t("Fiche dans l'annuaire de votre zone")}</span>
                    </li>
                    <li>
                      <svg className="ic" aria-hidden="true">
                        <use href="#i-check" />
                      </svg>
                      <span>{t("Invitation de vos clients actuels")}</span>
                    </li>
                    <li>
                      <svg className="ic" aria-hidden="true">
                        <use href="#i-check" />
                      </svg>
                      <span>{t("Coordonnées et services affichés")}</span>
                    </li>
                  </ul>
                  <a
                    className="btn btn--ghost btn--block"
                    href="#accueil/pro-inscription"
                  >
                    {t("Inscrire mon activité")}
                  </a>
                </article>
                <article className="plan plan--featured">
                  <h3 className="plan__name">{t("Pro Starter")}</h3>
                  <p className="plan__for">{t("Pour recevoir des demandes")}</p>
                  <p className="plan__price">
                    <strong>{t("39 €")}</strong>
                    <span>{t("HT par mois")}</span>
                  </p>
                  <p className="plan__alt">{t("Sans engagement")}</p>
                  <ul className="ticks">
                    <li>
                      <svg className="ic" aria-hidden="true">
                        <use href="#i-check" />
                      </svg>
                      <span>{t("Fiche vérifiée avec badge")}</span>
                    </li>
                    <li>
                      <svg className="ic" aria-hidden="true">
                        <use href="#i-check" />
                      </svg>
                      <span>{t("Demandes et messagerie")}</span>
                    </li>
                    <li>
                      <svg className="ic" aria-hidden="true">
                        <use href="#i-check" />
                      </svg>
                      <span>
                        {t("Fiches de garde reçues avec chaque demande")}
                      </span>
                    </li>
                    <li>
                      <svg className="ic" aria-hidden="true">
                        <use href="#i-check" />
                      </svg>
                      <span>{t("Encaissements sécurisés")}</span>
                    </li>
                  </ul>
                  <a
                    className="btn btn--primary btn--block"
                    href="#accueil/pro-inscription"
                  >
                    {t("Inscrire mon activité")}
                  </a>
                </article>
                <article className="plan">
                  <h3 className="plan__name">{t("Pro")}</h3>
                  <p className="plan__for">
                    {t("Pour développer votre activité")}
                  </p>
                  <p className="plan__price">
                    <strong>{t("79 €")}</strong>
                    <span>{t("HT par mois")}</span>
                  </p>
                  <p className="plan__alt">{t("Sans engagement")}</p>
                  <ul className="ticks">
                    <li>
                      <svg className="ic" aria-hidden="true">
                        <use href="#i-check" />
                      </svg>
                      <span>{t("Tout Pro Starter")}</span>
                    </li>
                    <li>
                      <svg className="ic" aria-hidden="true">
                        <use href="#i-check" />
                      </svg>
                      <span>{t("Agenda et suivi client")}</span>
                    </li>
                    <li>
                      <svg className="ic" aria-hidden="true">
                        <use href="#i-check" />
                      </svg>
                      <span>{t("Avis vérifiés")}</span>
                    </li>
                    <li>
                      <svg className="ic" aria-hidden="true">
                        <use href="#i-check" />
                      </svg>
                      <span>{t("Statistiques d'activité")}</span>
                    </li>
                    <li>
                      <svg className="ic" aria-hidden="true">
                        <use href="#i-check" />
                      </svg>
                      <span>{t("Comptes collaborateurs")}</span>
                    </li>
                  </ul>
                  <a
                    className="btn btn--ghost btn--block"
                    href="#accueil/pro-inscription"
                  >
                    {t("Inscrire mon activité")}
                  </a>
                </article>
              </div>
              <p className="note" style={{ marginTop: "1.5rem" }}>
                {t(
                  "Prix indicatifs. À l'ouverture de la réservation en ligne, une commission de 8 % TTC s'applique aux prestations réservées sur Anivaya.",
                )}
              </p>
            </div>
          </section>

          <section
            className="section"
            id="pro-inscription"
            aria-labelledby="pro-join-title"
          >
            <div className="wrap">
              <div className="join">
                <div className="join__intro join__intro--blue">
                  <h2 id="pro-join-title">
                    {t("Rejoignez les premiers professionnels.")}
                  </h2>
                  <p>
                    {t(
                      "Nous ouvrons d'abord deux zones pilotes. Inscrivez votre activité pour être contacté avant l'ouverture.",
                    )}
                  </p>
                  <ul className="ticks">
                    <li>
                      <svg className="ic" aria-hidden="true">
                        <use href="#i-check" />
                      </svg>
                      <span>{t("Fiche créée avec vous, gratuitement")}</span>
                    </li>
                    <li>
                      <svg className="ic" aria-hidden="true">
                        <use href="#i-check" />
                      </svg>
                      <span>
                        {t("Vérification accompagnée de vos documents")}
                      </span>
                    </li>
                    <li>
                      <svg className="ic" aria-hidden="true">
                        <use href="#i-check" />
                      </svg>
                      <span>
                        {t("Visibilité dès les premiers foyers inscrits")}
                      </span>
                    </li>
                  </ul>
                </div>
                <div className="join__form">
                  <LandingForm kind="pro" />
                </div>
              </div>
            </div>
          </section>
        </div>

        <div
          className="view"
          id="cliniques"
          data-title="Cliniques vétérinaires, Anivaya"
        >
          <section className="page-hero" aria-labelledby="clinic-title">
            <div className="wrap page-hero__grid">
              <div>
                <p className="pill">{t("Gratuit pour les cliniques")}</p>
                <h1 id="clinic-title">
                  {t("Des clients qui arrivent préparés.")}
                </h1>
                <p className="page-hero__lead">
                  {t(
                    "Anivaya aide vos clients à tenir le carnet de leur animal à jour et à ne plus oublier leurs rappels. Pour votre clinique, c'est gratuit, sans commission et sans logiciel à changer.",
                  )}
                </p>
                <div className="btn-row">
                  <a
                    className="btn btn--primary"
                    href="#accueil/clinique-inscription"
                  >
                    {t("Devenir clinique pilote")}
                  </a>
                  <a
                    className="btn btn--ghost"
                    href="#accueil/clinique-independance"
                  >
                    {t("Nos engagements")}
                  </a>
                </div>
              </div>
              <div className="page-hero__visual page-hero__visual--honey">
                <div
                  className="standee"
                  role="img"
                  aria-label={t(
                    "Présentoir d'accueil à poser sur le comptoir de la clinique, avec un QR code pour créer le dossier de son animal.",
                  )}
                >
                  <p className="standee__clinic">
                    {t("Votre clinique vétérinaire")}
                  </p>
                  <p className="standee__title">
                    {t("Le carnet de votre animal, toujours avec vous.")}
                  </p>
                  <div className="standee__qr">
                    <svg viewBox="0 0 33 33" aria-hidden="true">
                      <use href="#qr" width="33" height="33" />
                    </svg>
                  </div>
                  <p className="standee__cta">
                    {t("Scannez pour créer son dossier")}
                  </p>
                  <div className="standee__brand">
                    <img
                      src="/images/home/fa6d728ddfeec1fc.webp"
                      alt=""
                      width="320"
                      height="242"
                    />
                    <img
                      src="/images/home/a30056ba300ecd42.webp"
                      alt={t("Anivaya")}
                      width="520"
                      height="85"
                    />
                  </div>
                </div>
                <div className="float float--a" aria-hidden="true">
                  <span className="float__icon float__icon--blue">
                    <svg className="ic">
                      <use href="#i-folder-lock" />
                    </svg>
                  </span>
                  <p>
                    <b>{t("Dossier de Nala partagé")}</b>
                    <span>{t("Accès 48 h accordé par sa propriétaire")}</span>
                  </p>
                </div>
                <div className="float float--b" aria-hidden="true">
                  <span className="float__icon float__icon--honey">
                    <svg className="ic">
                      <use href="#i-circle-check" />
                    </svg>
                  </span>
                  <p>
                    <b>{t("Aucune commission")}</b>
                    <span>{t("Ni rémunération, ni contrepartie")}</span>
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section
            className="section section--mist"
            aria-labelledby="clinic-features-title"
          >
            <div className="wrap">
              <div className="head head--split">
                <h2 id="clinic-features-title">
                  {t("Moins de carnets oubliés, moins de rendez-vous manqués.")}
                </h2>
                <p className="head__lead">
                  {t(
                    "Anivaya s'occupe de l'organisation côté propriétaire. Votre façon de travailler ne change pas.",
                  )}
                </p>
              </div>
              <ul className="features">
                <li className="feature">
                  <span className="feature__icon">
                    <svg className="ic" aria-hidden="true">
                      <use href="#i-qr-code" />
                    </svg>
                  </span>
                  <div>
                    <h3>{t("QR d'accueil")}</h3>
                    <p>
                      {t(
                        "Vos clients créent le dossier de leur animal depuis votre salle d'attente, en scannant un présentoir fourni.",
                      )}
                    </p>
                  </div>
                </li>
                <li className="feature">
                  <span className="feature__icon">
                    <svg className="ic" aria-hidden="true">
                      <use href="#i-folder-lock" />
                    </svg>
                  </span>
                  <div>
                    <h3>{t("Informations transmises sur autorisation")}</h3>
                    <p>
                      {t(
                        "Avec l'accord du propriétaire, vous consultez l'historique déclaré et les documents avant la consultation, pour une durée limitée.",
                      )}
                    </p>
                  </div>
                </li>
                <li className="feature">
                  <span className="feature__icon">
                    <svg className="ic" aria-hidden="true">
                      <use href="#i-calendar-check" />
                    </svg>
                  </span>
                  <div>
                    <h3>{t("Votre agenda, pas le nôtre")}</h3>
                    <p>
                      {t(
                        "Anivaya renvoie vers votre outil de prise de rendez-vous existant. Aucun logiciel métier à remplacer.",
                      )}
                    </p>
                  </div>
                </li>
                <li className="feature">
                  <span className="feature__icon">
                    <svg className="ic" aria-hidden="true">
                      <use href="#i-bell" />
                    </svg>
                  </span>
                  <div>
                    <h3>{t("Rappels côté propriétaire")}</h3>
                    <p>
                      {t(
                        "Les échéances inscrites au carnet déclenchent un rappel chez votre client. Il pense à reprendre rendez-vous.",
                      )}
                    </p>
                  </div>
                </li>
              </ul>
            </div>
          </section>

          <section
            className="section section--navy on-dark"
            id="clinique-independance"
            aria-labelledby="indep-title"
          >
            <div className="wrap">
              <div className="head">
                <h2 id="indep-title">
                  {t("Votre indépendance, noir sur blanc.")}
                </h2>
                <p className="head__lead">
                  {t(
                    "Le partenariat avec une clinique repose sur une convention écrite, relue par un conseil juridique.",
                  )}
                </p>
              </div>
              <ul className="pledges">
                <li className="pledge">
                  <svg className="ic" aria-hidden="true">
                    <use href="#i-ban" />
                  </svg>
                  <h3>{t("Aucune contrepartie")}</h3>
                  <p>
                    {t(
                      "Ni commission, ni rémunération, ni avantage en échange de clientèle ou de recommandation.",
                    )}
                  </p>
                </li>
                <li className="pledge">
                  <svg className="ic" aria-hidden="true">
                    <use href="#i-search" />
                  </svg>
                  <h3>{t("Aucune visibilité achetée")}</h3>
                  <p>
                    {t(
                      "Aucune clinique ne paie pour apparaître dans l'annuaire. Le classement est expliqué publiquement.",
                    )}
                  </p>
                </li>
                <li className="pledge">
                  <svg className="ic" aria-hidden="true">
                    <use href="#i-stethoscope" />
                  </svg>
                  <h3>{t("Aucun acte vétérinaire")}</h3>
                  <p>
                    {t(
                      "Anivaya n'établit aucun diagnostic et ne prescrit rien. Les contenus d'information sont relus par un vétérinaire référent.",
                    )}
                  </p>
                </li>
              </ul>
            </div>
          </section>

          <section
            className="section"
            id="clinique-inscription"
            aria-labelledby="clinic-join-title"
          >
            <div className="wrap">
              <div className="join">
                <div className="join__intro">
                  <h2 id="clinic-join-title">
                    {t("Rejoignez les cliniques pilotes.")}
                  </h2>
                  <p>
                    {t(
                      "Nous recherchons des cliniques dans nos deux zones pilotes pour la bêta du début 2027.",
                    )}
                  </p>
                  <ul className="ticks">
                    <li>
                      <svg className="ic" aria-hidden="true">
                        <use href="#i-check" />
                      </svg>
                      <span>{t("Présentoirs QR et livrets fournis")}</span>
                    </li>
                    <li>
                      <svg className="ic" aria-hidden="true">
                        <use href="#i-check" />
                      </svg>
                      <span>{t("Convention écrite et sans engagement")}</span>
                    </li>
                    <li>
                      <svg className="ic" aria-hidden="true">
                        <use href="#i-check" />
                      </svg>
                      <span>
                        {t("Votre avis sur les fonctions avant l'ouverture")}
                      </span>
                    </li>
                  </ul>
                </div>
                <div className="join__form">
                  <LandingForm kind="clinique" />
                </div>
              </div>
            </div>
          </section>
        </div>

        <div
          className="view"
          id="entreprises"
          data-title="Entreprises et partenaires, Anivaya"
        >
          <section className="page-hero" aria-labelledby="biz-title">
            <div className="wrap page-hero__grid">
              <div>
                <p className="pill">
                  {t("Assureurs, mutuelles, CSE, enseignes")}
                </p>
                <h1 id="biz-title">
                  {t("La prévention animale, à vos couleurs.")}
                </h1>
                <p className="page-hero__lead">
                  {t(
                    "Offrez à vos assurés, adhérents ou salariés un service utile au quotidien, non médical et personnalisable. Ils suivent leur animal, vous gardez le lien avec eux.",
                  )}
                </p>
                <div className="btn-row">
                  <a
                    className="btn btn--primary"
                    href="#accueil/entreprise-contact"
                  >
                    {t("Parler à l'équipe")}
                  </a>
                  <a
                    className="btn btn--ghost"
                    href="#accueil/entreprise-offre"
                  >
                    {t("Voir l'offre")}
                  </a>
                </div>
              </div>
              <div className="page-hero__visual page-hero__visual--biz">
                <div
                  className="phone phone--real"
                  role="img"
                  aria-label={t("La vue d’ensemble de l’espace Anivaya")}
                >
                  <div className="phone__screen">
                    <img
                      className="app-capture"
                      src="/images/home/espace.jpg"
                      alt={t("La vue d’ensemble de l’espace Anivaya")}
                      width="390"
                      height="844"
                    />
                  </div>
                </div>
                <div className="float float--a" aria-hidden="true">
                  <span className="float__icon float__icon--blue">
                    <svg className="ic">
                      <use href="#i-chart-column" />
                    </svg>
                  </span>
                  <p>
                    <b>{t("Statistiques agrégées")}</b>
                    <span>{t("Aucune donnée individuelle transmise")}</span>
                  </p>
                </div>
                <div className="float float--b" aria-hidden="true">
                  <span className="float__icon float__icon--honey">
                    <svg className="ic">
                      <use href="#i-badge-check" />
                    </svg>
                  </span>
                  <p>
                    <b>{t("Co-marqué ou marque blanche")}</b>
                    <span>{t("Déployé à vos couleurs")}</span>
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section
            className="section section--mist"
            id="entreprise-offre"
            aria-labelledby="biz-offer-title"
          >
            <div className="wrap">
              <div className="head head--split">
                <h2 id="biz-offer-title">
                  {t("Un service utile, sans promesse médicale.")}
                </h2>
                <p className="head__lead">
                  {t(
                    "Anivaya s'intègre à votre relation client : un espace dédié, un déploiement accompagné et des indicateurs pour mesurer l'usage.",
                  )}
                </p>
              </div>
              <ul className="features">
                <li className="feature">
                  <span className="feature__icon">
                    <svg className="ic" aria-hidden="true">
                      <use href="#i-smartphone" />
                    </svg>
                  </span>
                  <div>
                    <h3>{t("Espace co-marqué ou marque blanche")}</h3>
                    <p>
                      {t(
                        "Votre logo, vos couleurs, vos avantages. L'application reste la même pour vos membres.",
                      )}
                    </p>
                  </div>
                </li>
                <li className="feature">
                  <span className="feature__icon">
                    <svg className="ic" aria-hidden="true">
                      <use href="#i-chart-column" />
                    </svg>
                  </span>
                  <div>
                    <h3>{t("Statistiques agrégées")}</h3>
                    <p>
                      {t(
                        "Activations, usage et engagement, mesurés sans jamais transmettre de données individuelles.",
                      )}
                    </p>
                  </div>
                </li>
                <li className="feature">
                  <span className="feature__icon">
                    <svg className="ic" aria-hidden="true">
                      <use href="#i-users" />
                    </svg>
                  </span>
                  <div>
                    <h3>{t("Déploiement accompagné")}</h3>
                    <p>
                      {t(
                        "Kit de communication, parcours d'activation et support pour vos adhérents, assurés ou salariés.",
                      )}
                    </p>
                  </div>
                </li>
                <li className="feature">
                  <span className="feature__icon">
                    <svg className="ic" aria-hidden="true">
                      <use href="#i-book-open" />
                    </svg>
                  </span>
                  <div>
                    <h3>{t("Contenus de prévention relus")}</h3>
                    <p>
                      {t(
                        "Fiches d'information générale, saisonnières et versionnées, relues par un vétérinaire référent.",
                      )}
                    </p>
                  </div>
                </li>
              </ul>
            </div>
          </section>

          <section className="section" aria-labelledby="uses-title">
            <div className="wrap">
              <div className="head">
                <h2 id="uses-title">{t("Pour qui ?")}</h2>
              </div>
              <ul className="uses">
                <li className="use">
                  <h3>{t("Assureurs et mutuelles")}</h3>
                  <p>
                    {t(
                      "Un service quotidien qui fait vivre le contrat entre deux sinistres et soutient la prévention.",
                    )}
                  </p>
                </li>
                <li className="use">
                  <h3>{t("CSE et employeurs")}</h3>
                  <p>
                    {t(
                      "Un avantage concret pour les salariés qui vivent avec un chien ou un chat.",
                    )}
                  </p>
                </li>
                <li className="use">
                  <h3>{t("Enseignes et distribution")}</h3>
                  <p>
                    {t(
                      "Fidélité, rappels de réassort alimentaire et services autour de l'animal, hors médicaments.",
                    )}
                  </p>
                </li>
              </ul>
              <p className="note" style={{ marginTop: "1.5rem" }}>
                {t(
                  "Tarification sur devis : mise en place, abonnement et tarif par membre actif.",
                )}
              </p>
            </div>
          </section>

          <section
            className="section section--mist"
            id="entreprise-contact"
            aria-labelledby="biz-join-title"
          >
            <div className="wrap">
              <div className="join">
                <div className="join__intro join__intro--navy on-dark">
                  <h2 id="biz-join-title">{t("Construisons votre offre.")}</h2>
                  <p>
                    {t(
                      "Décrivez votre projet en quelques lignes. Nous revenons vers vous sous deux jours ouvrés.",
                    )}
                  </p>
                  <ul className="ticks">
                    <li>
                      <svg className="ic" aria-hidden="true">
                        <use href="#i-check" />
                      </svg>
                      <span>{t("Démonstration de l'espace co-marqué")}</span>
                    </li>
                    <li>
                      <svg className="ic" aria-hidden="true">
                        <use href="#i-check" />
                      </svg>
                      <span>{t("Proposition adaptée à votre population")}</span>
                    </li>
                    <li>
                      <svg className="ic" aria-hidden="true">
                        <use href="#i-check" />
                      </svg>
                      <span>
                        {t("Pilote possible sur un périmètre restreint")}
                      </span>
                    </li>
                  </ul>
                </div>
                <div className="join__form">
                  <LandingForm kind="entreprise" />
                </div>
              </div>
            </div>
          </section>
        </div>

        <div
          className="view"
          id="informations-legales"
          data-title="Informations légales, Anivaya"
        >
          <section className="section section--tight-top">
            <div className="wrap legal">
              <LegalContent>
              <h1>{t("Informations légales")}</h1>
              <p className="legal__warn">
                {t(
                  "Gabarit en attente de validation. Les champs surlignés sont à compléter par la direction et le conseil juridique avant toute mise en ligne publique.",
                )}
              </p>

              <h2 id="mentions-legales">{t("Mentions légales")}</h2>
              <h3>{t("Éditeur du site")}</h3>
              <p>
                <span className="todo">{t("[Raison sociale]")}</span>
                {t(",")} <span className="todo">{t("[forme juridique]")}</span>
                {t(" au capital de")}{" "}
                <span className="todo">{t("[montant]")}</span>
                {t(" €, immatriculée au RCS de ")}
                <span className="todo">{t("[ville]")}</span>
                {t(" sous le numéro")}{" "}
                <span className="todo">{t("[SIREN]")}</span>
                {t(". Siège social :")}{" "}
                <span className="todo">{t("[adresse]")}</span>
                {t(". Numéro de TVA intracommunautaire : ")}
                <span className="todo">{t("[numéro]")}</span>
                {t(".")}
              </p>
              <p>
                {t("Directeur ou directrice de la publication :")}{" "}
                <span className="todo">{t("[nom]")}</span>
                {t(". Contact :")}{" "}
                <a href="mailto:contact@anivaya.fr">
                  {t("contact@anivaya.fr")}
                </a>
                {t(".")}
              </p>
              <h3>{t("Hébergement")}</h3>
              <p>
                <span className="todo">{t("[Nom de l'hébergeur]")}</span>
                {t(",")} <span className="todo">{t("[adresse]")}</span>
                {t(",")} <span className="todo">{t("[téléphone]")}</span>
                {t(".")}
              </p>
              <h3>{t("Propriété intellectuelle")}</h3>
              <p>
                {t(
                  "Le nom Anivaya, le logo et l'ensemble des contenus de ce site sont la propriété de ",
                )}
                <span className="todo">{t("[titulaire]")}</span>
                {t(". Toute reproduction sans autorisation est interdite.")}
              </p>
              <h3>{t("Nature du service")}</h3>
              <p>
                {t(
                  "Anivaya est un service d'organisation et d'information générale. Il ne fournit ni diagnostic, ni prescription, ni consultation vétérinaire, et ne remplace pas l'avis d'un vétérinaire.",
                )}
              </p>

              <h2 id="confidentialite">{t("Politique de confidentialité")}</h2>
              <h3>{t("Responsable du traitement")}</h3>
              <p>
                <span className="todo">{t("[Raison sociale]")}</span>
                {t(",")} <span className="todo">{t("[adresse]")}</span>
                {t(". Délégué à la protection des données :")}{" "}
                <span className="todo">{t("[nom ou cabinet, e-mail]")}</span>
                {t(".")}
              </p>
              <h3>{t("Données collectées sur ce site")}</h3>
              <ul>
                <li>
                  {t(
                    "Liste d'attente : adresse e-mail, code postal, profil, prénom et espèces de vos animaux si vous les indiquez.",
                  )}
                </li>
                <li>
                  {t(
                    "Professionnels, cliniques et entreprises : nom, organisation, activité, coordonnées professionnelles et message éventuel.",
                  )}
                </li>
              </ul>
              <h3>{t("Finalités et base légale")}</h3>
              <p>
                {t(
                  "Vous informer du lancement, choisir les zones pilotes, vous consulter sur les fonctions et les prix, et répondre aux demandes de partenariat. Base légale : votre consentement, que vous pouvez retirer à tout moment.",
                )}
              </p>
              <h3>{t("Durée de conservation")}</h3>
              <p>
                {t("Jusqu'à votre désinscription, et au plus")}{" "}
                <span className="todo">{t("[3 ans]")}</span>
                {t(" après le dernier contact.")}
              </p>
              <h3>{t("Destinataires et hébergement")}</h3>
              <p>
                {t("L'équipe Anivaya et ses sous-traitants techniques :")}{" "}
                <span className="todo">{t("[outil d'e-mailing]")}</span>
                {t(",")} <span className="todo">{t("[hébergeur]")}</span>
                {t(". Les données sont hébergées dans l'Union européenne.")}
              </p>
              <h3>{t("Vos droits")}</h3>
              <p>
                {t(
                  "Vous disposez des droits d'accès, de rectification, d'effacement, d'opposition, de limitation et de portabilité. Écrivez à ",
                )}
                <span className="todo">{t("[adresse e-mail du DPO]")}</span>
                {t(
                  ". Vous pouvez également introduire une réclamation auprès de la CNIL.",
                )}
              </p>

              <h2 id="cookies">{t("Cookies")}</h2>
              <p>
                {t(
                  "La connexion utilise un cookie de session nécessaire au fonctionnement de votre espace. Aucun outil de mesure d’audience n’est ajouté par cette page.",
                )}
              </p>
              </LegalContent>
            </div>
          </section>
        </div>
      </main>

      <PublicFooter />
    </>
  );
});
