# Collab

**Who should you make music with?**

Collab is a private network for verified artists. It finds the artists you should be making music with, explains why, puts you in a private voice room together, and carries what you make all the way to a joint release.

> A Spotify concept. This is an independent product prototype, not affiliated with or endorsed by Spotify. Every artist in it is fictional.

---

## The thesis

Spotify knows which artists should be making music together. It just doesn’t introduce them.

Today collaboration runs on managers, labels, DMs, friends of friends and luck. Meanwhile Spotify already sees who sounds compatible, whose audiences overlap, who is rising and whose sound would complement yours. Collab turns those signals into introductions, and turns introductions into releases.

Collab is **not** a dating app for musicians, LinkedIn for musicians, a social feed, a DAW or a distributor. It answers one question: *who should I make music with?*

### Why Spotify could build it

Spotify isn’t only where music is consumed. It sits where **artists, music, listeners and discovery** meet. Collab extends Spotify from *“discover music”* to *“discover who you should make music with.”*

```
More artists collaborate
        ↓
More collaborative releases
        ↓
Both artists reach each other’s audiences
        ↓
More streams
        ↓
More artists want to join Collab
        ↓
More collaboration data
        ↓
Better recommendations
        ↓
More collaborations
```

---

## Core features

The product loop is **Discover → Match → Invite → Create → Release**, built around three hero features.

### 1. Smart Matching
- **Discover** ranks artists by a computed *Collaboration Fit* (not hard-coded) and leads with one hero match.
- Every match explains itself: audience overlap, tempo, key compatibility (Camelot wheel), momentum and sonic contrast.
- **Why this artist?** opens a full explanation: overlap Venn, BPM ruler, Camelot wheel, growth sparkline, sound spectrum, and the score breakdown on request.
- The **70/30 line** (familiar ↔ unexpected) is a first-class control. “How adventurous are you?” re-ranks matches live.

### 2. Audio Channels: voice rooms for artists
Think Clubhouse or Discord voice, but private and built for making music.
- **Talk.** A voice room with speaking indicators. Unmute and the ring around your face follows your real microphone level.
- **Chat.** Room-only chat. Timestamps in messages, notes and marked moments are first-class.
- **Listen together.** Synchronized playback (same track, position, play/pause and shared queue for everyone). Open the same channel in two tabs to see it.
- **Live Session.** Build a track together in real time: four shared layers (drums, bass, chords, topline), three variations each, shared tempo and key. Any change is heard by everyone on the next 16th note.
- **Save takes** credited to everyone in the room. They land in the collaboration automatically.
- Lightweight tools: share a track, add a note, mark a moment, attach a demo, invite another verified artist.

### 3. Rising Talent Radar
- Growth rate over follower count. A polar radar by genre, where distance from the centre is momentum and every dot is the same size.
- Cards lead with streams and listener growth, with a generated **Why now** line.

### Collaborations and release
- Lightweight projects: **Exploring → Writing → Recording → Finished → Released**, with tracks, notes and moments.
- **Release on Spotify:** pick a take, title it, set a date, see estimated combined reach (net of audience overlap), and send for approval. When every credited artist approves, the single is scheduled on both profiles.

Also included: onboarding (“Analyzing your sound…”), artist profiles, natural-language search (“Toronto producers”, “female R&B vocalists”, “electronic producers open to features”) with filters, focused notifications, and privacy controls (visibility, who can invite, Rising Talent opt-out, overlap visibility).

---

## The demo

```bash
npm install
npm run dev        # http://127.0.0.1:5173
```

No accounts, keys or backend needed. You are **Alex Rivera**, an indie-pop artist from Vancouver.

1. **Enter Collab** → **Connect Spotify** (demo) → answer two questions.
2. Discover: **Lena Cruz** leads at ~90% fit. Click **Why Lena?**
3. **Invite to Audio Channel.** Lena accepts in demo mode.
4. In the room: **Unmute to talk**, press play, chat (try “At 1:42?”), **Mark Moment**, **Add to Queue**.
5. **Start Live Session.** Toggle layers, change variations, nudge tempo. Lena plays along. **Save take.**
6. Open the collaboration → **Release on Spotify** → send for approval.
7. Visit **Rising** and find someone by growth, not popularity.

