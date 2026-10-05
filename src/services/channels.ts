import type { AudioChannel, Message, MessageKind, Track } from '../types';
import { ARTIST_BY_ID, DEMO_USER_ID } from '../data/artists';
import { getState, update } from './store';
import { notify } from './notifications';
import { toast } from '../lib/toast';
import { fmtTime, hashString, uid } from '../lib/music';
import { href } from '../lib/router';
import { livePosition } from './playback';

// ─── Audio Channels: private, invite-only rooms ───────────────────────────────

const first = (id: string) => ARTIST_BY_ID[id]?.name.split(' ')[0] ?? 'Someone';
export const me = () => getState().auth?.userId ?? DEMO_USER_ID;

function msg(channelId: string, senderId: string, content: string, kind: MessageKind = 'text', ref?: string): Message {
  return { id: uid('m'), channelId, senderId, content, kind, ref, timestamp: Date.now() };
}

export function channelWith(artistId: string): AudioChannel | undefined {
  return Object.values(getState().channels)
    .filter((c) => c.status !== 'ended' && (c.participantIds.includes(artistId) || c.invitedIds.includes(artistId)))
    .sort((a, b) => b.lastActiveAt - a.lastActiveAt)[0];
}

/** Invite an artist into a new private Audio Channel. */
export function inviteToChannel(targetId: string, note: string): string {
  const existing = channelWith(targetId);
  if (existing) return existing.id;
  const id = uid('ch');
  const target = ARTIST_BY_ID[targetId];
  const myFirstTrack = ARTIST_BY_ID[me()]?.tracks[0];
  update((s) => {
    s.channels[id] = {
      id,
      participantIds: [me()],
      invitedIds: [targetId],
      status: 'pending',
      playback: { trackId: target.tracks[0].id, isPlaying: false, positionMs: 0, updatedAt: Date.now(), updatedBy: me() },
      queue: [
        { id: uid('q'), trackId: target.tracks[0].id, addedBy: me() },
        ...(myFirstTrack ? [{ id: uid('q'), trackId: myFirstTrack.id, addedBy: me() }] : []),
        { id: uid('q'), trackId: target.tracks[1]?.id ?? target.tracks[0].id, addedBy: me() },
      ],
      messages: note ? [msg(id, me(), note)] : [],
      moments: [],
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    };
    s.invitations.push({ id: uid('inv'), fromId: me(), toId: targetId, note, status: 'sent', channelId: id, createdAt: Date.now() });
  });
  scheduleDemoAcceptance(id, targetId);
  return id;
}

/** Demo mode: invited artists accept after a short, human-feeling pause. */
function scheduleDemoAcceptance(channelId: string, artistId: string, delay = 2600) {
  window.setTimeout(() => {
    const ch = getState().channels[channelId];
    if (!ch || !ch.invitedIds.includes(artistId)) return;
    update((s) => {
      const c = s.channels[channelId];
      c.invitedIds = c.invitedIds.filter((x) => x !== artistId);
      if (!c.participantIds.includes(artistId)) c.participantIds.push(artistId);
      c.status = 'live';
      c.messages.push(msg(channelId, 'system', `${first(artistId)} joined the channel`, 'system'));
      c.lastActiveAt = Date.now();
      const inv = s.invitations.find((i) => i.channelId === channelId && i.toId === artistId);
      if (inv) inv.status = 'accepted';
    });
    notify({ kind: 'accepted', text: `${first(artistId)} accepted your invitation.`, artistId, href: href(`channels/${channelId}`) });
    toast(`${first(artistId)} accepted your invitation.`, { tone: 'green', action: { label: 'Enter channel', href: href(`channels/${channelId}`) } });
  }, delay);
}

/** Resume acceptances that were pending when the page reloaded. */
export function resumePendingDemoInvites() {
  const s = getState();
  for (const inv of s.invitations) {
    if (inv.status === 'sent' && inv.fromId === me()) scheduleDemoAcceptance(inv.channelId, inv.toId, 1200);
  }
}

export function acceptInvitation(invitationId: string): string | null {
  const inv = getState().invitations.find((i) => i.id === invitationId);
  if (!inv) return null;
  update((s) => {
    const i = s.invitations.find((x) => x.id === invitationId)!;
    i.status = 'accepted';
    const c = s.channels[i.channelId];
    c.invitedIds = c.invitedIds.filter((x) => x !== me());
    if (!c.participantIds.includes(me())) c.participantIds.push(me());
    c.status = 'live';
    c.messages.push(msg(c.id, 'system', 'You joined the channel', 'system'));
    if (i.note) c.messages.push(msg(c.id, i.fromId, i.note));
    c.lastActiveAt = Date.now();
    s.notifications.forEach((n) => { if (n.kind === 'invite' && n.artistId === i.fromId) n.read = true; });
  });
  return inv.channelId;
}

