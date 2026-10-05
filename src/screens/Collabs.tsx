import { useState } from 'react';
import { STAGES } from '../types';
import { ARTIST_BY_ID } from '../data/artists';
import { useStore } from '../services/store';
import { CollabCard, TrackRow, usePreview } from '../components/cards';
import { AvatarPair, Button, Empty } from '../components/ui';
import { Icon } from '../components/Icon';
import { addCollabNote, renameCollaboration, setStage } from '../services/collaborations';
import { getTrack } from '../services/tracks';
import { me, reopenChannel } from '../services/channels';
import { fmtTime } from '../lib/music';
import { navigate } from '../lib/router';
import { timeAgo } from './Sheets';
import { Cover } from '../components/Art';
import { Sheet } from '../components/ui';
import { fmtCount } from '../lib/music';
import { fmtDate, nextFriday, proposeRelease } from '../services/session';
import { overlapPercent, weightedJaccard } from '../services/recommendation';
import type { Collaboration, Track } from '../types';
import { LogoMark } from '../brand/Logo';

export function Collabs() {
  const collabs = useStore((s) => s.collaborations);
  const active = collabs.filter((c) => c.status !== 'Finished' && c.status !== 'Released');
  const done = collabs.filter((c) => c.status === 'Finished' || c.status === 'Released');
  return (
    <div className="page collabs">
      <header className="page-head">
        <div>
          <p className="eyebrow">Collabs</p>
          <h1 className="display display--sm">My Collaborations</h1>
          <p className="page-head__sub">What started as an introduction. Keep it light: a name, a stage, the moments worth keeping.</p>
        </div>
      </header>
      {collabs.length === 0 && (
        <Empty icon="collabs" title="No collaborations yet">
          <p>Start one from inside an Audio Channel.</p>
        </Empty>
      )}
      {active.length > 0 && (
        <section>
          <h2 className="block__title">In progress</h2>
          <div className="collab-grid">{active.map((c) => <CollabCard key={c.id} collab={c} />)}</div>
        </section>
      )}
      {done.length > 0 && (
        <section>
          <h2 className="block__title">Finished and released</h2>
          <div className="collab-grid">{done.map((c) => <CollabCard key={c.id} collab={c} />)}</div>
        </section>
      )}
    </div>
  );
}

