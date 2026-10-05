import type { SpotifyArtistSummary, SpotifyProfile, SpotifyService } from './SpotifyService';
import type { Track } from '../../types';
import { hashString } from '../../lib/music';

/**
 * Real Spotify Web API integration (Authorization Code with PKCE — no client
 * secret ships to the browser).
 *
 * Endpoints used, all available to Development Mode apps after the
 * February 2026 changes:
 *   GET /me                        identity
 *   GET /artists/{id}              artist profile (followers/popularity no longer returned)
 *   GET /artists/{id}/albums       → GET /albums/{id}  catalog (replaces removed top-tracks)
 *   GET /search                    max 10 results per request
 *   PUT /me/player/play|pause, /me/player/seek   (SpotifyConnectPlaybackService, Premium only)
 */
declare const __COLLAB_ENV__: { spotifyClientId: string; spotifyRedirectUri: string };

const env = typeof __COLLAB_ENV__ !== 'undefined' ? __COLLAB_ENV__ : { spotifyClientId: '', spotifyRedirectUri: '' };
const API = 'https://api.spotify.com/v1';
const AUTH = 'https://accounts.spotify.com/authorize';
const TOKEN = 'https://accounts.spotify.com/api/token';
export const SPOTIFY_SCOPES = ['user-read-private', 'user-read-playback-state', 'user-modify-playback-state', 'streaming'];
const TOKEN_KEY = 'collab:spotify-token';
const VERIFIER_KEY = 'collab:spotify-verifier';

interface TokenSet { access_token: string; refresh_token?: string; expires_at: number }

const b64url = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function randomVerifier() {
  const bytes = crypto.getRandomValues(new Uint8Array(48));
  return b64url(bytes.buffer);
}

function readToken(): TokenSet | null {
  try { const raw = localStorage.getItem(TOKEN_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function writeToken(t: TokenSet | null) {
  try { t ? localStorage.setItem(TOKEN_KEY, JSON.stringify(t)) : localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
}

const redirectUri = () => env.spotifyRedirectUri || `${location.origin}${location.pathname}`;

export class SpotifyAPIService implements SpotifyService {
  readonly mode = 'spotify' as const;
  readonly canConnect = Boolean(env.spotifyClientId);

  async login() {
    if (!this.canConnect) throw new Error('Set COLLAB_SPOTIFY_CLIENT_ID in .env to connect a real Spotify account.');
    const verifier = randomVerifier();
    sessionStorage.setItem(VERIFIER_KEY, verifier);
    const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
    const params = new URLSearchParams({
      client_id: env.spotifyClientId,
      response_type: 'code',
      redirect_uri: redirectUri(),
      code_challenge_method: 'S256',
      code_challenge: challenge,
      scope: SPOTIFY_SCOPES.join(' '),
    });
    location.assign(`${AUTH}?${params}`);
  }

  async handleRedirect(): Promise<boolean> {
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    if (!code || !this.canConnect) return false;
    const verifier = sessionStorage.getItem(VERIFIER_KEY) ?? '';
    const res = await fetch(TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: env.spotifyClientId, grant_type: 'authorization_code', code, redirect_uri: redirectUri(), code_verifier: verifier }),
    });
    history.replaceState(null, '', `${location.pathname}#/onboarding`);
    if (!res.ok) throw new Error(`Spotify sign-in failed (${res.status}). Check the redirect URI in your Spotify app settings.`);
    const t = await res.json();
    writeToken({ access_token: t.access_token, refresh_token: t.refresh_token, expires_at: Date.now() + t.expires_in * 1000 });
    return true;
  }

  isAuthenticated() { return Boolean(readToken()); }
  logout() { writeToken(null); }

  private async token(): Promise<string> {
    const t = readToken();
    if (!t) throw new Error('Not connected to Spotify.');
    if (Date.now() < t.expires_at - 30_000 || !t.refresh_token) return t.access_token;
    const res = await fetch(TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: env.spotifyClientId, grant_type: 'refresh_token', refresh_token: t.refresh_token }),
    });
    if (!res.ok) { writeToken(null); throw new Error('Spotify session expired. Connect again.'); }
    const n = await res.json();
    writeToken({ access_token: n.access_token, refresh_token: n.refresh_token ?? t.refresh_token, expires_at: Date.now() + n.expires_in * 1000 });
    return n.access_token;
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${await this.token()}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) } });
    if (res.status === 204) return undefined as T;
    if (!res.ok) throw new Error(`Spotify API ${res.status} on ${path}`);
    return res.json();
  }

  async getMe(): Promise<SpotifyProfile> {
    const me = await this.request<any>('/me');
    return { id: me.id, displayName: me.display_name ?? me.id, imageUrl: me.images?.[0]?.url };
  }

  async getArtist(id: string): Promise<SpotifyArtistSummary> {
    const a = await this.request<any>(`/artists/${encodeURIComponent(id)}`);
    return { id: a.id, name: a.name, genres: a.genres ?? [], imageUrl: a.images?.[0]?.url, spotifyUrl: a.external_urls?.spotify ?? '' };
  }

  async getArtistCatalog(id: string, limit = 5): Promise<Track[]> {
    const albums = await this.request<any>(`/artists/${encodeURIComponent(id)}/albums?include_groups=album,single&limit=5`);
    const tracks: Track[] = [];
    for (const al of albums.items ?? []) {
      if (tracks.length >= limit) break;
      const full = await this.request<any>(`/albums/${al.id}`);
      const t = full.tracks?.items?.[0];
      if (t) tracks.push(mapTrack(t, id, full.images?.[0]?.url));
    }
    return tracks;
  }

  async searchTracks(query: string): Promise<Track[]> {
    if (!query.trim()) return [];
    const r = await this.request<any>(`/search?type=track&limit=10&q=${encodeURIComponent(query)}`);
    return (r.tracks?.items ?? []).map((t: any) => mapTrack(t, t.artists?.[0]?.id ?? 'spotify', t.album?.images?.[0]?.url));
  }

  async searchArtists(query: string): Promise<SpotifyArtistSummary[]> {
    if (!query.trim()) return [];
    const r = await this.request<any>(`/search?type=artist&limit=10&q=${encodeURIComponent(query)}`);
    return (r.artists?.items ?? []).map((a: any) => ({ id: a.id, name: a.name, genres: a.genres ?? [], imageUrl: a.images?.[0]?.url, spotifyUrl: a.external_urls?.spotify ?? '' }));
  }
}

function mapTrack(t: any, artistId: string, imageUrl?: string): Track {
  const seed = hashString(t.id);
  return {
    id: `sp_${t.id}`,
    artistId,
    title: t.name,
    durationMs: t.duration_ms,
    // Audio features (tempo/key) were removed from the Web API in Nov 2024; unknown here.
    tempo: 0,
    key: '',
    genre: '',
    demoMonthlyStreams: 0,
    spotifyUrl: t.external_urls?.spotify ?? '',
    spotifyUri: t.uri,
    imageUrl,
    cover: { style: seed % 5, hues: [seed % 360, (seed >> 3) % 360, (seed >> 6) % 360], seed },
  };
}

export const spotifyEnv = env;
