import type { ReactNode } from "react";
const shapes: Record<string, { viewBox: string; body: ReactNode }> = {
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
    viewBox: "0 0 32 32",
    body: (
      <>
        <path d="M3 15 16 4l13 11M7 13v16h7v-9h5v9h6V13" />
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
  "chevron-left": { viewBox: "0 0 24 24", body: <path d="m15 5-7 7 7 7" /> },
  "chevron-right": { viewBox: "0 0 24 24", body: <path d="m9 5 7 7-7 7" /> },
  close: { viewBox: "0 0 24 24", body: <path d="m6 6 12 12M18 6 6 18" /> },
};
export default function Icon({ name }: { name: string }) {
  const icon = shapes[name] || shapes.paw;
  return (
    <svg aria-hidden="true" viewBox={icon.viewBox}>
      {icon.body}
    </svg>
  );
}