export function CollabDetail({ id }: { id: string }) {
  const c = useStore((s) => s.collaborations.find((x) => x.id === id));
  const channel = useStore((s) => (c?.channelId ? s.channels[c.channelId] : undefined));
  const [note, setNote] = useState('');
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(c?.name ?? '');
  const { playingId, toggle } = usePreview();
  if (!c) return <div className="page"><h1>Collaboration not found</h1><a href="#/collabs">Back to Collabs</a></div>;
  const others = c.participantIds.filter((p) => p !== me()).map((p) => ARTIST_BY_ID[p]);
  const idx = STAGES.indexOf(c.status);
  const tracks = c.trackIds.map(getTrack).filter(Boolean);
  const moments = channel?.moments ?? [];

  return (
    <div className="page collab-detail">
      <a href="#/collabs" className="back"><Icon name="arrowLeft" size={16} /> My Collaborations</a>
      <header className="collab-detail__head">
        {others[0] && <AvatarPair a={others[0]} b={ARTIST_BY_ID[me()]} size={64} />}
        <div>
          <p className="eyebrow">{others.map((o) => o.name).join(', ')} × You</p>
          {editing ? (
            <form onSubmit={(e) => { e.preventDefault(); renameCollaboration(c.id, name); setEditing(false); }} className="rename">
              <input id="rename" value={name} onChange={(e) => setName(e.target.value)} autoFocus aria-label="Project name" />
              <Button type="submit" size="sm" variant="primary">Save</Button>
            </form>
          ) : (
            <h1 className="display display--sm">{c.name} <button className="link-btn" onClick={() => { setName(c.name); setEditing(true); }}>Rename</button></h1>
          )}
          <p className="meta">Started {timeAgo(c.createdAt)} · Last activity: {c.lastActivity}</p>
        </div>
        {channel && (
          <Button variant="primary" icon="channels" onClick={() => { if (channel.status === 'ended') reopenChannel(channel.id); navigate(`channels/${channel.id}`); }}>
            {channel.status === 'live' ? 'Open Audio Channel' : 'Reopen Audio Channel'}
          </Button>
        )}
      </header>

      <section className="block">
        <h2 className="block__title">Stage</h2>
        <ol className="stepper">
          {STAGES.map((s, i) => (
            <li key={s} className={`${i < idx ? 'is-done' : ''} ${i === idx ? 'is-current' : ''}`}>
              <button onClick={() => setStage(c.id, s)} aria-current={i === idx ? 'step' : undefined}>
                <span className="stepper__dot">{i < idx ? <Icon name="check" size={14} /> : i + 1}</span>
                <span>{s === 'Exploring' ? 'Idea' : s}</span>
              </button>
            </li>
          ))}
        </ol>
        <p className="muted small">Currently <strong>{c.status}</strong>. Click a stage to move the project.</p>
      </section>

      <ReleaseBlock c={c} />

      <div className="collab-detail__cols">
        <section className="block">
          <h2 className="block__title">Tracks</h2>
          {tracks.length ? <div className="track-list">{tracks.map((t, i) => <TrackRow key={t!.id} track={t!} index={i} showArtist playing={playingId === t!.id} onPlay={() => toggle(t!)} />)}</div> : <p className="muted">No tracks yet.</p>}
          {moments.length > 0 && (
            <>
              <h3 className="block__sub">Moments</h3>
              <ul className="moments">
                {moments.map((m) => <li key={m.id}><span className="mono green">{fmtTime(m.positionMs)}</span><span>{m.label}</span><small className="muted">{getTrack(m.trackId)?.title}</small></li>)}
              </ul>
            </>
          )}
        </section>
        <section className="block">
          <h2 className="block__title">Notes</h2>
          <form className="composer composer--block" onSubmit={(e) => { e.preventDefault(); addCollabNote(c.id, note); setNote(''); }}>
            <input id="collab-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Try a darker chorus" aria-label="Add a note" />
            <Button type="submit" size="sm" variant="secondary" disabled={!note.trim()}>Add</Button>
          </form>
          <ul className="notes">
            {c.notes.map((n) => <li key={n.id}><p>{n.text}</p><small className="muted">{n.by === me() ? 'You' : ARTIST_BY_ID[n.by]?.name.split(' ')[0]} · {timeAgo(n.at)}</small></li>)}
          </ul>
        </section>
      </div>
    </div>
  );
}

function estimateReach(ids: string[]) {
  const [a, b] = ids.map((i) => ARTIST_BY_ID[i]).filter(Boolean);
  if (!a) return 0;
  if (!b) return a.growthMetrics.monthlyListeners;
  const shared = (overlapPercent(weightedJaccard(a.audienceProfile.demoScenes, b.audienceProfile.demoScenes)) / 100) * Math.min(a.growthMetrics.monthlyListeners, b.growthMetrics.monthlyListeners);
  return Math.round(a.growthMetrics.monthlyListeners + b.growthMetrics.monthlyListeners - shared);
}

