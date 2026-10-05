import { useId } from 'react';
import type { ArtVisual, Track } from '../types';
import { rng } from '../lib/music';

const cleanId = (id: string) => id.replace(/[^a-zA-Z0-9]/g, '');

/**
 * Sound Portrait — a generative stand-in for artist photography. In production
 * this slot shows the artist's Spotify image; here each fictional artist gets
 * a portrait derived from their palette and seed so no real person is implied.
 */
export function Portrait({ visual, className, imageUrl, alt = '' }: { visual: ArtVisual; className?: string; imageUrl?: string; alt?: string }) {
  const id = cleanId(useId());
  if (imageUrl) return <img src={imageUrl} alt={alt} className={className} style={{ objectFit: 'cover' }} />;
  const r = rng(visual.seed);
  const [h0, h1, h2] = visual.hues;
  const blobs = [
    { x: 20 + r() * 60, y: 25 + r() * 40, rad: 55 + r() * 25, h: h0, l: 52 },
    { x: 10 + r() * 80, y: 60 + r() * 50, rad: 45 + r() * 25, h: h1, l: 45 },
    { x: 30 + r() * 50, y: 30 + r() * 60, rad: 18 + r() * 14, h: h2, l: 68 },
  ];
  const rings = 3 + Math.floor(r() * 4);
  const cx = 30 + r() * 40, cy = 45 + r() * 40;
  const tilt = Math.floor(r() * 60) - 30;
  return (
    <svg className={className} viewBox="0 0 100 125" preserveAspectRatio="xMidYMid slice" role={alt ? 'img' : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true}>
      <defs>
        <linearGradient id={`bg${id}`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor={`hsl(${h0} 38% 16%)`} />
          <stop offset="1" stopColor={`hsl(${h1} 45% 5%)`} />
        </linearGradient>
        {blobs.map((b, i) => (
          <radialGradient key={i} id={`b${i}${id}`}>
            <stop offset="0" stopColor={`hsl(${b.h} 78% ${b.l}%)`} stopOpacity={i === 2 ? 0.95 : 0.85} />
            <stop offset="1" stopColor={`hsl(${b.h} 78% ${b.l}%)`} stopOpacity="0" />
          </radialGradient>
        ))}
        <linearGradient id={`v${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.45" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.55" />
        </linearGradient>
        <filter id={`g${id}`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={visual.seed % 100} />
          <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.09 0" />
        </filter>
      </defs>
      <rect width="100" height="125" fill={`url(#bg${id})`} />
      {blobs.map((b, i) => (
        <ellipse key={i} cx={b.x} cy={b.y} rx={b.rad} ry={b.rad * 1.1} fill={`url(#b${i}${id})`} />
      ))}
      <g transform={`rotate(${tilt} ${cx} ${cy})`} fill="none" stroke="#fff" strokeOpacity="0.1">
        {Array.from({ length: rings }, (_, i) => (
          <ellipse key={i} cx={cx} cy={cy} rx={8 + i * 9} ry={(8 + i * 9) * 0.92} strokeWidth={i === 0 ? 0.9 : 0.4} />
        ))}
      </g>
      <rect width="100" height="125" fill={`url(#v${id})`} />
      <rect width="100" height="125" filter={`url(#g${id})`} />
    </svg>
  );
}

/** Generative cover art in five families, so a catalogue feels like a catalogue. */
export function Cover({ track, className }: { track: Track; className?: string }) {
  const id = cleanId(useId());
  if (track.imageUrl) return <img src={track.imageUrl} alt="" className={className} style={{ objectFit: 'cover' }} />;
  const { style, hues, seed } = track.cover;
  const r = rng(seed);
  const [a, b, c] = hues;
  const bg = `hsl(${a} 35% ${track.isDemo ? 10 : 12}%)`;
  let body;
  if (track.isDemo) {
    body = (
      <g>
        <rect width="100" height="100" fill="hsl(150 10% 10%)" />
        {Array.from({ length: 24 }, (_, i) => {
          const h = 10 + Math.abs(Math.sin(i * 0.9 + seed)) * 40;
          return <rect key={i} x={8 + i * 3.6} y={50 - h / 2} width="1.8" height={h} fill="var(--green)" opacity={0.85} />;
        })}
        <text x="8" y="90" fill="var(--green)" fontSize="8" fontFamily="IBM Plex Mono, monospace" letterSpacing="1">DEMO</text>
      </g>
    );
  } else if (style === 0) {
    const y = 40 + r() * 25;
    body = (
      <g>
        <defs>
          <linearGradient id={`s${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={`hsl(${b} 85% 66%)`} />
            <stop offset="1" stopColor={`hsl(${c} 80% 45%)`} />
          </linearGradient>
        </defs>
        <circle cx={35 + r() * 30} cy={y} r={22 + r() * 10} fill={`url(#s${id})`} />
        <rect y={y + 8} width="100" height="100" fill={bg} opacity="0.92" />
        {[0, 1, 2, 3].map((i) => <rect key={i} y={y + 12 + i * 6} width="100" height={0.7 + i * 0.4} fill={`hsl(${b} 70% 60%)`} opacity={0.5 - i * 0.1} />)}
      </g>
    );
  } else if (style === 1) {
    body = (
      <g transform={`rotate(${-35 + r() * 20} 50 50)`}>
        {Array.from({ length: 7 }, (_, i) => (
          <rect key={i} x="-40" y={-30 + i * 24} width="180" height={10 + r() * 10} fill={`hsl(${[a, b, c][i % 3]} ${55 + r() * 25}% ${35 + r() * 30}%)`} />
        ))}
      </g>
    );
  } else if (style === 2) {
    const hot = Math.floor(r() * 36);
    body = (
      <g>
        {Array.from({ length: 36 }, (_, i) => (
          <circle key={i} cx={14 + (i % 6) * 14.4} cy={14 + Math.floor(i / 6) * 14.4} r={i === hot ? 9 : 2.2 + r() * 2.2} fill={i === hot ? `hsl(${b} 85% 60%)` : `hsl(${c} 30% ${45 + r() * 30}%)`} />
        ))}
      </g>
    );
  } else if (style === 3) {
    body = (
      <g>
        <defs>
          {[a, b, c].map((h, i) => (
            <radialGradient key={i} id={`r${i}${id}`}>
              <stop offset="0" stopColor={`hsl(${h} 85% 60%)`} />
              <stop offset="1" stopColor={`hsl(${h} 85% 60%)`} stopOpacity="0" />
            </radialGradient>
          ))}
        </defs>
        {[a, b, c].map((_, i) => <circle key={i} cx={20 + r() * 60} cy={20 + r() * 60} r={30 + r() * 25} fill={`url(#r${i}${id})`} />)}
      </g>
    );
  } else {
    const corner = r() > 0.5;
    body = (
      <g fill="none">
        {Array.from({ length: 9 }, (_, i) => (
          <circle key={i} cx={corner ? 0 : 100} cy="100" r={12 + i * 11} stroke={`hsl(${i % 2 ? b : c} 75% ${50 + i * 3}%)`} strokeWidth={i === 4 ? 5 : 2} />
        ))}
      </g>
    );
  }
  return (
    <svg className={className} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="100" height="100" fill={bg} />
      {body}
    </svg>
  );
}
