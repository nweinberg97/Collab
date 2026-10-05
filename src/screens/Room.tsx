import { useEffect, useMemo, useRef, useState } from 'react';
import type { AudioChannel, Message, Track } from '../types';
import { ARTIST_BY_ID } from '../data/artists';
import { update, useStore } from '../services/store';
import { Avatar, Button, IconButton, LiveDot, Sheet } from '../components/ui';
import { Cover, Portrait } from '../components/Art';
import { Icon, type IconName } from '../components/Icon';
import { Eq } from '../components/cards';
import { LogoMark } from '../brand/Logo';
import { livePosition, playback, demoPlayback } from '../services/playback';
import { addDemo, addNote, addToQueue, acceptInvitation, inviteAnother, leaveChannel, markMoment, me, removeFromQueue, reopenChannel, sendMessage } from '../services/channels';
import { createCollaboration } from '../services/collaborations';
import { reactTo, tickPresence } from '../services/demoPresence';
import { getTrack } from '../services/tracks';
import { spotify } from '../services/spotify';
import { fmtTime } from '../lib/music';
import { href, navigate } from '../lib/router';
import { toast } from '../lib/toast';
import { synth } from '../lib/synth';
import { useRecommendations } from '../services/hooks';
import { stopPreview } from '../components/cards';
import { voice } from '../services/voice';
import { LiveSessionPanel, SessionInvite } from './LiveSession';

const firstName = (id: string) => (id === me() ? 'You' : ARTIST_BY_ID[id]?.name.split(' ')[0] ?? 'Someone');

export function Room({ id }: { id: string }) {
  const ch = useStore((s) => s.channels[id]);
  if (!ch) return <div className="page"><h1>Channel not found</h1><a href="#/channels">Back to Channels</a></div>;
  if (ch.status === 'pending') return <PendingRoom ch={ch} />;
  return <LiveRoom ch={ch} />;
}

function PendingRoom({ ch }: { ch: AudioChannel }) {
  const invitations = useStore((s) => s.invitations);
  const incoming = invitations.find((i) => i.channelId === ch.id && i.toId === me() && i.status === 'sent');
  const otherId = [...ch.participantIds, ...ch.invitedIds].find((p) => p !== me())!;
  const other = ARTIST_BY_ID[otherId];
  return (
    <div className="room-wait">
      <div className="room-wait__pair">
        <span className="room-wait__face"><Portrait visual={ARTIST_BY_ID[me()].photo} /></span>
        <LogoMark size={44} live />
        <span className="room-wait__face"><Portrait visual={other.photo} /></span>
      </div>
      {incoming ? (
        <>
          <h1>{other.name.split(' ')[0]} invited you to an Audio Channel</h1>
          {incoming.note && <p className="room-wait__note">“{incoming.note}”</p>}
          <div className="row-gap">
            <Button variant="primary" size="lg" icon="check" onClick={() => acceptInvitation(incoming.id)}>Join channel</Button>
            <Button variant="ghost" size="lg" onClick={() => navigate('channels')}>Not now</Button>
          </div>
        </>
      ) : (
        <>
          <h1>Waiting for {other.name.split(' ')[0]}…</h1>
          <p className="muted">They’ll get a notification. In demo mode they accept in a few seconds.</p>
        </>
      )}
    </div>
  );
}

function useNow(active: boolean, ms = 250) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const t = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(t);
  }, [active, ms]);
  return now;
}

