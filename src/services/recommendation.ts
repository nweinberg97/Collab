import type { Artist, GenreVector, Insight, Recommendation, SignalBreakdown } from '../types';
import { camelot, camelotDistance, cap, clamp, pronounPoss } from '../lib/music';
import { genreLabel } from '../data/genres';

/**
 * RecommendationService — Collaboration Fit.
 *
 * A prototype approximation of the kinds of signals Spotify could compute from
 * first-party data. Here every input comes from seeded demo data.
 *
 *   raw = genreCompatibility · wG
 *       + tempoCompatibility · 0.15
 *       + keyCompatibility   · 0.15
 *       + audienceOverlap    · 0.25
 *       + growthMomentum     · 0.10
 *       + creativeContrast   · wC
 *
 * wG and wC trade weight with the "How adventurous are you?" setting
 * (wG + wC = 0.35 always). creativeContrast peaks when two artists are about
 * 70% familiar / 30% different — Collab's core philosophy — and the peak moves
 * with adventurousness. The score is then nudged by role fit and calibrated to
 * a 0–100 "fit" that reads as a signal rather than a scientific measurement.
 */

export const WEIGHTS = { tempo: 0.15, key: 0.15, audience: 0.25, growth: 0.1, genreContrastPool: 0.35 };

/** Converts scene-vector similarity into an estimated share of listeners in common. */
const OVERLAP_CALIBRATION = 0.82;

