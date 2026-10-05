import { useSyncExternalStore } from 'react';
import type { AudioChannel, Collaboration, Invitation, Notification, Settings, Track } from '../types';
import { DEMO_USER_ID } from '../data/artists';

// ─── Prototype persistence ────────────────────────────────────────────────────
// One JSON document in localStorage. No backend. Other tabs stay in sync through
// the `storage` event, which is what lets two windows share one Audio Channel.

export interface AuthState {
  mode: 'demo' | 'spotify';
  userId: string;
  spotify?: { displayName: string; id: string; imageUrl?: string; artistId?: string; artistName?: string };
}

export interface AppState {
  version: number;
  onboarded: boolean;
  auth: AuthState | null;
  settings: Settings;
  dismissed: string[];
  favorites: string[];
  invitations: Invitation[];
  channels: Record<string, AudioChannel>;
  collaborations: Collaboration[];
  notifications: Notification[];
  recentTrackIds: string[];
  newMatchesSeen: boolean;
  /** Tracks not in the seed catalog: uploaded demos, tracks shared from Spotify search. */
  extraTracks: Record<string, Track>;
}

const KEY = 'collab:v1';
const VERSION = 3;
const now = Date.now();
const H = 3600_000;

export function initialState(): AppState {
  const theoChannel: AudioChannel = {
    id: 'ch_theo',
    participantIds: [DEMO_USER_ID, 'theo-park'],
    invitedIds: [],
    status: 'ended',
    playback: { trackId: 'theo-park-t1', isPlaying: false, positionMs: 64_000, updatedAt: now - 30 * H, updatedBy: 'theo-park' },
    queue: [
      { id: 'q1', trackId: 'theo-park-t1', addedBy: 'theo-park' },
      { id: 'q2', trackId: 'alex-rivera-t3', addedBy: DEMO_USER_ID },
    ],
    messages: [
      { id: 'm1', channelId: 'ch_theo', senderId: 'theo-park', content: 'Okay the drums on this are placeholder, ignore them', kind: 'text', timestamp: now - 31 * H },
      { id: 'm2', channelId: 'ch_theo', senderId: DEMO_USER_ID, content: 'The guitar line at the top is perfect though', kind: 'text', timestamp: now - 31 * H + 60_000 },
      { id: 'm3', channelId: 'ch_theo', senderId: 'theo-park', content: 'Added a second verse idea to the project', kind: 'text', timestamp: now - 30 * H },
    ],
    moments: [{ id: 'mo1', trackId: 'theo-park-t1', positionMs: 64_000, label: 'guitar hook', by: DEMO_USER_ID, at: now - 31 * H }],
    collaborationId: 'co_night',
    createdAt: now - 6 * 24 * H,
    lastActiveAt: now - 30 * H,
  };
  const mayaChannel: AudioChannel = {
    id: 'ch_maya',
    participantIds: ['maya-chen'],
    invitedIds: [DEMO_USER_ID],
    status: 'pending',
    playback: { trackId: 'maya-chen-t1', isPlaying: false, positionMs: 0, updatedAt: now, updatedBy: 'maya-chen' },
    queue: [{ id: 'q1', trackId: 'maya-chen-t1', addedBy: 'maya-chen' }, { id: 'q2', trackId: 'alex-rivera-t1', addedBy: 'maya-chen' }],
    messages: [],
    moments: [],
    collaborationId: 'co_golden',
    createdAt: now - 2 * H,
    lastActiveAt: now - 2 * H,
  };
  return {
    version: VERSION,
    onboarded: false,
    auth: null,
    settings: {
      visibility: 'open',
      whoCanInvite: 'matches',
      appearInRising: true,
      showAudienceOverlap: true,
      lookingFor: ['Producer', 'Co-writer', 'Feature'],
      adventurousness: 0.5,
      volume: 0.7,
    },
    dismissed: [],
    favorites: [],
    invitations: [
      { id: 'inv_maya', fromId: 'maya-chen', toId: DEMO_USER_ID, note: 'Want to hear what we could do with "Kitsilano Light" over my chords?', status: 'sent', channelId: 'ch_maya', createdAt: now - 2 * H },
    ],
    channels: { ch_theo: theoChannel, ch_maya: mayaChannel },
    collaborations: [
      {
        id: 'co_night', participantIds: [DEMO_USER_ID, 'theo-park'], name: 'Night Drive', status: 'Writing', channelId: 'ch_theo',
        trackIds: ['theo-park-t1'], notes: [{ id: 'n1', by: 'theo-park', text: 'Second verse: the city from the passenger seat', at: now - 30 * H }],
        lastActivity: 'Theo added a track to your collaboration', createdAt: now - 6 * 24 * H, updatedAt: now - 30 * H,
      },
      {
        id: 'co_golden', participantIds: [DEMO_USER_ID, 'maya-chen'], name: 'Golden Hour Remix', status: 'Finished', channelId: 'ch_maya',
        trackIds: ['lena-cruz-t2'], notes: [{ id: 'n1', by: 'maya-chen', text: 'Final mix approved. Bounce sent to both teams.', at: now - 50 * H }],
        lastActivity: 'Final mix approved', createdAt: now - 21 * 24 * H, updatedAt: now - 50 * H,
      },
    ],
    notifications: [
      { id: 'nt1', kind: 'invite', text: 'Maya invited you to an Audio Channel.', artistId: 'maya-chen', href: '#/channels', read: false, at: now - 2 * H },
      { id: 'nt2', kind: 'matches', text: 'Collab found 3 new strong matches for you.', href: '#/discover', read: false, at: now - 5 * H },
      { id: 'nt3', kind: 'activity', text: 'Theo added a track to your collaboration.', artistId: 'theo-park', href: '#/collabs/co_night', read: true, at: now - 30 * H },
    ],
    recentTrackIds: [],
    newMatchesSeen: false,
    extraTracks: {},
  };
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as AppState;
      if (s.version === VERSION) return s;
    }
  } catch { /* storage unavailable — run in memory */ }
  return initialState();
}

let state: AppState = load();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* quota or privacy mode */ }
}

export function getState() { return state; }

/** Immutable-ish update: mutate a structured clone, then publish. */
export function update(fn: (draft: AppState) => void) {
  const draft = structuredClone(state);
  fn(draft);
  state = draft;
  persist();
  emit();
}

export function resetDemo() {
  state = initialState();
  persist();
  emit();
}

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

// Cross-tab sync: another window wrote new state → adopt it.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY || !e.newValue) return;
    try { state = JSON.parse(e.newValue); emit(); } catch { /* ignore */ }
  });
}

export function useStore<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state), () => selector(state));
}
