import { useEffect } from 'react';
import { useRoute, href, navigate } from './lib/router';
import { useStore, update } from './services/store';
import { LogoMark, Wordmark } from './brand/Logo';
import { Icon, type IconName } from './components/Icon';
import { Portrait, Cover } from './components/Art';
import { dismissToast, useToasts } from './lib/toast';
import { openOverlay } from './lib/overlays';
import { Overlays } from './screens/Sheets';
import { Landing } from './screens/Landing';
import { Onboarding } from './screens/Onboarding';
import { Discover } from './screens/Discover';
import { ArtistProfile } from './screens/ArtistProfile';
import { Rising } from './screens/Rising';
import { Search } from './screens/Search';
import { Channels } from './screens/Channels';
import { Room } from './screens/Room';
import { Collabs, CollabDetail } from './screens/Collabs';
import { Profile } from './screens/Profile';
import { useViewer } from './services/hooks';
import { me, resumePendingDemoInvites } from './services/channels';
import { spotify, spotifyAPI } from './services/spotify';
import { getTrack } from './services/tracks';
import { demoPlayback, livePosition, playback, rendererFor } from './services/playback';
import { ARTIST_BY_ID } from './data/artists';
import { toast } from './lib/toast';

const NAV: { path: string; label: string; icon: IconName }[] = [
  { path: 'discover', label: 'Discover', icon: 'discover' },
  { path: 'rising', label: 'Rising', icon: 'rising' },
  { path: 'channels', label: 'Channels', icon: 'channels' },
  { path: 'collabs', label: 'Collabs', icon: 'collabs' },
  { path: 'profile', label: 'Profile', icon: 'profile' },
];

export function App() {
  const route = useRoute();
  const onboarded = useStore((s) => s.onboarded);
  const auth = useStore((s) => s.auth);

  useEffect(() => {
    resumePendingDemoInvites();
    // Complete a real Spotify OAuth redirect, if one just happened.
    spotifyAPI.handleRedirect().then(async (ok) => {
      if (!ok) return;
      const meProfile = await spotify().getMe();
      update((s) => { s.auth = { mode: 'spotify', userId: s.auth?.userId ?? 'alex-rivera', spotify: meProfile }; });
      navigate('onboarding');
    }).catch((e) => toast((e as Error).message));
  }, []);

  const [section, arg] = route;
  useEffect(() => { window.scrollTo(0, 0); }, [section, arg]);

  if (!section) return <><Landing /><Toasts /></>;
  if (section === 'onboarding') return <><Onboarding /><Toasts /></>;
  if (!onboarded || !auth) {
    // Deep links before onboarding go through the door first.
    queueMicrotask(() => navigate('onboarding'));
    return null;
  }

  let screen;
  switch (section) {
    case 'discover': screen = <Discover />; break;
    case 'artist': screen = <ArtistProfile id={arg} key={arg} />; break;
    case 'rising': screen = <Rising />; break;
    case 'search': screen = <Search />; break;
    case 'channels': screen = arg ? <Room id={arg} key={arg} /> : <Channels />; break;
    case 'collabs': screen = arg ? <CollabDetail id={arg} key={arg} /> : <Collabs />; break;
    case 'profile': screen = <Profile />; break;
    default: screen = <Discover />;
  }
  const inRoom = section === 'channels' && arg;

  return (
    <div className={`shell ${inRoom ? 'shell--room' : ''}`}>
      <a className="skip" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>Skip to content</a>
      <Sidebar active={section} />
      <div className="shell__main">
        <TopBar />
        <main id="main" tabIndex={-1} key={`${section}/${arg ?? ''}`} className="shell__page">{screen}</main>
        {!inRoom && <LiveBar />}
      </div>
      <TabBar active={section} />
      <Overlays />
      <Toasts />
      <ChannelAudio />
    </div>
  );
}

function Sidebar({ active }: { active: string }) {
  const viewer = useViewer();
  const invites = useStore((s) => s.invitations.filter((i) => i.toId === me() && i.status === 'sent').length);
  return (
    <aside className="sidebar" aria-label="Primary">
      <a href={href('discover')} className="sidebar__brand" aria-label="Collab home"><Wordmark size={20} /></a>
      <nav>
        <ul>
          {NAV.slice(0, 4).map((n) => (
            <li key={n.path}>
              <a href={href(n.path)} className={active === n.path || (n.path === 'discover' && active === 'artist') ? 'is-on' : ''} aria-current={active === n.path ? 'page' : undefined}>
                <Icon name={n.icon} size={22} /><span>{n.label}</span>
                {n.path === 'channels' && invites > 0 && <b className="badge">{invites}</b>}
              </a>
            </li>
          ))}
          <li><a href={href('search')} className={active === 'search' ? 'is-on' : ''}><Icon name="search" size={22} /><span>Search</span></a></li>
        </ul>
      </nav>
      <a href={href('profile')} className={`sidebar__me ${active === 'profile' ? 'is-on' : ''}`}>
        <span className="sidebar__me-face"><Portrait visual={viewer.photo} imageUrl={viewer.imageUrl} /></span>
        <span><strong>{viewer.name}</strong><small>Verified · Open to Collabs</small></span>
      </a>
      <p className="sidebar__concept">A Spotify concept</p>
    </aside>
  );
}

