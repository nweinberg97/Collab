import type { Artist, Track } from '../../types';

/**
 * The boundary between Collab and Spotify. UI code talks only to this interface.
 *
 *   DemoSpotifyService  – seeded fictional artists, works with zero setup.
 *   SpotifyAPIService   – real Spotify Web API via Authorization Code + PKCE.
 *
 * What the real API can provide today (identity, artist profile, catalog,
 * search) is fetched for real when configured. What it cannot provide —
 * audience overlap, listener-level growth, sound similarity at this depth —
 * stays clearly-labelled demo data (`demo*` fields).
 */
export interface SpotifyProfile {
  id: string;
  displayName: string;
  imageUrl?: string;
}

export interface SpotifyArtistSummary {
  id: string;
  name: string;
  genres: string[];
  imageUrl?: string;
  spotifyUrl: string;
}

export interface SpotifyService {
  readonly mode: 'demo' | 'spotify';
  /** True when a client ID is configured, so a real login is possible. */
  readonly canConnect: boolean;
  login(): Promise<void>;
  /** Completes an OAuth redirect if the current URL carries one. */
  handleRedirect(): Promise<boolean>;
  isAuthenticated(): boolean;
  logout(): void;
  getMe(): Promise<SpotifyProfile>;
  getArtist(id: string): Promise<SpotifyArtistSummary>;
  /** Recent tracks from an artist's albums/singles (top-tracks was removed for dev-mode apps in Feb 2026). */
  getArtistCatalog(id: string, limit?: number): Promise<Track[]>;
  searchTracks(query: string): Promise<Track[]>;
  searchArtists(query: string): Promise<SpotifyArtistSummary[]>;
}

export type { Artist };
