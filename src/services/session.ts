import type { LayerKind, LayerState, SessionLayers, Track } from '../types';
import { ARTIST_BY_ID } from '../data/artists';
import { getState, update } from './store';
import { me } from './channels';
import { livePosition } from './playback';
import { keyCompatibility } from './recommendation';
import { camelot, hashString, uid } from '../lib/music';
import { notify } from './notifications';
import { href } from '../lib/router';

/**
 * Live Session — co-writing inside an Audio Channel.
 * A sketch made of four shared layers. Anyone in the room can switch a layer
 * on, pick a variation, or change tempo and key; everyone hears the change on
 * the next 16th note because every client renders from the same shared record.
 * A take freezes the current layers into a track credited to everyone present.
 */
export const LAYERS: { kind: LayerKind; name: string; variants: [string, string, string] }[] = [
  { kind: 'drums', name: 'Drums', variants: ['Backbeat', 'Half-time', 'Broken'] },
  { kind: 'bass', name: 'Bass', variants: ['Roots', 'Bounce', 'Octaves'] },
  { kind: 'chords', name: 'Chords', variants: ['Pad', 'Stabs', 'Arp'] },
  { kind: 'topline', name: 'Topline', variants: ['Sparse', 'Busy', 'High'] },
];

/** Which of the 16 steps a layer variant sounds on (for the step lights). */
export function layerSteps(kind: LayerKind, v: number): number[] {
  const all = Array.from({ length: 16 }, (_, i) => i);
  switch (kind) {
    case 'drums': return [[0, 4, 8, 12], [0, 8, 10], [0, 3, 4, 8, 11, 12, 14]][v];
    case 'bass': return [[0, 8], [0, 3, 6, 10], all.filter((i) => i % 2 === 0)][v];
    case 'chords': return [[0], [2, 6, 10, 14], all.filter((i) => i % 2 === 0)][v];
    case 'topline': return [[0, 6, 12], all.filter((i) => i % 2 === 0), [0, 4, 10]][v];
  }
}

const sessionTrackId = (channelId: string) => `session_${channelId}`;

function defaultLayers(by: string): SessionLayers {
  const off = (): LayerState => ({ on: false, variant: 0, by });
  return { drums: { on: true, variant: 0, by }, bass: off(), chords: off(), topline: off() };
}

export function startSession(channelId: string) {
  const ch = getState().channels[channelId];
  if (!ch || ch.session) return;
  const people = ch.participantIds.map((p) => ARTIST_BY_ID[p]).filter(Boolean);
  const tempo = Math.round(people.reduce((n, a) => n + (a.tempoRange[0] + a.tempoRange[1]) / 2, 0) / people.length);
  const [a, b] = people;
  const key = a && b ? keyCompatibility(a, b).pairs[0]?.[0] ?? a.keys[0] : a?.keys[0] ?? 'A minor';
  const id = sessionTrackId(channelId);
  const seed = hashString(id);
  const track: Track = {
    id, artistId: me(), title: 'Live Session', durationMs: 240_000, tempo, key, genre: 'Session',
    demoMonthlyStreams: 0, spotifyUrl: '', session: { channelId }, credits: [...ch.participantIds],
    cover: { style: 4, hues: [150, 158, 140], seed },
  };
  update((s) => {
    const c = s.channels[channelId];
    s.extraTracks[id] = track;
    c.resumeTrackId = c.playback.trackId ?? undefined;
    c.session = { trackId: id, tempo, key, layers: defaultLayers(me()), takeIds: [], startedBy: me(), startedAt: Date.now() };
    c.playback = { trackId: id, isPlaying: true, positionMs: 0, updatedAt: Date.now(), updatedBy: me() };
    c.messages.push({ id: uid('m'), channelId, senderId: 'system', kind: 'system', content: `You started a Live Session at ${tempo} BPM in ${key} (${camelot(key).code})`, timestamp: Date.now() });
  });
}

export function setLayer(channelId: string, kind: LayerKind, patch: Partial<LayerState>, by = me()) {
  update((s) => {
    const c = s.channels[channelId];
    if (!c?.session) return;
    c.session.layers[kind] = { ...c.session.layers[kind], ...patch, by };
    c.lastActiveAt = Date.now();
  });
}