Tip: open any channel in a second tab to watch playback, chat and the Live Session stay in sync.

Other scripts:

| Script | What it does |
|---|---|
| `npm run build` | Production build to `dist/` |
| `npm run build:single` | One self-contained `dist-single/index.html` (for static hosting or sharing) |
| `npm test` | Sanity checks for the recommendation model and Camelot maths |
| `npm run typecheck` | `tsc --noEmit` |

---

## Technical architecture

- **React 19 + TypeScript**, bundled by **esbuild** (`scripts/build.mjs`) with a dev server and live rebuild.
- **Hand-authored design system** in `src/styles.css`: one token set, BEM-style component classes. No CSS framework.
- **Hash router**, `useSyncExternalStore` store, no state library.
- **No backend.** State persists to `localStorage` (one document, `collab:v1`); the `storage` event keeps tabs in sync. Audio files are never stored.

```
src/
  brand/Logo.tsx                 the Collab mark: LogoMark, Wordmark, AppIcon
  components/                    Icon set, generative art, cards, viz, UI primitives
  data/                          32 seeded fictional artists, genre vocabulary
  lib/                           music theory (Camelot), synth engine, router, toasts
  services/
    recommendation.ts            RecommendationService: Collaboration Fit model
    spotify/                     SpotifyService interface, Demo + real API implementations
    playback/                    SpotifyPlaybackService: shared-clock sync + renderers
    voice.ts                     VoiceService: mic metering (demo transport)
    channels.ts                  Audio Channels: invites, chat, queue, moments, demos
    session.ts                   Live Session layers, takes, release hand-off
    collaborations.ts            CollaborationService
    demoPresence.ts              scripted other-artist behaviour (labelled in UI)
    store.ts                     persistence + cross-tab sync
  screens/                       Landing, Onboarding, Discover, ArtistProfile, Rising,
                                 Search, Channels, Room, LiveSession, Collabs, Profile
```

UI components never call Spotify or fake APIs directly. They go through the service layer, so `DemoSpotifyService` can be swapped for `SpotifyAPIService` (or a future first-party backend) without touching screens.

---

## Recommendation model

`src/services/recommendation.ts` computes a real score from seeded data:

```
raw = genreCompatibility · wG      (cosine similarity of genre vectors)
    + tempoCompatibility · 0.15    (average-tempo distance incl. half/double time, range overlap)
    + keyCompatibility   · 0.15    (mean Camelot-wheel distance between key sets)
    + audienceOverlap    · 0.25    (weighted Jaccard of aggregate "listeners also play" scenes)
    + growthMomentum     · 0.10    (log-scaled 90-day listener growth)
    + creativeContrast   · wC      (Gaussian peak at ~30% difference: "70% familiar, 30% unexpected")

wG + wC = 0.35, traded by the adventurousness setting
raw × (0.9 + 0.1 · roleFit)        what you're looking for
fit = calibrate(raw) → 0–100       monotonic curve that spreads the top of the range
```

The explanations (“Your tracks frequently sit between 92–116 BPM”, “She leans more electronic. You lean more acoustic.”) are generated from the same signals that produce the score.

This is a **prototype approximation** of signals Spotify could compute from first-party data. It is not a claim about how Spotify ranks anything.

---

## Spotify integration

**Real integration first, graceful fallback second.**

| Area | Status |
|---|---|
| Sign-in | **Real** when configured: Authorization Code with PKCE (`SpotifyAPIService`) |
| Identity | **Real**: `GET /me` (name, image) overlays the demo profile |
| Artist profile / catalog | **Real** methods: `GET /artists/{id}`, `/artists/{id}/albums` → `/albums/{id}` |
| Track search in rooms | **Real**: `GET /search` (limit 10) when connected; demo catalog otherwise |
| Playback of real tracks | **Real** methods (`SpotifyConnectPlaybackService`): `PUT /me/player/play` with `position_ms`, pause. Needs Premium and an active device |
| Playback of fictional tracks | **Simulated**: rendered live with Web Audio from each track’s tempo and key |
| Audience overlap, growth, sound similarity | **Simulated** (`demo*` fields). Not available from the public API |
| Voice transport | **Simulated**. Your mic level is real; nothing is transmitted |
| Release | **Simulated**. Nothing is uploaded |

