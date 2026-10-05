import type { AudioChannel, PlaybackState, Track } from '../../types';
import { getState, update } from '../store';
import { getTrack } from '../tracks';
import { synth } from '../../lib/synth';
import { spotify } from '../spotify';
import { SpotifyAPIService } from '../spotify/SpotifyAPIService';

/**
 * Synchronized listening.
 *
 * The room's playback is one shared record: { trackId, isPlaying, positionMs, updatedAt }.
 * Every participant derives the live position from that record and their own clock,
 * so nobody streams position updates; only intent (play, pause, seek, skip) is shared.
 * In this prototype the record lives in localStorage (shared across tabs); in production
 * it would live on a realtime channel.
 *
 * SpotifyPlaybackService is the boundary. Two renderers sit behind it:
 *   DemoPlaybackService            – Web Audio rendering of seeded tracks (always available)
 *   SpotifyConnectPlaybackService  – drives the listener's own Spotify device for real
 *                                    Spotify tracks (Premium + user-modify-playback-state)
 */
export interface SpotifyPlaybackService {
  readonly kind: 'demo' | 'spotify-connect';
  canRender(track: Track): boolean;
  render(track: Track, positionMs: number, playing: boolean): Promise<void> | void;
  stop(): void;
  setVolume(v: number): void;
}

export class DemoPlaybackService implements SpotifyPlaybackService {
  readonly kind = 'demo' as const;
  canRender() { return true; }
  render(track: Track, positionMs: number, playing: boolean) {
    if (playing) synth.play(track, positionMs, layersFor(track));
    else synth.stop();
  }
  stop() { synth.stop(); }
  setVolume(v: number) { synth.setVolume(v); }
}

export class SpotifyConnectPlaybackService implements SpotifyPlaybackService {
  readonly kind = 'spotify-connect' as const;
  canRender(track: Track) {
    const s = spotify();
    return Boolean(track.spotifyUri) && s.mode === 'spotify';
  }
  async render(track: Track, positionMs: number, playing: boolean) {
    const api = spotify() as SpotifyAPIService;
    if (!playing) return api.request('/me/player/pause', { method: 'PUT' }).catch(() => undefined);
    await api.request('/me/player/play', { method: 'PUT', body: JSON.stringify({ uris: [track.spotifyUri], position_ms: Math.round(positionMs) }) });
  }
  stop() {
    const s = spotify();
    if (s.mode === 'spotify') (s as SpotifyAPIService).request('/me/player/pause', { method: 'PUT' }).catch(() => undefined);
  }
  setVolume() { /* the listener's device owns its volume */ }
}

/** Live Session tracks read the room's current layers; saved takes read their snapshot. */
export function layersFor(track: Track) {
  const cid = track.session?.channelId;
  if (cid) return () => getState().channels[cid]?.session?.layers ?? null;
  const snap = track.session?.layers;
  return snap ? () => snap : null;
}

export const demoPlayback = new DemoPlaybackService();
export const connectPlayback = new SpotifyConnectPlaybackService();
export const rendererFor = (t: Track): SpotifyPlaybackService => (connectPlayback.canRender(t) ? connectPlayback : demoPlayback);

// ─── Shared state transitions ──────────────────────────────────────────────────

export function livePosition(p: PlaybackState, now = Date.now()): number {
  const t = p.trackId ? getTrack(p.trackId) : null;
  const pos = p.isPlaying ? p.positionMs + (now - p.updatedAt) : p.positionMs;
  return t ? Math.min(pos, t.durationMs) : pos;
}

function setPlayback(channelId: string, by: string, fn: (p: PlaybackState, ch: AudioChannel) => Partial<PlaybackState>) {
  update((s) => {
    const ch = s.channels[channelId];
    if (!ch) return;
    const next = fn(ch.playback, ch);
    ch.playback = { ...ch.playback, ...next, updatedAt: Date.now(), updatedBy: by };
    ch.lastActiveAt = Date.now();
  });
}

export const playback = {
  play(channelId: string, by: string) {
    synth.unlock();
    setPlayback(channelId, by, (p, ch) => ({ isPlaying: true, positionMs: livePosition(p), trackId: p.trackId ?? ch.queue[0]?.trackId ?? null }));
  },
  pause(channelId: string, by: string) {
    setPlayback(channelId, by, (p) => ({ isPlaying: false, positionMs: livePosition(p) }));
  },
  toggle(channelId: string, by: string) {
    const ch = getState().channels[channelId];
    if (ch?.playback.isPlaying) this.pause(channelId, by);
    else this.play(channelId, by);
  },
  seek(channelId: string, positionMs: number, by: string) {
    setPlayback(channelId, by, () => ({ positionMs: Math.max(0, positionMs) }));
  },
  select(channelId: string, trackId: string, by: string, autoplay = true) {
    synth.unlock();
    setPlayback(channelId, by, (p) => ({ trackId, positionMs: 0, isPlaying: autoplay || p.isPlaying }));
  },
  next(channelId: string, by: string) {
    const ch = getState().channels[channelId];
    if (!ch || !ch.queue.length) return;
    const i = ch.queue.findIndex((q) => q.trackId === ch.playback.trackId);
    const nextItem = ch.queue[(i + 1) % ch.queue.length];
    setPlayback(channelId, by, (p) => ({ trackId: nextItem.trackId, positionMs: 0, isPlaying: p.isPlaying }));
  },
  prev(channelId: string, by: string) {
    const ch = getState().channels[channelId];
    if (!ch) return;
    if (livePosition(ch.playback) > 3000 || !ch.queue.length) return this.seek(channelId, 0, by);
    const i = ch.queue.findIndex((q) => q.trackId === ch.playback.trackId);
    const prevItem = ch.queue[(i - 1 + ch.queue.length) % ch.queue.length];
    setPlayback(channelId, by, (p) => ({ trackId: prevItem.trackId, positionMs: 0, isPlaying: p.isPlaying }));
  },
};