function LiveRoom({ ch }: { ch: AudioChannel }) {
  const volume = useStore((s) => s.settings.volume);
  const collab = useStore((s) => s.collaborations.find((c) => c.id === ch.collaborationId));
  const [tab, setTab] = useState<'room' | 'queue' | 'chat'>('room');
  const [sheet, setSheet] = useState<null | 'share' | 'demo' | 'invite' | 'collab'>(null);
  const [tool, setTool] = useState<null | 'moment' | 'note'>(null);
  const [muted, setMuted] = useState(true);
  const [level, setLevel] = useState(0);
  const toggleMic = async () => {
    if (!muted) { voice.mute(); setMuted(true); return; }
    setMuted(false);
    const ok = await voice.unmute();
    if (!ok) toast('Microphone unavailable here, so your voice is simulated in this demo.');
  };
  const enteredAt = useRef(Date.now());
  const live = ch.status === 'live';
  const now = useNow(true, 120);
  useEffect(() => { setLevel(muted ? 0 : voice.level()); }, [now]);
  useEffect(() => () => voice.mute(), []);

  const track = ch.playback.trackId ? getTrack(ch.playback.trackId) : null;
  const pos = livePosition(ch.playback, now);
  const others = ch.participantIds.filter((p) => p !== me());
  const title = `${others.map(firstName).join(' + ')} + You`;

  // Audio is rendered app-wide by <ChannelAudio/> so it keeps playing while you browse.
  useEffect(() => { stopPreview(); }, []);
  useEffect(() => { demoPlayback.setVolume(muted ? 0 : volume); }, [volume, muted]);

  // Scripted demo presence.
  useEffect(() => {
    if (!live) return;
    tickPresence(ch.id, enteredAt.current);
  }, [now]);

  // Keyboard: space toggles playback when not typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.code === 'Space' && !['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT'].includes(el.tagName)) { e.preventDefault(); playback.toggle(ch.id, me()); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ch.id]);

  const hue = track?.cover.hues[0] ?? 150;

  return (
    <div className={`room ${live ? '' : 'room--ended'}`} style={{ ['--room-hue' as string]: hue }}>
      <div className="room__glow" aria-hidden="true" />
      <header className="room__head">
        <a href="#/channels" className="icon-btn" aria-label="Back to Channels"><Icon name="arrowLeft" /></a>
        <div className="room__title">
          <div className="room__status">{live ? <LiveDot /> : <span className="eyebrow">Session ended</span>}<span className="room__private"><Icon name="lock" size={13} />Private Audio Channel</span></div>
          <h1>{title}</h1>
        </div>
        <div className="room__head-actions">
          {collab ? (
            <Button variant="secondary" icon="collabs" onClick={() => navigate(`collabs/${collab.id}`)}>{collab.name}</Button>
          ) : (
            <Button variant="primary" icon="plus" onClick={() => setSheet('collab')} disabled={!live}>New Collaboration</Button>
          )}
          {live ? <Button variant="ghost" onClick={() => { leaveChannel(ch.id); toast('Session ended. Everything you marked is saved.'); }}>End session</Button>
            : <Button variant="secondary" icon="refresh" onClick={() => reopenChannel(ch.id)}>Reopen</Button>}
        </div>
      </header>

      <nav className="room__tabs" aria-label="Room sections">
        {(['room', 'queue', 'chat'] as const).map((t) => (
          <button key={t} className={tab === t ? 'is-on' : ''} aria-pressed={tab === t} onClick={() => setTab(t)}>
            {t === 'room' ? 'Room' : t === 'queue' ? `Queue ${ch.queue.length}` : `Chat ${ch.messages.filter((m) => m.kind !== 'system').length}`}
          </button>
        ))}
      </nav>

      <div className={`room__layout room__layout--${tab}`}>
        <section className="room__stage" aria-label="Now playing">
          <div className="voice">
            <div className="voice__head">
              <span className="voice__status"><Icon name="live" size={16} />Voice · {ch.participantIds.length} connected</span>
              <button className={`mic-btn ${muted ? '' : 'is-live'}`} onClick={toggleMic} disabled={!live} aria-pressed={!muted}>
                <Icon name={muted ? 'micOff' : 'mic'} size={18} /><span>{muted ? 'Unmute to talk' : 'You’re live'}</span>
              </button>
            </div>
            <div className="participants">
              {ch.participantIds.map((p) => {
                const a = ARTIST_BY_ID[p];
                const self = p === me();
                const speaking = live && (self ? !muted && level > 0.08 : speakingNow(ch, p, now));
                const lvl = self ? (muted ? 0 : level) : speaking ? 0.55 + 0.35 * Math.abs(Math.sin(now / 180)) : 0;
                return (
                  <div key={p} className={`participant ${speaking ? 'is-speaking' : ''}`} style={{ ['--lvl' as string]: lvl }}>
                    <span className="participant__face"><Portrait visual={a.photo} imageUrl={a.imageUrl} /></span>
                    <strong>{self ? 'You' : a.name.split(' ')[0]}</strong>
                    <span className="participant__state">
                      <Icon name={self && muted ? 'micOff' : 'mic'} size={13} />
                      {self && muted ? 'Muted' : speaking ? 'Speaking' : ch.playback.isPlaying ? 'Listening' : 'In the room'}
                    </span>
                  </div>
                );
              })}
              {ch.invitedIds.map((p) => (
                <div key={p} className="participant participant--invited">
                  <span className="participant__face"><Portrait visual={ARTIST_BY_ID[p].photo} /></span>
                  <strong>{ARTIST_BY_ID[p].name.split(' ')[0]}</strong><span className="participant__state">Invited…</span>
                </div>
              ))}
            </div>
          </div>

          {ch.session ? <LiveSessionPanel ch={ch} now={now} /> : track ? (
            <div className="now">
              <div className="now__cover"><Cover track={track} />{ch.playback.isPlaying && <span className="now__eq"><Eq /></span>}</div>
              <div className="now__meta">
                <p className="eyebrow">Now playing together</p>
                <h2 className="now__title">{track.title}</h2>
                <p className="meta meta--lg">{firstName(track.artistId) === 'You' ? 'You' : ARTIST_BY_ID[track.artistId]?.name ?? 'Spotify'}{track.tempo ? ` · ${track.tempo} BPM · ${track.key}` : ''}</p>
                <Scrubber ch={ch} track={track} pos={pos} />
                <div className="now__controls">
                  <IconButton icon="prev" label="Previous" onClick={() => playback.prev(ch.id, me())} disabled={!live} />
                  <button className="play-btn" onClick={() => playback.toggle(ch.id, me())} disabled={!live} aria-label={ch.playback.isPlaying ? 'Pause for everyone' : 'Play for everyone'}>
                    <Icon name={ch.playback.isPlaying ? 'pause' : 'play'} size={26} />
                  </button>
                  <IconButton icon="next" label="Next" onClick={() => playback.next(ch.id, me())} disabled={!live} />
                  <Volume />
                </div>
                <SyncLine ch={ch} pos={pos} now={now} />
              </div>
            </div>
          ) : <p className="muted">Nothing queued yet. Share a track to start listening.</p>}

          <div className="tools" role="toolbar" aria-label="Creative tools">
            <Tool icon="share" label="Share Track" onClick={() => setSheet('share')} disabled={!live} />
            <Tool icon="note" label="Add Note" onClick={() => setTool(tool === 'note' ? null : 'note')} active={tool === 'note'} disabled={!live} />
            <Tool icon="flag" label="Mark Moment" onClick={() => setTool(tool === 'moment' ? null : 'moment')} active={tool === 'moment'} disabled={!live || !track} hint={fmtTime(pos)} />
            <Tool icon="upload" label="Add Demo" onClick={() => setSheet('demo')} disabled={!live} />
            <Tool icon="userPlus" label="Invite" onClick={() => setSheet('invite')} disabled={!live} />
          </div>
          {tool && <InlineTool kind={tool} ch={ch} pos={pos} onDone={() => setTool(null)} />}
          {!ch.session && live && <SessionInvite ch={ch} />}
        </section>

        <section className="room__queue" aria-label="Shared queue">
          <div className="panel-head"><h2>Shared Queue</h2><Button size="sm" variant="primary" icon="plus" onClick={() => setSheet('share')} disabled={!live}>Add to Queue</Button></div>
          <ol className="queue">
            {ch.queue.map((q, i) => {
              const t = getTrack(q.trackId);
              if (!t) return null;
              const current = q.trackId === ch.playback.trackId;
              const marks = ch.moments.filter((m) => m.trackId === t.id).length;
              return (
                <li key={q.id} className={current ? 'is-current' : ''}>
                  <button className="queue__play" onClick={() => playback.select(ch.id, t.id, me())} disabled={!live} aria-label={`Play ${t.title} for everyone`}>
                    <span className="queue__num mono">{current && ch.playback.isPlaying ? <Eq /> : i + 1}</span>
                    <span className="queue__cover"><Cover track={t} /></span>
                    <span className="queue__text"><strong>{t.title}</strong><small>{t.isDemo ? 'Demo' : firstName(t.artistId) === 'You' ? 'You' : ARTIST_BY_ID[t.artistId]?.name.split(' ')[0] ?? 'Spotify'}{marks ? ` · ${marks} moment${marks > 1 ? 's' : ''}` : ''}</small></span>
                  </button>
                  <span className="queue__by" title={`Added by ${firstName(q.addedBy)}`}><Avatar artist={ARTIST_BY_ID[q.addedBy] ?? ARTIST_BY_ID[me()]} size={22} /></span>
                  {q.addedBy === me() && !current && <IconButton icon="x" label={`Remove ${t.title}`} className="icon-btn--sm" onClick={() => removeFromQueue(ch.id, q.id)} size={14} />}
                </li>
              );
            })}
          </ol>
        </section>

        <Chat ch={ch} live={live} />
      </div>

      <p className="room__demo-note muted small">
        <Icon name="eye" size={14} /> Demo mode: {others.map(firstName).join(' and ')}’s side of this session is simulated. Open <a href={href(`channels/${ch.id}`)} target="_blank" rel="noreferrer">this channel in a second tab</a> to see playback, queue and chat stay in sync. Press Space to play or pause.
      </p>

      <ShareSheet open={sheet === 'share'} onClose={() => setSheet(null)} ch={ch} />
      <DemoSheet open={sheet === 'demo'} onClose={() => setSheet(null)} ch={ch} />
      <InviteMoreSheet open={sheet === 'invite'} onClose={() => setSheet(null)} ch={ch} />
      <NewCollabSheet open={sheet === 'collab'} onClose={() => setSheet(null)} ch={ch} />
    </div>
  );
}

