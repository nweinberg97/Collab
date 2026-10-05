import { useMemo, useState } from 'react';
import type { Artist } from '../types';
import { ARTISTS, DEMO_USER_ID } from '../data/artists';
import { Avatar, Button, Chip, Verified } from '../components/ui';
import { Icon } from '../components/Icon';
import { useRecommendations } from '../services/hooks';
import { href } from '../lib/router';
import { openOverlay } from '../lib/overlays';

const ROLE_WORDS: Record<string, string> = { producer: 'Producer', vocalist: 'Vocalist', singer: 'Vocalist', songwriter: 'Songwriter', writer: 'Songwriter', dj: 'DJ', band: 'Band', artist: 'Artist', rapper: 'Artist' };
const GENRE_WORDS: Record<string, string[]> = {
  indie: ['indie-pop', 'indie-rock', 'bedroom-pop'], 'r&b': ['alt-rnb', 'rnb', 'soul'], rnb: ['alt-rnb', 'rnb', 'soul'], soul: ['soul'], electronic: ['electronic', 'house'],
  'hip-hop': ['hip-hop'], hiphop: ['hip-hop'], rap: ['hip-hop'], pop: ['pop', 'indie-pop', 'bedroom-pop'], rock: ['indie-rock'], folk: ['folk'], jazz: ['jazz'],
  latin: ['latin'], afrobeats: ['afrobeats'], house: ['house'], ambient: ['ambient'], experimental: ['experimental'], dream: ['dream-pop'], bedroom: ['bedroom-pop'],
};
const COLLAB_WORDS: Record<string, string> = { feature: 'Feature', features: 'Feature', remix: 'Remix', remixes: 'Remix', production: 'Production', writing: 'Co-writing', 'co-writing': 'Co-writing', tour: 'Tour', touring: 'Tour', live: 'Live', vocals: 'Vocals' };
const MOMENTUM_WORDS: Record<string, string> = { rising: 'Rising', breakout: 'Breakout', established: 'Established' };
const STOP = new Set(['open', 'to', 'in', 'for', 'from', 'the', 'and', 'with', 'a', 'who', 'are', 'artists', 'female', 'male', 'women', 'men']);

const FILTERS = {
  role: ['Artist', 'Producer', 'Songwriter', 'DJ', 'Vocalist', 'Band'],
  genre: ['Indie', 'Hip-Hop', 'R&B', 'Electronic', 'Pop', 'Rock', 'Folk', 'Jazz', 'Latin', 'Afrobeats'],
  collab: ['Feature', 'Production', 'Co-writing', 'Remix', 'Tour'],
  momentum: ['Rising', 'Established', 'Breakout'],
};
type FilterKey = keyof typeof FILTERS;

const EXAMPLES = ['female R&B vocalists', 'Toronto producers', 'rising indie artists', 'electronic producers open to features'];

function parse(q: string) {
  const words = q.toLowerCase().replace(/[,.]/g, ' ').split(/\s+/).filter(Boolean);
  const out = { roles: new Set<string>(), genres: new Set<string>(), collab: new Set<string>(), momentum: new Set<string>(), pronoun: null as null | 'she' | 'he', free: [] as string[] };
  for (const raw of words) {
    const w = raw.replace(/s$/, '');
    if (raw === 'female' || raw === 'women' || raw === 'woman') out.pronoun = 'she';
    else if (raw === 'male' || raw === 'men' || raw === 'man') out.pronoun = 'he';
    else if (ROLE_WORDS[w]) out.roles.add(ROLE_WORDS[w]);
    else if (GENRE_WORDS[raw] || GENRE_WORDS[w]) (GENRE_WORDS[raw] ?? GENRE_WORDS[w]).forEach((g) => out.genres.add(g));
    else if (COLLAB_WORDS[raw]) out.collab.add(COLLAB_WORDS[raw]);
    else if (MOMENTUM_WORDS[raw]) out.momentum.add(MOMENTUM_WORDS[raw]);
    else if (!STOP.has(raw)) out.free.push(raw);
  }
  return out;
}

