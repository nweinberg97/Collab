// ─── Core domain model ────────────────────────────────────────────────────────
// Fields prefixed `demo` are prototype stand-ins for signals that only Spotify's
// first-party data could produce. They are never presented as live Spotify data.

export type Role = 'Artist' | 'Producer' | 'Songwriter' | 'Vocalist' | 'DJ' | 'Band';
export type CollabType = 'Feature' | 'Co-writing' | 'Production' | 'Remix' | 'Live' | 'Tour' | 'Vocals';
export type Momentum = 'Breakout' | 'Rising' | 'Established';
export type Pronoun = 'she' | 'he' | 'they';

/** Genre/scene weights 0–1, keyed by a shared vocabulary (see data/genres.ts). */
export type GenreVector = Record<string, number>;

export interface ArtVisual {
  /** Three hues (0–360) that drive the generative portrait / cover. */
  hues: [number, number, number];
  seed: number;
}

export interface Track {
  id: string;
  artistId: string;
  title: string;
  cover: ArtVisual & { style: number };
  durationMs: number;
  tempo: number;
  key: string; // e.g. "A minor"
  genre: string;
  demoMonthlyStreams: number;
  spotifyUrl: string;
  /** Present only for tracks fetched from the real Spotify API. */
  spotifyUri?: string;
  imageUrl?: string;
  isDemo?: boolean; // an unreleased demo uploaded in a channel
  /** Live Session sketches and saved takes: the layer settings that define them. */
  session?: { channelId?: string; layers?: SessionLayers };
  /** Artist IDs credited on a collaborative take. */
  credits?: string[];
}

export const LAYER_KINDS = ['drums', 'bass', 'chords', 'topline'] as const;
export type LayerKind = (typeof LAYER_KINDS)[number];
export interface LayerState { on: boolean; variant: number; by: string }
export type SessionLayers = Record<LayerKind, LayerState>;

/** A live co-writing session inside an Audio Channel. */
export interface LiveSession {
  trackId: string; // the virtual track the room plays while the session runs
  tempo: number;
  key: string;
  layers: SessionLayers;
  takeIds: string[];
  startedBy: string;
  startedAt: number;
}

export interface SoundProfile {
  acoustic: number; // 0–1
  electronic: number;
  energy: number;
  brightness: number; // 0 dark → 1 bright
}

export interface Artist {
  id: string;
  name: string;
  pronoun: Pronoun;
  photo: ArtVisual; // generative "sound portrait" (real build: Spotify artist image)
  imageUrl?: string;
  location: { city: string; country: string };
  bio: string;
  genres: string[]; // display labels, primary first
  genreVector: GenreVector;
  roles: Role[];
  spotifyUrl: string;
  verified: boolean;
  openToCollabs: boolean;
  collaborationTypes: CollabType[]; // what they're open to
  lookingFor: string[]; // the people they want
  tempoRange: [number, number];
  keys: string[];
  sound: SoundProfile;
  audienceProfile: {
    /** Aggregate listener taste — "listeners of this artist also play…" */
    demoScenes: GenreVector;
    topCities: string[];
  };
  growthMetrics: {
    monthlyListeners: number;
    listeners90dAgo: number;
    demoStreamsGrowthPct: number;
    /** 12 weekly monthly-listener samples, oldest first */
    history: number[];
  };
  momentum: Momentum;
  tracks: Track[];
  isDemoArtist: boolean;
}

export interface SignalBreakdown {
  genreCompatibility: number; // 0–1
  tempoCompatibility: number;
  keyCompatibility: number;
  audienceOverlap: number;
  growthMomentum: number;
  creativeContrast: number;
}

export interface Recommendation {
  id: string;
  artistId: string; // viewer
  targetArtistId: string;
  score: number; // 0–100
  signals: SignalBreakdown;
  insights: Insight[];
  headline: string;
  similarity: number; // 0–1 genre similarity → familiar ↔ unexpected
  createdAt: number;
}

export interface Insight {
  kind: 'audience' | 'tempo' | 'keys' | 'momentum' | 'contrast' | 'scene';
  title: string;
  detail: string;
  strength: number; // 0–1
}

export interface QueueItem {
  id: string;
  trackId: string;
  addedBy: string;
}

export interface PlaybackState {
  trackId: string | null;
  isPlaying: boolean;
  positionMs: number; // position at `updatedAt`
  updatedAt: number;
  updatedBy: string;
}

export interface Moment {
  id: string;
  trackId: string;
  positionMs: number;
  label: string;
  by: string;
  at: number;
}

export type MessageKind = 'text' | 'note' | 'moment' | 'system' | 'track';
export interface Message {
  id: string;
  channelId: string;
  senderId: string;
  content: string;
  kind: MessageKind;
  ref?: string; // trackId or momentId
  timestamp: number;
}

export interface AudioChannel {
  id: string;
  participantIds: string[];
  invitedIds: string[];
  status: 'pending' | 'live' | 'ended';
  playback: PlaybackState;
  queue: QueueItem[];
  messages: Message[];
  moments: Moment[];
  session?: LiveSession;
  /** Track the room was listening to before the session started. */
  resumeTrackId?: string;
  collaborationId?: string;
  createdAt: number;
  lastActiveAt: number;
}

export const STAGES = ['Exploring', 'Writing', 'Recording', 'Finished', 'Released'] as const;
export type Stage = (typeof STAGES)[number];

export interface Collaboration {
  id: string;
  participantIds: string[];
  name: string;
  status: Stage;
  channelId?: string;
  trackIds: string[];
  notes: { id: string; by: string; text: string; at: number }[];
  lastActivity: string;
  release?: Release;
  createdAt: number;
  updatedAt: number;
}

export interface Release {
  title: string;
  trackId: string;
  credits: string[]; // artist IDs, primary first
  releaseDate: string; // ISO date
  status: 'awaiting-approval' | 'scheduled' | 'out';
  approvals: string[];
  estReach: number;
}

export interface Invitation {
  id: string;
  fromId: string;
  toId: string;
  note: string;
  status: 'sent' | 'accepted' | 'declined';
  channelId: string;
  createdAt: number;
}

export interface Notification {
  id: string;
  kind: 'accepted' | 'invite' | 'matches' | 'activity';
  text: string;
  artistId?: string;
  href?: string;
  read: boolean;
  at: number;
}

export type Visibility = 'private' | 'discoverable' | 'open';
export interface Settings {
  visibility: Visibility;
  whoCanInvite: 'anyone' | 'matches' | 'nobody';
  appearInRising: boolean;
  showAudienceOverlap: boolean;
  lookingFor: string[];
  adventurousness: number; // 0 stay close → 1 surprise me
  volume: number;
}
