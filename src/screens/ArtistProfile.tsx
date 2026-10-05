import { useEffect } from 'react';
import { ARTIST_BY_ID } from '../data/artists';
import { Portrait } from '../components/Art';
import { Button, Chip, IconButton, Verified } from '../components/ui';
import { OverlapVenn, ScoreRing, SoundSpectrum, Sparkline, FamiliarityBar } from '../components/viz';
import { TrackRow, stopPreview, usePreview } from '../components/cards';
import { useFit, useViewer } from '../services/hooks';
import { update, useStore } from '../services/store';
import { openOverlay } from '../lib/overlays';
import { camelot, cap, fmtCount, pronounPoss } from '../lib/music';
import { listenerGrowth, overlapPercent } from '../services/recommendation';
import { toast } from '../lib/toast';
import { Icon } from '../components/Icon';
import { channelWith } from '../services/channels';
import { navigate } from '../lib/router';

export function ArtistProfile({ id }: { id: string }) {
  const a = ARTIST_BY_ID[id];
  const viewer = useViewer();
  const rec = useFit(id);
  const settings = useStore((s) => s.settings);
  const fav = useStore((s) => s.favorites.includes(id));
  const liveChannel = useStore((s) => Object.values(s.channels).find((c) => c.status === 'live' && c.participantIds.includes(id)));
  const { playingId, toggle } = usePreview();
  useEffect(() => { window.scrollTo(0, 0); return () => stopPreview(); }, [id]);

  if (!a) return <div className="page"><h1>Artist not found</h1></div>;
  const first = a.name.split(' ')[0];
  const her = pronounPoss(a.pronoun);
  const g = listenerGrowth(a);
  const pct = rec ? overlapPercent(rec.signals.audienceOverlap) : 0;
  const pending = channelWith(id);

  return (
    <div className="profile">
      <section className="profile__hero">
        <div className="profile__backdrop" aria-hidden="true"><Portrait visual={a.photo} imageUrl={a.imageUrl} /></div>
        <div className="profile__hero-inner">
          <div className="profile__portrait"><Portrait visual={a.photo} imageUrl={a.imageUrl} alt={`${a.name} (generative sound portrait)`} /></div>
          <div className="profile__id">
            <Verified />
            <h1 className="profile__name">{a.name}</h1>
            <p className="meta meta--lg">{a.genres[0]} · {a.location.city}, {a.location.country} · {fmtCount(a.growthMetrics.monthlyListeners)} monthly listeners</p>
            <p className="profile__open"><span className="eyebrow">Open to</span>{a.collaborationTypes.join(' · ')}</p>
            <div className="profile__actions">
              {liveChannel ? (
                <Button variant="primary" size="lg" icon="live" onClick={() => navigate(`channels/${liveChannel.id}`)}>Rejoin Audio Channel</Button>
              ) : (
                <Button variant="primary" size="lg" icon="channels" onClick={() => openOverlay({ kind: 'invite', artistId: id })}>{pending ? 'Invitation sent' : 'Invite to Audio Channel'}</Button>
              )}
              <Button variant="secondary" size="lg" icon="message" onClick={() => openOverlay({ kind: 'invite', artistId: id })}>Message</Button>
              <Button variant="secondary" size="lg" icon="external" onClick={() => toast(`${a.name} is a fictional demo artist. In production this opens ${her} Spotify profile.`)}>Spotify</Button>
              <IconButton icon="heart" label={fav ? 'Remove from saved artists' : 'Save artist'} active={fav} onClick={() => update((s) => { s.favorites = fav ? s.favorites.filter((x) => x !== id) : [...s.favorites, id]; })} />
            </div>
          </div>
        </div>
      </section>

      <div className="profile__body">
        <div className="profile__main">
          <section className="block">
            <h2 className="block__title">{cap(her)} sound</h2>
            <p className="profile__bio">{a.bio}</p>
            <div className="sound-facts">
              <div><span className="eyebrow">Genres</span><div className="chips">{a.genres.map((g) => <Chip key={g}>{g}</Chip>)}</div></div>
              <div><span className="eyebrow">Tempo</span><strong className="mono">{a.tempoRange[0]}–{a.tempoRange[1]} BPM</strong></div>
              <div><span className="eyebrow">Keys</span><div className="chips">{a.keys.map((k) => <Chip key={k}><span className="mono">{camelot(k).code}</span>&nbsp;{k}</Chip>)}</div></div>
            </div>
            <SoundSpectrum you={viewer.sound} them={a.sound} themName={first} />
          </section>

          <section className="block">
            <h2 className="block__title">Top tracks</h2>
            <div className="track-list">
              {a.tracks.map((t, i) => <TrackRow key={t.id} track={t} index={i} playing={playingId === t.id} onPlay={() => toggle(t)} />)}
            </div>
            <p className="muted small">Previews are rendered live from each track’s tempo and key. Stream counts are demo figures.</p>
          </section>

          <div className="profile__pair">
            {settings.showAudienceOverlap && rec && (
              <section className="block">
                <h2 className="block__title">Audience overlap</h2>
                <div className="overlap-block">
                  <OverlapVenn pct={pct} a="you" b={first} />
                  <div>
                    <strong className="big-num mono">{pct}%</strong>
                    <p>{pct >= 45 ? 'Your listeners already have a lot in common.' : pct >= 25 ? 'Some of your listeners already play both of you.' : 'Mostly different listeners. Room to grow both audiences.'}</p>
                    <p className="muted small">Strongest in {a.audienceProfile.topCities.slice(0, 3).join(', ')}. Aggregate signal only; no listener-level data.</p>
                  </div>
                </div>
              </section>
            )}
            <section className="block">
              <h2 className="block__title">Recent momentum</h2>
              <strong className="big-num mono green">+{a.growthMetrics.demoStreamsGrowthPct}%</strong>
              <p>streams over the last 90 days</p>
              <Sparkline values={a.growthMetrics.history} height={64} label="Monthly listeners, last 12 weeks" />
              <p className="mono muted small">{fmtCount(a.growthMetrics.listeners90dAgo)} → {fmtCount(a.growthMetrics.monthlyListeners)} monthly listeners ({g >= 0 ? '+' : ''}{Math.round(g * 100)}%)</p>
            </section>
          </div>

          <section className="block">
            <h2 className="block__title">Looking for</h2>
            <div className="chips chips--lg">{a.lookingFor.map((l) => <Chip key={l} tone="outline">{l}</Chip>)}</div>
          </section>
        </div>

        {rec && (
          <aside className="fit-panel" aria-label="Collaboration Fit">
            <div className="fit-panel__head">
              <ScoreRing value={rec.score} size={96} label="Fit" />
              <div>
                <p className="eyebrow">You × {first}</p>
                <p className="fit-panel__headline">{rec.headline}</p>
              </div>
            </div>
            <ul className="fit-panel__list">
              {rec.insights.slice(0, 5).map((ins) => (
                <li key={ins.kind}>
                  <span className="fit-panel__meter" style={{ ['--s' as string]: ins.strength }} aria-hidden="true" />
                  <div><strong>{ins.title}</strong><span>{ins.detail}</span></div>
                </li>
              ))}
            </ul>
            <FamiliarityBar similarity={rec.similarity} adventurousness={settings.adventurousness} compact />
            <Button variant="secondary" onClick={() => openOverlay({ kind: 'why', artistId: id })} iconRight="chevronRight">Why {first}?</Button>
          </aside>
        )}
      </div>
      <p className="profile__note muted small"><Icon name="lock" size={14} /> Fictional artist. Profile data is seeded demo data for this prototype.</p>
    </div>
  );
}
