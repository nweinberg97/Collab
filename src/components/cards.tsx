import type { Artist, Collaboration, Recommendation, Track } from '../types';
import { STAGES } from '../types';
import { ARTIST_BY_ID } from '../data/artists';
import { Cover, Portrait } from './Art';
import { Icon } from './Icon';
import { AvatarPair, Button, Chip, Verified } from './ui';
import { FamiliarityBar, ScoreRing, Sparkline } from './viz';
import { fmtCount, fmtTime } from '../lib/music';
import { href, navigate } from '../lib/router';
import { openOverlay } from '../lib/overlays';
import { listenerGrowth, overlapPercent } from '../services/recommendation';
import { useStore } from '../services/store';
import { synth } from '../lib/synth';
import { layersFor } from '../services/playback';
import { useEffect, useState, type ReactNode } from 'react';

const first = (a: Artist) => a.name.split(' ')[0];

/** Short, scannable reasons for a card. Derived from the signals, never hard-coded. */
export function reasonChips(rec: Recommendation, artist: Artist, showOverlap = true): string[] {
  const out: string[] = [];
  if (showOverlap) out.push(`${overlapPercent(rec.signals.audienceOverlap)}% audience overlap`);
  if (rec.signals.tempoCompatibility > 0.72) out.push('Similar tempo');
  if (rec.signals.keyCompatibility > 0.7) out.push('Compatible keys');
  if (rec.similarity < 0.45) out.push('Different genre');
  const g = listenerGrowth(artist);
  if (g > 1.5) out.push(`+${Math.round(g * 100)}% listeners`);
  else if (artist.momentum === 'Rising') out.push('Rising');
  else if (artist.momentum === 'Established') out.push('Established');
  return out.slice(0, 4);
}

export function RecHero({ rec, rank, total }: { rec: Recommendation; rank: number; total: number }) {
  const a = ARTIST_BY_ID[rec.targetArtistId];
  const settings = useStore((s) => s.settings);
  return (
    <article className="rec-hero" aria-labelledby={`hero-${a.id}`}>
      <a className="rec-hero__art" href={href(`artist/${a.id}`)} aria-label={`Open ${a.name}'s profile`}>
        <Portrait visual={a.photo} imageUrl={a.imageUrl} />
        <span className="rec-hero__rank mono">{String(rank).padStart(2, '0')} / {String(total).padStart(2, '0')}</span>
      </a>
      <div className="rec-hero__body">
        <div className="rec-hero__top">
          <div>
            <p className="eyebrow">Strongest match this week</p>
            <h2 id={`hero-${a.id}`} className="rec-hero__name"><a href={href(`artist/${a.id}`)}>{a.name}</a></h2>
            <p className="meta">{a.genres[0]} · {a.location.city} · <Verified compact /></p>
          </div>
          <ScoreRing value={rec.score} size={104} label="Fit" />
        </div>
        <ul className="reasons reasons--reveal">
          {reasonChips(rec, a, settings.showAudienceOverlap).map((c, i) => <li key={c} style={{ animationDelay: `${300 + i * 90}ms` }}>{c}</li>)}
        </ul>
        <blockquote className="rec-hero__why">
          <span className="eyebrow">Why you might work</span>
          <p>{rec.headline}</p>
        </blockquote>
        <FamiliarityBar similarity={rec.similarity} adventurousness={settings.adventurousness} />
        <div className="rec-hero__actions">
          <Button variant="primary" size="lg" icon="channels" onClick={() => openOverlay({ kind: 'invite', artistId: a.id })}>Invite to Audio Channel</Button>
          <Button variant="secondary" size="lg" onClick={() => openOverlay({ kind: 'why', artistId: a.id })}>Why {first(a)}?</Button>
        </div>
      </div>
    </article>
  );
}

export function RecCard({ rec, index, onDismiss }: { rec: Recommendation; index: number; onDismiss?: () => void }) {
  const a = ARTIST_BY_ID[rec.targetArtistId];
  const showOverlap = useStore((s) => s.settings.showAudienceOverlap);
  return (
    <article className="rec-card" style={{ animationDelay: `${index * 70}ms` }}>
      <a href={href(`artist/${a.id}`)} className="rec-card__art" aria-label={`${a.name}, ${rec.score}% fit`}>
        <Portrait visual={a.photo} imageUrl={a.imageUrl} />
        <span className="rec-card__score"><ScoreRing value={rec.score} size={58} delay={200 + index * 70} /></span>
      </a>
      <div className="rec-card__body">
        <h3><a href={href(`artist/${a.id}`)}>{a.name}</a></h3>
        <p className="meta">{a.genres[0]} · {a.location.city}</p>
        <ul className="reasons reasons--small">
          {reasonChips(rec, a, showOverlap).slice(0, 3).map((c) => <li key={c}>{c}</li>)}
        </ul>
        <div className="rec-card__actions">
          <Button size="sm" variant="primary" icon="channels" onClick={() => openOverlay({ kind: 'invite', artistId: a.id })}>Invite</Button>
          <Button size="sm" variant="quiet" onClick={() => openOverlay({ kind: 'why', artistId: a.id })}>Why {first(a)}?</Button>
          {onDismiss && <button className="icon-btn icon-btn--sm rec-card__dismiss" onClick={onDismiss} aria-label={`Not now: hide ${a.name}`} title="Not now"><Icon name="x" size={16} /></button>}
        </div>
      </div>
    </article>
  );
}

