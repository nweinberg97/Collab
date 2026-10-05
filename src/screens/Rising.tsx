import { useMemo, useState } from 'react';
import type { Artist } from '../types';
import { ARTISTS, DEMO_USER_ID } from '../data/artists';
import { RISING_CATEGORIES, genreLabel } from '../data/genres';
import { RisingCard } from '../components/cards';
import { Segmented } from '../components/ui';
import { growthMomentum, listenerGrowth } from '../services/recommendation';
import { useRecommendations } from '../services/hooks';
import { cap, fmtCount, hashString, pronounPoss } from '../lib/music';
import { useStore } from '../services/store';
import { navigate } from '../lib/router';

/** Which Rising category an artist belongs to. Indie/dream pop fold into Bedroom Pop. */
export function risingCategory(a: Artist): string {
  const v = (k: string) => a.genreVector[k] ?? 0;
  const score: Record<string, number> = {};
  for (const c of RISING_CATEGORIES) score[c] = v(c);
  score['bedroom-pop'] = Math.max(score['bedroom-pop'], v('indie-pop') * 0.8, v('dream-pop') * 0.7);
  score['alt-rnb'] = Math.max(score['alt-rnb'], v('rnb') * 0.9, v('soul') * 0.85);
  score['electronic'] = Math.max(score['electronic'], v('house') * 0.9);
  score['experimental'] = Math.max(score['experimental'], v('ambient') * 0.9);
  score['singer-songwriter'] = Math.max(score['singer-songwriter'], v('jazz') * 0.7);
  return Object.entries(score).sort((x, y) => y[1] - x[1])[0][0];
}

export function whyNow(a: Artist, pool: Artist[]): string {
  const cat = risingCategory(a);
  const g = listenerGrowth(a);
  const obj = a.pronoun === 'she' ? 'her' : a.pronoun === 'he' ? 'him' : 'them';
  const poss = pronounPoss(a.pronoun);
  const peers = pool.filter((p) => risingCategory(p) === cat && p.id !== a.id);
  // Fastest in their category.
  if (peers.length && peers.every((p) => listenerGrowth(p) < g)) return `The fastest-growing artist in ${genreLabel(cat).toLowerCase()} on Collab right now.`;
  // Outpacing much bigger artists in the same lane.
  const bigger = peers.filter((p) => p.growthMetrics.monthlyListeners >= a.growthMetrics.monthlyListeners * 10);
  if (bigger.length && g > 1.5 && bigger.every((b) => listenerGrowth(b) < g / 5)) return `${cap(poss)} audience is growing faster than artists 10× ${poss} size.`;
  const away = a.audienceProfile.topCities.find((c) => c !== a.location.city);
  const variant = hashString(a.id) % 3;
  if (variant === 0 && away) return `New listeners are arriving from ${away}, well outside ${poss} home scene in ${a.location.city}.`;
  if (variant === 1 && a.growthMetrics.demoStreamsGrowthPct > g * 100) return `Streams are outpacing listener growth: people who find ${obj} keep coming back.`;
  return `Monthly listeners up ${Math.round(g * 100)}% in 90 days, from ${fmtCount(a.growthMetrics.listeners90dAgo)} to ${fmtCount(a.growthMetrics.monthlyListeners)}.`;
}

export function Rising() {
  const [cat, setCat] = useState<string>('all');
  const [sort, setSort] = useState<'growth' | 'fit'>('growth');
  const [hover, setHover] = useState<string | null>(null);
  const appearInRising = useStore((s) => s.settings.appearInRising);
  const recs = useRecommendations();
  const fitById = useMemo(() => Object.fromEntries(recs.map((r) => [r.targetArtistId, r.score])), [recs]);

  const pool = ARTISTS.filter((a) => a.id !== DEMO_USER_ID);
  const rising = pool
    .filter((a) => a.momentum !== 'Established' && listenerGrowth(a) > 0.3)
    .filter((a) => cat === 'all' || risingCategory(a) === cat)
    .sort((x, y) => (sort === 'growth' ? listenerGrowth(y) - listenerGrowth(x) : (fitById[y.id] ?? 0) - (fitById[x.id] ?? 0)));

  return (
    <div className="page rising">
      <header className="page-head rising__head">
        <div>
          <p className="eyebrow eyebrow--green">Rising Talent</p>
          <h1 className="display">Find artists before everyone else does.</h1>
          <p className="page-head__sub">Ranked by growth rate, not follower count. The further from the centre, the faster an artist is growing right now.</p>
          {!appearInRising && <p className="notice">You’re hidden from Rising Talent. Change this in Profile → Privacy.</p>}
        </div>
      </header>

      <Radar pool={pool} active={cat} hover={hover} setHover={setHover} />

      <div className="rising__controls">
        <div className="filter-row" role="group" aria-label="Category">
          <button className={`pill ${cat === 'all' ? 'is-on' : ''}`} aria-pressed={cat === 'all'} onClick={() => setCat('all')}>All</button>
          {RISING_CATEGORIES.map((c) => (
            <button key={c} className={`pill ${cat === c ? 'is-on' : ''}`} aria-pressed={cat === c} onClick={() => setCat(c)}>{genreLabel(c)}</button>
          ))}
        </div>
        <Segmented label="Sort" value={sort} onChange={setSort} options={[{ value: 'growth', label: 'Growth rate' }, { value: 'fit', label: 'Fit with you' }]} />
      </div>

      {rising.length ? (
        <div className="rising-grid">
          {rising.map((a) => (
            <div key={a.id} onMouseEnter={() => setHover(a.id)} onMouseLeave={() => setHover(null)} className={hover === a.id ? 'is-hover' : ''}>
              <RisingCard artist={a} category={genreLabel(risingCategory(a))} why={whyNow(a, pool)} fit={fitById[a.id]} />
            </div>
          ))}
        </div>
      ) : (
        <p className="empty-line">No one is breaking out in {genreLabel(cat)} on Collab this week. Check back Friday.</p>
      )}
    </div>
  );
}

