import { useState } from 'react';
import type { AudioChannel, LayerKind } from '../types';
import { ARTIST_BY_ID } from '../data/artists';
import { Avatar, Button, IconButton, LiveDot, Sheet } from '../components/ui';
import { Icon } from '../components/Icon';
import { LAYERS, endSession, layerSteps, saveTake, setLayer, setTempoKey, startSession } from '../services/session';
import { livePosition, playback } from '../services/playback';
import { me } from '../services/channels';
import { reactTo } from '../services/demoPresence';
import { camelot } from '../lib/music';
import { toast } from '../lib/toast';
import { href } from '../lib/router';
import { synth } from '../lib/synth';

const firstName = (id: string) => (id === me() ? 'You' : ARTIST_BY_ID[id]?.name.split(' ')[0] ?? 'Someone');

/** Call-to-action shown in the room when no session is running. */
export function SessionInvite({ ch }: { ch: AudioChannel }) {
  const others = ch.participantIds.filter((p) => p !== me()).map(firstName).join(' and ');
  return (
    <div className="session-cta">
      <div className="session-cta__art" aria-hidden="true">{[0, 1, 2, 3].map((i) => <i key={i} style={{ ['--i' as string]: i }} />)}</div>
      <div>
        <p className="eyebrow eyebrow--green">Live Session</p>
        <h3>Make something with {others} right now.</h3>
        <p className="muted">Build a sketch together in real time: drums, bass, chords and a topline. Either of you can change any layer and both hear it on the next beat. Save the takes you love to your collaboration.</p>
      </div>
      <Button variant="primary" size="lg" icon="spark" onClick={() => { synth.unlock(); startSession(ch.id); }}>Start Live Session</Button>
    </div>
  );
}

export function LiveSessionPanel({ ch, now }: { ch: AudioChannel; now: number }) {
  const s = ch.session!;
  const [saving, setSaving] = useState(false);
  const [takeName, setTakeName] = useState('');
  const pos = livePosition(ch.playback, now);
  const stepDur = 60_000 / s.tempo / 4;
  const step = ch.playback.isPlaying ? Math.floor(pos / stepDur) % 16 : -1;
  const keys = Array.from(new Set(ch.participantIds.flatMap((p) => ARTIST_BY_ID[p]?.keys ?? [])));
  const toggle = (kind: LayerKind, on: boolean) => { setLayer(ch.id, kind, { on }); if (on) reactTo(ch.id, { type: 'layer' }); };

  return (
    <div className="session">
      <div className="session__head">
        <div>
          <div className="row-gap"><LiveDot label="Live Session" /><span className="muted small">Everyone in the room hears every change</span></div>
          <h2 className="session__title">Sketch in {s.key}</h2>
        </div>
        <div className="session__controls">
          <div className="stepper-num" aria-label="Tempo">
            <IconButton icon="arrowLeft" label="Slower" size={16} onClick={() => setTempoKey(ch.id, { tempo: s.tempo - 2 })} />
            <span className="mono"><strong>{s.tempo}</strong> BPM</span>
            <IconButton icon="arrowRight" label="Faster" size={16} onClick={() => setTempoKey(ch.id, { tempo: s.tempo + 2 })} />
          </div>
          <label className="select select--inline">
            <span className="sr-only">Key</span>
            <select id="session-key" value={s.key} onChange={(e) => setTempoKey(ch.id, { key: e.target.value })}>
              {keys.map((k) => <option key={k} value={k}>{k} · {camelot(k).code}</option>)}
            </select>
          </label>
          <button className="play-btn play-btn--sm" onClick={() => playback.toggle(ch.id, me())} aria-label={ch.playback.isPlaying ? 'Pause session for everyone' : 'Play session for everyone'}>
            <Icon name={ch.playback.isPlaying ? 'pause' : 'play'} size={20} />
          </button>
        </div>
      </div>

      <ol className="layers">
        {LAYERS.map(({ kind, name, variants }) => {
          const L = s.layers[kind];
          const steps = new Set(layerSteps(kind, L.variant));
          const by = ARTIST_BY_ID[L.by];
          return (
            <li key={kind} className={`layer ${L.on ? 'is-on' : ''}`}>
              <button className="layer__toggle" aria-pressed={L.on} onClick={() => toggle(kind, !L.on)}>
                <span className="layer__led" aria-hidden="true" />
                <span className="layer__name">{name}</span>
              </button>
              <div className="layer__grid" aria-hidden="true">
                {Array.from({ length: 16 }, (_, i) => (
                  <i key={i} className={`${steps.has(i) ? 'hit' : ''} ${i === step ? 'now' : ''} ${i % 4 === 0 ? 'beat' : ''}`} />
                ))}
              </div>
              <div className="layer__variants" role="radiogroup" aria-label={`${name} variation`}>
                {variants.map((v, i) => (
                  <button key={v} role="radio" aria-checked={L.variant === i} className={L.variant === i ? 'is-on' : ''} onClick={() => setLayer(ch.id, kind, { variant: i, on: true })}>{v}</button>
                ))}
              </div>
              <span className="layer__by" title={`Last changed by ${firstName(L.by)}`}>{by && <Avatar artist={by} size={22} />}<small>{firstName(L.by)}</small></span>
            </li>
          );
        })}
      </ol>

      <div className="session__foot">
        <span className="muted small">{s.takeIds.length ? `${s.takeIds.length} take${s.takeIds.length > 1 ? 's' : ''} saved to the collaboration` : 'Nothing saved yet'}</span>
        <div className="row-gap">
          <Button variant="ghost" onClick={() => endSession(ch.id)}>End session</Button>
          <Button variant="primary" icon="check" onClick={() => { setTakeName(s.takeIds.length ? '' : 'Untitled Collab'); setSaving(true); }}>Save take</Button>
        </div>
      </div>

      <Sheet open={saving} onClose={() => setSaving(false)} title="Save this take">
        <p className="muted">Freezes the current layers at {s.tempo} BPM in {s.key}. Credited to {ch.participantIds.map((p) => (p === me() ? 'you' : ARTIST_BY_ID[p]?.name)).join(' and ')}.</p>
        <label className="field"><span>Take name</span><input id="take-name" value={takeName} onChange={(e) => setTakeName(e.target.value)} placeholder={`Session take ${s.takeIds.length + 1}`} autoFocus /></label>
        <div className="row-gap">
          <Button variant="primary" icon="check" onClick={() => {
            const { collabId } = saveTake(ch.id, takeName);
            reactTo(ch.id, { type: 'take' });
            setSaving(false);
            toast('Take saved to your collaboration', { tone: 'green', action: { label: 'Open', href: href(`collabs/${collabId}`) } });
          }}>Save take</Button>
          <Button variant="ghost" onClick={() => setSaving(false)}>Cancel</Button>
        </div>
      </Sheet>
    </div>
  );
}