/** Tempo/key changes restart the render at the same position so everyone re-locks. */
export function setTempoKey(channelId: string, patch: { tempo?: number; key?: string }) {
  update((s) => {
    const c = s.channels[channelId];
    if (!c?.session) return;
    const pos = livePosition(c.playback);
    if (patch.tempo) c.session.tempo = Math.max(60, Math.min(160, patch.tempo));
    if (patch.key) c.session.key = patch.key;
    const t = s.extraTracks[c.session.trackId];
    if (t) { t.tempo = c.session.tempo; t.key = c.session.key; }
    c.playback = { ...c.playback, positionMs: pos, updatedAt: Date.now(), updatedBy: me() };
  });
}

/** Freeze the current layers into a take credited to everyone in the room. */
export function saveTake(channelId: string, title: string): { takeId: string; collabId: string } {
  const ch = getState().channels[channelId];
  const sess = ch.session!;
  const takeId = uid('take');
  let collabId = ch.collaborationId ?? '';
  const name = title.trim() || `Session take ${sess.takeIds.length + 1}`;
  update((s) => {
    const c = s.channels[channelId];
    s.extraTracks[takeId] = {
      id: takeId, artistId: me(), title: name, durationMs: 210_000, tempo: sess.tempo, key: sess.key, genre: 'Collab take',
      demoMonthlyStreams: 0, spotifyUrl: '', credits: [...c.participantIds],
      session: { layers: structuredClone(c.session!.layers) },
      cover: { style: 4, hues: [150 + c.session!.takeIds.length * 40, 300, 30], seed: hashString(takeId) },
    };
    c.session!.takeIds.push(takeId);
    c.messages.push({ id: uid('m'), channelId, senderId: 'system', kind: 'system', content: `Saved take “${name}” · ${sess.tempo} BPM · ${sess.key}`, timestamp: Date.now() });
    let co = s.collaborations.find((x) => x.id === c.collaborationId);
    if (!co) {
      collabId = uid('co');
      co = { id: collabId, participantIds: [...c.participantIds], name, status: 'Writing', channelId, trackIds: [], notes: [], lastActivity: '', createdAt: Date.now(), updatedAt: Date.now() };
      s.collaborations.unshift(co);
      c.collaborationId = collabId;
    }
    co.trackIds.unshift(takeId);
    co.lastActivity = `Take “${name}” saved from a Live Session`;
    if (co.status === 'Exploring') co.status = 'Writing';
    co.updatedAt = Date.now();
  });
  return { takeId, collabId };
}

export function endSession(channelId: string) {
  update((s) => {
    const c = s.channels[channelId];
    if (!c?.session) return;
    const back = c.resumeTrackId && c.resumeTrackId !== c.session.trackId ? c.resumeTrackId : c.queue[0]?.trackId ?? null;
    c.session = undefined;
    c.playback = { trackId: back, isPlaying: false, positionMs: 0, updatedAt: Date.now(), updatedBy: me() };
    c.messages.push({ id: uid('m'), channelId, senderId: 'system', kind: 'system', content: 'Live Session ended. Takes are saved to the collaboration.', timestamp: Date.now() });
  });
}

// ─── Release (simulated hand-off) ─────────────────────────────────────────────

export function nextFriday(from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7));
  return d.toISOString().slice(0, 10);
}

export function proposeRelease(collabId: string, r: { title: string; trackId: string; credits: string[]; releaseDate: string; estReach: number }) {
  update((s) => {
    const c = s.collaborations.find((x) => x.id === collabId);
    if (!c) return;
    c.release = { ...r, status: 'awaiting-approval', approvals: [me()] };
    c.status = 'Finished';
    c.lastActivity = `Release proposed for ${fmtDate(r.releaseDate)}`;
    c.updatedAt = Date.now();
    const t = s.extraTracks[r.trackId];
    if (t) t.title = r.title;
  });
  // Demo mode: the other credited artist approves shortly after.
  const others = r.credits.filter((x) => x !== me());
  window.setTimeout(() => {
    update((s) => {
      const c = s.collaborations.find((x) => x.id === collabId);
      if (!c?.release) return;
      c.release.approvals = [...new Set([...c.release.approvals, ...others])];
      c.release.status = 'scheduled';
      c.status = 'Released';
      c.lastActivity = `Scheduled on Spotify for ${fmtDate(c.release.releaseDate)}`;
    });
    const first = ARTIST_BY_ID[others[0]]?.name.split(' ')[0] ?? 'Your collaborator';
    notify({ kind: 'activity', text: `${first} approved the release. “${r.title}” is scheduled for ${fmtDate(r.releaseDate)}.`, artistId: others[0], href: href(`collabs/${collabId}`) });
  }, 2800);
}

export function fmtDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
