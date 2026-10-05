// Music-theory helpers: Camelot wheel, time formatting, deterministic randomness.

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_TO_SHARP: Record<string, string> = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#' };

// Camelot numbers for major keys by pitch class (C major = 8B). Minor = relative major's number, letter A.
const MAJOR_CAMELOT = [8, 3, 10, 5, 12, 7, 2, 9, 4, 11, 6, 1];

export function parseKey(key: string): { pc: number; minor: boolean } {
  const [rawNote, mode = 'major'] = key.split(' ');
  const note = FLAT_TO_SHARP[rawNote] ?? rawNote;
  return { pc: Math.max(0, NOTES.indexOf(note)), minor: mode.toLowerCase().startsWith('min') };
}

/** "A minor" → "8A". The DJ-native way to show harmonic neighbourhoods. */
export function camelot(key: string): { num: number; letter: 'A' | 'B'; code: string } {
  const { pc, minor } = parseKey(key);
  const relMajor = minor ? (pc + 3) % 12 : pc;
  const num = MAJOR_CAMELOT[relMajor];
  const letter = minor ? 'A' : 'B';
  return { num, letter, code: `${num}${letter}` };
}

/** Steps on the Camelot wheel: 0 same key, 1 neighbour (perfect mix), up to 7. */
export function camelotDistance(a: string, b: string): number {
  const ca = camelot(a), cb = camelot(b);
  const d = Math.abs(ca.num - cb.num);
  const ring = Math.min(d, 12 - d);
  return ring + (ca.letter === cb.letter ? 0 : 1);
}

export function fmtTime(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function parseDuration(mmss: string): number {
  const [m, s] = mmss.split(':').map(Number);
  return (m * 60 + s) * 1000;
}

export function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 100_000 ? 0 : 1).replace(/\.0$/, '')}K`;
  return String(n);
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Small deterministic PRNG (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const uid = (p = 'id') => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
export const pronounObj = (p: 'she' | 'he' | 'they') => (p === 'she' ? 'her' : p === 'he' ? 'him' : 'them');
export const pronounPoss = (p: 'she' | 'he' | 'they') => (p === 'she' ? 'her' : p === 'he' ? 'his' : 'their');
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
