import { AmbientSoundManager } from './ambience';

/**
 * 100% Procedural 3D/4D Spatial Web Audio Synthesizer for Ghats of Wayanad.
 * Features stereo 3D lane panning (StereoPannerNode), 4D Chrono-Shift time-dilation
 * resonance, rolling Western Ghats thunderclaps, haptic feedback pulses, and
 * dynamic Wayanad biome soundscapes.
 */
export class WayanadAudio {
  private ctx: AudioContext | null = null;
  private muted = false;
  private hapticsEnabled = true;
  private noiseBuffer: AudioBuffer | null = null;
  private whiteBuffer: AudioBuffer | null = null;
  public readonly ambience = new AmbientSoundManager();

  public isMuted(): boolean {
    return this.muted;
  }

  public setHapticsEnabled(enabled: boolean): void {
    this.hapticsEnabled = enabled;
  }

  public vibrate(pattern: number | number[]): void {
    if (this.muted || !this.hapticsEnabled) return;
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(pattern);
      }
    } catch {
      // Ignore in unsupported browsers
    }
  }

  public setMuted(mute: boolean): void {
    this.muted = mute;
    this.ambience.setMuted(mute);
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    this.ambience.setMuted(this.muted);
    if (!this.muted) {
      this.ensureContext();
    }
    return this.muted;
  }

  private connectWithPan(node: AudioNode, ctx: AudioContext, pan = 0): void {
    if (typeof ctx.createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      node.connect(panner);
      panner.connect(ctx.destination);
    } else {
      node.connect(ctx.destination);
    }
  }

  private ensureContext(): AudioContext | null {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (this.ctx && (!this.noiseBuffer || !this.whiteBuffer)) {
      const sampleRate = this.ctx.sampleRate;
      const length = Math.floor(sampleRate * 2.4);

      const pinkBuf = this.ctx.createBuffer(1, length, sampleRate);
      const pinkData = pinkBuf.getChannelData(0);

      const whiteBuf = this.ctx.createBuffer(1, length, sampleRate);
      const whiteData = whiteBuf.getChannelData(0);

      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        whiteData[i] = white * 0.25;
        b0 = 0.99765 * b0 + white * 0.099046;
        b1 = 0.963 * b1 + white * 0.2965164;
        b2 = 0.57 * b2 + white * 1.0526913;
        pinkData[i] = (b0 + b1 + b2 + white * 0.1848) * 0.18;
      }
      this.noiseBuffer = pinkBuf;
      this.whiteBuffer = whiteBuf;
    }

    if (this.ctx && this.noiseBuffer && this.whiteBuffer) {
      this.ambience.attachContext(this.ctx, this.noiseBuffer, this.whiteBuffer);
      this.ambience.setMuted(this.muted);
    }

    if (this.muted) return null;
    return this.ctx;
  }

  public unlock(): void {
    this.ensureContext();
  }

  public dispose(): void {
    this.ambience.dispose();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }

  /** Spatial 3D panned gold coin ring */
  public playCoinCollect(chainIndex: number, lanePan = 0): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const scale = [
      783.99, 880.0, 987.77, 1174.66, 1318.51, 1567.98, 1760.0, 1975.53,
    ];
    const base = scale[Math.min(chainIndex, scale.length - 1)];

    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(base, now);
    osc1.frequency.setValueAtTime(base * 1.5, now + 0.045);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc1.connect(gain);
    this.connectWithPan(gain, ctx, lanePan * 0.55);
    osc1.start(now);
    osc1.stop(now + 0.24);
  }

  /** Spatial lateral swoosh when switching lanes */
  public playLaneSwitch(lanePan = 0): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.whiteBuffer) return;
    const now = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = this.whiteBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(750, now);
    filter.frequency.exponentialRampToValueAtTime(1650, now + 0.08);
    filter.Q.value = 1.8;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.11, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);

    src.connect(filter);
    filter.connect(gain);
    this.connectWithPan(gain, ctx, lanePan * 0.65);
    src.start(now);
    src.stop(now + 0.09);
  }

  public playJump(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(185, now);
    osc.frequency.exponentialRampToValueAtTime(460, now + 0.14);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.16, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.17);
  }

  public playSlide(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(920, now);
    filter.frequency.exponentialRampToValueAtTime(280, now + 0.24);
    filter.Q.value = 1.4;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.22, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
    src.stop(now + 0.26);
  }

  public playPowerup(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [440, 554.37, 659.25, 880, 1108.73];
    notes.forEach((f, idx) => {
      const t = now + idx * 0.045;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, t);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.14, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.32);
    });
    this.vibrate(25);
  }

  /** Soft two-note highland milestone chime every 100m when pace gently steps up */
  public playSpeedMilestone(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25];
    notes.forEach((f, idx) => {
      const t = now + idx * 0.07;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.065, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.26);
    });
  }

  /** 4D Chrono-Shift Time-Warp sub-drop & crystalline harmonic shimmer */
  public playChronoShift(entering: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(entering ? 220 : 68, now);
    sub.frequency.exponentialRampToValueAtTime(entering ? 52 : 210, now + 0.48);

    const sGain = ctx.createGain();
    sGain.gain.setValueAtTime(0.001, now);
    sGain.gain.linearRampToValueAtTime(0.28, now + 0.04);
    sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.52);

    sub.connect(sGain);
    sGain.connect(ctx.destination);
    sub.start(now);
    sub.stop(now + 0.55);

    const chord = entering ? [880, 659.25, 523.25] : [523.25, 659.25, 880];
    chord.forEach((f, i) => {
      const t = now + i * 0.055;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.09, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
      osc.connect(g);
      this.connectWithPan(g, ctx, (i - 1) * 0.5);
      osc.start(t);
      osc.stop(t + 0.4);
    });
    this.vibrate(entering ? [20, 30, 40] : 20);
  }

  /** 4D Monsoon Storm Rolling Thunderclap with 3D stereo sky panning */
  public playThunderclap(pan = 0): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(340, now);
    filter.frequency.exponentialRampToValueAtTime(68, now + 1.65);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.26, now + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.09, now + 0.38);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.7);

    src.connect(filter);
    filter.connect(gain);
    this.connectWithPan(gain, ctx, pan);
    src.start(now, Math.random() * 0.6);
    src.stop(now + 1.75);
    this.vibrate([18, 40, 25]);
  }

  public playMonsterRoar(intensity = 1.0): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(118, now);
    osc.frequency.linearRampToValueAtTime(142, now + 0.12);
    osc.frequency.exponentialRampToValueAtTime(52, now + 0.65);

    const formant = ctx.createBiquadFilter();
    formant.type = 'lowpass';
    formant.frequency.setValueAtTime(480, now);
    formant.frequency.exponentialRampToValueAtTime(145, now + 0.62);
    formant.Q.value = 3.5;

    const oGain = ctx.createGain();
    oGain.gain.setValueAtTime(0.001, now);
    oGain.gain.linearRampToValueAtTime(0.24 * intensity, now + 0.06);
    oGain.gain.exponentialRampToValueAtTime(0.001, now + 0.68);

    osc.connect(formant);
    formant.connect(oGain);
    oGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.7);

    const breath = ctx.createBufferSource();
    breath.buffer = this.noiseBuffer;
    const bFilter = ctx.createBiquadFilter();
    bFilter.type = 'bandpass';
    bFilter.frequency.setValueAtTime(310, now);
    bFilter.frequency.exponentialRampToValueAtTime(135, now + 0.6);
    bFilter.Q.value = 1.6;

    const bGain = ctx.createGain();
    bGain.gain.setValueAtTime(0.001, now);
    bGain.gain.linearRampToValueAtTime(0.22 * intensity, now + 0.08);
    bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.62);

    breath.connect(bFilter);
    bFilter.connect(bGain);
    bGain.connect(ctx.destination);
    breath.start(now);
    breath.stop(now + 0.65);

    this.vibrate([35, 30, 55]);
  }

  public playMonsterFootstep(proximity: number, pan = 0): void {
    if (proximity < 0.45) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(84, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.13);

    const gain = ctx.createGain();
    const vol = (proximity - 0.4) * 0.25;
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(gain);
    this.connectWithPan(gain, ctx, pan * 0.5);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  public playStumbleImpact(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(36, now + 0.26);

    const oGain = ctx.createGain();
    oGain.gain.setValueAtTime(0.32, now);
    oGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(oGain);
    oGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.3);

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(680, now);
    filter.frequency.exponentialRampToValueAtTime(160, now + 0.24);

    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.28, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.26);
    this.vibrate([45, 25, 45]);
  }

  public playTuskerTrumpet(pan = 0): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(185, now);
    osc.frequency.exponentialRampToValueAtTime(365, now + 0.16);
    osc.frequency.exponentialRampToValueAtTime(260, now + 0.42);

    const formant = ctx.createBiquadFilter();
    formant.type = 'bandpass';
    formant.frequency.setValueAtTime(720, now);
    formant.frequency.linearRampToValueAtTime(1080, now + 0.18);
    formant.Q.value = 3.0;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.44);

    osc.connect(formant);
    formant.connect(gain);
    this.connectWithPan(gain, ctx, pan * 0.6);
    osc.start(now);
    osc.stop(now + 0.46);
  }
}