/** Simulated voice activity for the other participant: short bursts tied to recent chat. */
function speakingNow(ch: AudioChannel, p: string, now: number) {
  const last = [...ch.messages].reverse().find((m) => m.senderId === p);
  if (last && now - last.timestamp < 2500) return true;
  // Between songs people talk: short simulated bursts while playback is paused.
  return !ch.playback.isPlaying && (now / 1000 + p.length * 3) % 11 < 2.2;
}

function Tool({ icon, label, onClick, disabled, active, hint }: { icon: IconName; label: string; onClick: () => void; disabled?: boolean; active?: boolean; hint?: string }) {
  return (
    <button className={`tool ${active ? 'is-on' : ''}`} onClick={onClick} disabled={disabled} aria-pressed={active}>
      <Icon name={icon} size={20} />
      <span>{label}</span>
      {hint && <small className="mono">{hint}</small>}
    </button>
  );
}

function Scrubber({ ch, track, pos }: { ch: AudioChannel; track: Track; pos: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const pct = Math.min(100, (pos / track.durationMs) * 100);
  const marks = ch.moments.filter((m) => m.trackId === track.id);
  const seekTo = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    playback.seek(ch.id, ((clientX - r.left) / r.width) * track.durationMs, me());
  };
  return (
    <div className="scrub">
      <div
        ref={ref}
        className="scrub__track"
        role="slider"
        tabIndex={0}
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={Math.round(track.durationMs / 1000)}
        aria-valuenow={Math.round(pos / 1000)}
        aria-valuetext={`${fmtTime(pos)} of ${fmtTime(track.durationMs)}`}
        onClick={(e) => seekTo(e.clientX)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') playback.seek(ch.id, pos + 5000, me());
          if (e.key === 'ArrowLeft') playback.seek(ch.id, pos - 5000, me());
        }}
      >
        <div className="scrub__fill" style={{ width: `${pct}%` }} />
        <div className="scrub__head" style={{ left: `${pct}%` }} />
        {marks.map((m) => (
          <button key={m.id} className="scrub__mark" style={{ left: `${(m.positionMs / track.durationMs) * 100}%` }} onClick={(e) => { e.stopPropagation(); playback.seek(ch.id, m.positionMs, me()); }} aria-label={`Jump to ${fmtTime(m.positionMs)}: ${m.label}`} title={`${fmtTime(m.positionMs)} — ${m.label}`} />
        ))}
      </div>
      <div className="scrub__times mono"><span>{fmtTime(pos)}</span><span>{fmtTime(track.durationMs)}</span></div>
    </div>
  );
}

