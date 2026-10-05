/**
 * The Collab mark — "the Orbit".
 * An outer C (Collab, a record's edge) and an inner orbit rotated off-axis:
 * two creative paths circling one shared point. At rest it reads as a C;
 * when `live`, the inner orbit turns slowly, like a record in play.
 */
export const LOGO_PATHS = {
  outer: 'M48.85 17.86A22 22 0 1 0 48.85 46.14',
  inner: 'M30.95 20.05A12 12 0 1 0 43.95 30.95',
};

type Tone = 'green' | 'white' | 'black' | 'current';
const toneColor: Record<Tone, string> = {
  green: 'var(--green)',
  white: 'var(--fg)',
  black: '#070807',
  current: 'currentColor',
};

export function LogoMark({ size = 28, tone = 'green', live = false, title }: { size?: number; tone?: Tone; live?: boolean; title?: string }) {
  const c = toneColor[tone];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={live ? 'logo-live' : undefined}
      style={{ color: c, flex: 'none' }}
    >
      <g fill="none" stroke="currentColor" strokeWidth={size < 24 ? 6.5 : 5.5}>
        <path d={LOGO_PATHS.outer} />
        <path className="logo-orbit" d={LOGO_PATHS.inner} />
      </g>
      <circle cx="32" cy="32" r="4.5" fill="currentColor" />
    </svg>
  );
}

export function Wordmark({ size = 22, tone = 'green' }: { size?: number; tone?: Tone }) {
  return (
    <span className="wordmark" style={{ fontSize: size }}>
      <LogoMark size={Math.round(size * 1.25)} tone={tone} />
      <span>Collab</span>
    </span>
  );
}

/** App-icon lockup: mark on a rounded graphite tile. */
export function AppIcon({ size = 64 }: { size?: number }) {
  return (
    <span className="app-icon" style={{ width: size, height: size, borderRadius: size * 0.24 }}>
      <LogoMark size={size * 0.7} />
    </span>
  );
}