/** From take to release: credited to every artist in the session. */
function ReleaseBlock({ c }: { c: Collaboration }) {
  const [open, setOpen] = useState(false);
  const takes = c.trackIds.map(getTrack).filter((t): t is Track => Boolean(t?.credits?.length));
  const [takeId, setTakeId] = useState<string | null>(null);
  const [title, setTitle] = useState(c.name);
  const [date, setDate] = useState(nextFriday());
  const r = c.release;
  const credits = c.participantIds.filter((p) => p !== me()).concat(me());
  const reach = estimateReach(credits);
  const names = credits.map((p) => ARTIST_BY_ID[p]?.name).join(', ');

  if (r) {
    const t = getTrack(r.trackId);
    const out = r.status === 'scheduled' && r.releaseDate <= new Date().toISOString().slice(0, 10);
    return (
      <section className="release-card">
        {t && <div className="release-card__cover"><Cover track={t} /></div>}
        <div className="release-card__body">
          <p className="eyebrow eyebrow--green">{r.status === 'awaiting-approval' ? 'Release proposed' : out ? 'Out now on Spotify' : 'Scheduled on Spotify'}</p>
          <h2>{r.title}</h2>
          <p className="meta meta--lg">Single · {r.credits.map((p) => ARTIST_BY_ID[p]?.name).join(', ')}</p>
          <ul className="release-card__facts">
            <li><span className="eyebrow">Release</span><strong>{fmtDate(r.releaseDate)}</strong></li>
            <li><span className="eyebrow">Combined reach</span><strong className="mono">~{fmtCount(r.estReach)}</strong></li>
            <li><span className="eyebrow">Approvals</span><strong>{r.approvals.length}/{r.credits.length}</strong></li>
          </ul>
          <p className="release-card__status">
            {r.status === 'awaiting-approval'
              ? <><span className="dots"><i /><i /><i /></span> Waiting for {r.credits.filter((p) => !r.approvals.includes(p)).map((p) => ARTIST_BY_ID[p]?.name.split(' ')[0]).join(', ')} to approve</>
              : <><LogoMark size={16} /> Both audiences get it on release day: followers of each artist see it in Release Radar.</>}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="release-cta">
      <div>
        <p className="eyebrow">Release</p>
        <h2 className="block__title">{takes.length ? 'Ready to put it out?' : 'Release on Spotify'}</h2>
        <p className="muted">{takes.length ? `Turn a take into a single credited to ${names}. It lands in front of both audiences.` : 'Start a Live Session in the Audio Channel and save a take. Takes can be released as a single credited to everyone who made it.'}</p>
      </div>
      <Button variant={takes.length ? 'primary' : 'secondary'} icon="arrowRight" disabled={!takes.length} onClick={() => { setTakeId(takes[0]?.id ?? null); setTitle(takes[0]?.title ?? c.name); setOpen(true); }}>Release on Spotify</Button>
      <Sheet open={open} onClose={() => setOpen(false)} labelledBy="rel-title">
        <div className="release-sheet">
          <p className="eyebrow eyebrow--green">New release</p>
          <h2 id="rel-title">Release “{title || c.name}”</h2>
          <div className="pick-list" role="radiogroup" aria-label="Take">
            {takes.map((t) => (
              <label key={t.id} className={`take-option ${takeId === t.id ? 'is-on' : ''}`}>
                <input type="radio" name="take" checked={takeId === t.id} onChange={() => { setTakeId(t.id); setTitle(t.title); }} />
                <span className="pick-list__cover"><Cover track={t} /></span>
                <span className="pick-list__text"><strong>{t.title}</strong><small>{t.tempo} BPM · {t.key} · Live Session take</small></span>
              </label>
            ))}
          </div>
          <label className="field"><span>Title</span><input id="rel-name" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
          <label className="field"><span>Release date</span><input id="rel-date" type="date" value={date} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} /></label>
          <ul className="release-sheet__facts">
            <li><Icon name="collabs" size={16} /><span>Credited to <strong>{names}</strong>, as a joint single on each artist’s profile.</span></li>
            <li><Icon name="spark" size={16} /><span>Reaches up to <strong className="mono">~{fmtCount(reach)}</strong> monthly listeners across both audiences, net of overlap.</span></li>
            <li><Icon name="check" size={16} /><span>Every credited artist approves before it goes out.</span></li>
          </ul>
          <p className="muted small">Prototype: nothing is uploaded. In production this hands the master and credits to Spotify for Artists through the artists’ distributor.</p>
          <div className="row-gap">
            <Button variant="primary" size="lg" icon="arrowRight" disabled={!takeId} onClick={() => { proposeRelease(c.id, { title: title.trim() || c.name, trackId: takeId!, credits, releaseDate: date, estReach: reach }); setOpen(false); }}>Send for approval</Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </div>
      </Sheet>
    </section>
  );
}
