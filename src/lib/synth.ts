import type { SessionLayers, Track } from '../types';
import { parseKey, rng } from './music';

/**
 * Demo audio. Every fictional track is rendered live with the Web Audio API
 * from its own tempo and key, so listening together actually makes sound
 * without shipping audio files. Each track gets a seeded arrangement.
 */

const MINOR_PROG: [number, boolean][] = [[0, true], [8, false], [3, false], [10, false]]; // i VI III VII
const MAJOR_PROG: [number, boolean][] = [[0, false], [7, false], [9, true], [5, false]]; // I V vi IV
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export class SynthEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private timer: number | null = null;
  private nextStepTime = 0;
  private step = 0;
  private track: Track | null = null;
  private pattern: { kick: boolean[]; snare: boolean[]; hat: boolean[]; arp: boolean[]; arpOrder: number[] } | null = null;
  private volume = 0.7;
  private noise: AudioBuffer | null = null;
  playingId: string | null = null;
  /** When set, the arrangement comes from live layer settings (Live Session). Read every step, so edits are heard instantly. */
  layersFn: (() => SessionLayers | null) | null = null;
  /** Current 16th-note step, for playhead visuals. */
  get currentStep() { return this.step; }

  private ensure() {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume * 0.5;
    const comp = this.ctx.createDynamicsCompressor();
    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 9000;
    this.master.connect(this.filter).connect(comp).connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 0.5;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return this.ctx;
  }

  /** Call from a user gesture so browsers allow sound. */
  unlock() {
    const ctx = this.ensure();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  get unlocked() { return this.ctx?.state === 'running'; }

  setVolume(v: number) {
    this.volume = v;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(v * 0.5, this.ctx.currentTime, 0.05);
  }

  play(track: Track, offsetMs: number, layersFn: (() => SessionLayers | null) | null = null) {
    this.layersFn = layersFn;
    const ctx = this.ensure();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    this.stopScheduler();
    this.track = track;
    this.playingId = track.id;
    const r = rng(track.cover.seed || 1);
    const pick = (p: number) => Array.from({ length: 16 }, () => r() < p);
    const kick = Array.from({ length: 16 }, (_, i) => i % 8 === 0 || (i === 10 && r() > 0.4) || (i === 6 && r() > 0.7));
    const snare = Array.from({ length: 16 }, (_, i) => i === 4 || i === 12);
    const hat = Array.from({ length: 16 }, (_, i) => i % 2 === 1 || (r() > 0.75));
    this.pattern = { kick, snare, hat, arp: pick(0.55), arpOrder: [0, 1, 2, 1, 2, 0, 2, 1].sort(() => r() - 0.5) };
    const stepDur = this.stepDur();
    this.step = Math.floor(offsetMs / 1000 / stepDur);
    this.nextStepTime = ctx.currentTime + 0.06;
    this.timer = window.setInterval(() => this.schedule(), 40);
    this.schedule();
  }

  stop() {
    this.stopScheduler();
    this.playingId = null;
  }

  private stopScheduler() {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }

  private stepDur() {
    const bpm = this.track?.tempo || 100;
    return 60 / bpm / 4;
  }

  private schedule() {
    const ctx = this.ctx!;
    const dur = this.stepDur();
    while (this.nextStepTime < ctx.currentTime + 0.2) {
      this.playStep(this.step, this.nextStepTime, dur);
      this.nextStepTime += dur;
      this.step++;
    }
  }

  private playStep(step: number, t: number, dur: number) {
    if (!this.track || !this.pattern) return;
    const s = step % 16;
    const bar = Math.floor(step / 16);
    const { pc, minor } = parseKey(this.track.key || 'A minor');
    const prog = minor ? MINOR_PROG : MAJOR_PROG;
    const [off, chordMinor] = prog[bar % 4];
    const root = 45 + ((pc + off) % 12); // around A2
    const chord = [0, chordMinor ? 3 : 4, 7].map((x) => root + 12 + x);
    const demo = this.track.isDemo;
    const intro = bar < 2;
    const L = this.layersFn?.();
    if (L) return this.sessionStep(L, s, t, dur, root, chord);

    if (s === 0) this.pad(chord, t, dur * 16, demo);
    if (!intro) {
      if (this.pattern.kick[s]) this.kick(t);
      if (this.pattern.snare[s]) this.snare(t);
      if (this.pattern.hat[s]) this.hat(t, s % 4 === 2 ? 0.05 : 0.025);
      if (s === 0 || s === 8 || (s === 14 && bar % 2)) this.bass(root - 12, t, dur * (s === 14 ? 2 : 6));
    }
    if (s % 2 === 0 && this.pattern.arp[s] && bar % 8 !== 7) {
      const n = chord[this.pattern.arpOrder[(s / 2) % 8] % 3] + 12;
      this.pluck(n, t, demo);
    }
  }

  /** Live Session arrangement: four layers, three variants each. */
  private sessionStep(L: SessionLayers, s: number, t: number, dur: number, root: number, chord: number[]) {
    const d = L.drums, b = L.bass, c = L.chords, m = L.topline;
    if (d.on) {
      const kick = [[0, 8], [0, 10], [0, 3, 8, 11]][d.variant];
      const snare = [[4, 12], [8], [4, 12, 14]][d.variant];
      if (kick.includes(s)) this.kick(t);
      if (snare.includes(s)) this.snare(t);
      const hat = d.variant === 2 ? true : d.variant === 1 ? s % 4 === 2 : s % 2 === 1;
      if (hat) this.hat(t, s % 4 === 2 ? 0.05 : 0.025);
    }
    if (b.on) {
      if (b.variant === 0 && (s === 0 || s === 8)) this.bass(root - 12, t, dur * 6);
      if (b.variant === 1 && [0, 3, 6, 10].includes(s)) this.bass(root - 12 + (s === 6 ? 7 : 0), t, dur * 2.5);
      if (b.variant === 2 && s % 2 === 0) this.bass(root - 12 + (s % 4 === 2 ? 12 : 0), t, dur * 1.5);
    }
    if (c.on) {
      if (c.variant === 0 && s === 0) this.pad(chord, t, dur * 16);
      if (c.variant === 1 && [2, 6, 10, 14].includes(s)) chord.forEach((n) => this.pluck(n, t, true));
      if (c.variant === 2 && s % 2 === 0) this.pluck(chord[(s / 2) % 3] + 12, t);
    }
    if (m.on) {
      const scale = [0, 3, 5, 7, 10, 12, 15];
      const at = [[0, 6, 12], [0, 2, 4, 6, 8, 10, 12, 14], [0, 4, 10]][m.variant];
      if (at.includes(s)) {
        const n = root + 24 + scale[(s * 5 + Math.floor(this.step / 16) * 2) % scale.length] + (m.variant === 2 ? 12 : 0);
        this.pluck(n, t, m.variant !== 1);
      }
    }
  }

  private env(g: GainNode, t: number, a: number, peak: number, d: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  private pad(notes: number[], t: number, len: number, warm = false) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = warm ? 900 : 1400;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.06, t + 0.4);
    g.gain.setValueAtTime(0.06, t + len - 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    f.connect(g).connect(this.master!);
    for (const n of notes) for (const det of [-7, 7]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = mtof(n);
      o.detune.value = det;
      o.connect(f);
      o.start(t);
      o.stop(t + len + 0.05);
    }
  }

  private pluck(n: number, t: number, soft = false) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = soft ? 'sine' : 'triangle';
    o.frequency.value = mtof(n);
    this.env(g, t, 0.005, 0.08, 0.35);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + 0.45);
  }

  private bass(n: number, t: number, len: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = mtof(n);
    this.env(g, t, 0.01, 0.22, Math.min(len, 0.8));
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + len + 0.1);
  }

  private kick(t: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    this.env(g, t, 0.002, 0.55, 0.28);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + 0.32);
  }

  private snare(t: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1800;
    const g = ctx.createGain();
    this.env(g, t, 0.002, 0.18, 0.16);
    src.connect(f).connect(g).connect(this.master!);
    src.start(t);
    src.stop(t + 0.2);
  }

  private hat(t: number, level: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7000;
    const g = ctx.createGain();
    this.env(g, t, 0.001, level, 0.05);
    src.connect(f).connect(g).connect(this.master!);
    src.start(t);
    src.stop(t + 0.07);
  }
}

export const synth = new SynthEngine();
