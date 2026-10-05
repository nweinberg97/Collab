import { useEffect, useId, useState } from 'react';
import type { Artist, SignalBreakdown } from '../types';
import { camelot } from '../lib/music';

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function useCountUp(target: number, duration = 900, delay = 0) {
  const [v, setV] = useState(reduced() ? target : 0);
  useEffect(() => {
    if (reduced()) { setV(target); return; }
    let raf = 0;
    const start = performance.now() + delay;
    const from = 0;
    const tick = (t: number) => {
      const p = Math.min(1, Math.max(0, (t - start) / duration));
      const e = 1 - Math.pow(1 - p, 3);
      setV(Math.round(from + (target - from) * e));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, delay]);
  return v;
}

/** The Collaboration Fit dial. An open ring, echoing the logo's C. */
export function ScoreRing({ value, size = 88, label = 'Fit', delay = 0 }: { value: number; size?: number; label?: string; delay?: number }) {
  const v = useCountUp(value, 1000, delay);
  const r = 40, c = 2 * Math.PI * r, arc = 0.82; // ring opens to the right like the mark
  return (
    <div className="score-ring" style={{ width: size, height: size }} role="img" aria-label={`${value}% Collaboration Fit`}>
      <svg viewBox="0 0 100 100" width={size} height={size} style={{ transform: 'rotate(33deg)' }}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--line)" strokeWidth="6" strokeDasharray={`${c * arc} ${c}`} />
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--green)" strokeWidth="6" strokeDasharray={`${(c * arc * v) / 100} ${c}`} />
      </svg>
      <div className="score-ring__num">
        <strong style={{ fontSize: size * 0.3 }}>{v}<span>%</span></strong>
        {size >= 72 && <small>{label}</small>}
      </div>
    </div>
  );
}

/** Collab's 70/30 line: where this pairing sits between familiar and unexpected. */
export function FamiliarityBar({ similarity, adventurousness, compact = false }: { similarity: number; adventurousness: number; compact?: boolean }) {
  const diff = Math.min(1, Math.max(0, 1 - similarity));
  const target = 0.12 + 0.36 * adventurousness;
  return (
    <div className={`fam ${compact ? 'fam--compact' : ''}`}>
      <div className="fam__track" aria-hidden="true">
        <div className="fam__zone" style={{ left: `${Math.max(0, target - 0.13) * 100}%`, width: '26%' }} />
        <div className="fam__marker" style={{ left: `${diff * 100}%` }} />
      </div>
      <div className="fam__labels">
        <span>Familiar</span>
        <span className="mono">{Math.round(similarity * 100)}/{100 - Math.round(similarity * 100)}</span>
        <span>Unexpected</span>
      </div>
    </div>
  );
}

