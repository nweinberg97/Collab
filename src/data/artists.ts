import type { Artist, CollabType, GenreVector, Momentum, Pronoun, Role, Track } from '../types';
import { hashString, parseDuration, rng } from '../lib/music';
import { genreLabel } from './genres';

// ─── Seeded, fictional artists ────────────────────────────────────────────────
// Every artist here is invented. Audience scenes, overlap and growth are
// `demo` signals — stand-ins for what Spotify's first-party data could compute.

interface Seed {
  id: string;
  name: string;
  p: Pronoun;
  city: string;
  country: string;
  bio: string;
  gv: GenreVector; // genre weights; top 3 become display genres
  roles: Role[];
  open?: boolean;
  types: CollabType[];
  wants: string[];
  bpm: [number, number];
  keys: string[];
  sound: [number, number, number, number]; // acoustic, electronic, energy, brightness
  scenes: GenreVector; // audience: "listeners also play…"
  cities: string[];
  ml: [number, number]; // monthly listeners [now, 90 days ago]
  streams: number; // demo streams growth %
  momentum: Momentum;
  hues: [number, number, number];
  tracks: [string, string, number, string][]; // title, m:ss, bpm, key
}

function build(s: Seed): Artist {
  const r = rng(hashString(s.id));
  const genresSorted = Object.entries(s.gv).sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const [now, then] = s.ml;
  // 12 weekly samples easing from `then` to `now` with light noise.
  const history = Array.from({ length: 12 }, (_, i) => {
    const t = i / 11;
    const eased = Math.pow(t, 1.6);
    const v = then + (now - then) * eased;
    return Math.round(v * (1 + (r() - 0.5) * 0.06 * (i > 0 && i < 11 ? 1 : 0)));
  });
  const tracks: Track[] = s.tracks.map(([title, dur, tempo, key], i) => ({
    id: `${s.id}-t${i + 1}`,
    artistId: s.id,
    title,
    durationMs: parseDuration(dur),
    tempo,
    key,
    genre: genreLabel(genresSorted[0]),
    demoMonthlyStreams: Math.round(now * (2.4 - i * 0.45) * (0.8 + r() * 0.4)),
    spotifyUrl: '',
    cover: {
      style: Math.floor(r() * 5),
      hues: [(s.hues[0] + i * 23) % 360, (s.hues[1] + i * 31) % 360, (s.hues[2] + i * 17) % 360],
      seed: hashString(`${s.id}-${title}`),
    },
  }));
  return {
    id: s.id,
    name: s.name,
    pronoun: s.p,
    photo: { hues: s.hues, seed: hashString(s.name) },
    location: { city: s.city, country: s.country },
    bio: s.bio,
    genres: genresSorted.slice(0, 3).map(genreLabel),
    genreVector: s.gv,
    roles: s.roles,
    spotifyUrl: '',
    verified: true,
    openToCollabs: s.open ?? true,
    collaborationTypes: s.types,
    lookingFor: s.wants,
    tempoRange: s.bpm,
    keys: s.keys,
    sound: { acoustic: s.sound[0], electronic: s.sound[1], energy: s.sound[2], brightness: s.sound[3] },
    audienceProfile: { demoScenes: s.scenes, topCities: s.cities },
    growthMetrics: {
      monthlyListeners: now,
      listeners90dAgo: then,
      demoStreamsGrowthPct: s.streams,
      history,
    },
    momentum: s.momentum,
    tracks,
    isDemoArtist: true,
  };
}

// ─── The demo user ────────────────────────────────────────────────────────────
export const DEMO_USER_ID = 'alex-rivera';

