const shapes = {
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
  close: { viewBox: "0 0 24 24", body: <path d="m6 6 12 12M18 6 6 18" /> },
};
export default function Icon({ name }) {
  const icon = shapes[name] || shapes.paw;
  return (
    <svg aria-hidden="true" viewBox={icon.viewBox}>
      {icon.body}
    </svg>
  );
}
