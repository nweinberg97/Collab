import { useEffect, useState } from 'react';
import { ARTIST_BY_ID } from '../data/artists';
import { closeOverlay, openOverlay, useOverlay } from '../lib/overlays';
import { useFit, useViewer } from '../services/hooks';
import { useStore } from '../services/store';
import { Avatar, Button, Sheet, Verified } from '../components/ui';
import { CamelotWheel, FamiliarityBar, OverlapVenn, ScoreRing, SignalBars, SoundSpectrum, Sparkline, TempoRuler } from '../components/viz';
import { Portrait } from '../components/Art';
import { channelWith, inviteToChannel } from '../services/channels';
import { navigate } from '../lib/router';
import { cap, fmtCount, pronounObj } from '../lib/music';
import { listenerGrowth, overlapPercent } from '../services/recommendation';
import { Icon } from '../components/Icon';
import { markAllRead } from '../services/notifications';
import type { Insight } from '../types';


export function Overlays() {
  const o = useOverlay();
  return (
    <>
      <WhySheet artistId={o?.kind === 'why' ? o.artistId : null} />
      <InviteSheet artistId={o?.kind === 'invite' ? o.artistId : null} />
      <NotificationsSheet open={o?.kind === 'notifications'} />
    </>
  );
}

/** "Why this artist?" — the explanation moment. */
function WhySheet({ artistId }: { artistId: string | null }) {
  const viewer = useViewer();
  const rec = useFit(artistId ?? '');
  const settings = useStore((s) => s.settings);
  const [showModel, setShowModel] = useState(false);
  useEffect(() => setShowModel(false), [artistId]);
  if (!artistId || !rec) return <Sheet open={false} onClose={closeOverlay}>{null}</Sheet>;
  const a = ARTIST_BY_ID[artistId];
  const first = a.name.split(' ')[0];
  const pct = overlapPercent(rec.signals.audienceOverlap);
  const g = listenerGrowth(a);
  const byKind = (k: Insight['kind']) => rec.insights.find((i) => i.kind === k);

  return (
    <Sheet open onClose={closeOverlay} wide labelledBy="why-title">
      <div className="why">
        <header className="why__head">
          <div className="why__pair" aria-hidden="true">
            <span className="why__face"><Portrait visual={viewer.photo} imageUrl={viewer.imageUrl} /></span>
            <span className="why__join"><svg viewBox="0 0 40 20" width="40" height="20"><path d="M2 10h36" stroke="var(--green)" strokeWidth="1.5" strokeDasharray="2 3" /><circle cx="20" cy="10" r="3.5" fill="var(--green)" /></svg></span>
            <span className="why__face"><Portrait visual={a.photo} imageUrl={a.imageUrl} /></span>
          </div>
          <p className="eyebrow">Why {first}?</p>
          <h2 id="why-title" className="why__title">Collab thinks you’d work well together.</h2>
          <div className="why__score"><ScoreRing value={rec.score} size={92} label="Fit" /><FamiliarityBar similarity={rec.similarity} adventurousness={settings.adventurousness} /></div>
        </header>

        <div className="why__grid">
          {settings.showAudienceOverlap && (
            <section className="why__cell why__cell--audience">
              <OverlapVenn pct={pct} a="you" b={first} />
              <div>
                <h3>{pct}% audience overlap</h3>
                <p>{byKind('audience')?.detail}</p>
                {byKind('scene') && <p className="muted">{byKind('scene')!.detail}</p>}
              </div>
            </section>
          )}
          <section className="why__cell">
            <h3>{byKind('tempo')?.title}</h3>
            <p>{byKind('tempo')?.detail}</p>
            <TempoRuler you={viewer.tempoRange} them={a.tempoRange} themName={first} />
          </section>
          <section className="why__cell why__cell--keys">
            <CamelotWheel you={viewer.keys} them={a.keys} size={150} />
            <div>
              <h3>{byKind('keys')?.title}</h3>
              <p>{byKind('keys')?.detail}</p>
              <div className="legend"><span><b className="sw sw--you" />Your keys</span><span><b className="sw sw--them" />{first}’s</span><span><b className="sw sw--both" />Both</span></div>
            </div>
          </section>
          {g > 0.3 && (
            <section className="why__cell">
              <h3>{byKind('momentum')?.title}</h3>
              <p>{cap(a.pronoun === 'they' ? 'their' : a.pronoun === 'she' ? 'her' : 'his')} monthly listeners have grown {Math.round(g * 100)}% recently.</p>
              <Sparkline values={a.growthMetrics.history} height={56} label="Monthly listeners, last 12 weeks" />
              <p className="mono muted small">{fmtCount(a.growthMetrics.listeners90dAgo)} → {fmtCount(a.growthMetrics.monthlyListeners)} monthly listeners · 90 days</p>
            </section>
          )}
          <section className="why__cell why__cell--wide">
            <h3>{byKind('contrast')?.title ?? 'Sound'}</h3>
            <p>{byKind('contrast')?.detail ?? 'You sit close together sonically.'}</p>
            <SoundSpectrum you={viewer.sound} them={a.sound} themName={first} />
          </section>
        </div>

        <p className="why__verdict">{rec.similarity > 0.82 ? 'You sound close enough to finish each other’s songs.' : 'You sound familiar enough to connect, different enough to surprise.'}</p>

        <div className="why__actions">
          <Button variant="primary" size="lg" icon="channels" onClick={() => openOverlay({ kind: 'invite', artistId: a.id })}>Invite {first}</Button>
          <Button variant="secondary" size="lg" onClick={() => { closeOverlay(); navigate(`artist/${a.id}`); }}>View profile</Button>
          <button className="link-btn" aria-expanded={showModel} onClick={() => setShowModel((v) => !v)}>{showModel ? 'Hide' : 'How'} the score is built</button>
        </div>
        {showModel && (
          <div className="why__model">
            <SignalBars signals={rec.signals} />
            <p className="muted small">A prototype approximation of signals Spotify could compute from first-party data. Every input here is seeded demo data. Genre proximity and creative contrast trade weight with your adventurousness setting.</p>
          </div>
        )}
      </div>
    </Sheet>
  );
}

