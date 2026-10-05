/**
 * VoiceService — the "talk" half of an Audio Channel.
 *
 * Production: WebRTC through an SFU (selective forwarding unit) with the
 * channel's participants as the only subscribers. That needs signalling and
 * media servers, which this prototype deliberately doesn't run.
 *
 * DemoVoiceService: your microphone is real (local level metering, so the
 * speaking ring reacts to your voice), nothing is transmitted, and the other
 * artist's voice activity is simulated.
 */
export interface VoiceService {
  readonly transport: 'demo' | 'webrtc';
  unmute(): Promise<boolean>; // false → mic unavailable, voice stays simulated
  mute(): void;
  level(): number; // 0–1 local input level
}

class DemoVoiceService implements VoiceService {
  readonly transport = 'demo' as const;
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private buf = new Uint8Array(256);

  async unmute(): Promise<boolean> {
    if (this.stream) { this.stream.getAudioTracks().forEach((t) => (t.enabled = true)); return true; }
    try {
      if (!navigator.mediaDevices?.getUserMedia) return false;
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AC();
      const src = this.ctx.createMediaStreamSource(this.stream);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 512;
      src.connect(this.analyser); // analysis only — never routed to speakers
      return true;
    } catch {
      return false;
    }
  }

  mute() {
    this.stream?.getAudioTracks().forEach((t) => (t.enabled = false));
  }

  level(): number {
    if (!this.analyser || !this.stream?.getAudioTracks()[0]?.enabled) return 0;
    this.analyser.getByteTimeDomainData(this.buf);
    let sum = 0;
    for (const v of this.buf) { const x = (v - 128) / 128; sum += x * x; }
    return Math.min(1, Math.sqrt(sum / this.buf.length) * 6);
  }
}

export const voice: VoiceService = new DemoVoiceService();
