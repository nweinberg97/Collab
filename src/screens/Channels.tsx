import { ARTIST_BY_ID } from '../data/artists';
import { useStore } from '../services/store';
import { Avatar, Button, Empty, LiveDot, SectionHead } from '../components/ui';
import { Cover } from '../components/Art';
import { acceptInvitation, declineInvitation, me } from '../services/channels';
import { getTrack } from '../services/tracks';
import { href, navigate } from '../lib/router';
import { timeAgo } from './Sheets';
import type { AudioChannel } from '../types';

export function Channels() {
  const channels = useStore((s) => s.channels);
  const invitations = useStore((s) => s.invitations);
  const all = Object.values(channels).sort((a, b) => b.lastActiveAt - a.lastActiveAt);
  const incoming = invitations.filter((i) => i.toId === me() && i.status === 'sent');
  const live = all.filter((c) => c.status === 'live');
  const waiting = all.filter((c) => c.status === 'pending' && c.participantIds.includes(me()));
  const past = all.filter((c) => c.status === 'ended');

  return (
    <div className="page channels">
      <header className="page-head">
        <div>
          <p className="eyebrow">Channels</p>
          <h1 className="display display--sm">Private Audio Channels</h1>
          <p className="page-head__sub">Invite-only voice rooms for artists. Talk, listen together, build a track live, and take the best takes all the way to a release. No audience. No pressure.</p>
        </div>
      </header>

      {incoming.length > 0 && (
        <section>
          <SectionHead title="Invitations" />
          <div className="invite-list">
            {incoming.map((inv) => {
              const a = ARTIST_BY_ID[inv.fromId];
              return (
                <article key={inv.id} className="invite-card">
                  <Avatar artist={a} size={56} ring />
                  <div className="invite-card__body">
                    <p><strong>{a.name.split(' ')[0]}</strong> invited you to an Audio Channel.</p>
                    {inv.note && <p className="invite-card__note">“{inv.note}”</p>}
                    <span className="muted small">{timeAgo(inv.createdAt)}</span>
                  </div>
                  <div className="invite-card__actions">
                    <Button variant="primary" icon="check" onClick={() => { const id = acceptInvitation(inv.id); if (id) navigate(`channels/${id}`); }}>Accept</Button>
                    <Button variant="ghost" onClick={() => declineInvitation(inv.id)}>Decline</Button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <SectionHead title="Live now" />
        {live.length ? <div className="channel-grid">{live.map((c) => <ChannelCard key={c.id} c={c} />)}</div> : (
          <Empty icon="channels" title="No live channels">
            <p>Invite a match from <a href="#/discover">Discover</a> to open a room.</p>
          </Empty>
        )}
      </section>

      {waiting.length > 0 && (
        <section>
          <SectionHead title="Waiting to join" />
          <div className="channel-grid">{waiting.map((c) => <ChannelCard key={c.id} c={c} />)}</div>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <SectionHead title="Past sessions" />
          <div className="channel-grid">{past.map((c) => <ChannelCard key={c.id} c={c} />)}</div>
        </section>
      )}
    </div>
  );
}

function ChannelCard({ c }: { c: AudioChannel }) {
  const others = [...c.participantIds, ...c.invitedIds].filter((p) => p !== me()).map((p) => ARTIST_BY_ID[p]).filter(Boolean);
  const t = c.playback.trackId ? getTrack(c.playback.trackId) : null;
  const names = others.map((o) => o.name.split(' ')[0]).join(' + ');
  return (
    <a className={`channel-card channel-card--${c.status}`} href={href(`channels/${c.id}`)}>
      <div className="channel-card__art">{t && <Cover track={t} />}</div>
      <div className="channel-card__body">
        {c.status === 'live' ? <LiveDot /> : <span className="eyebrow">{c.status === 'pending' ? 'Invitation sent' : `Last session ${timeAgo(c.lastActiveAt)}`}</span>}
        <h3>{names} + You</h3>
        <p className="meta">{t ? `Now: ${t.title}` : 'Nothing queued'} · {c.queue.length} in queue · {c.moments.length} moment{c.moments.length === 1 ? '' : 's'}</p>
        <div className="channel-card__faces">{others.map((o) => <Avatar key={o.id} artist={o} size={28} />)}</div>
      </div>
    </a>
  );
}
