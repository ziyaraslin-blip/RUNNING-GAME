import { LandmarkType } from './types';

export interface AmbienceDynamicState {
  landmark: LandmarkType;
  pausedOrModal: boolean;
  hazardActive: boolean;
  solarAligned: boolean;
  waterAligned: boolean;
  convoyRunning: boolean;
}

interface ActiveBedNodes {
  landmark: LandmarkType;
  masterBedGain: GainNode;
  primaryFilter: BiquadFilterNode;
  secondaryGain: GainNode;
  harmonicGain: GainNode | null;
  stopAndDisconnect: () => void;
}

export const LANDMARK_SOUNDSCAPE_LABELS: Record<LandmarkType, string> = {
  [LandmarkType.LakkidiViewpoint]: 'Highland Mist Wind & Chain-Tree Chimes',
  [LandmarkType.ChembraHeartLake]: 'Meppadi Tea-Estate Songbirds & Breeze',
  [LandmarkType.EdakkalCaves]: 'Cavernous Granite Echoes & Cave Drips',
  [LandmarkType.SoochiparaFalls]: 'Monsoon Rainfall & Cascade Roar',
  [LandmarkType.KuruvadweepIslands]: 'Kabini River Currents & Bamboo Grove',
  [LandmarkType.BanasuraDam]: 'Summit Squall & Reservoir Spillways',
};

/**
 * Dynamic Procedural Web Audio Ambient Soundscape Manager for Wayanad.
 * Synthesizes continuous environmental beds (monsoon rain, waterfalls, mist winds,
 * river currents, cave acoustics) and stochastic biome micro-events (tea-estate
 * whistling thrushes, bulbuls, barbets, leaf raindrops, cave drips, bamboo creaks)
 * with smooth stage crossfading and live puzzle-state reactivity.
 */
export class AmbientSoundManager {
  private ctx: AudioContext | null = null;
  private pinkBuffer: AudioBuffer | null = null;
  private whiteBuffer: AudioBuffer | null = null;

  private masterGain: GainNode | null = null;
  private currentBed: ActiveBedNodes | null = null;
  private fadingBeds: Array<{ bed: ActiveBedNodes; cleanupAt: number }> = [];

  private volume = 0.75; // User slider 0..1
  private muted = false;
  private desiredLandmark: LandmarkType = LandmarkType.LakkidiViewpoint;

  // Timers for stochastic procedural micro-events (birds, raindrops, drips, bamboo)
  private nextPrimaryEventTimer = 0.8;
  private nextSecondaryEventTimer = 1.6;
  private disposed = false;

  public attachContext(
    ctx: AudioContext,
    pinkBuffer: AudioBuffer,
    whiteBuffer: AudioBuffer
  ): void {
    if (this.disposed) return;
    if (this.ctx === ctx && this.masterGain) return;

    this.ctx = ctx;
    this.pinkBuffer = pinkBuffer;
    this.whiteBuffer = whiteBuffer;

    this.masterGain = ctx.createGain();
    this.masterGain.gain.setValueAtTime(
      this.muted ? 0.0001 : this.volume,
      ctx.currentTime
    );
    this.masterGain.connect(ctx.destination);

    // Immediately spin up the active stage soundscape bed
    this.transitionToLandmark(this.desiredLandmark, true);
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setTargetAtTime(
      muted ? 0.0001 : Math.max(0.0001, this.volume),
      now,
      0.08
    );
  }

  public setVolume(unitVolume: number): void {
    this.volume = Math.max(0, Math.min(1, unitVolume));
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setTargetAtTime(
      Math.max(0.0001, this.volume),
      now,
      0.06
    );
  }

  public getVolumePercent(): number {
    return Math.round(this.volume * 100);
  }