const SEEDS: Seed[] = [
  {
    id: DEMO_USER_ID, name: 'Alex Rivera', p: 'they', city: 'Vancouver', country: 'Canada',
    bio: 'Warm, guitar-led indie pop written between ferry rides. Two self-released EPs, one song that found its way onto a lot of rainy-day playlists.',
    gv: { 'indie-pop': 0.85, 'singer-songwriter': 0.45, folk: 0.35, 'dream-pop': 0.3, 'bedroom-pop': 0.2 },
    roles: ['Artist', 'Songwriter', 'Vocalist'], types: ['Feature', 'Co-writing', 'Production'], wants: ['Producer', 'Co-writer', 'Feature'],
    bpm: [92, 116], keys: ['A minor', 'C major', 'E minor', 'G major'], sound: [0.72, 0.24, 0.5, 0.62],
    scenes: { 'indie-pop': 0.9, 'dream-pop': 0.62, 'bedroom-pop': 0.5, 'singer-songwriter': 0.48, folk: 0.38, 'alt-rnb': 0.22, electronic: 0.18 },
    cities: ['Vancouver', 'Seattle', 'Toronto', 'London'], ml: [46200, 31800], streams: 58, momentum: 'Rising', hues: [150, 200, 30],
    tracks: [['Kitsilano Light', '3:41', 104, 'A minor'], ['Low Tide, High Beams', '3:12', 98, 'C major'], ['Northbound', '4:02', 112, 'E minor'], ['Rain on Main', '2:58', 96, 'G major']],
  },
  {
    id: 'lena-cruz', name: 'Lena Cruz', p: 'she', city: 'Los Angeles', country: 'USA',
    bio: 'Late-night indie pop built on drum machines and close-mic vocals. Writes in her car, finishes in a converted garage in Highland Park.',
    gv: { 'indie-pop': 0.78, 'dream-pop': 0.6, electronic: 0.55, 'bedroom-pop': 0.25 },
    roles: ['Artist', 'Vocalist', 'Producer'], types: ['Feature', 'Co-writing', 'Production'], wants: ['Producer', 'Feature', 'Co-writer'],
    bpm: [92, 118], keys: ['A minor', 'F major', 'D minor', 'C major'], sound: [0.3, 0.72, 0.55, 0.48],
    scenes: { 'indie-pop': 0.9, 'dream-pop': 0.78, 'bedroom-pop': 0.5, electronic: 0.46, 'singer-songwriter': 0.3, 'alt-rnb': 0.24, folk: 0.12 },
    cities: ['Los Angeles', 'Vancouver', 'Mexico City', 'London'], ml: [37800, 12200], streams: 340, momentum: 'Rising', hues: [330, 270, 20],
    tracks: [['Midnight Drive', '3:27', 106, 'A minor'], ['Golden Hour', '3:48', 100, 'F major'], ['Static Bloom', '3:05', 114, 'D minor'], ['Echo Park, 2am', '4:11', 94, 'C major']],
  },
  {
    id: 'maya-chen', name: 'Maya Chen', p: 'she', city: 'Toronto', country: 'Canada',
    bio: 'Alternative R&B with jazz chords and a low, unhurried voice. Former session keyboardist; now the one people book sessions around.',
    gv: { 'alt-rnb': 0.8, 'indie-pop': 0.55, rnb: 0.4, 'dream-pop': 0.35, electronic: 0.3, jazz: 0.25 },
    roles: ['Artist', 'Vocalist', 'Songwriter'], types: ['Feature', 'Co-writing', 'Vocals'], wants: ['Songwriter', 'Producer', 'Feature'],
    bpm: [90, 112], keys: ['A minor', 'F major', 'E minor', 'C major'], sound: [0.5, 0.52, 0.42, 0.45],
    scenes: { 'indie-pop': 0.82, 'alt-rnb': 0.9, 'dream-pop': 0.58, 'bedroom-pop': 0.46, 'singer-songwriter': 0.44, rnb: 0.4, folk: 0.18 },
    cities: ['Toronto', 'Vancouver', 'New York', 'London'], ml: [71400, 22100], streams: 245, momentum: 'Rising', hues: [20, 350, 45],
    tracks: [['Velvet Hours', '3:36', 96, 'A minor'], ['Second Language', '3:58', 92, 'F major'], ['Neon Psalm', '3:14', 108, 'E minor'], ['Slow Exit', '4:20', 90, 'C major']],
  },
  {
    id: 'theo-park', name: 'Theo Park', p: 'he', city: 'Seattle', country: 'USA',
    bio: 'Bedroom pop recorded on a four-track and a laptop with a cracked screen. Big on harmonies, small on budget.',
    gv: { 'bedroom-pop': 0.88, 'indie-pop': 0.62, 'dream-pop': 0.35, 'indie-rock': 0.25 },
    roles: ['Artist', 'Producer'], types: ['Production', 'Co-writing', 'Remix'], wants: ['Vocalist', 'Co-writer'],
    bpm: [96, 120], keys: ['G major', 'E minor', 'D major', 'C major'], sound: [0.58, 0.4, 0.48, 0.7],
    scenes: { 'bedroom-pop': 0.9, 'indie-pop': 0.8, 'dream-pop': 0.5, 'indie-rock': 0.42, 'singer-songwriter': 0.3, folk: 0.2 },
    cities: ['Seattle', 'Portland', 'Vancouver', 'Los Angeles'], ml: [29100, 11400], streams: 210, momentum: 'Rising', hues: [45, 190, 120],
    tracks: [['Night Drive (demo)', '2:51', 108, 'G major'], ['Cassette Summer', '3:03', 112, 'E minor'], ['Paper Moon', '2:44', 100, 'D major'], ['Alder Street', '3:20', 104, 'C major']],
  },
  {
    id: 'juno-okafor', name: 'Juno Okafor', p: 'she', city: 'London', country: 'UK',
    bio: 'South London vocalist moving between Afrobeats grooves and late-night R&B. Sang backing for three headline tours before stepping out front.',
    gv: { afrobeats: 0.7, 'alt-rnb': 0.65, rnb: 0.45, pop: 0.3 },
    roles: ['Vocalist', 'Artist', 'Songwriter'], types: ['Feature', 'Vocals', 'Co-writing'], wants: ['Producer', 'Feature'],
    bpm: [98, 112], keys: ['C minor', 'G minor', 'D# major', 'F minor'], sound: [0.35, 0.6, 0.66, 0.55],
    scenes: { afrobeats: 0.8, 'alt-rnb': 0.75, rnb: 0.6, 'indie-pop': 0.3, pop: 0.45, soul: 0.35 },
    cities: ['London', 'Lagos', 'Manchester', 'Toronto'], ml: [121000, 52300], streams: 180, momentum: 'Rising', hues: [35, 15, 280],
    tracks: [['Lagos to Peckham', '3:22', 104, 'C minor'], ['Soft Power', '3:45', 100, 'G minor'], ['Sunday Best', '3:10', 108, 'D# major']],
  },
  {
    id: 'sol-marin', name: 'Sol Marín', p: 'they', city: 'Mexico City', country: 'Mexico',
    bio: 'Bilingual dream pop that sounds like a Mexico City rooftop at 5am. Every record starts as a voice memo in Spanish.',
    gv: { latin: 0.7, 'dream-pop': 0.65, 'indie-pop': 0.45, electronic: 0.3 },
    roles: ['Artist', 'Vocalist', 'Songwriter'], types: ['Feature', 'Co-writing', 'Remix'], wants: ['Producer', 'Remix', 'Feature'],
    bpm: [88, 110], keys: ['E minor', 'B minor', 'A minor', 'D major'], sound: [0.48, 0.5, 0.42, 0.5],
    scenes: { latin: 0.85, 'dream-pop': 0.7, 'indie-pop': 0.6, 'bedroom-pop': 0.4, electronic: 0.3 },
    cities: ['Mexico City', 'Los Angeles', 'Madrid', 'Bogotá'], ml: [88300, 19800], streams: 410, momentum: 'Breakout', hues: [12, 300, 190],
    tracks: [['Azotea', '3:30', 96, 'E minor'], ['Luz de Mercurio', '3:52', 92, 'B minor'], ['Ojos Cerrados', '3:18', 104, 'A minor']],
  },
  {
    id: 'ezra-vance', name: 'Ezra Vance', p: 'he', city: 'Nashville', country: 'USA',
    bio: 'Plainspoken folk songs with a pedal-steel ache. Writes for other artists most weeks and keeps the best ones for himself.',
    gv: { folk: 0.85, 'singer-songwriter': 0.8, 'indie-rock': 0.2 },
    roles: ['Artist', 'Songwriter'], types: ['Co-writing', 'Feature', 'Tour'], wants: ['Co-writer', 'Vocalist', 'Tour partner'],
    bpm: [72, 100], keys: ['G major', 'D major', 'C major', 'E minor'], sound: [0.92, 0.05, 0.35, 0.55],
    scenes: { folk: 0.9, 'singer-songwriter': 0.85, 'indie-rock': 0.35, 'indie-pop': 0.3 },
    cities: ['Nashville', 'Austin', 'Chicago', 'Dublin'], ml: [1420000, 1310000], streams: 12, momentum: 'Established', hues: [32, 48, 200],
    tracks: [['Dry County', '3:55', 84, 'G major'], ['The Long Way Home', '4:18', 76, 'D major'], ['Porchlight', '3:27', 92, 'C major']],
  },
  {
    id: 'halcyon-drive', name: 'Halcyon Drive', p: 'they', city: 'Manchester', country: 'UK',
    bio: 'Four-piece indie rock with jangly guitars and choruses built for basement venues. Self-booked a 30-date UK run last spring.',
    gv: { 'indie-rock': 0.9, 'indie-pop': 0.4, 'dream-pop': 0.2 },
    roles: ['Band'], types: ['Tour', 'Live', 'Remix'], wants: ['Tour partner', 'Producer'],
    bpm: [118, 142], keys: ['E major', 'A major', 'B major', 'C# minor'], sound: [0.55, 0.15, 0.85, 0.65],
    scenes: { 'indie-rock': 0.92, 'indie-pop': 0.55, 'bedroom-pop': 0.3, 'dream-pop': 0.25 },
    cities: ['Manchester', 'London', 'Glasgow', 'Dublin'], ml: [54700, 21900], streams: 196, momentum: 'Rising', hues: [210, 10, 60],
    tracks: [['Ancoats', '3:11', 132, 'E major'], ['Floodlights', '2:58', 138, 'A major'], ['Late Train South', '3:40', 124, 'C# minor']],
  },
  {
    id: 'nadia-rahimi', name: 'Nadia Rahimi', p: 'she', city: 'Berlin', country: 'Germany',
    bio: 'Producer and DJ making melodic electronic music for the hour after the club. Known for remixes that end up bigger than the originals.',
    gv: { electronic: 0.92, house: 0.55, ambient: 0.35, 'dream-pop': 0.2 },
    roles: ['Producer', 'DJ'], types: ['Production', 'Remix', 'Live'], wants: ['Vocalist', 'Feature'],
    bpm: [110, 124], keys: ['A minor', 'D minor', 'F major', 'G minor'], sound: [0.08, 0.95, 0.65, 0.42],
    scenes: { electronic: 0.92, house: 0.7, 'dream-pop': 0.4, 'indie-pop': 0.35, ambient: 0.4 },
    cities: ['Berlin', 'London', 'Amsterdam', 'Paris'], ml: [892000, 768000], streams: 21, momentum: 'Established', hues: [190, 250, 160],
    tracks: [['Afterhours (Kreuzberg)', '5:42', 122, 'A minor'], ['Glasshouse', '4:58', 118, 'D minor'], ['Undertow', '6:10', 120, 'F major'], ['Kept Light', '4:36', 112, 'G minor']],
  },
  {
    id: 'kofi-mensah', name: 'Kofi Mensah', p: 'he', city: 'Accra', country: 'Ghana',
    bio: 'Producer behind a run of Afrobeats records with highlife guitar at their centre. Builds every beat around a live percussion take.',
    gv: { afrobeats: 0.92, 'hip-hop': 0.3, pop: 0.3, electronic: 0.25 },
    roles: ['Producer'], types: ['Production', 'Remix', 'Feature'], wants: ['Vocalist', 'Songwriter'],
    bpm: [100, 116], keys: ['F minor', 'C minor', 'G# major', 'D# major'], sound: [0.45, 0.55, 0.75, 0.72],
    scenes: { afrobeats: 0.95, pop: 0.45, 'hip-hop': 0.4, 'alt-rnb': 0.35, rnb: 0.3 },
    cities: ['Accra', 'Lagos', 'London', 'Paris'], ml: [214000, 51200], streams: 380, momentum: 'Breakout', hues: [40, 140, 15],
    tracks: [['Osu Nights', '3:28', 106, 'F minor'], ['Palm Wine Riddim', '3:05', 110, 'G# major'], ['Highlife Code', '3:44', 104, 'C minor']],
  },
  {
    id: 'wren-holloway', name: 'Wren Holloway', p: 'she', city: 'Melbourne', country: 'Australia',
    bio: 'Fingerpicked songs about small towns and big weather. Records live to tape, one take, no clicks.',
    gv: { 'singer-songwriter': 0.88, folk: 0.75, 'indie-pop': 0.3 },
    roles: ['Artist', 'Songwriter', 'Vocalist'], types: ['Co-writing', 'Feature', 'Tour'], wants: ['Co-writer', 'Producer'],
    bpm: [80, 104], keys: ['C major', 'A minor', 'G major', 'F major'], sound: [0.9, 0.08, 0.32, 0.6],
    scenes: { 'singer-songwriter': 0.9, folk: 0.8, 'indie-pop': 0.5, 'dream-pop': 0.25 },
    cities: ['Melbourne', 'Sydney', 'Auckland', 'London'], ml: [33600, 15200], streams: 140, momentum: 'Rising', hues: [95, 40, 210],
    tracks: [['Westerly', '3:48', 88, 'C major'], ['Salt Flats', '4:05', 96, 'A minor'], ['Kettle On', '2:56', 100, 'G major']],
  },
  {
    id: 'dax-monroe', name: 'Dax Monroe', p: 'he', city: 'Atlanta', country: 'USA',
    bio: 'Hip-hop producer with credits across two platinum records. Samples gospel choirs and old soul 45s, then flips them inside out.',
    gv: { 'hip-hop': 0.92, soul: 0.4, rnb: 0.35 },
    roles: ['Producer'], types: ['Production', 'Remix'], wants: ['Vocalist', 'Feature'],
    bpm: [70, 96], keys: ['C minor', 'F minor', 'A# minor', 'G minor'], sound: [0.3, 0.7, 0.72, 0.35],
    scenes: { 'hip-hop': 0.95, rnb: 0.55, soul: 0.4, 'alt-rnb': 0.35 },
    cities: ['Atlanta', 'Houston', 'New York', 'Chicago'], ml: [2310000, 2190000], streams: 9, momentum: 'Established', hues: [0, 40, 260],
    tracks: [['Choir Practice', '3:12', 88, 'C minor'], ['Peachtree', '2:49', 92, 'F minor'], ['Sunday Service', '3:31', 76, 'G minor']],
  },
  {
    id: 'isla-moreau', name: 'Isla Moreau', p: 'she', city: 'Montréal', country: 'Canada',
    bio: 'Shoegaze-leaning dream pop sung half in French. Builds walls of guitar, then whispers over them.',
    gv: { 'dream-pop': 0.9, 'indie-rock': 0.4, 'indie-pop': 0.35, ambient: 0.3 },
    roles: ['Artist', 'Vocalist'], types: ['Feature', 'Co-writing', 'Remix'], wants: ['Producer', 'Co-writer'],
    bpm: [84, 112], keys: ['D major', 'B minor', 'F# minor', 'A major'], sound: [0.4, 0.5, 0.45, 0.38],
    scenes: { 'dream-pop': 0.9, 'indie-pop': 0.65, 'indie-rock': 0.5, 'bedroom-pop': 0.4, ambient: 0.3 },
    cities: ['Montréal', 'Paris', 'Toronto', 'Brooklyn'], ml: [41900, 17700], streams: 168, momentum: 'Rising', hues: [260, 200, 330],
    tracks: [['Brume', '4:12', 92, 'D major'], ['Mile End', '3:39', 104, 'B minor'], ['Tout Bas', '3:58', 88, 'F# minor']],
  },
  {
    id: 'paper-lanterns', name: 'Paper Lanterns', p: 'they', city: 'Brooklyn', country: 'USA',
    bio: 'A duo making tiny, glowing bedroom pop songs. One sings, one plays everything; both argue about the bridge.',
    gv: { 'bedroom-pop': 0.9, 'indie-pop': 0.5, 'dream-pop': 0.45 },
    roles: ['Band', 'Producer'], types: ['Remix', 'Feature', 'Co-writing'], wants: ['Vocalist', 'Remix'],
    bpm: [90, 110], keys: ['F major', 'D minor', 'C major', 'A minor'], sound: [0.5, 0.5, 0.38, 0.72],
    scenes: { 'bedroom-pop': 0.92, 'indie-pop': 0.7, 'dream-pop': 0.6, 'singer-songwriter': 0.3 },
    cities: ['Brooklyn', 'Philadelphia', 'Boston', 'Toronto'], ml: [52600, 9800], streams: 520, momentum: 'Breakout', hues: [48, 20, 340],
    tracks: [['Lantern Season', '2:47', 98, 'F major'], ['Small Hours', '3:02', 94, 'D minor'], ['Fire Escape Garden', '3:15', 104, 'C major']],
  },
  {
    id: 'rio-valente', name: 'Rio Valente', p: 'he', city: 'São Paulo', country: 'Brazil',
    bio: 'Producer folding bossa nova chords into club rhythms. His remixes travel from São Paulo warehouses to Lisbon rooftops.',
    gv: { latin: 0.65, electronic: 0.75, house: 0.45, jazz: 0.25 },
    roles: ['Producer', 'DJ'], types: ['Production', 'Remix', 'Live'], wants: ['Vocalist', 'Feature'],
    bpm: [112, 124], keys: ['A minor', 'E minor', 'D minor', 'C major'], sound: [0.3, 0.8, 0.7, 0.6],
    scenes: { latin: 0.75, electronic: 0.8, house: 0.6, 'indie-pop': 0.3, jazz: 0.2 },
    cities: ['São Paulo', 'Rio de Janeiro', 'Lisbon', 'Berlin'], ml: [76400, 34800], streams: 150, momentum: 'Rising', hues: [160, 45, 0],
    tracks: [['Paulista', '4:40', 120, 'A minor'], ['Garoa', '5:02', 116, 'E minor'], ['Bossa Machine', '4:21', 122, 'D minor']],
  },
  {
    id: 'ama-serwaa', name: 'Ama Serwaa', p: 'she', city: 'Lagos', country: 'Nigeria',
    bio: 'Soul singer with an Afrobeats heartbeat. Writes melodies first, words last, and harmonies in the shower.',
    gv: { afrobeats: 0.65, soul: 0.7, rnb: 0.5 },
    roles: ['Vocalist', 'Artist'], types: ['Feature', 'Vocals', 'Co-writing'], wants: ['Producer', 'Co-writer'],
    bpm: [94, 108], keys: ['G minor', 'D# major', 'C minor', 'A# major'], sound: [0.55, 0.42, 0.6, 0.62],
    scenes: { afrobeats: 0.85, soul: 0.6, rnb: 0.55, 'alt-rnb': 0.45, pop: 0.35 },
    cities: ['Lagos', 'Accra', 'London', 'Houston'], ml: [98700, 31500], streams: 260, momentum: 'Breakout', hues: [25, 320, 50],
    tracks: [['Owambe Heart', '3:34', 102, 'G minor'], ['Gold Thread', '3:51', 96, 'D# major'], ['Third Mainland', '3:18', 106, 'C minor']],
  },
  {
    id: 'felix-lindqvist', name: 'Felix Lindqvist', p: 'he', city: 'Stockholm', country: 'Sweden',
    bio: 'Pop producer with a Scandinavian ear for melody and a habit of finishing records in one long night.',
    gv: { 'indie-pop': 0.6, electronic: 0.7, pop: 0.6 },
    roles: ['Producer', 'Songwriter'], types: ['Production', 'Co-writing', 'Remix'], wants: ['Vocalist', 'Artist'],
    bpm: [96, 124], keys: ['C major', 'A minor', 'G major', 'E minor'], sound: [0.25, 0.8, 0.62, 0.75],
    scenes: { 'indie-pop': 0.7, pop: 0.75, electronic: 0.65, 'dream-pop': 0.35, 'bedroom-pop': 0.3 },
    cities: ['Stockholm', 'Oslo', 'London', 'Berlin'], ml: [1080000, 968000], streams: 18, momentum: 'Established', hues: [205, 175, 50],
    tracks: [['Midsommar Static', '3:21', 112, 'C major'], ['Northern Rooms', '3:46', 104, 'A minor'], ['Långt Bort', '3:09', 118, 'G major']],
  },
  {
    id: 'noor-haddad', name: 'Noor Haddad', p: 'she', city: 'Paris', country: 'France',
    bio: 'Experimental electronic composer weaving oud recordings through modular synths. Scores films when she is not making records.',
    gv: { experimental: 0.88, ambient: 0.6, electronic: 0.65 },
    roles: ['Producer', 'Artist'], types: ['Production', 'Remix', 'Live'], wants: ['Vocalist', 'Producer'],
    bpm: [70, 128], keys: ['D minor', 'E minor', 'B minor', 'F# minor'], sound: [0.35, 0.85, 0.4, 0.3],
    scenes: { experimental: 0.85, ambient: 0.7, electronic: 0.7, jazz: 0.3, 'dream-pop': 0.25 },
    cities: ['Paris', 'Beirut', 'Berlin', 'Montréal'], ml: [28400, 11300], streams: 205, momentum: 'Rising', hues: [180, 280, 30],
    tracks: [['Maqam for Machines', '6:24', 90, 'D minor'], ['Belleville Signal', '4:48', 120, 'E minor'], ['Quiet Cartography', '5:30', 72, 'B minor']],
  },
  {
    id: 'cass-delgado', name: 'Cass Delgado', p: 'they', city: 'Austin', country: 'USA',
    bio: 'Fuzzed-out indie rock with big, honest hooks. Plays every show like it is the last night the venue is open.',
    gv: { 'indie-rock': 0.85, 'bedroom-pop': 0.3, 'indie-pop': 0.35 },
    roles: ['Artist', 'Band'], types: ['Tour', 'Feature', 'Live'], wants: ['Tour partner', 'Feature'],
    bpm: [120, 150], keys: ['E minor', 'A major', 'D major', 'G major'], sound: [0.55, 0.2, 0.9, 0.58],
    scenes: { 'indie-rock': 0.9, 'indie-pop': 0.5, 'bedroom-pop': 0.45, folk: 0.2 },
    cities: ['Austin', 'Dallas', 'Los Angeles', 'Chicago'], ml: [39200, 14800], streams: 188, momentum: 'Rising', hues: [10, 50, 230],
    tracks: [['Sixth Street Ghost', '3:02', 140, 'E minor'], ['Heat Lightning', '2:46', 148, 'A major'], ['Box Fan', '3:24', 126, 'D major']],
  },
  {
    id: 'marcus-bell', name: 'Marcus Bell', p: 'he', city: 'Chicago', country: 'USA',
    bio: 'Gospel-trained soul vocalist with a falsetto that has carried hooks for half the Chicago scene.',
    gv: { soul: 0.85, rnb: 0.7, 'alt-rnb': 0.3 },
    roles: ['Vocalist', 'Artist'], types: ['Feature', 'Vocals'], wants: ['Producer', 'Artist'],
    bpm: [68, 96], keys: ['A# major', 'G minor', 'D# major', 'C minor'], sound: [0.6, 0.35, 0.5, 0.5],
    scenes: { soul: 0.9, rnb: 0.8, 'hip-hop': 0.45, 'alt-rnb': 0.4 },
    cities: ['Chicago', 'Detroit', 'Atlanta', 'New York'], ml: [612000, 571000], streams: 14, momentum: 'Established', hues: [30, 0, 45],
    tracks: [['South Side Hymn', '4:06', 76, 'A# major'], ['Lakeshore', '3:40', 88, 'G minor'], ['Hold the Note', '3:58', 72, 'D# major']],
  },
  {
    id: 'yuki-arai', name: 'Yuki Arai', p: 'she', city: 'Tokyo', country: 'Japan',
    bio: 'Glitchy, joyful electronic pop that borrows from 80s city pop and arcade soundtracks. Makes everything on a single MPC.',
    gv: { experimental: 0.6, electronic: 0.75, pop: 0.45, 'indie-pop': 0.3 },
    roles: ['Artist', 'Producer'], types: ['Remix', 'Production', 'Feature'], wants: ['Vocalist', 'Remix'],
    bpm: [108, 132], keys: ['F# major', 'D# minor', 'B major', 'G# minor'], sound: [0.12, 0.9, 0.78, 0.85],
    scenes: { electronic: 0.8, experimental: 0.6, 'indie-pop': 0.45, pop: 0.5, 'bedroom-pop': 0.35 },
    cities: ['Tokyo', 'Osaka', 'Seoul', 'Los Angeles'], ml: [143000, 26100], streams: 590, momentum: 'Breakout', hues: [300, 190, 55],
    tracks: [['Shimokita Arcade', '3:16', 124, 'F# major'], ['Neon Kissaten', '3:33', 116, 'D# minor'], ['Save Point', '2:58', 128, 'B major']],
  },
  {
    id: 'june-abernathy', name: 'June Abernathy', p: 'she', city: 'Glasgow', country: 'UK',
    bio: 'Scottish folk sung plainly, with fiddle and harmonium. Her first EP was recorded in a church hall during a storm.',
    gv: { folk: 0.9, 'singer-songwriter': 0.65 },
    roles: ['Artist', 'Songwriter', 'Vocalist'], types: ['Co-writing', 'Feature', 'Tour'], wants: ['Co-writer', 'Tour partner'],
    bpm: [70, 98], keys: ['D major', 'G major', 'B minor', 'A major'], sound: [0.95, 0.04, 0.3, 0.5],
    scenes: { folk: 0.9, 'singer-songwriter': 0.8, 'indie-pop': 0.25 },
    cities: ['Glasgow', 'Edinburgh', 'Dublin', 'London'], ml: [18900, 7100], streams: 175, momentum: 'Rising', hues: [140, 220, 35],
    tracks: [['Clyde Water', '4:22', 80, 'D major'], ['Harmonium Hymn', '3:50', 72, 'G major'], ['The Gale', '3:31', 94, 'B minor']],
  },
  {
    id: 'odell-price', name: 'Odell Price', p: 'he', city: 'Houston', country: 'USA',
    bio: 'Houston rapper with a slow, deliberate flow and a notebook full of stories from the Third Ward.',
    gv: { 'hip-hop': 0.92, rnb: 0.25, soul: 0.2 },
    roles: ['Artist'], types: ['Feature', 'Co-writing'], wants: ['Producer', 'Vocalist'],
    bpm: [64, 84], keys: ['C minor', 'G minor', 'F minor', 'D minor'], sound: [0.2, 0.75, 0.6, 0.3],
    scenes: { 'hip-hop': 0.95, rnb: 0.5, soul: 0.3, 'alt-rnb': 0.3 },
    cities: ['Houston', 'Dallas', 'Atlanta', 'New Orleans'], ml: [167000, 36400], streams: 430, momentum: 'Breakout', hues: [270, 10, 200],
    tracks: [['Third Ward Gospel', '3:25', 72, 'C minor'], ['Slab', '2:58', 68, 'G minor'], ['Front Porch Theory', '3:44', 80, 'F minor']],
  },
  {
    id: 'saffron-lake', name: 'Saffron Lake', p: 'they', city: 'Portland', country: 'USA',
    bio: 'Five-piece indie folk-rock with three-part harmonies and a trumpet player who also drives the van.',
    gv: { folk: 0.6, 'indie-rock': 0.7, 'singer-songwriter': 0.35, 'indie-pop': 0.3 },
    roles: ['Band'], types: ['Tour', 'Live', 'Co-writing'], wants: ['Tour partner', 'Producer'],
    bpm: [96, 128], keys: ['G major', 'C major', 'E minor', 'D major'], sound: [0.75, 0.12, 0.62, 0.66],
    scenes: { 'indie-rock': 0.75, folk: 0.7, 'indie-pop': 0.55, 'singer-songwriter': 0.5 },
    cities: ['Portland', 'Seattle', 'San Francisco', 'Vancouver'], ml: [284000, 261000], streams: 16, momentum: 'Established', hues: [38, 110, 190],
    tracks: [['Willamette', '4:01', 108, 'G major'], ['Trumpet in the Rain', '3:37', 116, 'C major'], ['Burnside Bridge', '4:14', 100, 'E minor']],
  },
  {
    id: 'mila-novak', name: 'Mila Novak', p: 'she', city: 'Vancouver', country: 'Canada',
    bio: 'Producer and synth player turning field recordings from the North Shore into shimmering electronic pop.',
    gv: { electronic: 0.8, 'indie-pop': 0.55, ambient: 0.35, 'dream-pop': 0.35 },
    roles: ['Producer', 'Artist'], types: ['Production', 'Remix', 'Co-writing'], wants: ['Vocalist', 'Songwriter'],
    bpm: [96, 120], keys: ['E minor', 'G major', 'A minor', 'D major'], sound: [0.2, 0.85, 0.5, 0.58],
    scenes: { electronic: 0.75, 'indie-pop': 0.7, 'dream-pop': 0.55, ambient: 0.35, 'bedroom-pop': 0.35 },
    cities: ['Vancouver', 'Seattle', 'Toronto', 'Berlin'], ml: [24300, 10900], streams: 160, momentum: 'Rising', hues: [175, 220, 140],
    tracks: [['Lynn Canyon', '4:05', 108, 'E minor'], ['Seabus', '3:41', 100, 'G major'], ['Fog Index', '4:28', 96, 'A minor']],
  },
  {
    id: 'tomas-reyes', name: 'Tomás Reyes', p: 'he', city: 'Bogotá', country: 'Colombia',
    bio: 'Latin pop hitmaker with a soft spot for cumbia basslines. Has co-written for artists across three continents.',
    gv: { latin: 0.92, pop: 0.6, electronic: 0.25 },
    roles: ['Artist', 'Songwriter', 'Producer'], types: ['Co-writing', 'Feature', 'Production'], wants: ['Vocalist', 'Feature'],
    bpm: [90, 104], keys: ['A minor', 'D minor', 'E minor', 'C major'], sound: [0.4, 0.6, 0.75, 0.78],
    scenes: { latin: 0.92, pop: 0.65, 'indie-pop': 0.25, afrobeats: 0.3 },
    cities: ['Bogotá', 'Medellín', 'Mexico City', 'Madrid'], ml: [3480000, 3360000], streams: 6, momentum: 'Established', hues: [45, 0, 160],
    tracks: [['Cumbia de Neón', '3:14', 96, 'A minor'], ['Candelaria', '3:28', 92, 'D minor'], ['Nadie Como Tú', '3:05', 100, 'E minor']],
  },
  {
    id: 'priya-raman', name: 'Priya Raman', p: 'she', city: 'Toronto', country: 'Canada',
    bio: 'Producer blending tabla loops, 808s and airy R&B chords. Runs a beat-making night above a Kensington Market café.',
    gv: { 'alt-rnb': 0.65, electronic: 0.7, 'hip-hop': 0.35 },
    roles: ['Producer'], types: ['Production', 'Remix', 'Co-writing'], wants: ['Vocalist', 'Artist'],
    bpm: [80, 104], keys: ['B minor', 'F# minor', 'D major', 'E minor'], sound: [0.3, 0.8, 0.55, 0.45],
    scenes: { 'alt-rnb': 0.8, electronic: 0.6, 'hip-hop': 0.5, 'indie-pop': 0.35, rnb: 0.5 },
    cities: ['Toronto', 'London', 'Mumbai', 'New York'], ml: [31700, 12400], streams: 215, momentum: 'Rising', hues: [320, 30, 260],
    tracks: [['Kensington 3am', '3:12', 92, 'B minor'], ['Monsoon Logic', '3:36', 86, 'F# minor'], ['Cardamom', '2:54', 100, 'D major']],
  },
  {
    id: 'bastian-kroll', name: 'Bastian Kroll', p: 'he', city: 'Hamburg', country: 'Germany',
    bio: 'House DJ and producer with a decade of residencies. Builds records slowly, from a single chord stab outward.',
    gv: { house: 0.9, electronic: 0.75 },
    roles: ['DJ', 'Producer'], types: ['Remix', 'Production', 'Live'], wants: ['Vocalist', 'Remix'],
    bpm: [120, 126], keys: ['F minor', 'G minor', 'A minor', 'C minor'], sound: [0.05, 0.95, 0.8, 0.5],
    scenes: { house: 0.9, electronic: 0.85, 'alt-rnb': 0.2 },
    cities: ['Hamburg', 'Berlin', 'Amsterdam', 'Ibiza'], ml: [702000, 688000], streams: 4, momentum: 'Established', hues: [220, 190, 20],
    tracks: [['Hafen', '6:30', 124, 'F minor'], ['Reeperbahn Sunrise', '5:58', 122, 'G minor'], ['Chord Memory', '6:12', 125, 'A minor']],
  },
  {
    id: 'celeste-ward', name: 'Celeste Ward', p: 'she', city: 'Los Angeles', country: 'USA',
    bio: 'Pop songwriter with credits on records you have definitely heard. Now quietly releasing her own songs under her own name.',
    gv: { pop: 0.85, 'indie-pop': 0.55, 'singer-songwriter': 0.45 },
    roles: ['Songwriter', 'Artist'], types: ['Co-writing', 'Feature'], wants: ['Artist', 'Producer'],
    bpm: [94, 120], keys: ['C major', 'G major', 'A minor', 'F major'], sound: [0.5, 0.55, 0.6, 0.8],
    scenes: { pop: 0.85, 'indie-pop': 0.65, 'singer-songwriter': 0.5, 'bedroom-pop': 0.3 },
    cities: ['Los Angeles', 'New York', 'London', 'Toronto'], ml: [412000, 362000], streams: 22, momentum: 'Established', hues: [350, 40, 200],
    tracks: [['Bridge I Wrote for Someone Else', '3:19', 104, 'C major'], ['Laurel', '3:02', 98, 'G major'], ['Credits Roll', '3:44', 112, 'A minor']],
  },
  {
    id: 'ollie-sato', name: 'Ollie Sato', p: 'he', city: 'Vancouver', country: 'Canada',
    bio: 'Bedroom pop from a basement suite in East Van. Lo-fi drums, bright synths, lyrics about missing the last SkyTrain.',
    gv: { 'bedroom-pop': 0.85, 'indie-pop': 0.5, electronic: 0.35 },
    roles: ['Artist', 'Producer'], types: ['Co-writing', 'Remix', 'Production'], wants: ['Vocalist', 'Co-writer'],
    bpm: [94, 116], keys: ['D major', 'B minor', 'G major', 'E minor'], sound: [0.45, 0.6, 0.45, 0.75],
    scenes: { 'bedroom-pop': 0.9, 'indie-pop': 0.75, 'dream-pop': 0.45, electronic: 0.3 },
    cities: ['Vancouver', 'Seattle', 'Toronto', 'Los Angeles'], ml: [41800, 8200], streams: 470, momentum: 'Breakout', hues: [55, 200, 330],
    tracks: [['Last SkyTrain', '2:52', 104, 'D major'], ['Commercial Drive', '3:06', 110, 'B minor'], ['Basement Suite', '2:41', 98, 'G major']],
  },
  {
    id: 'ines-duarte', name: 'Inês Duarte', p: 'she', city: 'Lisbon', country: 'Portugal',
    bio: 'Singer-songwriter shaped by fado and jazz standards. Her voice does most of the arranging.',
    gv: { 'singer-songwriter': 0.7, jazz: 0.6, folk: 0.4 },
    roles: ['Artist', 'Vocalist', 'Songwriter'], types: ['Feature', 'Co-writing', 'Vocals'], wants: ['Producer', 'Co-writer'],
    bpm: [66, 96], keys: ['E minor', 'A minor', 'D minor', 'G major'], sound: [0.82, 0.15, 0.3, 0.42],
    scenes: { 'singer-songwriter': 0.8, jazz: 0.65, folk: 0.5, 'indie-pop': 0.35, soul: 0.3 },
    cities: ['Lisbon', 'Porto', 'Paris', 'São Paulo'], ml: [26800, 12900], streams: 128, momentum: 'Rising', hues: [200, 30, 350],
    tracks: [['Alfama, Late', '4:10', 72, 'E minor'], ['Saudade Machine', '3:44', 88, 'A minor'], ['Tram 28', '3:20', 94, 'G major']],
  },
  {
    id: 'kai-nakamura', name: 'Kai Nakamura', p: 'they', city: 'San Francisco', country: 'USA',
    bio: 'Ambient and experimental producer recording fog horns, cable cars and the hum of server rooms.',
    gv: { ambient: 0.85, experimental: 0.75, electronic: 0.5 },
    roles: ['Producer'], types: ['Production', 'Remix', 'Live'], wants: ['Vocalist', 'Artist'],
    bpm: [60, 100], keys: ['D major', 'A major', 'B minor', 'F# minor'], sound: [0.4, 0.75, 0.2, 0.45],
    scenes: { ambient: 0.85, experimental: 0.75, electronic: 0.6, 'dream-pop': 0.35 },
    cities: ['San Francisco', 'Los Angeles', 'Tokyo', 'Berlin'], ml: [21600, 9600], streams: 190, momentum: 'Rising', hues: [190, 210, 260],
    tracks: [['Karl the Fog', '7:12', 64, 'D major'], ['Cable Car Drone', '5:40', 80, 'A major'], ['Server Room Lullaby', '6:05', 72, 'B minor']],
  },
  {
    id: 'zara-bloom', name: 'Zara Bloom', p: 'she', city: 'New York', country: 'USA',
    bio: 'Bronx-born vocalist who raps the verses and sings the hooks. Writes fast and arrives at sessions with ten ideas.',
    gv: { 'hip-hop': 0.7, rnb: 0.65, 'alt-rnb': 0.45 },
    roles: ['Vocalist', 'Artist'], types: ['Feature', 'Vocals', 'Co-writing'], wants: ['Producer', 'Feature'],
    bpm: [76, 100], keys: ['G minor', 'C minor', 'D# major', 'F minor'], sound: [0.25, 0.7, 0.72, 0.5],
    scenes: { 'hip-hop': 0.85, rnb: 0.75, 'alt-rnb': 0.55, pop: 0.35 },
    cities: ['New York', 'Philadelphia', 'Atlanta', 'London'], ml: [58300, 21700], streams: 235, momentum: 'Rising', hues: [340, 280, 40],
    tracks: [['Grand Concourse', '3:08', 92, 'G minor'], ['Ten Ideas', '2:52', 96, 'C minor'], ['Fire Escape Freestyle', '2:31', 84, 'F minor']],
  },
];

export const ARTISTS: Artist[] = SEEDS.map(build);
export const ARTIST_BY_ID: Record<string, Artist> = Object.fromEntries(ARTISTS.map((a) => [a.id, a]));
export const ALL_TRACKS: Track[] = ARTISTS.flatMap((a) => a.tracks);
export const TRACK_BY_ID: Record<string, Track> = Object.fromEntries(ALL_TRACKS.map((t) => [t.id, t]));