function Volume() {
  const v = useStore((s) => s.settings.volume);
  return (
    <label className="volume">
      <Icon name={v === 0 ? 'mute' : 'volume'} size={18} />
      <input id="room-volume" type="range" min={0} max={100} value={Math.round(v * 100)} aria-label="Your volume" style={{ ['--p' as string]: `${v * 100}%` }}
        onChange={(e) => { const nv = Number(e.target.value) / 100; update((s) => { s.settings.volume = nv; }); }} />
    </label>
  );
}

/** Shows that every participant derives the same position from the shared record. */
function SyncLine({ ch, pos, now }: { ch: AudioChannel; pos: number; now: number }) {
  const other = ch.participantIds.find((p) => p !== me());
  const latency = useMemo(() => 28 + Math.round(Math.random() * 30), [Math.floor(now / 4000)]);
  if (!other) return null;
  const by = ch.playback.updatedBy === me() ? 'you' : firstName(ch.playback.updatedBy);
  return (
    <p className="sync mono">
      <span className="sync__dot" aria-hidden="true" />
      In sync with {firstName(other)} · {fmtTime(pos)} on both players · {latency}ms · last change by {by}
      {!synth.unlocked && ch.playback.isPlaying && <button className="link-btn" onClick={() => { synth.unlock(); playback.seek(ch.id, pos, me()); }}>Tap to hear audio</button>}
    </p>
  );
}