/** A playable track row. Plays a local preview (not the shared channel). */
export function TrackRow({ track, index, onPlay, playing, showArtist = false, right }: { track: Track; index?: number; onPlay?: () => void; playing?: boolean; showArtist?: boolean; right?: ReactNode }) {
  const artist = ARTIST_BY_ID[track.artistId];
  const maxStreams = artist ? Math.max(...artist.tracks.map((t) => t.demoMonthlyStreams)) : 1;
  const pop = track.demoMonthlyStreams / (maxStreams || 1);
  return (
    <div className={`track-row ${playing ? 'is-playing' : ''}`}>
      {index !== undefined && <span className="track-row__idx mono">{playing ? <Eq /> : index + 1}</span>}
      <button className="track-row__cover" onClick={onPlay} aria-label={`${playing ? 'Pause' : 'Play'} ${track.title}`}>
        <Cover track={track} />
        <span className="track-row__play"><Icon name={playing ? 'pause' : 'play'} size={16} /></span>
      </button>
      <div className="track-row__title">
        <strong>{track.title}</strong>
        <span className="meta">{track.credits?.length ? `${track.credits.map((c) => ARTIST_BY_ID[c]?.name).filter(Boolean).join(', ')} · ` : showArtist && artist ? `${artist.name} · ` : ''}{track.tempo ? `${track.tempo} BPM · ${track.key}` : track.isDemo ? 'Unreleased demo' : 'Spotify'}</span>
      </div>
      {track.demoMonthlyStreams > 0 && (
        <span className="track-row__pop" title={`${fmtCount(track.demoMonthlyStreams)} monthly streams (demo)`}>
          <span className="pop-bars" aria-hidden="true">{[0.2, 0.4, 0.6, 0.8].map((t) => <i key={t} className={pop > t ? 'on' : ''} />)}</span>
          <span className="mono muted">{fmtCount(track.demoMonthlyStreams)}</span>
        </span>
      )}
      <span className="track-row__dur mono muted">{fmtTime(track.durationMs)}</span>
      {right}
    </div>
  );
}

export function Eq() {
  return <span className="eq" aria-hidden="true"><i /><i /><i /></span>;
}

/** Local preview player state for profile/track lists. */
let previewId: string | null = null;
const previewLs = new Set<() => void>();
export function usePreview() {
  const [id, setId] = useState(previewId);
  useEffect(() => {
    const l = () => setId(previewId);
    previewLs.add(l);
    return () => { previewLs.delete(l); };
  }, []);
  const toggle = (t: Track) => {
    synth.unlock();
    if (previewId === t.id) { synth.stop(); previewId = null; }
    else { synth.play(t, t.session ? 0 : 30_000, layersFor(t)); previewId = t.id; }
    previewLs.forEach((l) => l());
  };
  return { playingId: id, toggle };
}
export function stopPreview() {
  if (previewId) { synth.stop(); previewId = null; previewLs.forEach((l) => l()); }
}

export function CollabCard({ collab }: { collab: Collaboration }) {
  const meId = useStore((s) => s.auth?.userId);
  const others = collab.participantIds.filter((p) => p !== meId).map((p) => ARTIST_BY_ID[p]).filter(Boolean);
  const meA = ARTIST_BY_ID[meId ?? 'alex-rivera'];
  const other = others[0];
  const idx = STAGES.indexOf(collab.status);
  return (
    <a className="collab-card" href={href(`collabs/${collab.id}`)}>
      <div className="collab-card__top">
        {other && <AvatarPair a={other} b={meA} size={44} />}
        <span className={`stage stage--${collab.status.toLowerCase()}`}>{collab.status}</span>
      </div>
      <h3>{collab.name}</h3>
      <p className="meta">{others.map((o) => o.name).join(', ')} × You</p>
      <ol className="stage-dots" aria-label={`Stage ${idx + 1} of ${STAGES.length}: ${collab.status}`}>
        {STAGES.map((s, i) => <li key={s} className={i <= idx ? 'on' : ''} />)}
      </ol>
      <p className="collab-card__activity"><span className="eyebrow">Last activity</span>{collab.lastActivity}</p>
    </a>
  );
}

export function RisingCard({ artist, category, why, fit }: { artist: Artist; category: string; why: string; fit?: number }) {
  const g = listenerGrowth(artist);
  return (
    <article className="rising-card">
      <a href={href(`artist/${artist.id}`)} className="rising-card__art" aria-label={artist.name}>
        <Portrait visual={artist.photo} imageUrl={artist.imageUrl} />
      </a>
      <div className="rising-card__body">
        <p className="eyebrow eyebrow--green">Rising in {category}</p>
        <h3><a href={href(`artist/${artist.id}`)}>{artist.name}</a></h3>
        <p className="meta">{artist.location.city} · {artist.roles.slice(0, 2).join(' / ')}</p>
        <div className="rising-card__stats">
          <div><strong className="mono">+{artist.growthMetrics.demoStreamsGrowthPct}%</strong><span>streams</span></div>
          <div><strong className="mono">+{Math.round(g * 100)}%</strong><span>listeners</span></div>
          {fit !== undefined && <div><strong className="mono">{fit}%</strong><span>fit</span></div>}
        </div>
        <Sparkline values={artist.growthMetrics.history} height={40} label={`Monthly listeners grew from ${fmtCount(artist.growthMetrics.listeners90dAgo)} to ${fmtCount(artist.growthMetrics.monthlyListeners)}`} />
        <p className="rising-card__range mono">{fmtCount(artist.growthMetrics.listeners90dAgo)} → {fmtCount(artist.growthMetrics.monthlyListeners)} monthly listeners</p>
        <p className="rising-card__why"><span className="eyebrow">Why now</span>{why}</p>
        <div className="rising-card__actions">
          <Button size="sm" variant="secondary" onClick={() => navigate(`artist/${artist.id}`)}>View Artist</Button>
          <Button size="sm" variant="primary" icon="channels" onClick={() => openOverlay({ kind: 'invite', artistId: artist.id })}>Invite</Button>
        </div>
      </div>
    </article>
  );
}

export { Chip };