export function Sparkline({ values, width = 200, height = 48, label }: { values: number[]; width?: number; height?: number; label?: string }) {
  const min = Math.min(...values), max = Math.max(...values);
  const pad = 4;
  const pts = values.map((v, i) => [pad + (i / (values.length - 1)) * (width - pad * 2), height - pad - ((v - min) / (max - min || 1)) * (height - pad * 2)]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('');
  const last = pts[pts.length - 1];
  return (
    <svg className="spark" viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none" role="img" aria-label={label}>
      {[0.25, 0.5, 0.75].map((f) => <line key={f} x1="0" x2={width} y1={height * f} y2={height * f} stroke="var(--line)" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
      <path d={`${d}L${last[0]} ${height}L${pts[0][0]} ${height}Z`} fill="var(--green)" opacity="0.12" />
      <path d={d} fill="none" stroke="var(--green)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <circle cx={last[0]} cy={last[1]} r="3.5" fill="var(--green)" />
    </svg>
  );
}

/** Two listener circles whose overlap area matches the overlap share. */
export function OverlapVenn({ pct, a, b }: { pct: number; a: string; b: string }) {
  const cid = 'v' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const r = 34;
  // distance between centres so the lens is roughly `pct` of a circle (good-enough inverse)
  const f = Math.min(0.95, Math.max(0.02, pct / 100));
  const d = 2 * r * (1 - Math.pow(f, 0.72));
  const cx1 = 60 - d / 2, cx2 = 60 + d / 2;
  return (
    <svg viewBox="0 0 120 84" className="venn" role="img" aria-label={`${pct}% audience overlap between ${a} and ${b}`}>
      <circle cx={cx1} cy="42" r={r} fill="var(--fg)" fillOpacity="0.06" stroke="var(--fg-2)" strokeWidth="1" />
      <circle cx={cx2} cy="42" r={r} fill="var(--green)" fillOpacity="0.1" stroke="var(--green)" strokeWidth="1" />
      <clipPath id={cid}><circle cx={cx1} cy="42" r={r} /></clipPath>
      <circle cx={cx2} cy="42" r={r} fill="var(--green)" fillOpacity="0.35" clipPath={`url(#${cid})`} />
      <text x="60" y="46" textAnchor="middle" className="venn__pct">{pct}%</text>
    </svg>
  );
}

/** A BPM ruler with both artists' usual ranges; the shared band glows. */
export function TempoRuler({ you, them, themName }: { you: [number, number]; them: [number, number]; themName: string }) {
  const lo = Math.min(60, you[0], them[0]), hi = Math.max(150, you[1], them[1]);
  const x = (v: number) => ((v - lo) / (hi - lo)) * 100;
  const s0 = Math.max(you[0], them[0]), s1 = Math.min(you[1], them[1]);
  const ticks = [];
  for (let t = Math.ceil(lo / 20) * 20; t <= hi; t += 20) ticks.push(t);
  return (
    <div className="ruler" role="img" aria-label={`Your tempo ${you[0]}–${you[1]} BPM, ${themName} ${them[0]}–${them[1]} BPM`}>
      <div className="ruler__names" aria-hidden="true"><span>You</span><span>{themName}</span><span /></div>
      <div className="ruler__lanes" aria-hidden="true">
        {s1 > s0 && <div className="ruler__shared" style={{ left: `${x(s0)}%`, width: `${x(s1) - x(s0)}%` }} />}
        <div className="ruler__lane"><div className="ruler__bar ruler__bar--you" style={{ left: `${x(you[0])}%`, width: `${x(you[1]) - x(you[0])}%` }} /></div>
        <div className="ruler__lane"><div className="ruler__bar" style={{ left: `${x(them[0])}%`, width: `${x(them[1]) - x(them[0])}%` }} /></div>
        <div className="ruler__ticks">{ticks.map((t) => <span key={t} style={{ left: `${x(t)}%` }}>{t}</span>)}</div>
      </div>
    </div>
  );
}

/** The Camelot wheel: outer ring majors (B), inner ring minors (A). */
export function CamelotWheel({ you, them, size = 168 }: { you: string[]; them: string[]; size?: number }) {
  const youC = new Set(you.map((k) => camelot(k).code));
  const themC = new Set(them.map((k) => camelot(k).code));
  const seg = (n: number, ring: 'A' | 'B') => {
    const a0 = ((n - 1) * 30 - 15 - 90) * (Math.PI / 180), a1 = (n * 30 - 15 - 90) * (Math.PI / 180);
    const [ri, ro] = ring === 'B' ? [56, 80] : [32, 55];
    const p = (r: number, a: number) => `${100 + r * Math.cos(a)} ${100 + r * Math.sin(a)}`;
    return `M${p(ri, a0)}L${p(ro, a0)}A${ro} ${ro} 0 0 1 ${p(ro, a1)}L${p(ri, a1)}A${ri} ${ri} 0 0 0 ${p(ri, a0)}Z`;
  };
  const cells = [];
  for (let n = 1; n <= 12; n++) for (const ring of ['A', 'B'] as const) {
    const code = `${n}${ring}`;
    const y = youC.has(code), t = themC.has(code);
    const fill = y && t ? 'var(--green)' : t ? 'color-mix(in oklab, var(--green) 38%, transparent)' : y ? 'color-mix(in oklab, var(--fg) 26%, transparent)' : 'var(--ink-3)';
    const a = ((n - 1) * 30 - 90) * (Math.PI / 180);
    const rl = ring === 'B' ? 68 : 43.5;
    cells.push(
      <g key={code}>
        <path d={seg(n, ring)} fill={fill} stroke="var(--ink-0)" strokeWidth="1.5" />
        <text x={100 + rl * Math.cos(a)} y={100 + rl * Math.sin(a) + 3} textAnchor="middle" className={`wheel__label ${y && t ? 'is-both' : ''}`}>{code}</text>
      </g>,
    );
  }
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} className="wheel" role="img" aria-label={`Camelot wheel. Your keys ${[...youC].join(', ')}. Their keys ${[...themC].join(', ')}.`}>
      {cells}
      <circle cx="100" cy="100" r="27" fill="var(--ink-1)" />
      <text x="100" y="98" textAnchor="middle" className="wheel__center">KEYS</text>
      <text x="100" y="109" textAnchor="middle" className="wheel__center wheel__center--sub">camelot</text>
    </svg>
  );
}

const AXES: { k: keyof Artist['sound']; lo: string; hi: string }[] = [
  { k: 'electronic', lo: 'Acoustic', hi: 'Electronic' },
  { k: 'energy', lo: 'Laid-back', hi: 'High-energy' },
  { k: 'brightness', lo: 'Moody', hi: 'Bright' },
];
export function SoundSpectrum({ you, them, themName }: { you: Artist['sound']; them: Artist['sound']; themName: string }) {
  return (
    <div className="spectrum">
      {AXES.map((ax) => (
        <div key={ax.k} className="spectrum__row">
          <span>{ax.lo}</span>
          <div className="spectrum__lane" role="img" aria-label={`${ax.lo} to ${ax.hi}: you ${Math.round(you[ax.k] * 100)}, ${themName} ${Math.round(them[ax.k] * 100)}`}>
            <i className="spectrum__link" style={{ left: `${Math.min(you[ax.k], them[ax.k]) * 100}%`, width: `${Math.abs(you[ax.k] - them[ax.k]) * 100}%` }} />
            <b className="spectrum__dot spectrum__dot--you" style={{ left: `${you[ax.k] * 100}%` }} />
            <b className="spectrum__dot" style={{ left: `${them[ax.k] * 100}%` }} />
          </div>
          <span>{ax.hi}</span>
        </div>
      ))}
      <div className="legend"><span><b className="spectrum__dot spectrum__dot--you" /> You</span><span><b className="spectrum__dot" /> {themName}</span></div>
    </div>
  );
}

const SIGNAL_LABELS: [keyof SignalBreakdown, string, string][] = [
  ['audienceOverlap', 'Audience', '25%'],
  ['genreCompatibility', 'Genre proximity', 'adaptive'],
  ['tempoCompatibility', 'Tempo', '15%'],
  ['keyCompatibility', 'Harmony', '15%'],
  ['growthMomentum', 'Momentum', '10%'],
  ['creativeContrast', 'Creative contrast', 'adaptive'],
];
export function SignalBars({ signals }: { signals: SignalBreakdown }) {
  return (
    <ul className="sigbars">
      {SIGNAL_LABELS.map(([k, label, w]) => (
        <li key={k}>
          <span>{label}</span>
          <div className="sigbars__lane"><i style={{ width: `${Math.round(signals[k] * 100)}%` }} /></div>
          <span className="mono">{Math.round(signals[k] * 100)}</span>
          <span className="mono muted">{w}</span>
        </li>
      ))}
    </ul>
  );
}
