// Shared genre/scene vocabulary used by genre vectors and audience "scenes".
export const GENRES: Record<string, string> = {
  'indie-pop': 'Indie Pop',
  'dream-pop': 'Dream Pop',
  'bedroom-pop': 'Bedroom Pop',
  electronic: 'Electronic',
  'alt-rnb': 'Alternative R&B',
  rnb: 'R&B',
  soul: 'Soul',
  'hip-hop': 'Hip-Hop',
  'indie-rock': 'Indie Rock',
  folk: 'Folk',
  'singer-songwriter': 'Singer-Songwriter',
  latin: 'Latin',
  afrobeats: 'Afrobeats',
  jazz: 'Jazz',
  experimental: 'Experimental',
  ambient: 'Ambient',
  house: 'House',
  pop: 'Pop',
};

/** Rising Talent categories, in display order. */
export const RISING_CATEGORIES = [
  'bedroom-pop',
  'indie-rock',
  'alt-rnb',
  'hip-hop',
  'electronic',
  'folk',
  'singer-songwriter',
  'latin',
  'afrobeats',
  'experimental',
] as const;

export const genreLabel = (k: string) => GENRES[k] ?? k;
