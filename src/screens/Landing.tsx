import { ARTIST_BY_ID, DEMO_USER_ID } from '../data/artists';
import { Portrait } from '../components/Art';
import { LogoMark, Wordmark } from '../brand/Logo';
import { Button } from '../components/ui';
import { Icon } from '../components/Icon';
import { navigate } from '../lib/router';
import { useStore } from '../services/store';
import { useRecommendations } from '../services/hooks';
import { keyCompatibility, overlapPercent, tempoCompatibility } from '../services/recommendation';
import { camelot } from '../lib/music';

const STEPS = [
  ['You make music.', 'Your catalog is already on Spotify.'],
  ['Collab understands your sound.', 'Genre, tempo, key, texture.'],
  ['Collab understands your audience.', 'Who listens to you, and who else they love.'],
  ['Collab finds the artists you should meet.', 'Familiar enough to connect. Different enough to surprise.'],
  ['You make something together.', 'Talk it through in a private voice room, build it live, and release it to both audiences.'],
];

const FLYWHEEL = ['More artists collaborate', 'More collaborative releases', 'Each reaches the other’s audience', 'More streams', 'More artists join Collab', 'More collaboration data', 'Better recommendations'];

export function Landing() {
  const onboarded = useStore((s) => s.onboarded);
  const enter = () => navigate(onboarded ? 'discover' : 'onboarding');
  const recs = useRecommendations();
  const top = recs[0];
  const lena = ARTIST_BY_ID[top?.targetArtistId ?? 'lena-cruz'];
  const alex = ARTIST_BY_ID[DEMO_USER_ID];
  const tempoDiff = Math.max(1, tempoCompatibility(alex, lena).diff);
  const pair = keyCompatibility(alex, lena).pairs[0] ?? [alex.keys[0], lena.keys[0]];

  return (
    <div className="landing">
      <header className="landing__bar">
        <Wordmark size={22} />
        <span className="landing__concept">A Spotify concept</span>
        <Button variant="primary" size="sm" onClick={enter}>Enter Collab</Button>
      </header>

      <section className="hero">
        <div className="hero__copy">
          <p className="eyebrow eyebrow--green">A private network for verified artists</p>
          <h1 className="hero__title">Who should you make music with?</h1>
          <p className="hero__sub">Collab helps artists discover collaborators based on sound, audience, and creative compatibility. Then puts you in a room together.</p>
          <div className="hero__ctas">
            <Button variant="primary" size="lg" iconRight="arrowRight" onClick={enter}>Enter Collab</Button>
            <a className="btn btn--ghost btn--lg" href="#how" onClick={(e) => { e.preventDefault(); document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' }); }}>See how it works</a>
          </div>
        </div>

        <div className="hero__stage" aria-label={`Example match: ${alex.name} and ${lena.name}, ${top?.score}% Collaboration Fit`}>
          <div className="orbit" aria-hidden="true">
            <svg viewBox="0 0 400 400" className="orbit__rings">
              <circle cx="200" cy="200" r="190" />
              <circle cx="200" cy="200" r="140" />
              <circle cx="200" cy="200" r="90" />
            </svg>
          </div>
          <figure className="hero__card hero__card--a">
            <Portrait visual={alex.photo} />
            <figcaption><strong>{alex.name}</strong><span>Indie Pop · Vancouver</span></figcaption>
          </figure>
          <figure className="hero__card hero__card--b">
            <Portrait visual={lena.photo} />
            <figcaption><strong>{lena.name}</strong><span>{lena.genres[0]} · {lena.location.city}</span></figcaption>
          </figure>
          <div className="hero__fit">
            <LogoMark size={30} live />
            <strong className="mono">{top?.score ?? 90}%</strong>
            <span>Collaboration Fit</span>
          </div>
          <ul className="hero__signals mono">
            <li style={{ ['--i' as string]: 0 }}>{top ? overlapPercent(top.signals.audienceOverlap) : 62}% audience overlap</li>
            <li style={{ ['--i' as string]: 1 }}>tempos within {tempoDiff} BPM</li>
            <li style={{ ['--i' as string]: 2 }}>keys {camelot(pair[0]).code} ↔ {camelot(pair[1]).code}</li>
            <li style={{ ['--i' as string]: 3 }}>acoustic × electronic</li>
          </ul>
        </div>
      </section>

      <section className="story">
        <div className="story__col">
          <p className="eyebrow">Today</p>
          <h2>Collaboration happens by luck.</h2>
          <p>Artists find each other through managers, labels, DMs, friends of friends, and industry connections. The right collaborator is often one city, one scene, one introduction away, and never meets you.</p>
          <ul className="story__luck">{['Managers', 'Labels', 'DMs', 'Industry relationships', 'Luck'].map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
        <div className="story__col story__col--knows">
          <p className="eyebrow eyebrow--green">But Spotify already knows</p>
          <ul className="story__knows">
            <li>Who sounds compatible.</li>
            <li>Whose audiences overlap.</li>
            <li>Who’s rising.</li>
            <li>Who might complement your sound.</li>
          </ul>
          <p className="story__punch">Collab turns those signals into introductions.</p>
        </div>
      </section>

      <section className="how" id="how">
        <p className="eyebrow">How it works</p>
        <ol className="how__steps">
          {STEPS.map(([t, s], i) => (
            <li key={t} style={{ ['--i' as string]: i }}>
              <span className="how__num mono">{String(i + 1).padStart(2, '0')}</span>
              <div><h3>{t}</h3><p>{s}</p></div>
            </li>
          ))}
        </ol>
      </section>

      <section className="pillars">
        {[
          ['spark', 'Smart Matching', 'Collab tells you who you should meet, and shows its working: audience, tempo, key, momentum, contrast.'],
          ['channels', 'Audio Channels', 'Private, invite-only voice rooms. Talk, listen in sync, start a Live Session, and release what you make as a joint single.'],
          ['rising', 'Rising Talent Radar', 'Growth rate over follower count. Find the next generation before everyone else does.'],
        ].map(([icon, t, d]) => (
          <article key={t} className="pillar">
            <Icon name={icon as 'spark'} size={26} />
            <h3>{t}</h3>
            <p>{d}</p>
          </article>
        ))}
      </section>

      <section className="flywheel">
        <div className="flywheel__copy">
          <p className="eyebrow">Why Spotify</p>
          <h2>From “discover music” to “discover who you should make music with.”</h2>
          <p>Spotify isn’t only where music is consumed. It sits where artists, music, listeners and discovery meet. Every collaboration Collab starts makes the next recommendation better.</p>
        </div>
        <Flywheel />
      </section>

      <section className="final-cta">
        <LogoMark size={56} live />
        <h2>Meet the artists Collab thinks you should know.</h2>
        <Button variant="primary" size="lg" iconRight="arrowRight" onClick={enter}>Enter Collab</Button>
      </section>

      <footer className="landing__foot">
        <Wordmark size={16} tone="white" />
        <p>A product concept and working prototype. Not affiliated with or endorsed by Spotify. All artists shown are fictional; audience and growth figures are simulated.</p>
      </footer>
    </div>
  );
}

function Flywheel() {
  const n = FLYWHEEL.length;
  const R = 150;
  return (
    <div className="wheel-diagram" role="img" aria-label={`Flywheel: ${FLYWHEEL.join(', then ')}, then more collaborations.`}>
      <svg viewBox="0 0 420 420" aria-hidden="true">
        <circle cx="210" cy="210" r={R} fill="none" stroke="var(--line)" strokeWidth="1" />
        <circle cx="210" cy="210" r={R} fill="none" stroke="var(--green)" strokeWidth="2" strokeDasharray="40 902" className="wheel-diagram__spin" />
        {FLYWHEEL.map((_, i) => {
          const a = (i / n) * Math.PI * 2 - Math.PI / 2;
          return <circle key={i} cx={210 + R * Math.cos(a)} cy={210 + R * Math.sin(a)} r="5" fill="var(--green)" />;
        })}
      </svg>
      {FLYWHEEL.map((label, i) => {
        const a = (i / n) * Math.PI * 2 - Math.PI / 2;
        const x = 50 + (Math.cos(a) * (R + 8)) / 4.2, y = 50 + (Math.sin(a) * (R + 8)) / 4.2;
        return <span key={label} className="wheel-diagram__label" style={{ left: `${x}%`, top: `${y}%`, transform: `translate(${Math.cos(a) > 0.2 ? '6%' : Math.cos(a) < -0.2 ? '-106%' : '-50%'}, ${Math.sin(a) > 0.5 ? '10%' : Math.sin(a) < -0.5 ? '-115%' : '-50%'})` }}>{label}</span>;
      })}
      <div className="wheel-diagram__hub"><LogoMark size={44} live /><span>More collaborations</span></div>
    </div>
  );
}