function Radar({ pool, active, hover, setHover }: { pool: Artist[]; active: string; hover: string | null; setHover: (id: string | null) => void }) {
  const N = RISING_CATEGORIES.length;
  const C = 220, R = 190;
  const dots = pool.map((a) => {
    const cat = risingCategory(a);
    const ci = RISING_CATEGORIES.indexOf(cat as (typeof RISING_CATEGORIES)[number]);
    const jitter = ((hashString(a.id) % 1000) / 1000) * 0.7 + 0.15;
    const ang = ((ci + jitter) / N) * Math.PI * 2 - Math.PI / 2;
    const r = 26 + growthMomentum(a) * (R - 34);
    return { a, cat, x: C + r * Math.cos(ang), y: C + r * Math.sin(ang) };
  });
  return (
    <div className="radar">
      <svg viewBox="0 0 440 440" role="img" aria-label="Rising Talent radar. Artists further from the centre are growing faster.">
        <defs>
          <linearGradient id="sweep" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="var(--green)" stopOpacity="0" />
            <stop offset="1" stopColor="var(--green)" stopOpacity="0.28" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((f) => <circle key={f} cx={C} cy={C} r={26 + f * (R - 34)} fill="none" stroke="var(--line)" strokeWidth="1" />)}
        {RISING_CATEGORIES.map((c, i) => {
          const ang = (i / N) * Math.PI * 2 - Math.PI / 2;
          const mid = ((i + 0.5) / N) * Math.PI * 2 - Math.PI / 2;
          const on = active === c;
          return (
            <g key={c}>
              {on && <path d={`M${C} ${C}L${C + R * Math.cos(ang)} ${C + R * Math.sin(ang)}A${R} ${R} 0 0 1 ${C + R * Math.cos(ang + (Math.PI * 2) / N)} ${C + R * Math.sin(ang + (Math.PI * 2) / N)}Z`} fill="var(--green)" opacity="0.08" />}
              <line x1={C} y1={C} x2={C + R * Math.cos(ang)} y2={C + R * Math.sin(ang)} stroke="var(--line)" />
              <text x={C + (R + 14) * Math.cos(mid)} y={C + (R + 14) * Math.sin(mid) + 3} textAnchor="middle" className={`radar__label ${on ? 'is-on' : ''}`}>{genreLabel(c).replace('Singer-Songwriter', 'Songwriter').replace('Alternative R&B', 'Alt R&B')}</text>
            </g>
          );
        })}
        <g className="radar__sweep"><path d={`M${C} ${C}L${C + R} ${C}A${R} ${R} 0 0 0 ${C + R * Math.cos(-0.5)} ${C + R * Math.sin(-0.5)}Z`} fill="url(#sweep)" /></g>
        <text x={C} y={C + 4} textAnchor="middle" className="radar__center">steady</text>
        {dots.map(({ a, cat, x, y }) => {
          const dim = active !== 'all' && cat !== active;
          const isH = hover === a.id;
          const fast = growthMomentum(a) > 0.6;
          return (
            <g key={a.id} className="radar__dot" opacity={dim ? 0.18 : 1} tabIndex={dim ? -1 : 0} role="link" aria-label={`${a.name}, +${Math.round(listenerGrowth(a) * 100)}% listeners`}
              onMouseEnter={() => setHover(a.id)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(a.id)} onBlur={() => setHover(null)}
              onClick={() => navigate(`artist/${a.id}`)} onKeyDown={(e) => { if (e.key === 'Enter') navigate(`artist/${a.id}`); }}>
              {fast && <circle cx={x} cy={y} r="9" fill="var(--green)" opacity="0.18" className="radar__ping" />}
              <circle cx={x} cy={y} r={isH ? 7 : 4.5} fill={fast ? 'var(--green)' : 'var(--fg-2)'} />
              {(isH || (fast && active !== 'all' && !dim)) && <text x={x} y={y - 11} textAnchor="middle" className="radar__name">{a.name}</text>}
            </g>
          );
        })}
      </svg>
      <div className="radar__legend">
        <span><b className="radar__key radar__key--fast" />Breaking out</span>
        <span><b className="radar__key" />Growing steadily or established</span>
        <span className="muted">Dot size is the same for everyone. Audience size is not the point.</span>
      </div>
    </div>
  );
}