function InlineTool({ kind, ch, pos, onDone }: { kind: 'moment' | 'note'; ch: AudioChannel; pos: number; onDone: () => void }) {
  const [text, setText] = useState('');
  const atPos = useRef(pos);
  const submit = (value = text) => {
    if (kind === 'moment') {
      markMoment(ch.id, value);
      reactTo(ch.id, { type: 'moment' });
      toast(`Marked ${fmtTime(atPos.current)} — ${value.trim() || 'idea'}`, { tone: 'green' });
    } else {
      if (!value.trim()) return;
      addNote(ch.id, value);
      reactTo(ch.id, { type: 'note' });
    }
    onDone();
  };
  return (
    <form className="inline-tool" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      {kind === 'moment' && <span className="inline-tool__time mono">{fmtTime(atPos.current)}</span>}
      <input id={`tool-${kind}`} autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder={kind === 'moment' ? 'What happens here? e.g. vocal idea' : 'e.g. Try a darker chorus'} aria-label={kind === 'moment' ? 'Moment label' : 'Note'} />
      {kind === 'moment' && (
        <div className="inline-tool__quick">
          {['vocal idea', 'chorus', 'drop here', 'lyric'].map((q) => <button type="button" key={q} className="pill pill--sm" onClick={() => submit(q)}>{q}</button>)}
        </div>
      )}
      <Button type="submit" size="sm" variant="primary">{kind === 'moment' ? 'Mark' : 'Add note'}</Button>
    </form>
  );
}

function Chat({ ch, live }: { ch: AudioChannel; live: boolean }) {
  const [text, setText] = useState('');
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' }); }, [ch.messages.length]);
  const send = () => {
    if (!text.trim()) return;
    sendMessage(ch.id, text);
    reactTo(ch.id, { type: 'message', text });
    setText('');
  };
  return (
    <section className="room__chat" aria-label="Chat">
      <div className="panel-head"><h2>Chat</h2><span className="muted small">Only people in this room can see this</span></div>
      <ol className="chat" ref={list} aria-live="polite">
        {ch.messages.map((m, i) => <ChatItem key={m.id} m={m} prev={ch.messages[i - 1]} ch={ch} />)}
      </ol>
      <form className="composer" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input id="chat-input" value={text} onChange={(e) => setText(e.target.value)} placeholder={live ? 'Say something, e.g. “At 1:42?”' : 'Session ended'} disabled={!live} aria-label="Message" />
        <IconButton type="submit" icon="arrowRight" label="Send" disabled={!live || !text.trim()} />
      </form>
    </section>
  );
}

