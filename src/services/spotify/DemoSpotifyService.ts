import type { SpotifyArtistSummary, SpotifyProfile, SpotifyService } from './SpotifyService';
import type { Track } from '../../types';
import { ALL_TRACKS, ARTISTS, ARTIST_BY_ID, DEMO_USER_ID } from '../../data/artists';

const toSummary = (id: string): SpotifyArtistSummary => {
  const a = ARTIST_BY_ID[id];
  return { id: a.id, name: a.name, genres: a.genres, spotifyUrl: a.spotifyUrl };
};

/** Seeded responses shaped like the real service. Zero network, zero setup. */
export class DemoSpotifyService implements SpotifyService {
  readonly mode = 'demo' as const;
  readonly canConnect = false;
  private authed = true;
  async login() { this.authed = true; }
  async handleRedirect() { return false; }
  isAuthenticated() { return this.authed; }
  logout() { this.authed = false; }
  async getMe(): Promise<SpotifyProfile> {
    return { id: DEMO_USER_ID, displayName: ARTIST_BY_ID[DEMO_USER_ID].name };
  }
  async getArtist(id: string) { return toSummary(id); }
  async getArtistCatalog(id: string, limit = 5): Promise<Track[]> {
    return (ARTIST_BY_ID[id]?.tracks ?? []).slice(0, limit);
  }
  async searchTracks(query: string): Promise<Track[]> {
    const q = query.trim().toLowerCase();
    if (!q) return ALL_TRACKS.slice(0, 10);
    return ALL_TRACKS.filter((t) => t.title.toLowerCase().includes(q) || ARTIST_BY_ID[t.artistId].name.toLowerCase().includes(q)).slice(0, 10);
  }
  async searchArtists(query: string) {
    const q = query.trim().toLowerCase();
    return ARTISTS.filter((a) => a.name.toLowerCase().includes(q)).slice(0, 10).map((a) => toSummary(a.id));
  }
}
