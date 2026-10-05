import { useEffect, useMemo, useState } from 'react';
import { ARTISTS, ARTIST_BY_ID, DEMO_USER_ID } from '../data/artists';
import { AppIcon, Wordmark } from '../brand/Logo';
import { Button } from '../components/ui';
import { Cover, Portrait } from '../components/Art';
import { Icon } from '../components/Icon';
import { navigate } from '../lib/router';
import { camelot, fmtCount } from '../lib/music';
import { recommend, listenerGrowth } from '../services/recommendation';
import { update, useStore } from '../services/store';
import { spotify, spotifyAPI, spotifyAvailable } from '../services/spotify';
import { useViewer } from '../services/hooks';
import { toast } from '../lib/toast';
import { genreLabel } from '../data/genres';

const LOOKING = ['Co-writer', 'Producer', 'Vocalist', 'Feature', 'Remix', 'Live collaborator', 'Tour partner', 'Open to anything'];

export function Onboarding() {
  const auth = useStore((s) => s.auth);
  const settings = useStore((s) => s.settings);
  const [step, setStep] = useState(auth ? 1 : 0);
  const [connecting, setConnecting] = useState(false);

  const connect = async () => {
    setConnecting(true);
    if (spotifyAvailable) {
      try { await spotifyAPI.login(); return; } catch (e) { toast((e as Error).message); }
    }
    // Demo mode: connect the sample artist profile.
    window.setTimeout(() => {
      update((s) => { s.auth = { mode: 'demo', userId: DEMO_USER_ID }; });
      setConnecting(false);
      setStep(1);
    }, 700);
  };

  const finish = () => {
    update((s) => { s.onboarded = true; });
    navigate('discover');
  };

  return (
    <div className="onb">
      <header className="onb__bar">
        <Wordmark size={18} />
        {step > 0 && <ol className="onb__progress" aria-label={`Step ${step} of 4`}>{[1, 2, 3, 4].map((i) => <li key={i} className={i <= step ? 'on' : ''} />)}</ol>}
        <Button variant="quiet" size="sm" onClick={() => navigate('')}>Exit</Button>
      </header>
      <main className="onb__main" key={step}>
        {step === 0 && (
          <section className="onb__step onb__welcome">
            <AppIcon size={88} />
            <h1>Welcome to Collab</h1>
            <p className="onb__lede">A private network where verified artists meet the people they should be making music with.</p>
            <Button variant="primary" size="lg" icon="arrowRight" onClick={connect} disabled={connecting}>{connecting ? 'Connecting…' : 'Connect Spotify'}</Button>
            <p className="muted small">
              {spotifyAvailable
                ? 'Connects your Spotify account with PKCE sign-in. Collab reads your profile and catalog; it never posts or plays without you.'
                : 'Demo mode: no Spotify app is configured, so this connects the sample artist profile Alex Rivera.'}
            </p>
          </section>
        )}
        {step === 1 && <Analyzing onDone={() => setStep(2)} />}
        {step === 2 && (
          <section className="onb__step">
            <p className="eyebrow">Step 2</p>
            <h1>What are you looking for?</h1>
            <p className="onb__lede">Pick as many as you like. Collab weighs these when ranking matches.</p>
            <div className="choice-grid" role="group" aria-label="Collaboration types">
              {LOOKING.map((l) => {
                const on = settings.lookingFor.includes(l);
                return (
                  <button key={l} className={`choice ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={() => update((s) => {
                    const set = new Set(s.settings.lookingFor);
                    if (l === 'Open to anything') { s.settings.lookingFor = on ? [] : ['Open to anything']; return; }
                    set.delete('Open to anything');
                    on ? set.delete(l) : set.add(l);
                    s.settings.lookingFor = [...set];
                  })}>
                    <span>{l}</span>{on && <Icon name="check" size={16} />}
                  </button>
                );
              })}
            </div>
            <Button variant="primary" size="lg" iconRight="arrowRight" onClick={() => setStep(3)} disabled={!settings.lookingFor.length}>Continue</Button>
          </section>
        )}
        {step === 3 && <Adventure onDone={() => setStep(4)} />}
        {step === 4 && <Ready onDone={finish} />}
      </main>
    </div>
  );
}

function Analyzing({ onDone }: { onDone: () => void }) {
  const viewer = useViewer();
  const auth = useStore((s) => s.auth);
  const [shown, setShown] = useState(0);
  const [realTracks, setRealTracks] = useState<string[] | null>(null);
  useEffect(() => {
    const ids = [1, 2, 3, 4, 5, 6].map((i) => window.setTimeout(() => setShown(i), i * 520));
    return () => ids.forEach(clearTimeout);
  }, []);
  useEffect(() => {
    // Real mode: pull identity from Spotify. Sound/audience analysis stays demo data.
    if (auth?.mode !== 'spotify') return;
    spotify().getMe().then((me) => update((s) => { if (s.auth) s.auth.spotify = { ...s.auth.spotify, ...me, displayName: me.displayName }; })).catch(() => undefined);
    if (auth.spotify?.artistId) spotify().getArtistCatalog(auth.spotify.artistId).then((t) => setRealTracks(t.map((x) => x.title))).catch(() => undefined);
  }, [auth?.mode]);

  const g = listenerGrowth(viewer);
  const rows = [
    { label: 'Your genres', value: <span className="chips">{Object.entries(viewer.genreVector).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k]) => <span key={k} className="chip">{genreLabel(k)}</span>)}</span> },
    { label: 'Top tracks', value: <span className="onb__tracks">{(realTracks ?? viewer.tracks.map((t) => t.title)).slice(0, 3).map((t, i) => <span key={t}>{viewer.tracks[i] && <Cover track={viewer.tracks[i]} className="onb__cover" />}{t}</span>)}</span> },
    { label: 'Tempo range', value: <span className="mono">{viewer.tempoRange[0]}–{viewer.tempoRange[1]} BPM</span> },
    { label: 'Key patterns', value: <span className="mono">{viewer.keys.map((k) => `${k.replace(' major', '').replace(' minor', 'm')} ${camelot(k).code}`).join(' · ')}</span> },
    { label: 'Audience', value: <span>Strongest in {viewer.audienceProfile.topCities.slice(0, 3).join(', ')}</span> },
    { label: 'Recent growth', value: <span className="mono green">+{Math.round(g * 100)}% monthly listeners · {fmtCount(viewer.growthMetrics.monthlyListeners)}</span> },
  ];
  return (
    <section className="onb__step onb__analyze">
      <div className="onb__analyze-head">
        <span className="onb__avatar"><Portrait visual={viewer.photo} imageUrl={viewer.imageUrl} /></span>
        <div>
          <p className="eyebrow">Step 1 · {viewer.name}</p>
          <h1>{shown < 6 ? 'Analyzing your sound…' : 'Here’s your sound.'}</h1>
        </div>
      </div>
      <dl className="analysis">
        {rows.map((r, i) => (
          <div key={r.label} className={`analysis__row ${i < shown ? 'is-in' : ''}`}>
            <dt>{r.label}</dt>
            <dd>{i < shown ? r.value : <span className="analysis__scan" aria-hidden="true" />}</dd>
          </div>
        ))}
      </dl>
      <p className="muted small">
        {auth?.mode === 'spotify' ? 'Identity and catalog come from your Spotify account. ' : ''}
        Sound and audience analysis in this prototype uses demo data shaped like what Spotify could compute.
      </p>
      <Button variant="primary" size="lg" iconRight="arrowRight" onClick={onDone} disabled={shown < 6}>Continue</Button>
    </section>
  );
}

function Adventure({ onDone }: { onDone: () => void }) {
  const settings = useStore((s) => s.settings);
  const viewer = useViewer();
  const top = useMemo(() => recommend(viewer, ARTISTS, { adventurousness: settings.adventurousness, lookingFor: settings.lookingFor }).slice(0, 3), [viewer, settings.adventurousness, settings.lookingFor]);
  const v = settings.adventurousness;
  return (
    <section className="onb__step">
      <p className="eyebrow">Step 3</p>
      <h1>How adventurous are you?</h1>
      <p className="onb__lede">Collab looks for about 70% familiar, 30% unexpected. Move the line and watch who rises.</p>
      <div className="adv">
        <input id="adventure" type="range" min={0} max={100} value={Math.round(v * 100)} aria-label="Adventurousness"
          aria-valuetext={v < 0.33 ? 'Stay close to my sound' : v > 0.66 ? 'Surprise me' : 'Balanced'}
          onChange={(e) => update((s) => { s.settings.adventurousness = Number(e.target.value) / 100; })}
          style={{ ['--p' as string]: `${v * 100}%` }} />
        <div className="adv__labels"><span>Stay close to my sound</span><span>Surprise me</span></div>
      </div>
      <div className="adv__preview" aria-live="polite">
        <p className="eyebrow">Your top matches right now</p>
        <ol>
          {top.map((r) => {
            const a = ARTIST_BY_ID[r.targetArtistId];
            return (
              <li key={a.id}>
                <span className="adv__face"><Portrait visual={a.photo} /></span>
                <span><strong>{a.name}</strong><small>{a.genres.slice(0, 2).join(' · ')}</small></span>
                <span className="mono green">{r.score}%</span>
              </li>
            );
          })}
        </ol>
      </div>
      <Button variant="primary" size="lg" iconRight="arrowRight" onClick={onDone}>Continue</Button>
    </section>
  );
}

function Ready({ onDone }: { onDone: () => void }) {
  const viewer = useViewer();
  const settings = useStore((s) => s.settings);
  const recs = useMemo(() => recommend(viewer, ARTISTS, settings).slice(0, 8), [viewer, settings]);
  return (
    <section className="onb__step onb__ready">
      <div className="ready-stack" aria-hidden="true">
        {recs.slice(0, 5).map((r, i) => (
          <span key={r.targetArtistId} className="ready-stack__face" style={{ ['--i' as string]: i }}><Portrait visual={ARTIST_BY_ID[r.targetArtistId].photo} /></span>
        ))}
      </div>
      <h1>You’re ready.</h1>
      <p className="onb__lede">Collab found {recs.length} artists you should meet.</p>
      <Button variant="primary" size="lg" iconRight="arrowRight" onClick={onDone}>Meet them</Button>
    </section>
  );
}