export function cosine(a: GenreVector, b: GenreVector): number {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let dot = 0, na = 0, nb = 0;
  for (const k of keys) {
    const x = a[k] ?? 0, y = b[k] ?? 0;
    dot += x * y; na += x * x; nb += y * y;
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

export function weightedJaccard(a: GenreVector, b: GenreVector): number {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let mn = 0, mx = 0;
  for (const k of keys) {
    const x = a[k] ?? 0, y = b[k] ?? 0;
    mn += Math.min(x, y); mx += Math.max(x, y);
  }
  return mx ? mn / mx : 0;
}

const avgTempo = (a: Artist) => (a.tempoRange[0] + a.tempoRange[1]) / 2;

export function tempoCompatibility(a: Artist, b: Artist): { score: number; diff: number; shared: [number, number] | null } {
  const ta = avgTempo(a), tb = avgTempo(b);
  // Half- and double-time count as compatible (a 72 BPM rap verse sits fine on a 144 BPM rock beat).
  const diff = Math.min(Math.abs(ta - tb), Math.abs(ta - tb * 2), Math.abs(ta * 2 - tb));
  const lo = Math.max(a.tempoRange[0], b.tempoRange[0]);
  const hi = Math.min(a.tempoRange[1], b.tempoRange[1]);
  const overlap = Math.max(0, hi - lo);
  const union = Math.max(a.tempoRange[1], b.tempoRange[1]) - Math.min(a.tempoRange[0], b.tempoRange[0]);
  const score = clamp(1 - diff / 28) * 0.65 + (union ? overlap / union : 0) * 0.35;
  return { score, diff: Math.round(Math.abs(ta - tb)), shared: overlap > 0 ? [lo, hi] : null };
}

export function keyCompatibility(a: Artist, b: Artist): { score: number; pairs: [string, string][] } {
  let total = 0;
  const pairs: [string, string][] = [];
  for (const ka of a.keys) {
    let best = 99, bestKey = b.keys[0];
    for (const kb of b.keys) {
      const d = camelotDistance(ka, kb);
      if (d < best) { best = d; bestKey = kb; }
    }
    total += best;
    if (best <= 1) pairs.push([ka, bestKey]);
  }
  const avg = total / a.keys.length;
  return { score: clamp(1 - avg / 4), pairs };
}

export function listenerGrowth(a: Artist): number {
  const { monthlyListeners: now, listeners90dAgo: then } = a.growthMetrics;
  return then ? now / then - 1 : 0;
}

export function growthMomentum(a: Artist): number {
  return clamp(Math.log(1 + Math.max(0, listenerGrowth(a))) / Math.log(5));
}

const SOUND_AXES = [
  { key: 'acoustic', hi: 'acoustic', lo: 'electronic' },
  { key: 'electronic', hi: 'electronic', lo: 'acoustic' },
  { key: 'energy', hi: 'high-energy', lo: 'laid-back' },
  { key: 'brightness', hi: 'bright', lo: 'moody' },
] as const;

function soundDifference(a: Artist, b: Artist) {
  let sum = 0;
  let biggest: { axis: (typeof SOUND_AXES)[number]; delta: number } = { axis: SOUND_AXES[0], delta: 0 };
  for (const axis of SOUND_AXES) {
    const delta = b.sound[axis.key] - a.sound[axis.key];
    sum += Math.abs(delta);
    if (Math.abs(delta) > Math.abs(biggest.delta)) biggest = { axis, delta };
  }
  return { mean: sum / SOUND_AXES.length, biggest };
}

export function creativeContrast(similarity: number, soundDiff: number, adventurousness: number): number {
  const difference = 0.6 * (1 - similarity) + 0.4 * soundDiff;
  const target = 0.12 + 0.36 * adventurousness; // 0.30 at the default → "70% familiar, 30% unexpected"
  return Math.exp(-((difference - target) ** 2) / (2 * 0.17 ** 2));
}

/** Map raw 0–1 to the displayed 0–100 fit. Monotonic; spreads the useful top of the range. */
export function calibrate(raw: number): number {
  return Math.round(100 * clamp(1 - Math.pow(1 - clamp(raw), 1.45) * 1.16));
}

const ROLE_MAP: Record<string, string[]> = {
  'Co-writer': ['Songwriter'],
  Producer: ['Producer'],
  Vocalist: ['Vocalist'],
  Feature: ['Artist', 'Vocalist'],
  Remix: ['Producer', 'DJ'],
  'Live collaborator': ['Band', 'Artist', 'DJ'],
  'Tour partner': ['Band', 'Artist'],
};

export function roleFit(target: Artist, lookingFor: string[]): number {
  if (!lookingFor.length || lookingFor.includes('Open to anything')) return 1;
  const wanted = new Set(lookingFor.flatMap((l) => ROLE_MAP[l] ?? []));
  return target.roles.some((r) => wanted.has(r)) ? 1 : 0;
}

export interface ScoreOptions {
  adventurousness: number;
  lookingFor: string[];
}

export function scorePair(viewer: Artist, target: Artist, opts: ScoreOptions): Recommendation {
  const adv = clamp(opts.adventurousness);
  const similarity = cosine(viewer.genreVector, target.genreVector);
  const tempo = tempoCompatibility(viewer, target);
  const keys = keyCompatibility(viewer, target);
  const overlapRaw = weightedJaccard(viewer.audienceProfile.demoScenes, target.audienceProfile.demoScenes);
  const sound = soundDifference(viewer, target);

  const signals: SignalBreakdown = {
    genreCompatibility: similarity,
    tempoCompatibility: tempo.score,
    keyCompatibility: keys.score,
    audienceOverlap: overlapRaw,
    growthMomentum: growthMomentum(target),
    creativeContrast: creativeContrast(similarity, sound.mean, adv),
  };

  const wC = 0.1 + (adv - 0.5) * 0.2;
  const wG = WEIGHTS.genreContrastPool - wC;
  let raw =
    signals.genreCompatibility * wG +
    signals.tempoCompatibility * WEIGHTS.tempo +
    signals.keyCompatibility * WEIGHTS.key +
    signals.audienceOverlap * WEIGHTS.audience +
    signals.growthMomentum * WEIGHTS.growth +
    signals.creativeContrast * wC;
  raw *= 0.9 + 0.1 * roleFit(target, opts.lookingFor);

  const insights = buildInsights(viewer, target, { similarity, tempo, keys, overlapRaw, sound });
  return {
    id: `rec_${viewer.id}_${target.id}`,
    artistId: viewer.id,
    targetArtistId: target.id,
    score: calibrate(raw),
    signals,
    insights,
    headline: buildHeadline(target, similarity, overlapRaw, sound.mean),
    similarity,
    createdAt: Date.now(),
  };
}

export const overlapPercent = (raw: number) => Math.round(raw * OVERLAP_CALIBRATION * 100);

function sharedScene(viewer: Artist, target: Artist): string | null {
  const primary = new Set([Object.entries(viewer.genreVector).sort((a, b) => b[1] - a[1])[0][0]]);
  let best: string | null = null, bestV = 0.35;
  for (const [k, v] of Object.entries(viewer.audienceProfile.demoScenes)) {
    if (primary.has(k)) continue;
    const m = Math.min(v, target.audienceProfile.demoScenes[k] ?? 0);
    if (m > bestV) { bestV = m; best = k; }
  }
  return best;
}

function buildInsights(
  viewer: Artist,
  target: Artist,
  x: {
    similarity: number;
    tempo: ReturnType<typeof tempoCompatibility>;
    keys: ReturnType<typeof keyCompatibility>;
    overlapRaw: number;
    sound: ReturnType<typeof soundDifference>;
  },
): Insight[] {
  const P = target.pronoun;
  const She = cap(P);
  const her = pronounPoss(P);
  const out: Insight[] = [];
  const pct = overlapPercent(x.overlapRaw);

  out.push({
    kind: 'audience',
    title: `${pct}% audience overlap`,
    detail: pct >= 50 ? 'Your listeners already share several favorite artists.' : pct >= 30 ? 'A real slice of your listeners already play both of you.' : 'Mostly new ears for each of you. A collab would open a fresh audience.',
    strength: clamp(pct / 70),
  });

  const scene = sharedScene(viewer, target);
  if (scene) out.push({ kind: 'scene', title: `Shared ${genreLabel(scene).toLowerCase()} listeners`, detail: `You share listeners who also listen to ${genreLabel(scene).toLowerCase()}.`, strength: 0.6 });

  const t = x.tempo;
  out.push({
    kind: 'tempo',
    title: t.diff <= 8 ? 'Similar tempo' : t.score > 0.5 ? 'Workable tempo' : 'Different tempos',
    detail: t.shared && t.shared[1] - t.shared[0] >= 8
      ? `Your tracks frequently sit between ${t.shared[0]}–${t.shared[1]} BPM. Average tempos are ${t.diff <= 1 ? 'nearly identical' : `within ${t.diff} BPM`}.`
      : `${cap(her)} tracks run around ${Math.round(avgTempo(target))} BPM to your ${Math.round(avgTempo(viewer))}. Half-time or double-time could bridge it.`,
    strength: t.score,
  });

  const k = x.keys;
  const pair = k.pairs[0];
  out.push({
    kind: 'keys',
    title: k.score > 0.7 ? 'Compatible keys' : k.score > 0.45 ? 'Nearby keys' : 'Distant keys',
    detail: pair
      ? pair[0] === pair[1] || camelot(pair[0]).code === camelot(pair[1]).code
        ? `Your songs often live in neighbouring harmonic territory. You both write in ${pair[0]} (${camelot(pair[0]).code})${k.pairs[1] && camelot(k.pairs[1][0]).code !== camelot(k.pairs[1][1]).code ? `, and ${her} ${k.pairs[1][1]} sits one step from your ${k.pairs[1][0]}` : ''}.`
        : `Your songs often live in neighbouring harmonic territory: ${her} ${pair[1]} (${camelot(pair[1]).code}) sits one step from your ${pair[0]} (${camelot(pair[0]).code}).`
      : 'Your usual keys are a few steps apart on the Camelot wheel. A key change would bring you together.',
    strength: k.score,
  });

  const g = listenerGrowth(target);
  if (g > 0.3) out.push({
    kind: 'momentum',
    title: g > 1.2 ? 'Rising momentum' : 'Growing steadily',
    detail: `${cap(her)} monthly listeners have grown ${Math.round(g * 100)}% in the last 90 days.`,
    strength: growthMomentum(target),
  });

  const b = x.sound.biggest;
  if (Math.abs(b.delta) > 0.15) {
    const theirs = b.delta > 0 ? b.axis.hi : b.axis.lo;
    const yours = b.delta > 0 ? b.axis.lo : b.axis.hi;
    out.push({
      kind: 'contrast',
      title: 'Complementary sound',
      detail: `${She} lean${P === 'they' ? '' : 's'} more ${theirs}. You lean more ${yours}.`,
      strength: clamp(Math.abs(b.delta) * 1.5),
    });
  }
  return out;
}

function buildHeadline(target: Artist, similarity: number, overlap: number, soundDiff: number): string {
  const highOverlap = overlap > 0.55;
  const different = similarity < 0.82 || soundDiff > 0.2;
  if (highOverlap && different) return 'Your audiences overlap heavily, but your sounds are different enough to create something new.';
  if (highOverlap) return 'You already share a lot of listeners. A collab would feel natural to both audiences.';
  if (different && overlap > 0.3) return `Enough common ground to connect, and ${pronounPoss(target.pronoun)} sound pulls you somewhere new.`;
  if (different) return `A real stretch. ${cap(target.pronoun === 'they' ? 'their' : pronounPoss(target.pronoun))} world is far from yours, which is the point.`;
  return 'Close in sound and spirit. You would find your footing fast.';
}

/** Rank every eligible artist for the viewer. */
export function recommend(viewer: Artist, pool: Artist[], opts: ScoreOptions, exclude: Set<string> = new Set()): Recommendation[] {
  return pool
    .filter((a) => a.id !== viewer.id && a.openToCollabs && !exclude.has(a.id))
    .map((a) => scorePair(viewer, a, opts))
    .sort((a, b) => b.score - a.score);
}

export function familiarityLabel(similarity: number): string {
  const familiar = Math.round(similarity * 100);
  return `${familiar}% familiar · ${100 - familiar}% unexpected`;
}
