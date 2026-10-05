import { ARTIST_BY_ID } from '../data/artists';
import { getState } from './store';
import { addToQueue, me, sendMessage } from './channels';
import { livePosition } from './playback';
import { getTrack } from './tracks';
import { saveTake, setLayer } from './session';

/**
 * Demo presence. In demo mode the other artist's side of a session is scripted:
 * a handful of reactions tied to what is actually happening in the room. It is
 * not an AI chatbot, and the room labels it as simulated.
 */
const fired = new Map<string, Set<string>>();
const once = (channelId: string, key: string) => {
  const s = fired.get(channelId) ?? new Set();
  fired.set(channelId, s);
  if (s.has(key)) return false;
  s.add(key);
  return true;
};

const REPLIES = ['Okay I love that', 'Try it a little darker?', 'Hold on, writing that down', 'That’s the one.', 'What if the second verse drops out completely?'];
const TIMESTAMP = /\b\d:\d{2}\b/;

function other(channelId: string): string | null {
  const ch = getState().channels[channelId];
  return ch?.participantIds.find((p) => p !== me() && ARTIST_BY_ID[p]) ?? null;
}

function say(channelId: string, text: string, delay: number) {
  const who = other(channelId);
  if (!who) return;
  window.setTimeout(() => {
    const ch = getState().channels[channelId];
    if (ch?.status === 'live') sendMessage(channelId, text, who);
  }, delay);
}

/** Called on every tick while a room is open. */
export function tickPresence(channelId: string, enteredAt: number) {
  const ch = getState().channels[channelId];
  const who = other(channelId);
  if (!ch || ch.status !== 'live' || !who) return;
  const artist = ARTIST_BY_ID[who];
  const firstName = artist.name.split(' ')[0];

  if (once(channelId, 'hello') && !ch.messages.some((m) => m.senderId === who && m.kind === 'text')) {
    say(channelId, `Hey! Put on “${artist.tracks[0].title}”, I want you to hear the chorus.`, 1400);
  }

  const track = ch.playback.trackId ? getTrack(ch.playback.trackId) : null;
  const pos = livePosition(ch.playback);
  if (ch.playback.isPlaying && track?.artistId === who && pos > 95_000 && pos < 120_000 && once(channelId, 'chorus')) {
    say(channelId, 'Wait, play that chorus again.', 600);
  }

  if (Date.now() - enteredAt > 45_000 && once(channelId, 'queue')) {
    const pick = artist.tracks.find((t) => !ch.queue.some((q) => q.trackId === t.id));
    if (pick) addToQueue(channelId, pick, who);
  }
  // Live Session: the other artist plays along.
  const sess = ch.session;
  if (sess) {
    const since = Date.now() - sess.startedAt;
    if (since > 4000 && once(channelId, `s-chords-${sess.startedAt}`)) {
      setLayer(channelId, 'chords', { on: true, variant: 1 }, who);
      sendMessage(channelId, 'Adding some chord stabs under that', who);
    }
    if (since > 13000 && once(channelId, `s-top-${sess.startedAt}`)) {
      setLayer(channelId, 'topline', { on: true, variant: 2 }, who);
      sendMessage(channelId, 'Topline idea. Tell me if it’s too much.', who);
    }
    if (since > 24000 && once(channelId, `s-bass-${sess.startedAt}`) && !sess.layers.bass.on) {
      setLayer(channelId, 'bass', { on: true, variant: 1 }, who);
      sendMessage(channelId, 'Bass in. Save a take when it feels right?', who);
    }
  }
  void firstName;
  void saveTake;
}

/** React to something the local artist just did. */
export function reactTo(channelId: string, event: { type: 'message'; text: string } | { type: 'moment' } | { type: 'note' } | { type: 'take' } | { type: 'layer' }) {
  if (!other(channelId)) return;
  const n = (fired.get(channelId)?.size ?? 0) + getState().channels[channelId].messages.length;
  if (event.type === 'message') {
    if (TIMESTAMP.test(event.text)) return say(channelId, 'YES.', 1100);
    if (once(channelId, `r${n % 4}`)) say(channelId, REPLIES[n % REPLIES.length], 1800);
  } else if (event.type === 'moment' && once(channelId, 'moment')) {
    say(channelId, 'Saving that one. That’s the part.', 1500);
  } else if (event.type === 'take') {
    if (once(channelId, `take${n}`)) say(channelId, 'That’s the one. We should put this out.', 1400);
  } else if (event.type === 'layer') {
    if (once(channelId, 'layer1')) say(channelId, 'Ooh, keep that.', 1200);
  } else if (event.type === 'note' && once(channelId, 'note')) {
    say(channelId, 'Agreed. Let’s try it next pass.', 1600);
  }
}