function InviteSheet({ artistId }: { artistId: string | null }) {
  const a = artistId ? ARTIST_BY_ID[artistId] : null;
  const viewer = useViewer();
  const [note, setNote] = useState('');
  const [sentId, setSentId] = useState<string | null>(null);
  const channel = useStore((s) => (sentId ? s.channels[sentId] : null));
  useEffect(() => {
    if (!a) return;
    const existing = channelWith(a.id);
    setSentId(existing ? existing.id : null);
    setNote(`Hey ${a.name.split(' ')[0]}, Collab put us together. Want to listen through a few ideas?`);
  }, [artistId]);
  if (!a) return <Sheet open={false} onClose={closeOverlay}>{null}</Sheet>;
  const accepted = channel?.status === 'live';
  const first = a.name.split(' ')[0];
  return (
    <Sheet open onClose={closeOverlay} labelledBy="inv-title">
      <div className="invite">
        <div className="invite__pair">
          <Avatar artist={viewer} size={64} />
          <span className={`invite__link ${sentId ? 'is-sent' : ''} ${accepted ? 'is-live' : ''}`} aria-hidden="true"><i /><i /><i /></span>
          <Avatar artist={a} size={64} ring={accepted} />
        </div>
        <p className="eyebrow">Private Audio Channel</p>
        <h2 id="inv-title">{accepted ? `${first} is in the channel` : sentId ? `Invitation sent to ${first}` : `Invite ${first} to listen together`}</h2>
        {!sentId && (
          <>
            <ul className="invite__facts">
              <li><Icon name="lock" size={16} />Invite-only voice room. No audience.</li>
              <li><Icon name="channels" size={16} />Talk, chat and listen in sync.</li>
              <li><Icon name="spark" size={16} />Build a track live, then release it together.</li>
            </ul>
            <label className="field">
              <span>Add a note</span>
              <textarea id="invite-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={240} />
            </label>
            <div className="invite__actions">
              <Button variant="primary" size="lg" icon="arrowRight" onClick={() => setSentId(inviteToChannel(a.id, note))}>Send invitation</Button>
              <Button variant="ghost" onClick={closeOverlay}>Cancel</Button>
            </div>
          </>
        )}
        {sentId && !accepted && <p className="invite__waiting"><span className="dots"><i /><i /><i /></span> Waiting for {first} to accept. You can keep browsing.</p>}
        {accepted && (
          <div className="invite__actions">
            <Button variant="primary" size="lg" icon="arrowRight" onClick={() => { closeOverlay(); navigate(`channels/${sentId}`); }}>Enter Audio Channel</Button>
          </div>
        )}
        <p className="muted small"><Verified compact /> {first} is a verified artist. Demo mode: invitations are accepted automatically.</p>
      </div>
    </Sheet>
  );
}

function NotificationsSheet({ open }: { open: boolean }) {
  const items = useStore((s) => s.notifications);
  useEffect(() => { if (open) { const t = setTimeout(markAllRead, 1500); return () => clearTimeout(t); } }, [open]);
  return (
    <Sheet open={open} onClose={closeOverlay} title="Notifications">
      <ul className="notes-list">
        {items.map((n) => {
          const a = n.artistId ? ARTIST_BY_ID[n.artistId] : null;
          return (
            <li key={n.id} className={n.read ? '' : 'is-unread'}>
              <a href={n.href ?? '#/discover'} onClick={closeOverlay}>
                {a ? <Avatar artist={a} size={36} /> : <span className="notes-list__icon"><Icon name="spark" size={18} /></span>}
                <span>{n.text}<small className="muted">{timeAgo(n.at)}</small></span>
              </a>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}

export function timeAgo(t: number) {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export { pronounObj };
