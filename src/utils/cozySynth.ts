/**
 * Zero-dependency Web Audio API cozy pastoral music-box synthesizer.
 * Plays a gentle Stardew-inspired pentatonic melody + soft warm pad so
 * users can enjoy relaxing music immediately even if their local Music folder is empty.
 */
class CozyPastoralSynth {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private timer: number | null = null;
  private step = 0;
  private running = false;
  private volume = 0.65;

  // Warm C-major / A-minor pastoral pentatonic progression (Hz)
  private readonly melody: (number | null)[] = [
    523.25, 659.25, 783.99, null, 880.0, 783.99, 659.25, null,
    587.33, 659.25, 783.99, 659.25, 523.25, null, 392.0, null,
    440.0, 523.25, 659.25, null, 783.99, 659.25, 587.33, null,
    523.25, 587.33, 659.25, 523.25, 392.0, null, null, null,
  ];

  private readonly bass: (number | null)[] = [
    261.63, null, null, null, 220.0, null, null, null,
    174.61, null, null, null, 196.0, null, null, null,
    220.0, null, null, null, 174.61, null, null, null,
    196.0, null, null, null, 261.63, null, null, null,
  ];

  private ensureContext() {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume * 0.22;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }

  private playTone(freq: number, duration: number, type: OscillatorType, gainAmt: number) {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(gainAmt, now + 0.035);
    env.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(env);
    env.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + duration + 0.04);
  }

  public start() {
    if (this.running) return;
    this.ensureContext();
    this.running = true;

    const tick = () => {
      if (!this.running) return;
      const idx = this.step % this.melody.length;
      const m = this.melody[idx];
      const b = this.bass[idx];
      if (m) {
        this.playTone(m, 0.72, "triangle", 0.55);
        this.playTone(m * 2, 0.35, "sine", 0.14); // Soft bell shimmer
      }
      if (b) {
        this.playTone(b, 1.55, "sine", 0.42);
      }
      this.step++;
    };

    tick();
    this.timer = window.setInterval(tick, 430);
  }

  public stop() {
    this.running = false;
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  public setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volume * 0.22, this.ctx.currentTime, 0.05);
    }
  }

  public isRunning(): boolean {
    return this.running;
  }
}

export const cozySynth = new CozyPastoralSynth();