  public transitionToLandmark(landmark: LandmarkType, immediate = false): void {
    this.desiredLandmark = landmark;
    if (!this.ctx || !this.masterGain || !this.pinkBuffer || !this.whiteBuffer) {
      return;
    }
    if (this.currentBed && this.currentBed.landmark === landmark) {
      return;
    }

    const now = this.ctx.currentTime;
    const fadeSeconds = immediate ? 0.15 : 1.25;

    // Crossfade out existing bed cleanly
    if (this.currentBed) {
      const oldBed = this.currentBed;
      oldBed.masterBedGain.gain.cancelScheduledValues(now);
      oldBed.masterBedGain.gain.setValueAtTime(
        Math.max(0.0001, oldBed.masterBedGain.gain.value),
        now
      );
      oldBed.masterBedGain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + fadeSeconds
      );
      this.fadingBeds.push({
        bed: oldBed,
        cleanupAt: performance.now() + (fadeSeconds + 0.2) * 1000,
      });
      this.currentBed = null;
    }

    // Build and fade in the new Wayanad biome soundscape bed
    const newBed = this.buildStageBed(landmark);
    newBed.masterBedGain.gain.setValueAtTime(0.0001, now);
    newBed.masterBedGain.gain.exponentialRampToValueAtTime(
      1.0,
      now + fadeSeconds
    );
    this.currentBed = newBed;