function TopBar() {
  const unread = useStore((s) => s.notifications.filter((n) => !n.read).length);
  return (
    <div className="topbar">
      <a href={href('discover')} className="topbar__brand" aria-label="Collab home"><LogoMark size={28} /></a>
      <div className="topbar__nav">
        <button className="icon-btn" onClick={() => history.back()} aria-label="Go back"><Icon name="arrowLeft" /></button>
      </div>
      <div className="topbar__right">
        <a href={href('search')} className="topbar__search"><Icon name="search" size={18} /><span>Search artists, genres, cities</span></a>
        <button className="icon-btn topbar__bell" onClick={() => openOverlay({ kind: 'notifications' })} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
          <Icon name="bell" />
          {unread > 0 && <b className="badge badge--dot">{unread}</b>}
        </button>
      </div>
    </div>
  );
}

function TabBar({ active }: { active: string }) {
  return (
    <nav className="tabbar" aria-label="Primary">
      {NAV.map((n) => (
        <a key={n.path} href={href(n.path)} className={active === n.path ? 'is-on' : ''} aria-current={active === n.path ? 'page' : undefined}>
          <Icon name={n.icon} size={22} />
          <span>{n.label}</span>
        </a>
      ))}
    </nav>
  );
}

/** Persistent strip when a channel is live, so the room is always one tap away. */
function LiveBar() {
  const live = useStore((s) => Object.values(s.channels).find((c) => c.status === 'live' && c.playback.isPlaying));
  if (!live) return null;
  const t = live.playback.trackId ? getTrack(live.playback.trackId) : null;
  const others = live.participantIds.filter((p) => p !== me()).map((p) => ARTIST_BY_ID[p]?.name.split(' ')[0]);
  return (
    <a className="livebar" href={href(`channels/${live.id}`)}>
      {t && <span className="livebar__cover"><Cover track={t} /></span>}
      <span className="livebar__text"><strong>{t?.title}</strong><small><span className="live live--sm"><i />Live</span> with {others.join(', ')} · {Math.floor(livePosition(live.playback) / 60000)}:{String(Math.floor((livePosition(live.playback) % 60000) / 1000)).padStart(2, '0')}</small></span>
      <span className="livebar__go">Return to channel <Icon name="arrowRight" size={16} /></span>
    </a>
  );
}

function Toasts() {
  const toasts = useToasts();
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone === 'green' ? 'toast--green' : ''}`}>
          {t.tone === 'green' && <LogoMark size={18} />}
          <span>{t.text}</span>
          {t.action && <a href={t.action.href} onClick={() => dismissToast(t.id)}>{t.action.label}</a>}
          <button onClick={() => dismissToast(t.id)} aria-label="Dismiss"><Icon name="x" size={14} /></button>
        </div>
      ))}
    </div>
  );
}

/**
 * Renders sound for the live channel from its shared playback record. Lives at
 * app level so listening continues while you browse, like any music app.
 */
function ChannelAudio() {
  const ch = useStore((s) => Object.values(s.channels).filter((c) => c.status === 'live').sort((a, b) => b.playback.updatedAt - a.playback.updatedAt)[0]);
  const p = ch?.playback;
  useEffect(() => {
    const t = p?.trackId ? getTrack(p.trackId) : null;
    if (!ch || !t || !p) { demoPlayback.stop(); return; }
    Promise.resolve(rendererFor(t).render(t, livePosition(p), p.isPlaying)).catch((e) => toast(String(e?.message ?? e)));
  }, [ch?.id, p?.trackId, p?.isPlaying, p?.updatedAt]);
  // Auto-advance at the end of a track, even when the room isn't open.
  useEffect(() => {
    if (!ch || !p?.isPlaying || !p.trackId) return;
    const t = getTrack(p.trackId);
    if (!t) return;
    const left = t.durationMs - livePosition(p);
    const id = window.setTimeout(() => playback.next(ch.id, me()), Math.max(200, left));
    return () => window.clearTimeout(id);
  }, [ch?.id, p?.trackId, p?.isPlaying, p?.updatedAt]);
  useEffect(() => () => demoPlayback.stop(), []);
  return null;
}