### Environment variables

Copy `.env.example` to `.env`:

| Variable | Purpose |
|---|---|
| `COLLAB_SPOTIFY_CLIENT_ID` | Your Spotify app’s client ID. Enables real sign-in |
| `COLLAB_SPOTIFY_REDIRECT_URI` | Must match a Redirect URI on your app. Default: the page URL |

### Spotify developer setup
1. Create an app at <https://developer.spotify.com/dashboard> (select *Web API*).
2. Add the redirect URI `http://127.0.0.1:5173/`. Spotify requires loopback IPs rather than `localhost` for http redirects.
3. Copy the client ID into `.env` and restart `npm run dev`.
4. Development Mode apps are limited to a small allow-list of users (add yours under *User Management*), and since February 2026 the app owner needs Premium.

Scopes requested: `user-read-private user-read-playback-state user-modify-playback-state streaming`.

### API limitations (what the public API doesn’t provide)
- **Audio features** (tempo, key, energy) and **recommendations / related artists** were removed for new apps in November 2024. Tempo and key here are seeded.
- The **February 2026** Development Mode changes removed `GET /artists/{id}/top-tracks`, batch lookups, and `followers` / `popularity` fields; search is capped at 10 results. Collab reads catalog through albums instead.
- No public API exposes listener overlap, growth curves or audience composition. These are exactly the first-party signals that make Collab a Spotify product rather than a third-party app.
- There is no public API to release music to Spotify. In production the release step would hand off to Spotify for Artists through the artists’ distributor.

Demo-only values are named for what they are (`demoScenes`, `demoStreamsGrowthPct`, `demoMonthlyStreams`) and never presented as live Spotify data.

---

## Brand

- **Name:** Collab (never “Spotify Collab” in the UI).
- **Mark, “the Orbit”:** an outer C and an inner orbit turned off-axis around a single shared point. It reads as two creative paths circling one idea, a record’s groove, and a C. It works in green on black, white on black and black on light, and as an app icon or favicon. `LogoMark` animates the inner orbit when something is live.
- **Palette:** deep black `#070807`, graphite surfaces, warm white `#F3F1EC`, a green-biased muted gray, and **Collab Green `#26E48C`**: cooler and brighter than Spotify’s, reserved for action, live state and fit.
- **Type:** Schibsted Grotesk (tight, heavy display; legible body) with IBM Plex Mono for data such as BPM, Camelot codes, timestamps and scores.
- **Its own iconography** (square-ended 1.75px strokes), its own card system, and its own visualizations: the Fit ring opens like the mark, plus the 70/30 line, Camelot wheel and growth radar.
- Artist imagery is **generative “sound portraits”**, so no real person is implied. In production these slots show Spotify artist images.

## Accessibility
Keyboard-navigable throughout (skip link, focus-trapped sheets, Escape to close, Space toggles room playback, arrow keys seek), visible focus states, semantic landmarks, ARIA labels on visualizations and controls, and `prefers-reduced-motion` support.

## Future architecture
- **Matching service** on Spotify’s first-party data: audio embeddings instead of genre vectors, true listener-graph overlap, and outcome feedback (which intros became releases) closing the flywheel.
- **Realtime rooms**: WebRTC voice via an SFU; a realtime channel (e.g. WebSocket) carrying the same intent-only playback and session records used here.
- **Session audio**: replace the four-layer sketch with stems recorded by each artist, synced to the shared clock.
- **Spotify Connect** for in-room listening across both artists’ devices; Web Playback SDK in the browser.
- **Release hand-off** to Spotify for Artists and distributors, with credits and approvals carried from the session.
- **Trust & safety**: verified-artist identity from Spotify for Artists, invite permissions, rate limits, reporting.
