import type { ReactNode } from "react";
const shapes: Record<string, { viewBox: string; body: ReactNode }> = {
  globe: {
    viewBox: "0 0 24 24",
    body: (
      <>
        <circle cx="12" cy="12" r="9" />
        <ellipse cx="12" cy="12" rx="4" ry="9" />
        <path d="M3 12h18" />
      </>
    ),
  },
  medical: {
    viewBox: "0 0 24 24",
    body: (
      <>
        <path d="M5 3v5a5 5 0 0 0 10 0V3M3 3h4M13 3h4M10 13v3a5 5 0 0 0 10 0v-2" />
        <circle cx="20" cy="11" r="3" />
      </>
    ),
  },
  training: {
    viewBox: "0 0 24 24",
    body: <path d="M4 7h8l8 5-8 5H4zM8 7V3M8 17v4" />,
  },
  heart: {
    viewBox: "0 0 24 24",
    body: (
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z" />
    ),
  },
  pin: {
    viewBox: "0 0 24 24",
    body: (
      <>
        <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
  },
  scissors: {
    viewBox: "0 0 24 24",
    body: (
      <>
        <circle cx="6" cy="6" r="3" />
        <circle cx="6" cy="18" r="3" />
        <path d="m8 8 13 13M8 16 21 3" />
      </>
    ),
  },
  leaf: {
    viewBox: "0 0 24 24",
    body: (
      <>
        <path d="M20 3C7 2 2 8 5 16s16 5 15-13zM5 20 16 9" />
      </>
    ),
  },
  card: {
    viewBox: "0 0 24 24",
    body: (
      <>
        <rect x="2" y="4" width="20" height="16" rx="3" />
        <path d="M2 9h20M6 15h4" />
      </>
    ),
  },
  info: {
    viewBox: "0 0 24 24",
    body: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 11v6M12 7v1" />
      </>
    ),
  },
  logout: {
    viewBox: "0 0 24 24",
    body: (
      <>
        <path d="M9 3H4v18h5M9 12h12m-5-5 5 5-5 5" />
      </>
    ),
  },
  settings: {
    viewBox: "0 0 24 24",
    body: (
      <>
        <path d="M10.16 4.63L10.23 1.95A10.2 10.2 0 0 1 13.77 1.95L13.84 4.63A7.6 7.6 0 0 1 15.91 5.49L17.85 3.64A10.2 10.2 0 0 1 20.36 6.15L18.51 8.09A7.6 7.6 0 0 1 19.37 10.16L22.05 10.23A10.2 10.2 0 0 1 22.05 13.77L19.37 13.84A7.6 7.6 0 0 1 18.51 15.91L20.36 17.85A10.2 10.2 0 0 1 17.85 20.36L15.91 18.51A7.6 7.6 0 0 1 13.84 19.37L13.77 22.05A10.2 10.2 0 0 1 10.23 22.05L10.16 19.37A7.6 7.6 0 0 1 8.09 18.51L6.15 20.36A10.2 10.2 0 0 1 3.64 17.85L5.49 15.91A7.6 7.6 0 0 1 4.63 13.84L1.95 13.77A10.2 10.2 0 0 1 1.95 10.23L4.63 10.16A7.6 7.6 0 0 1 5.49 8.09L3.64 6.15A10.2 10.2 0 0 1 6.15 3.64L8.09 5.49A7.6 7.6 0 0 1 10.16 4.63z" />
        <circle cx="12" cy="12" r="3.2" />
      </>
    ),
  },
  share: {
    viewBox: "0 0 24 24",
    body: (
      <>
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4" />
      </>
    ),
  },
  back: { viewBox: "0 0 24 24", body: <path d="M20 12H4m6-6-6 6 6 6" /> },
  file: {
    viewBox: "0 0 32 32",
    body: (
      <>
        <path d="M8 3h11l7 7v19H8zM19 3v8h7M12 17h10M12 22h8" />
      </>
    ),
  },
  calendar: {
    viewBox: "0 0 32 32",
    body: (
      <>
        <rect x="4" y="7" width="24" height="22" rx="3" />
        <path d="M10 3v8M22 3v8M4 15h24M10 20h2M20 20h2M10 25h2" />
      </>
    ),
  },
  // Calendrier dont le coin bas droit laisse la place à une clochette.
  reminder: {
    viewBox: "0 0 32 32",
    body: (
      <>
        <path d="M17 27H6a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3h16a3 3 0 0 1 3 3v6M9 3v6M19 3v6M3 13h22M8 18h2M13 18h2M8 22h2" />
        <path d="M18.5 27.5h11l-1.6-2.4V21a3.9 3.9 0 0 0-7.8 0v4.1zM22.5 29.6a1.5 1.5 0 0 0 3 0M24 15.8v1.3" />
      </>
    ),
  },
  bell: {
    viewBox: "0 0 32 32",
    body: (
      <>
        <path d="M6 24h20l-3-5v-7a7 7 0 0 0-14 0v7zM13 28a3 3 0 0 0 6 0M16 3v2" />
      </>
    ),
  },
  home: {
    viewBox: "0 0 24 24",
    body: (
      <>
        <path d="M2 11 12 3l10 8M5 10v12h5v-7h4v7h5V10" />
      </>
    ),
  },
  paw: {
    viewBox: "0 0 32 32",
    body: (
      <>
        <ellipse cx="7" cy="11" rx="3" ry="4" />
        <ellipse cx="14" cy="6" rx="3" ry="4" />
        <ellipse cx="23" cy="8" rx="3" ry="4" />
        <ellipse cx="28" cy="16" rx="2" ry="3" />
        <path d="M7 25c0-4 6-12 10-12s9 7 9 11c0 7-7 3-10 3s-9 4-9-2Z" />
      </>
    ),
  },
  lock: {
    viewBox: "0 0 32 32",
    body: (
      <>
        <rect x="6" y="14" width="20" height="15" rx="3" />
        <path d="M10 14V9a6 6 0 0 1 12 0v5M16 20v4" />
      </>
    ),
  },
  eye: {
    viewBox: "0 0 24 24",
    body: (
      <>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
  },
  "eye-off": {
    viewBox: "0 0 24 24",
    body: (
      <path d="M10.6 5.1A9.8 9.8 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.4 3.3M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a9.6 9.6 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18" />
    ),
  },
  edit: {
    viewBox: "0 0 24 24",
    body: (
      <>
        <path d="m15 4 5 5M4 20l5-1L21 7a2.8 2.8 0 0 0-4-4L5 15z" />
      </>
    ),
  },
  trash: {
    viewBox: "0 0 24 24",
    body: (
      <>
        <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" />
      </>
    ),
  },
  check: { viewBox: "0 0 24 24", body: <path d="m4 12 5 5L20 6" /> },
  arrow: { viewBox: "0 0 24 24", body: <path d="M4 12h16m-6-6 6 6-6 6" /> },
  download: {
    viewBox: "0 0 24 24",
    body: <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />,
  },
  "chevron-left": { viewBox: "0 0 24 24", body: <path d="m15 5-7 7 7 7" /> },
  "chevron-right": { viewBox: "0 0 24 24", body: <path d="m9 5 7 7-7 7" /> },
  plus: { viewBox: "0 0 24 24", body: <path d="M12 5v14M5 12h14" /> },
  search: {
    viewBox: "0 0 24 24",
    body: <path d="m21 21-5.2-5.2M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />,
  },
  user: {
    viewBox: "0 0 24 24",
    body: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),
  },
  "group-add": {
    viewBox: "0 0 24 24",
    body: (
      <>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2 20a7 7 0 0 1 12.5-4.3M19 13v7M15.5 16.5h7" />
      </>
    ),
  },
  close: { viewBox: "0 0 24 24", body: <path d="m6 6 12 12M18 6 6 18" /> },
  menu: { viewBox: "0 0 24 24", body: <path d="M4 6h16M4 12h16M4 18h16" /> },
  // Administration
  shield: {
    viewBox: "0 0 24 24",
    body: <path d="M12 3 3 7v5c0 5 9 10 9 10s9-5 9-10V7zM8 12l3 3 5-6" />,
  },
  headset: {
    viewBox: "0 0 24 24",
    body: (
      <path d="M4 13v-2a8 8 0 0 1 16 0v2M4 11H3v7h4v-7H4m16 0h1v7h-4v-7h3m0 7v1a2 2 0 0 1-2 2h-5M10 21h3" />
    ),
  },
  clock: {
    viewBox: "0 0 24 24",
    body: <path d="M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v5l3 2" />,
  },
  chart: {
    viewBox: "0 0 24 24",
    body: <path d="M4 3v18h17M8 16v-5M13 16V7M18 16V4" />,
  },
  person: {
    viewBox: "0 0 24 24",
    body: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),
  },
  // Arc continu aux extrémités arrondies.
  refresh: {
    viewBox: "0 0 24 24",
    body: <path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5" />,
  },
  up: { viewBox: "0 0 24 24", body: <path d="m6 15 6-6 6 6" /> },
  down: { viewBox: "0 0 24 24", body: <path d="m6 9 6 6 6-6" /> },
  sort: { viewBox: "0 0 24 24", body: <path d="m8 10 4-4 4 4M8 14l4 4 4-4" /> },
  // Communautés
  people: {
    viewBox: "0 0 24 24",
    body: (
      <>
        <circle cx="9" cy="7" r="4" />
        <path d="M2 21v-2a7 7 0 0 1 14 0v2M16 3a4 4 0 0 1 0 8M22 21v-2a6 6 0 0 0-3-5" />
      </>
    ),
  },
  chat: {
    viewBox: "0 0 24 24",
    body: <path d="M21 11a9 9 0 0 1-9 9H3l1.6-4A9 9 0 1 1 21 11Z" />,
  },
  flag: {
    viewBox: "0 0 24 24",
    body: <path d="M5 22V3m0 1c4-4 10 4 15 0v11c-5 4-11-4-15 0" />,
  },
  block: {
    viewBox: "0 0 24 24",
    body: <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM6 6l12 12" />,
  },
  friend: {
    viewBox: "0 0 24 24",
    body: (
      <path d="M15 21H2v-2a6 6 0 0 1 12 0M12 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M19 8v8m-4-4h8" />
    ),
  },
  more: {
    viewBox: "0 0 24 24",
    body: <path d="M5 12h.01M12 12h.01M19 12h.01" />,
  },
  send: {
    viewBox: "0 0 24 24",
    body: <path d="m22 2-7 20-4-9L2 9 22 2ZM22 2 11 13" />,
  },
  image: {
    viewBox: "0 0 24 24",
    body: <path d="M3 3h18v18H3ZM3 16l5-5 5 5 3-3 5 5M7 7h.01" />,
  },
  "check-double": {
    viewBox: "0 0 24 24",
    body: <path d="m2 12 4 4L16 6m-5 8 3 3L24 7" />,
  },
};
export default function Icon({ name }: { name: string }) {
  const icon = shapes[name] || shapes.paw;
  return (
    <svg aria-hidden="true" viewBox={icon.viewBox}>
      {icon.body}
    </svg>
  );
}