function ChatItem({ m, prev, ch }: { m: Message; prev?: Message; ch: AudioChannel }) {
  if (m.kind === 'system') return <li className="chat__system">{m.content}</li>;
  const mine = m.senderId === me();
  const grouped = prev && prev.senderId === m.senderId && prev.kind !== 'system' && m.timestamp - prev.timestamp < 120_000;
  const a = ARTIST_BY_ID[m.senderId];
  if (m.kind === 'moment') {
    const mo = ch.moments.find((x) => x.id === m.ref);
    return (
      <li className={`chat__moment ${mine ? 'is-mine' : ''}`}>
        <button onClick={() => mo && playback.seek(ch.id, mo.positionMs, me())} disabled={!mo || ch.playback.trackId !== mo.trackId} title="Jump to this moment">
          <Icon name="flag" size={14} /><span className="mono">{m.content}</span>
        </button>
        <small>{firstName(m.senderId)} marked a moment</small>
      </li>
    );
  }
  if (m.kind === 'note') return <li className="chat__note"><Icon name="note" size={14} /><div><small>{firstName(m.senderId)} added a note</small><p>{m.content}</p></div></li>;
  if (m.kind === 'track') return <li className="chat__system chat__system--track"><Icon name="queue" size={14} />{m.content}</li>;
  return (
    <li className={`chat__msg ${mine ? 'is-mine' : ''} ${grouped ? 'is-grouped' : ''}`}>
      {!mine && !grouped && a && <span className="chat__who">{a.name.split(' ')[0]}</span>}
      <p>{m.content}</p>
    </li>
  );
}

function ShareSheet({ open, onClose, ch }: { open: boolean; onClose: () => void; ch: AudioChannel }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Track[]>([]);
  const s = spotify();
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const run = async () => {
      // Participants' catalogs first, then the wider network / Spotify search.
      const own = ch.participantIds.flatMap((p) => ARTIST_BY_ID[p]?.tracks ?? []);
      const found = q.trim() ? await s.searchTracks(q).catch(() => []) : [];
      const local = own.filter((t) => !q.trim() || t.title.toLowerCase().includes(q.toLowerCase()));
      if (!cancelled) setResults([...local, ...found.filter((f) => !local.some((l) => l.id === f.id))].slice(0, 14));
    };
    const t = window.setTimeout(run, 180);
    return () => { cancelled = true; window.clearTimeout(t); };
  }, [q, open]);
  return (
    <Sheet open={open} onClose={onClose} title="Share a track">
      <div className="search__box search__box--sm">
        <Icon name="search" size={18} />
        <input id="share-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder={s.mode === 'spotify' ? 'Search Spotify' : 'Search the Collab catalog'} aria-label="Search tracks" />
      </div>
      <ul className="pick-list">
        {results.map((t) => {
          const queued = ch.queue.some((x) => x.trackId === t.id);
          return (
            <li key={t.id}>
              <span className="pick-list__cover"><Cover track={t} /></span>
              <span className="pick-list__text"><strong>{t.title}</strong><small>{ARTIST_BY_ID[t.artistId]?.name ?? 'Spotify'}{t.tempo ? ` · ${t.tempo} BPM` : ''}</small></span>
              <Button size="sm" variant={queued ? 'ghost' : 'secondary'} disabled={queued} icon={queued ? 'check' : 'plus'} onClick={() => { addToQueue(ch.id, t); toast(`Added “${t.title}” to the queue`); }}>{queued ? 'Queued' : 'Add'}</Button>
            </li>
          );
        })}
      </ul>
      {s.mode === 'demo' && <p className="muted small">Demo catalog. With Spotify connected, search returns real tracks; playing them uses your Spotify device (Premium).</p>}
    </Sheet>
  );
}

