import { ARTIST_BY_ID } from '../data/artists';
import { resetDemo, update, useStore } from '../services/store';
import { useViewer } from '../services/hooks';
import { Portrait } from '../components/Art';
import { Button, Chip, Segmented, Toggle, Verified } from '../components/ui';
import { AppIcon, LogoMark } from '../brand/Logo';
import { spotifyAPI, spotifyAvailable } from '../services/spotify';
import { navigate } from '../lib/router';
import { toast } from '../lib/toast';
import { camelot, fmtCount } from '../lib/music';
import type { Visibility } from '../types';
import { Avatar } from '../components/ui';

const LOOKING = ['Co-writer', 'Producer', 'Vocalist', 'Feature', 'Remix', 'Live collaborator', 'Tour partner', 'Open to anything'];

export function Profile() {
  const viewer = useViewer();
  const auth = useStore((s) => s.auth);
  const s = useStore((st) => st.settings);
  const favorites = useStore((st) => st.favorites);
  const set = (fn: (x: typeof s) => void) => update((st) => fn(st.settings));

  return (
    <div className="page me">
      <header className="me__head">
        <span className="me__portrait"><Portrait visual={viewer.photo} imageUrl={viewer.imageUrl} /></span>
        <div>
          <Verified />
          <h1 className="display display--sm">{viewer.name}</h1>
          <p className="meta meta--lg">{viewer.genres[0]} · {viewer.location.city} · {fmtCount(viewer.growthMetrics.monthlyListeners)} monthly listeners</p>
          <p className="profile__open"><span className="eyebrow">Open to</span>{viewer.collaborationTypes.map((c) => (c === 'Feature' ? 'Features' : c)).join(' · ')}</p>
        </div>
      </header>

      <div className="me__grid">
        <section className="block">
          <h2 className="block__title">Visibility</h2>
          <Segmented<Visibility>
            label="Visibility"
            value={s.visibility}
            onChange={(v) => set((x) => { x.visibility = v; })}
            options={[
              { value: 'private', label: 'Private', hint: 'Only people you invite can interact.' },
              { value: 'discoverable', label: 'Discoverable', hint: 'Collab can recommend you to compatible artists.' },
              { value: 'open', label: 'Open to Collabs', hint: 'You actively want collaboration opportunities.' },
            ]}
          />
        </section>

        <section className="block">
          <h2 className="block__title">Privacy</h2>
          <label className="select select--row">
            <span>Who can invite you</span>
            <select id="who-invite" value={s.whoCanInvite} onChange={(e) => set((x) => { x.whoCanInvite = e.target.value as typeof s.whoCanInvite; })}>
              <option value="anyone">Any verified artist</option>
              <option value="matches">Only artists Collab matched with me</option>
              <option value="nobody">Nobody (I’ll reach out)</option>
            </select>
          </label>
          <Toggle id="t-rising" label="Appear in Rising Talent" hint="Let established artists find you by growth." checked={s.appearInRising} onChange={(v) => set((x) => { x.appearInRising = v; })} />
          <Toggle id="t-overlap" label="Show audience overlap" hint="Overlap is always aggregate. Never listener-level data." checked={s.showAudienceOverlap} onChange={(v) => set((x) => { x.showAudienceOverlap = v; })} />
        </section>

        <section className="block">
          <h2 className="block__title">Collaboration preferences</h2>
          <p className="muted small">Looking for</p>
          <div className="choice-grid choice-grid--sm" role="group" aria-label="Looking for">
            {LOOKING.map((l) => {
              const on = s.lookingFor.includes(l);
              return <button key={l} className={`choice ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={() => set((x) => { x.lookingFor = on ? x.lookingFor.filter((y) => y !== l) : [...x.lookingFor.filter((y) => y !== 'Open to anything'), l]; })}>{l}</button>;
            })}
          </div>
          <div className="adv adv--sm">
            <label htmlFor="adv2" className="muted small">How adventurous are you?</label>
            <input id="adv2" type="range" min={0} max={100} value={Math.round(s.adventurousness * 100)} onChange={(e) => set((x) => { x.adventurousness = Number(e.target.value) / 100; })} style={{ ['--p' as string]: `${s.adventurousness * 100}%` }} />
            <div className="adv__labels"><span>Stay close to my sound</span><span>Surprise me</span></div>
          </div>
        </section>

        <section className="block">
          <h2 className="block__title">Your sound</h2>
          <div className="sound-facts">
            <div><span className="eyebrow">Genres</span><div className="chips">{viewer.genres.map((g) => <Chip key={g}>{g}</Chip>)}</div></div>
            <div><span className="eyebrow">Tempo</span><strong className="mono">{viewer.tempoRange[0]}–{viewer.tempoRange[1]} BPM</strong></div>
            <div><span className="eyebrow">Keys</span><div className="chips">{viewer.keys.map((k) => <Chip key={k}><span className="mono">{camelot(k).code}</span>&nbsp;{k}</Chip>)}</div></div>
          </div>
        </section>

        {favorites.length > 0 && (
          <section className="block">
            <h2 className="block__title">Saved artists</h2>
            <ul className="saved">{favorites.map((f) => <li key={f}><a href={`#/artist/${f}`}><Avatar artist={ARTIST_BY_ID[f]} size={36} /><span>{ARTIST_BY_ID[f].name}</span></a></li>)}</ul>
          </section>
        )}

        <section className="block">
          <h2 className="block__title">Spotify connection</h2>
          <p>{auth?.mode === 'spotify' ? <>Connected as <strong>{auth.spotify?.displayName}</strong>.</> : <>Demo mode. Signed in as the sample artist <strong>Alex Rivera</strong>.</>}</p>
          <p className="muted small">{spotifyAvailable ? 'A Spotify client ID is configured for this build.' : 'No Spotify client ID is configured. Add COLLAB_SPOTIFY_CLIENT_ID to .env to enable real sign-in (see README).'}</p>
          <div className="row-gap">
            {spotifyAvailable && auth?.mode !== 'spotify' && <Button variant="primary" onClick={() => spotifyAPI.login()}>Connect Spotify</Button>}
            {auth?.mode === 'spotify' && <Button variant="secondary" onClick={() => { spotifyAPI.logout(); update((st) => { st.auth = { mode: 'demo', userId: st.auth!.userId }; }); toast('Disconnected from Spotify'); }}>Disconnect</Button>}
            <Button variant="ghost" icon="refresh" onClick={() => { resetDemo(); navigate(''); toast('Demo reset to its starting state'); }}>Reset demo</Button>
          </div>
        </section>

        <section className="block brand-block">
          <h2 className="block__title">The Collab mark</h2>
          <div className="brand-row">
            <span className="brand-tile brand-tile--dark"><LogoMark size={56} tone="green" /></span>
            <span className="brand-tile brand-tile--dark"><LogoMark size={56} tone="white" /></span>
            <span className="brand-tile brand-tile--light"><LogoMark size={56} tone="black" /></span>
            <AppIcon size={72} />
            <span className="brand-tile brand-tile--dark"><LogoMark size={16} tone="green" /></span>
          </div>
          <p className="muted small">An outer C and an inner orbit, turned off-axis around one shared point: two creative paths meeting.</p>
        </section>
      </div>
    </div>
  );
}