function matches(a: Artist, p: ReturnType<typeof parse>, f: Record<FilterKey, string | null>, loc: string) {
  const gv = (k: string) => (a.genreVector[k] ?? 0) >= 0.4;
  if (p.pronoun && a.pronoun !== p.pronoun) return false;
  if (p.roles.size && ![...p.roles].some((r) => a.roles.includes(r as never))) return false;
  if (p.genres.size && ![...p.genres].some(gv)) return false;
  if (p.collab.size && ![...p.collab].every((c) => a.collaborationTypes.includes(c as never))) return false;
  if (p.momentum.size && !p.momentum.has(a.momentum)) return false;
  const hay = `${a.name} ${a.location.city} ${a.location.country} ${a.genres.join(' ')}`.toLowerCase();
  if (p.free.length && !p.free.every((w) => hay.includes(w))) return false;
  if (f.role && !a.roles.includes(f.role as never)) return false;
  if (f.genre && !(GENRE_WORDS[f.genre.toLowerCase()] ?? []).some(gv)) return false;
  if (f.collab && !a.collaborationTypes.includes(f.collab as never)) return false;
  if (f.momentum && a.momentum !== f.momentum) return false;
  if (loc && !`${a.location.city} ${a.location.country}`.toLowerCase().includes(loc.toLowerCase())) return false;
  return true;
}

export function Search() {
  const [q, setQ] = useState('');
  const [loc, setLoc] = useState('');
  const [f, setF] = useState<Record<FilterKey, string | null>>({ role: null, genre: null, collab: null, momentum: null });
  const recs = useRecommendations();
  const fit = useMemo(() => Object.fromEntries(recs.map((r) => [r.targetArtistId, r.score])), [recs]);
  const parsed = useMemo(() => parse(q), [q]);
  const results = ARTISTS.filter((a) => a.id !== DEMO_USER_ID && matches(a, parsed, f, loc)).sort((x, y) => (fit[y.id] ?? 0) - (fit[x.id] ?? 0));
  const understood = [
    parsed.pronoun && (parsed.pronoun === 'she' ? 'women' : 'men'),
    ...parsed.roles, ...[...parsed.genres].slice(0, 3), ...[...parsed.collab].map((c) => `open to ${c.toLowerCase()}`), ...parsed.momentum, ...parsed.free.map((w) => `“${w}”`),
  ].filter(Boolean);

  return (
    <div className="page search">
      <header className="page-head">
        <div>
          <p className="eyebrow">Search</p>
          <h1 className="display display--sm">Find a specific kind of collaborator.</h1>
        </div>
      </header>
      <div className="search__box">
        <Icon name="search" size={22} />
        <input id="search-q" type="search" placeholder="Try “Toronto producers” or “rising indie artists”" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search artists by name, genre, role, location or collaboration type" autoFocus />
      </div>
      <div className="search__examples">
        {EXAMPLES.map((e) => <button key={e} className="pill" onClick={() => setQ(e)}>{e}</button>)}
      </div>
      <div className="filters">
        {(Object.keys(FILTERS) as FilterKey[]).map((k) => (
          <label key={k} className="select">
            <span>{k === 'collab' ? 'Collaboration' : k[0].toUpperCase() + k.slice(1)}</span>
            <select id={`f-${k}`} value={f[k] ?? ''} onChange={(e) => setF((s) => ({ ...s, [k]: e.target.value || null }))}>
              <option value="">Any</option>
              {FILTERS[k].map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>
        ))}
        <label className="select select--text">
          <span>Location</span>
          <input id="f-loc" value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="City or country" />
        </label>
      </div>
      {q && understood.length > 0 && <p className="search__understood">Looking for {understood.join(' · ')}</p>}
      <p className="search__count muted">{results.length} artist{results.length === 1 ? '' : 's'} · sorted by fit with you</p>
      <ul className="result-list">
        {results.map((a) => (
          <li key={a.id} className="result">
            <a href={href(`artist/${a.id}`)} className="result__main">
              <Avatar artist={a} size={52} />
              <span>
                <strong>{a.name} <Verified compact /></strong>
                <span className="meta">{a.roles.join(' / ')} · {a.genres.slice(0, 2).join(', ')} · {a.location.city}</span>
                <span className="chips">{a.collaborationTypes.map((c) => <Chip key={c}>{c}</Chip>)}</span>
              </span>
            </a>
            <span className={`result__fit mono ${fit[a.id] >= 70 ? 'green' : ''}`}>{fit[a.id] !== undefined ? (fit[a.id] < 25 ? 'Low fit' : `${fit[a.id]}%`) : '—'}</span>
            <Button size="sm" variant="secondary" onClick={() => openOverlay({ kind: 'invite', artistId: a.id })}>Invite</Button>
          </li>
        ))}
      </ul>
      {!results.length && <p className="empty-line">No verified artists match that yet. Try fewer words, or clear a filter.</p>}
    </div>
  );
}