    // Reset event timers so the player hears signature biome character right away
    this.nextPrimaryEventTimer = 0.45;
    this.nextSecondaryEventTimer = 1.2;
  }

  private buildStageBed(landmark: LandmarkType): ActiveBedNodes {
    const ctx = this.ctx!;
    const now = ctx.currentTime;
    const masterBedGain = ctx.createGain();
    masterBedGain.connect(this.masterGain!);

    const disposableSources: AudioScheduledSourceNode[] = [];
    const disposableNodes: AudioNode[] = [masterBedGain];

    const makeLoopingNoise = (useWhite: boolean): AudioBufferSourceNode => {
      const src = ctx.createBufferSource();
      src.buffer = useWhite ? this.whiteBuffer! : this.pinkBuffer!;
      src.loop = true;
      // Offset randomly so parallel layers never phase-comb
      src.start(now, Math.random() * 1.5);
      disposableSources.push(src);
      disposableNodes.push(src);
      return src;
    };

    const primaryFilter = ctx.createBiquadFilter();
    const secondaryGain = ctx.createGain();
    let harmonicGain: GainNode | null = null;
    disposableNodes.push(primaryFilter, secondaryGain);

    switch (landmark) {
      case LandmarkType.LakkidiViewpoint: {
        // Misty Churam Wind (slow LFO bandpass sweep) + Gentle Highland Valley Air
        const windSrc = makeLoopingNoise(false);
        primaryFilter.type = 'bandpass';
        primaryFilter.frequency.setValueAtTime(260, now);
        primaryFilter.Q.value = 1.8;

        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.11;
        const lfoDepth = ctx.createGain();
        lfoDepth.gain.value = 110;
        lfo.connect(lfoDepth);
        lfoDepth.connect(primaryFilter.frequency);
        lfo.start(now);
        disposableSources.push(lfo);
        disposableNodes.push(lfo, lfoDepth);

        const windGain = ctx.createGain();
        windGain.gain.value = 0.22;
        windSrc.connect(primaryFilter);
        primaryFilter.connect(windGain);
        windGain.connect(masterBedGain);
        disposableNodes.push(windGain);

        // Secondary rustling banyan canopy layer
        const leafSrc = makeLoopingNoise(true);
        const leafFilter = ctx.createBiquadFilter();
        leafFilter.type = 'bandpass';
        leafFilter.frequency.value = 1850;
        leafFilter.Q.value = 1.1;
        secondaryGain.gain.value = 0.025;
        leafSrc.connect(leafFilter);
        leafFilter.connect(secondaryGain);
        secondaryGain.connect(masterBedGain);
        disposableNodes.push(leafFilter);
        break;
      }

      case LandmarkType.ChembraHeartLake: {
        // Meppadi Tea Estates: Soft High-Altitude Breeze + Hridaya Saras Lake Lapping
        const breezeSrc = makeLoopingNoise(false);
        primaryFilter.type = 'bandpass';
        primaryFilter.frequency.value = 480;
        primaryFilter.Q.value = 1.2;

        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.08;
        const lfoDepth = ctx.createGain();
        lfoDepth.gain.value = 140;
        lfo.connect(lfoDepth);
        lfoDepth.connect(primaryFilter.frequency);
        lfo.start(now);
        disposableSources.push(lfo);
        disposableNodes.push(lfo, lfoDepth);

        const breezeGain = ctx.createGain();
        breezeGain.gain.value = 0.14;
        breezeSrc.connect(primaryFilter);
        primaryFilter.connect(breezeGain);
        breezeGain.connect(masterBedGain);
        disposableNodes.push(breezeGain);

        // Gentle Heart-Lake water shimmer
        const lakeSrc = makeLoopingNoise(false);
        const lakeFilter = ctx.createBiquadFilter();
        lakeFilter.type = 'lowpass';
        lakeFilter.frequency.value = 340;
        secondaryGain.gain.value = 0.08;
        lakeSrc.connect(lakeFilter);
        lakeFilter.connect(secondaryGain);
        secondaryGain.connect(masterBedGain);
        disposableNodes.push(lakeFilter);
        break;
      }

      case LandmarkType.EdakkalCaves: {
        // Cavernous Granite Resonance + Solar Prism Harmonic Singing Drone
        const caveSrc = makeLoopingNoise(false);
        primaryFilter.type = 'bandpass';
        primaryFilter.frequency.value = 145;
        primaryFilter.Q.value = 4.2;

        const caveGain = ctx.createGain();
        caveGain.gain.value = 0.26;
        caveSrc.connect(primaryFilter);
        primaryFilter.connect(caveGain);
        caveGain.connect(masterBedGain);
        disposableNodes.push(caveGain);

        // Rocky cleft draft
        const draftSrc = makeLoopingNoise(false);
        const draftFilter = ctx.createBiquadFilter();
        draftFilter.type = 'bandpass';
        draftFilter.frequency.value = 620;
        draftFilter.Q.value = 2.6;
        secondaryGain.gain.value = 0.05;
        draftSrc.connect(draftFilter);
        draftFilter.connect(secondaryGain);
        secondaryGain.connect(masterBedGain);
        disposableNodes.push(draftFilter);

        // Ethereal Solar Petroglyph Resonance (swells when Solar Prism aligns!)
        harmonicGain = ctx.createGain();
        harmonicGain.gain.value = 0.001;
        for (const freq of [220, 329.63, 440]) {
          const osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.value = freq;
          const g = ctx.createGain();
          g.gain.value = freq === 440 ? 0.015 : 0.028;
          osc.connect(g);
          g.connect(harmonicGain);
          osc.start(now);
          disposableSources.push(osc);
          disposableNodes.push(osc, g);
        }
        harmonicGain.connect(masterBedGain);
        disposableNodes.push(harmonicGain);
        break;
      }

      case LandmarkType.SoochiparaFalls: {
        // Monsoon Rainfall Patter + Three-Tiered Waterfall Cascade Roar!
        // Layer 1: Steady Rainfall Sheet (white noise sculpted around 1.8kHz - 3.8kHz)
        const rainSrc = makeLoopingNoise(true);
        primaryFilter.type = 'bandpass';
        primaryFilter.frequency.value = 2100;
        primaryFilter.Q.value = 0.75;

        const rainLfo = ctx.createOscillator();
        rainLfo.type = 'sine';
        rainLfo.frequency.value = 0.14;
        const rainLfoGain = ctx.createGain();
        rainLfoGain.gain.value = 380;
        rainLfo.connect(rainLfoGain);
        rainLfoGain.connect(primaryFilter.frequency);
        rainLfo.start(now);
        disposableSources.push(rainLfo);
        disposableNodes.push(rainLfo, rainLfoGain);

        const rainGain = ctx.createGain();
        rainGain.gain.value = 0.085;
        rainSrc.connect(primaryFilter);
        primaryFilter.connect(rainGain);
        rainGain.connect(masterBedGain);
        disposableNodes.push(rainGain);

        // Layer 2: Deep Soochipara Plunge-Pool Cascade Roar (swells when Water Sluice connects!)
        const fallsSrc = makeLoopingNoise(false);
        const fallsFilter = ctx.createBiquadFilter();
        fallsFilter.type = 'lowpass';
        fallsFilter.frequency.value = 360;
        secondaryGain.gain.value = 0.24;
        fallsSrc.connect(fallsFilter);
        fallsFilter.connect(secondaryGain);
        secondaryGain.connect(masterBedGain);
        disposableNodes.push(fallsFilter);
        break;
      }

      case LandmarkType.KuruvadweepIslands: {
        // Braided Kabini River Currents + Evergreen Shola Cicada Shimmer
        const riverSrc = makeLoopingNoise(false);
        primaryFilter.type = 'bandpass';
        primaryFilter.frequency.value = 520;
        primaryFilter.Q.value = 1.5;

        const rippleLfo = ctx.createOscillator();
        rippleLfo.type = 'sine';
        rippleLfo.frequency.value = 0.32;
        const rippleDepth = ctx.createGain();
        rippleDepth.gain.value = 165;
        rippleLfo.connect(rippleDepth);
        rippleDepth.connect(primaryFilter.frequency);
        rippleLfo.start(now);
        disposableSources.push(rippleLfo);
        disposableNodes.push(rippleLfo, rippleDepth);

        const riverGain = ctx.createGain();
        riverGain.gain.value = 0.18;
        riverSrc.connect(primaryFilter);
        primaryFilter.connect(riverGain);
        riverGain.connect(masterBedGain);
        disposableNodes.push(riverGain);

        // High Shola Forest Cicada Shimmer (4.4kHz narrow bandpass modulated at 11Hz)
        const cicadaSrc = makeLoopingNoise(true);
        const cicadaFilter = ctx.createBiquadFilter();
        cicadaFilter.type = 'bandpass';
        cicadaFilter.frequency.value = 4450;
        cicadaFilter.Q.value = 8.5;
        secondaryGain.gain.value = 0.018;

        const pulseOsc = ctx.createOscillator();
        pulseOsc.type = 'sine';
        pulseOsc.frequency.value = 9.5;
        const pulseDepth = ctx.createGain();
        pulseDepth.gain.value = 0.008;
        pulseOsc.connect(pulseDepth);
        pulseDepth.connect(secondaryGain.gain);
        pulseOsc.start(now);
        disposableSources.push(pulseOsc);

        cicadaSrc.connect(cicadaFilter);
        cicadaFilter.connect(secondaryGain);
        secondaryGain.connect(masterBedGain);
        disposableNodes.push(cicadaFilter, pulseOsc, pulseDepth);
        break;
      }

      case LandmarkType.BanasuraDam: {
        // Summit Squall + Dam Spillway Surge + Astrolabe Harmonic Convergence
        const squallSrc = makeLoopingNoise(true);
        primaryFilter.type = 'bandpass';
        primaryFilter.frequency.value = 1350;
        primaryFilter.Q.value = 0.85;

        const squallGain = ctx.createGain();
        squallGain.gain.value = 0.065;
        squallSrc.connect(primaryFilter);
        primaryFilter.connect(squallGain);
        squallGain.connect(masterBedGain);
        disposableNodes.push(squallGain);

        // Earthen Dam Spillway Surge
        const damSrc = makeLoopingNoise(false);
        const damFilter = ctx.createBiquadFilter();
        damFilter.type = 'lowpass';
        damFilter.frequency.value = 310;
        secondaryGain.gain.value = 0.22;
        damSrc.connect(damFilter);
        damFilter.connect(secondaryGain);
        secondaryGain.connect(masterBedGain);
        disposableNodes.push(damFilter);

        // Astrolabe Harmonic Fifth
        harmonicGain = ctx.createGain();
        harmonicGain.gain.value = 0.001;
        for (const freq of [196.0, 293.66, 392.0]) {
          const osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.value = freq;
          const g = ctx.createGain();
          g.gain.value = 0.022;
          osc.connect(g);
          g.connect(harmonicGain);
          osc.start(now);
          disposableSources.push(osc);
          disposableNodes.push(osc, g);
        }
        harmonicGain.connect(masterBedGain);
        disposableNodes.push(harmonicGain);
        break;
      }
    }

    return {
      landmark,
      masterBedGain,
      primaryFilter,
      secondaryGain,
      harmonicGain,
      stopAndDisconnect: () => {
        for (const s of disposableSources) {
          try {
            s.stop();
          } catch {
            // Already stopped
          }
        }
        for (const n of disposableNodes) {
          try {
            n.disconnect();
          } catch {
            // Already disconnected
          }
        }
      },
    };
  }

  /**
   * Per-frame update called from the 60fps simulation engine.
   * Cleans up finished crossfades, modulates filter/gain targets based on live game state,
   * and triggers stochastic Wayanad birdsong, leaf raindrops, cave drips, and bamboo creaks.
   */
  public update(dt: number, state: AmbienceDynamicState): void {
    if (this.disposed) return;

    if (state.landmark !== this.desiredLandmark) {
      this.transitionToLandmark(state.landmark, false);
    }

    if (!this.ctx || !this.currentBed || this.muted || this.volume <= 0.01) {
      return;
    }

    // Reap completed crossfade beds
    const nowMs = performance.now();
    for (let i = this.fadingBeds.length - 1; i >= 0; i--) {
      if (nowMs >= this.fadingBeds[i].cleanupAt) {
        this.fadingBeds[i].bed.stopAndDisconnect();
        this.fadingBeds.splice(i, 1);
      }
    }

    const now = this.ctx.currentTime;
    const bed = this.currentBed;

    // 1. Duck smoothly on Pause / Modal, boost slightly on Hazard Windup!
    const targetBedLevel = state.pausedOrModal
      ? 0.34
      : state.hazardActive
      ? 1.25
      : 1.0;
    bed.masterBedGain.gain.setTargetAtTime(targetBedLevel, now, 0.25);

    // 2. React to Solar Prism Alignment (Edakkal & Banasura)
    if (bed.harmonicGain) {
      const targetHarmonic = state.solarAligned ? 0.95 : 0.001;
      bed.harmonicGain.gain.setTargetAtTime(targetHarmonic, now, 0.35);
    }

    // 3. React to Water Sluice Flow (Soochipara & Banasura)
    if (
      bed.landmark === LandmarkType.SoochiparaFalls ||
      bed.landmark === LandmarkType.BanasuraDam
    ) {
      const baseFlow = bed.landmark === LandmarkType.SoochiparaFalls ? 0.22 : 0.2;
      const targetFlow = state.waterAligned ? baseFlow * 1.48 : baseFlow;
      bed.secondaryGain.gain.setTargetAtTime(targetFlow, now, 0.3);
    }

    if (state.pausedOrModal) return;

    // 4. Stochastic Biome Micro-Events (Birds, Raindrops, Cave Drips, Bamboo Creaks)
    this.nextPrimaryEventTimer -= dt;
    if (this.nextPrimaryEventTimer <= 0) {
      this.triggerPrimaryMicroEvent(bed.landmark, state.hazardActive);
      this.nextPrimaryEventTimer = this.nextIntervalForPrimary(bed.landmark);
    }

    this.nextSecondaryEventTimer -= dt;
    if (this.nextSecondaryEventTimer <= 0) {
      this.triggerSecondaryMicroEvent(bed.landmark);
      this.nextSecondaryEventTimer = 2.4 + Math.random() * 4.2;
    }
  }

  private nextIntervalForPrimary(landmark: LandmarkType): number {
    switch (landmark) {
      case LandmarkType.ChembraHeartLake:
        return 1.3 + Math.random() * 2.5; // Frequent tea-estate songbirds!
      case LandmarkType.SoochiparaFalls:
        return 0.16 + Math.random() * 0.28; // Pattering close leaf raindrops!
      case LandmarkType.EdakkalCaves:
        return 1.1 + Math.random() * 2.4; // Echoing subterranean cave water drips!
      case LandmarkType.KuruvadweepIslands:
        return 1.6 + Math.random() * 2.8; // River birds & bamboo knocks
      case LandmarkType.BanasuraDam:
        return 0.28 + Math.random() * 0.55; // Summit rain splatters
      case LandmarkType.LakkidiViewpoint:
      default:
        return 2.0 + Math.random() * 3.2; // Distant whistling thrush in the mist
    }
  }

  private triggerPrimaryMicroEvent(
    landmark: LandmarkType,
    hazardActive: boolean
  ): void {
    if (!this.ctx || !this.masterGain) return;

    switch (landmark) {
      case LandmarkType.ChembraHeartLake: {
        // Tea-Estate Birdsong Trio: Bulbul Chirps, Malabar Whistling Thrush, or White-cheeked Barbet!
        const roll = Math.random();
        if (roll < 0.45) {
          this.playTeaEstateSongbirdPhrase();
        } else if (roll < 0.8) {
          this.playWhistlingThrushPhrase(0.065);
        } else {
          this.playMalabarBarbetCall();
        }
        break;
      }

      case LandmarkType.LakkidiViewpoint: {
        this.playWhistlingThrushPhrase(0.045);
        break;
      }

      case LandmarkType.SoochiparaFalls:
      case LandmarkType.BanasuraDam: {
        this.playLeafRaindropPatter(hazardActive ? 0.075 : 0.048);
        break;
      }

      case LandmarkType.EdakkalCaves: {
        this.playEchoingCaveDrip();
        break;
      }

      case LandmarkType.KuruvadweepIslands: {
        if (Math.random() < 0.55) {
          this.playTeaEstateSongbirdPhrase();
        } else {
          this.playBambooGroveCreak();
        }
        break;
      }
    }
  }

  private triggerSecondaryMicroEvent(landmark: LandmarkType): void {
    if (!this.ctx || !this.masterGain) return;
    if (landmark === LandmarkType.LakkidiViewpoint) {
      // Gentle metallic clink of Karinthandan's Chain-Tree swaying in the ghat mist
      this.playChainTreeClink();
    } else if (
      landmark === LandmarkType.SoochiparaFalls ||
      landmark === LandmarkType.BanasuraDam
    ) {
      // Soft distant monsoon horizon thunder murmur
      if (Math.random() < 0.45) {
        this.playDistantHorizonThunder();
      }
    } else if (landmark === LandmarkType.KuruvadweepIslands) {
      this.playBambooGroveCreak();
    }
  }

  // ==================== PROCEDURAL BIOME VOICE SYNTHESIS ====================

  /** Cheerful 2–4 noteNilgiri / Red-whiskered Bulbul chirp phrase across Meppadi tea bushes */
  private playTeaEstateSongbirdPhrase(): void {
    const ctx = this.ctx!;
    const now = ctx.currentTime;
    const notes = 2 + Math.floor(Math.random() * 3);
    const baseFreq = 2150 + Math.random() * 850;

    for (let i = 0; i < notes; i++) {
      const t = now + i * (0.085 + Math.random() * 0.05);
      const dur = 0.055 + Math.random() * 0.035;
      const fStart = baseFreq * (0.9 + Math.random() * 0.28);
      const fEnd = fStart * (Math.random() > 0.4 ? 1.28 : 0.78);

      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(fStart, t);
      osc.frequency.exponentialRampToValueAtTime(fEnd, t + dur);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.048, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + dur + 0.01);
    }
  }

  /** Melodic gliding flute-like whistle of the Malabar Whistling Thrush ("Whistling Schoolboy") */
  private playWhistlingThrushPhrase(peakGain: number): void {
    const ctx = this.ctx!;
    const now = ctx.currentTime;
    const motif = [1046.5, 1318.5, 1174.6, 1567.98];
    const startIdx = Math.floor(Math.random() * 2);

    for (let i = 0; i < 3; i++) {
      const t = now + i * 0.22;
      const dur = 0.19;
      const targetF = motif[(startIdx + i) % motif.length];

      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(targetF * 0.92, t);
      osc.frequency.linearRampToValueAtTime(targetF, t + 0.06);
      osc.frequency.linearRampToValueAtTime(targetF * 1.03, t + dur);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(peakGain, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    }
  }

  /** Characteristic hollow "kut-roo" call of the Western Ghats White-cheeked Barbet */
  private playMalabarBarbetCall(): void {
    const ctx = this.ctx!;
    const now = ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const t = now + i * 0.16;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(i === 0 ? 740 : 620, t);
      osc.frequency.exponentialRampToValueAtTime(i === 0 ? 660 : 510, t + 0.1);

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 650;
      filter.Q.value = 3.0;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.042, t + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.12);
    }
  }

  /** Tactile raindrop hitting broad tropical foliage at Soochipara / Banasura */
  private playLeafRaindropPatter(peak: number): void {
    if (!this.whiteBuffer) return;
    const ctx = this.ctx!;
    const now = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = this.whiteBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1100 + Math.random() * 2100;
    filter.Q.value = 5.5;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(peak * (0.5 + Math.random() * 0.6), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.028);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);
    src.start(now, Math.random() * 0.5);
    src.stop(now + 0.032);
  }

  /** Subterranean water droplet with 3-tap granite cave echo inside Edakkal Caves */
  private playEchoingCaveDrip(): void {
    const ctx = this.ctx!;
    const now = ctx.currentTime;
    const baseF = 1180 + Math.random() * 620;

    for (let tap = 0; tap < 3; tap++) {
      const t = now + tap * 0.19;
      const amp = 0.055 * Math.pow(0.45, tap);
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseF * 0.85, t);
      osc.frequency.exponentialRampToValueAtTime(baseF * 1.38, t + 0.045);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(amp, t + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.065);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.075);
    }
  }

  /** Hollow woody bamboo knock & creak along Kuruvadweep river islands */
  private playBambooGroveCreak(): void {
    const ctx = this.ctx!;
    const now = ctx.currentTime;
    const base = 195 + Math.random() * 95;

    for (let i = 0; i < 2; i++) {
      const t = now + i * 0.09;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(base * (1 + i * 0.14), t);
      osc.frequency.exponentialRampToValueAtTime(base * 0.78, t + 0.07);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.05 * (1 - i * 0.35), t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.075);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.085);
    }
  }

  /** Subtle iron-link chime from Lakkidi's legendary Chain-Tree */
  private playChainTreeClink(): void {
    const ctx = this.ctx!;
    const now = ctx.currentTime;
    const f = 1480 + Math.random() * 260;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.024, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  /** Soft low-frequency horizon thunder roll behind Soochipara & Banasura */
  private playDistantHorizonThunder(): void {
    if (!this.pinkBuffer) return;
    const ctx = this.ctx!;
    const now = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = this.pinkBuffer;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(115, now);
    filter.frequency.linearRampToValueAtTime(65, now + 1.4);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.11, now + 0.35);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.45);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);
    src.start(now, Math.random() * 0.5);
    src.stop(now + 1.5);
  }

  public dispose(): void {
    this.disposed = true;
    this.currentBed?.stopAndDisconnect();
    this.currentBed = null;
    for (const item of this.fadingBeds) {
      item.bed.stopAndDisconnect();
    }
    this.fadingBeds = [];
    try {
      this.masterGain?.disconnect();
    } catch {
      // Ignore
    }
    this.masterGain = null;
  }
}