function DemoSheet({ open, onClose, ch }: { open: boolean; onClose: () => void; ch: AudioChannel }) {
  const [name, setName] = useState('');
  const [dur, setDur] = useState<number | undefined>();
  const onFile = (f: File | undefined) => {
    if (!f) return;
    setName(f.name.replace(/\.[a-z0-9]+$/i, ''));
    const url = URL.createObjectURL(f);
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => { if (isFinite(audio.duration)) setDur(Math.round(audio.duration * 1000)); URL.revokeObjectURL(url); };
    audio.onerror = () => URL.revokeObjectURL(url);
    audio.src = url;
  };
  return (
    <Sheet open={open} onClose={onClose} title="Add a demo">
      <p className="muted">Drop in a rough idea. In this prototype only the name and length are kept; Collab plays a sketch in your usual tempo and key.</p>
      <label className="dropzone">
        <Icon name="upload" size={24} />
        <span>Choose an audio file</span>
        <input id="demo-file" type="file" accept="audio/*" onChange={(e) => onFile(e.target.files?.[0])} />
      </label>
      <label className="field"><span>Demo name</span><input id="demo-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="untitled ferry idea v2" /></label>
      <div className="row-gap">
        <Button variant="primary" icon="plus" onClick={() => { const t = addDemo(ch.id, name || 'Untitled demo', dur); toast(`“${t.title}” added to the queue`); setName(''); setDur(undefined); onClose(); }}>Add to queue</Button>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
      </div>
    </Sheet>
  );
}

function InviteMoreSheet({ open, onClose, ch }: { open: boolean; onClose: () => void; ch: AudioChannel }) {
  const recs = useRecommendations();
  const candidates = recs.filter((r) => !ch.participantIds.includes(r.targetArtistId) && !ch.invitedIds.includes(r.targetArtistId)).slice(0, 6);
  return (
    <Sheet open={open} onClose={onClose} title="Invite another artist">
      <p className="muted">Bring in a third voice. Only verified artists can join.</p>
      <ul className="pick-list">
        {candidates.map((r) => {
          const a = ARTIST_BY_ID[r.targetArtistId];
          return (
            <li key={a.id}>
              <Avatar artist={a} size={40} />
              <span className="pick-list__text"><strong>{a.name}</strong><small>{a.roles[0]} · {a.genres[0]} · {r.score}% fit</small></span>
              <Button size="sm" variant="secondary" icon="userPlus" onClick={() => { inviteAnother(ch.id, a.id); toast(`Invited ${a.name}`); onClose(); }}>Invite</Button>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}

function NewCollabSheet({ open, onClose, ch }: { open: boolean; onClose: () => void; ch: AudioChannel }) {
  const [name, setName] = useState('Untitled');
  const people = ch.participantIds.filter((p) => p !== me());
  return (
    <Sheet open={open} onClose={onClose} labelledBy="newco-title">
      <div className="newco">
        <p className="eyebrow eyebrow--green">New Collaboration</p>
        <h2 id="newco-title">{people.map((p) => ARTIST_BY_ID[p].name).join(', ')} × You</h2>
        <label className="field"><span>Project name</span><input id="collab-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus onFocus={(e) => e.target.select()} /></label>
        <div className="newco__facts">
          <div><span className="eyebrow">Status</span><strong>Exploring</strong></div>
          <div><span className="eyebrow">Moments</span><strong className="mono">{ch.moments.length}</strong></div>
          <div><span className="eyebrow">Notes</span><strong className="mono">{ch.messages.filter((m) => m.kind === 'note').length}</strong></div>
        </div>
        <p className="muted small">Moments, notes and this channel carry over. Stages: Exploring → Writing → Recording → Finished → Released.</p>
        <div className="row-gap">
          <Button variant="primary" size="lg" icon="collabs" onClick={() => {
            const id = createCollaboration(ch.id, name);
            onClose();
            toast(`“${name.trim() || 'Untitled'}” is in My Collabs`, { tone: 'green', action: { label: 'View', href: href(`collabs/${id}`) } });
          }}>Create collaboration</Button>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Sheet>
  );
}

