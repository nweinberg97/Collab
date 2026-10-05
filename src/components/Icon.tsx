// Collab's own icon set: 24px grid, 1.75 stroke, square ends — deliberately
// sharper than the rounded consumer-app default.
const P: Record<string, string> = {
  discover: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M15.5 8.5l-2 5l-5 2l2-5z',
  rising: 'M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0M12 12L19 5M5.6 18.4A9 9 0 1 1 18.4 18.4M8.5 15.5a5 5 0 1 1 7 0',
  channels: 'M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2',
  collabs: 'M9 12a5 5 0 1 0 0 0.01M15 12a5 5 0 1 0 0 0.01',
  profile: 'M12 4a4 4 0 1 0 0 8a4 4 0 1 0 0-8M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6',
  search: 'M10.5 4a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13M15.5 15.5L21 21',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4',
  play: 'M7 4.5v15l12.5-7.5z',
  pause: 'M7 5h3.5v14H7zM13.5 5H17v14h-3.5z',
  prev: 'M6 5v14M19 5L9 12l10 7z',
  next: 'M18 5v14M5 5l10 7L5 19z',
  volume: 'M4 9h4l5-4v14l-5-4H4zM16.5 9a4 4 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11',
  mute: 'M4 9h4l5-4v14l-5-4H4zM17 9.5l5 5M22 9.5l-5 5',
  plus: 'M12 5v14M5 12h14',
  x: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  arrowRight: 'M5 12h14M13 6l6 6l-6 6',
  arrowLeft: 'M19 12H5M11 6l-6 6l6 6',
  chevronRight: 'M9 6l6 6l-6 6',
  chevronDown: 'M6 9l6 6l6-6',
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21',
  micOff: 'M9 9v3a3 3 0 0 0 5.1 2.1M15 9.5V6a3 3 0 0 0-5.7-1.3M5.5 11a6.5 6.5 0 0 0 10.7 5M18.5 11a6.4 6.4 0 0 1-.6 2.7M12 17.5V21M4 4l16 16',
  flag: 'M6 21V4M6 4h11l-2 4l2 4H6',
  note: 'M5 4h14v11l-5 5H5zM14 20v-5h5',
  upload: 'M12 16V4M7 9l5-5l5 5M5 15v5h14v-5',
  share: 'M4 12v8h16v-8M12 3v12M7.5 7.5L12 3l4.5 4.5',
  userPlus: 'M10 4a4 4 0 1 0 0 8a4 4 0 1 0 0-8M3 21c1.3-3.8 4-6 7-6c1.8 0 3.4.7 4.7 2M19 14v6M16 17h6',
  settings: 'M4 7h10M18 7h2M4 17h2M10 17h10M14 4.5v5M8 14.5v5',
  external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  spark: 'M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z',
  lock: 'M6 11h12v10H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  message: 'M4 5h16v11H9l-5 4z',
  queue: 'M4 6h12M4 11h12M4 16h7M17 14v6l4-3z',
  eye: 'M2.5 12S6 5.5 12 5.5S21.5 12 21.5 12S18 18.5 12 18.5S2.5 12 2.5 12M12 9.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5',
  trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13',
  verified: 'M12 2.5l2.4 1.8l3-.2l.9 2.9l2.5 1.7l-1 2.8l1 2.8l-2.5 1.7l-.9 2.9l-3-.2L12 21.5l-2.4-1.8l-3 .2l-.9-2.9l-2.5-1.7l1-2.8l-1-2.8l2.5-1.7l.9-2.9l3 .2z',
  live: 'M12 10.5a1.5 1.5 0 1 0 0 3a1.5 1.5 0 1 0 0-3M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14',
  refresh: 'M20 11a8 8 0 0 0-14.6-4.5M4 4v3h3M4 13a8 8 0 0 0 14.6 4.5M20 20v-3h-3',
  heart: 'M12 20s-7.5-4.6-7.5-10A4.5 4.5 0 0 1 12 7.2A4.5 4.5 0 0 1 19.5 10C19.5 15.4 12 20 12 20z',
  menu: 'M4 7h16M4 12h16M4 17h16',
  logout: 'M15 4h5v16h-5M10 8l-4 4l4 4M6 12h11',
};

export type IconName = keyof typeof P;

export function Icon({ name, size = 20, filled = false, className, label }: { name: IconName; size?: number; filled?: boolean; className?: string; label?: string }) {
  const solid = filled || name === 'play' || name === 'pause' || name === 'prev' || name === 'next';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
      fill={solid ? 'currentColor' : 'none'}
      stroke={solid && name !== 'prev' && name !== 'next' ? 'none' : 'currentColor'}
      strokeWidth={1.75}
      strokeLinecap="square"
      strokeLinejoin="miter"
      style={{ flex: 'none' }}
    >
      <path d={P[name]} />
    </svg>
  );
}