export function declineInvitation(invitationId: string) {
  update((s) => {
    const i = s.invitations.find((x) => x.id === invitationId);
    if (i) { i.status = 'declined'; const c = s.channels[i.channelId]; if (c) c.status = 'ended'; }
  });
}

export function sendMessage(channelId: string, content: string, senderId = me()) {
  const text = content.trim();
  if (!text) return;
  update((s) => {
    const c = s.channels[channelId];
    c.messages.push(msg(channelId, senderId, text));
    c.lastActiveAt = Date.now();
  });
}

export function addNote(channelId: string, text: string) {
  const t = text.trim();
  if (!t) return;
  update((s) => {
    const c = s.channels[channelId];
    c.messages.push(msg(channelId, me(), t, 'note'));
    const co = s.collaborations.find((x) => x.id === c.collaborationId);
    if (co) { co.notes.unshift({ id: uid('n'), by: me(), text: t, at: Date.now() }); co.lastActivity = 'Note added'; co.updatedAt = Date.now(); }
  });
}

export function markMoment(channelId: string, label: string) {
  const ch = getState().channels[channelId];
  if (!ch?.playback.trackId) return;
  const pos = livePosition(ch.playback);
  const id = uid('mo');
  const l = label.trim() || 'idea';
  update((s) => {
    const c = s.channels[channelId];
    c.moments.push({ id, trackId: c.playback.trackId!, positionMs: pos, label: l, by: me(), at: Date.now() });
    c.messages.push(msg(channelId, me(), `${fmtTime(pos)} — ${l}`, 'moment', id));
    const co = s.collaborations.find((x) => x.id === c.collaborationId);
    if (co) { co.lastActivity = `Moment marked at ${fmtTime(pos)}`; co.updatedAt = Date.now(); }
  });
  return pos;
}

export function addToQueue(channelId: string, track: Track, by = me()) {
  update((s) => {
    if (!s.extraTracks[track.id] && (track.isDemo || track.spotifyUri)) s.extraTracks[track.id] = track;
    const c = s.channels[channelId];
    c.queue.push({ id: uid('q'), trackId: track.id, addedBy: by });
    c.messages.push(msg(channelId, by, `${by === me() ? 'You' : first(by)} added “${track.title}” to the queue`, 'track', track.id));
    if (!c.playback.trackId) c.playback.trackId = track.id;
    c.lastActiveAt = Date.now();
  });
}

export function removeFromQueue(channelId: string, queueId: string) {
  update((s) => {
    const c = s.channels[channelId];
    c.queue = c.queue.filter((q) => q.id !== queueId);
  });
}

/** Attach a demo. Only metadata is stored (no audio files in localStorage). */
export function addDemo(channelId: string, name: string, durationMs = 150_000) {
  const user = ARTIST_BY_ID[me()];
  const seed = hashString(name + Date.now());
  const t: Track = {
    id: uid('demo'),
    artistId: me(),
    title: name.replace(/\.[a-z0-9]+$/i, '') || 'Untitled demo',
    durationMs,
    tempo: user ? Math.round((user.tempoRange[0] + user.tempoRange[1]) / 2) : 100,
    key: user?.keys[0] ?? 'A minor',
    genre: 'Demo',
    demoMonthlyStreams: 0,
    spotifyUrl: '',
    isDemo: true,
    cover: { style: 2, hues: [150, 160, 170], seed },
  };
  addToQueue(channelId, t);
  return t;
}

export function inviteAnother(channelId: string, artistId: string) {
  update((s) => {
    const c = s.channels[channelId];
    if (!c.invitedIds.includes(artistId) && !c.participantIds.includes(artistId)) c.invitedIds.push(artistId);
    c.messages.push(msg(channelId, 'system', `You invited ${ARTIST_BY_ID[artistId].name}`, 'system'));
  });
  scheduleDemoAcceptance(channelId, artistId, 4200);
}

export function leaveChannel(channelId: string) {
  update((s) => {
    const c = s.channels[channelId];
    c.status = 'ended';
    c.playback = { ...c.playback, isPlaying: false, positionMs: livePosition(c.playback), updatedAt: Date.now() };
    c.messages.push(msg(channelId, 'system', 'Session ended', 'system'));
  });
}

export function reopenChannel(channelId: string) {
  update((s) => {
    const c = s.channels[channelId];
    c.status = 'live';
    c.lastActiveAt = Date.now();
    c.messages.push(msg(channelId, 'system', 'Session reopened', 'system'));
  });
}
