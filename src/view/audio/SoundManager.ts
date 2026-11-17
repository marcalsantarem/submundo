export type SoundEventId =
  | 'attack'
  | 'crit'
  | 'dash'
  | 'skill_inferno'
  | 'skill_submundo'
  | 'skill_empireo'
  | 'potion'
  | 'loot_drop'
  | 'loot_legendary'
  | 'soul_pickup'
  | 'hit_player'
  | 'ui_click'
  | 'dialogue_blip'
  | 'forge'
  | 'altar'
  | 'victory'
  | 'defeat';

export const MUTE_STORAGE_KEY = 'submundo_muted_v1';

const DEBOUNCE_MS = 35;

interface WebAudioWindow {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
}

export class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted: boolean;
  private lastPlayedAt: Partial<Record<SoundEventId, number>> = {};

  constructor() {
    this.muted = this.readMutedFromStorage();
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean): void {
    this.muted = Boolean(muted);
    this.writeMutedToStorage(this.muted);
    if (this.masterGain && this.ctx) {
      try {
        this.masterGain.gain.setValueAtTime(
          this.muted ? 0 : 0.45,
          this.ctx.currentTime,
        );
      } catch {
        // Ignore audio scheduling errors in restricted contexts.
      }
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  public unlock(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      try {
        void ctx.resume().catch(() => {});
      } catch {
        // Ignore resume errors when blocked by autoplay policy.
      }
    }
  }

  public play(event: SoundEventId): void {
    if (this.muted) return;

    const nowMs = this.now();
    const prevMs = this.lastPlayedAt[event];
    if (prevMs !== undefined && nowMs - prevMs < DEBOUNCE_MS) {
      return;
    }

    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    if (ctx.state === 'suspended') {
      try {
        void ctx.resume().catch(() => {});
      } catch {
        return;
      }
    }

    this.lastPlayedAt[event] = nowMs;

    try {
      this.synthesize(ctx, this.masterGain, event);
    } catch {
      // Never throw on audio synthesis failures.
    }
  }

  private now(): number {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
      return performance.now();
    }
    return Date.now();
  }

  private readMutedFromStorage(): boolean {
    try {
      if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
        return false;
      }
      return window.localStorage.getItem(MUTE_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  }

  private writeMutedToStorage(muted: boolean): void {
    try {
      if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
        return;
      }
      window.localStorage.setItem(MUTE_STORAGE_KEY, muted ? 'true' : 'false');
    } catch {
      // Ignore storage errors (private mode, headless, quota).
    }
  }

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    if (typeof window === 'undefined') return null;

    const win = window as unknown as WebAudioWindow;
    const AudioCtx = win.AudioContext ?? win.webkitAudioContext;
    if (typeof AudioCtx !== 'function') return null;

    try {
      const ctx = new AudioCtx();
      const master = ctx.createGain();
      master.gain.setValueAtTime(this.muted ? 0 : 0.45, ctx.currentTime);
      master.connect(ctx.destination);

      this.ctx = ctx;
      this.masterGain = master;
      this.noiseBuffer = this.createNoiseBuffer(ctx, 0.7);
      return ctx;
    } catch {
      this.ctx = null;
      this.masterGain = null;
      this.noiseBuffer = null;
      return null;
    }
  }

  private createNoiseBuffer(ctx: AudioContext, durationSec: number): AudioBuffer | null {
    try {
      const length = Math.max(1, Math.floor(ctx.sampleRate * durationSec));
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      return buffer;
    } catch {
      return null;
    }
  }

  private playTone(
    ctx: AudioContext,
    dest: AudioNode,
    opts: {
      type: OscillatorType;
      freqStart: number;
      freqEnd?: number;
      startTime: number;
      attack: number;
      decay: number;
      peakGain: number;
      sustainGain?: number;
    },
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = opts.type;
    osc.frequency.setValueAtTime(Math.max(20, opts.freqStart), opts.startTime);
    if (opts.freqEnd !== undefined && opts.freqEnd !== opts.freqStart) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(20, opts.freqEnd),
        opts.startTime + opts.attack + opts.decay,
      );
    }

    const attackEnd = opts.startTime + Math.max(0.002, opts.attack);
    const totalEnd = attackEnd + Math.max(0.01, opts.decay);

    gain.gain.setValueAtTime(0.0001, opts.startTime);
    gain.gain.linearRampToValueAtTime(opts.peakGain, attackEnd);
    if (opts.sustainGain !== undefined && opts.sustainGain > 0) {
      gain.gain.linearRampToValueAtTime(opts.sustainGain, attackEnd + opts.decay * 0.5);
    }
    gain.gain.exponentialRampToValueAtTime(0.0001, totalEnd);

    osc.connect(gain);
    gain.connect(dest);

    osc.start(opts.startTime);
    osc.stop(totalEnd + 0.01);
  }

  private playNoise(
    ctx: AudioContext,
    dest: AudioNode,
    opts: {
      filterType: BiquadFilterType;
      freqStart: number;
      freqEnd?: number;
      q?: number;
      startTime: number;
      attack: number;
      decay: number;
      peakGain: number;
    },
  ): void {
    if (!this.noiseBuffer) return;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = opts.filterType;
    filter.Q.setValueAtTime(opts.q ?? 1.2, opts.startTime);
    filter.frequency.setValueAtTime(Math.max(40, opts.freqStart), opts.startTime);
    if (opts.freqEnd !== undefined && opts.freqEnd !== opts.freqStart) {
      filter.frequency.exponentialRampToValueAtTime(
        Math.max(40, opts.freqEnd),
        opts.startTime + opts.attack + opts.decay,
      );
    }

    const gain = ctx.createGain();
    const attackEnd = opts.startTime + Math.max(0.002, opts.attack);
    const totalEnd = attackEnd + Math.max(0.01, opts.decay);

    gain.gain.setValueAtTime(0.0001, opts.startTime);
    gain.gain.linearRampToValueAtTime(opts.peakGain, attackEnd);
    gain.gain.exponentialRampToValueAtTime(0.0001, totalEnd);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    src.start(opts.startTime);
    src.stop(totalEnd + 0.01);
  }

  private synthesize(ctx: AudioContext, dest: AudioNode, event: SoundEventId): void {
    const t = ctx.currentTime;

    switch (event) {
      case 'attack': {
        // Metallic blade slash + crisp edge transient
        this.playNoise(ctx, dest, {
          filterType: 'bandpass',
          freqStart: 2800,
          freqEnd: 850,
          q: 2.2,
          startTime: t,
          attack: 0.005,
          decay: 0.075,
          peakGain: 0.34,
        });
        this.playTone(ctx, dest, {
          type: 'triangle',
          freqStart: 440,
          freqEnd: 130,
          startTime: t,
          attack: 0.004,
          decay: 0.065,
          peakGain: 0.24,
        });
        break;
      }

      case 'crit': {
        // Heavy metallic cleave + dual-harmonic punch
        this.playNoise(ctx, dest, {
          filterType: 'bandpass',
          freqStart: 3600,
          freqEnd: 700,
          q: 1.8,
          startTime: t,
          attack: 0.004,
          decay: 0.13,
          peakGain: 0.45,
        });
        this.playTone(ctx, dest, {
          type: 'sawtooth',
          freqStart: 620,
          freqEnd: 140,
          startTime: t,
          attack: 0.004,
          decay: 0.12,
          peakGain: 0.28,
        });
        this.playTone(ctx, dest, {
          type: 'triangle',
          freqStart: 930,
          freqEnd: 260,
          startTime: t + 0.01,
          attack: 0.004,
          decay: 0.14,
          peakGain: 0.25,
        });
        break;
      }

      case 'dash': {
        // Spectral wind whoosh
        this.playNoise(ctx, dest, {
          filterType: 'bandpass',
          freqStart: 500,
          freqEnd: 1700,
          q: 1.4,
          startTime: t,
          attack: 0.015,
          decay: 0.13,
          peakGain: 0.32,
        });
        this.playTone(ctx, dest, {
          type: 'sine',
          freqStart: 340,
          freqEnd: 150,
          startTime: t,
          attack: 0.01,
          decay: 0.12,
          peakGain: 0.18,
        });
        break;
      }

      case 'skill_inferno': {
        // Fire roar + sub-bass eruption
        this.playNoise(ctx, dest, {
          filterType: 'lowpass',
          freqStart: 1200,
          freqEnd: 220,
          q: 1.1,
          startTime: t,
          attack: 0.015,
          decay: 0.26,
          peakGain: 0.46,
        });
        this.playTone(ctx, dest, {
          type: 'sawtooth',
          freqStart: 135,
          freqEnd: 48,
          startTime: t,
          attack: 0.01,
          decay: 0.27,
          peakGain: 0.32,
        });
        this.playNoise(ctx, dest, {
          filterType: 'highpass',
          freqStart: 2200,
          freqEnd: 900,
          q: 0.9,
          startTime: t + 0.02,
          attack: 0.01,
          decay: 0.16,
          peakGain: 0.2,
        });
        break;
      }

      case 'skill_submundo': {
        // Dark underworld minor/tritone chord + resonant pull
        const freqs = [110, 130.81, 155.56];
        for (const f of freqs) {
          this.playTone(ctx, dest, {
            type: 'triangle',
            freqStart: f,
            freqEnd: f * 0.88,
            startTime: t,
            attack: 0.02,
            decay: 0.3,
            peakGain: 0.2,
          });
        }
        this.playTone(ctx, dest, {
          type: 'sine',
          freqStart: 220,
          freqEnd: 73.42,
          startTime: t,
          attack: 0.015,
          decay: 0.28,
          peakGain: 0.28,
        });
        break;
      }

      case 'skill_empireo': {
        // Electric lightning snap + thunder rumble
        this.playNoise(ctx, dest, {
          filterType: 'highpass',
          freqStart: 3200,
          freqEnd: 1200,
          q: 1.5,
          startTime: t,
          attack: 0.002,
          decay: 0.07,
          peakGain: 0.45,
        });
        this.playTone(ctx, dest, {
          type: 'square',
          freqStart: 1380,
          freqEnd: 190,
          startTime: t,
          attack: 0.003,
          decay: 0.14,
          peakGain: 0.22,
        });
        this.playTone(ctx, dest, {
          type: 'triangle',
          freqStart: 95,
          freqEnd: 40,
          startTime: t + 0.025,
          attack: 0.01,
          decay: 0.25,
          peakGain: 0.34,
        });
        break;
      }

      case 'potion': {
        // Restorative liquid shimmer
        this.playTone(ctx, dest, {
          type: 'sine',
          freqStart: 420,
          freqEnd: 880,
          startTime: t,
          attack: 0.01,
          decay: 0.16,
          peakGain: 0.26,
        });
        this.playTone(ctx, dest, {
          type: 'sine',
          freqStart: 880,
          freqEnd: 1320,
          startTime: t + 0.07,
          attack: 0.01,
          decay: 0.18,
          peakGain: 0.22,
        });
        break;
      }

      case 'loot_drop': {
        // Crystalline chime drop
        this.playTone(ctx, dest, {
          type: 'sine',
          freqStart: 1046.5,
          startTime: t,
          attack: 0.004,
          decay: 0.11,
          peakGain: 0.26,
        });
        this.playTone(ctx, dest, {
          type: 'triangle',
          freqStart: 1567.98,
          startTime: t + 0.045,
          attack: 0.004,
          decay: 0.14,
          peakGain: 0.2,
        });
        break;
      }

      case 'loot_legendary': {
        // Radiant ascending crystalline fanfare
        const notes = [523.25, 659.25, 783.99, 1046.5, 1567.98];
        notes.forEach((freq, idx) => {
          const offset = idx * 0.055;
          this.playTone(ctx, dest, {
            type: idx % 2 === 0 ? 'sine' : 'triangle',
            freqStart: freq,
            startTime: t + offset,
            attack: 0.006,
            decay: idx === notes.length - 1 ? 0.36 : 0.18,
            peakGain: 0.22,
          });
        });
        break;
      }

      case 'soul_pickup': {
        // Ethereal crystalline bell
        this.playTone(ctx, dest, {
          type: 'sine',
          freqStart: 880,
          freqEnd: 1174.66,
          startTime: t,
          attack: 0.004,
          decay: 0.16,
          peakGain: 0.24,
        });
        this.playTone(ctx, dest, {
          type: 'sine',
          freqStart: 1760,
          startTime: t + 0.02,
          attack: 0.004,
          decay: 0.15,
          peakGain: 0.12,
        });
        break;
      }

      case 'hit_player': {
        // Heavy dull impact thud
        this.playTone(ctx, dest, {
          type: 'triangle',
          freqStart: 165,
          freqEnd: 46,
          startTime: t,
          attack: 0.003,
          decay: 0.13,
          peakGain: 0.42,
        });
        this.playNoise(ctx, dest, {
          filterType: 'lowpass',
          freqStart: 620,
          freqEnd: 140,
          q: 1.0,
          startTime: t,
          attack: 0.003,
          decay: 0.1,
          peakGain: 0.3,
        });
        break;
      }

      case 'ui_click': {
        // Short clean UI click
        this.playTone(ctx, dest, {
          type: 'triangle',
          freqStart: 640,
          freqEnd: 300,
          startTime: t,
          attack: 0.002,
          decay: 0.03,
          peakGain: 0.2,
        });
        break;
      }

      case 'dialogue_blip': {
        // Short dialogue text blip
        this.playTone(ctx, dest, {
          type: 'sine',
          freqStart: 430,
          freqEnd: 360,
          startTime: t,
          attack: 0.003,
          decay: 0.036,
          peakGain: 0.16,
        });
        break;
      }

      case 'forge': {
        // Metallic anvil strike with harmonic ring
        this.playNoise(ctx, dest, {
          filterType: 'bandpass',
          freqStart: 2400,
          freqEnd: 1200,
          q: 2.0,
          startTime: t,
          attack: 0.002,
          decay: 0.06,
          peakGain: 0.32,
        });
        const partials = [
          { freq: 820, gain: 0.25, decay: 0.34 },
          { freq: 1245, gain: 0.2, decay: 0.28 },
          { freq: 1890, gain: 0.14, decay: 0.22 },
        ];
        for (const p of partials) {
          this.playTone(ctx, dest, {
            type: 'triangle',
            freqStart: p.freq,
            startTime: t,
            attack: 0.002,
            decay: p.decay,
            peakGain: p.gain,
          });
        }
        break;
      }

      case 'altar': {
        // Mystical resonant harmonic swell
        const chord = [146.83, 220, 440, 659.25];
        chord.forEach((freq, i) => {
          this.playTone(ctx, dest, {
            type: i < 2 ? 'triangle' : 'sine',
            freqStart: freq,
            startTime: t + i * 0.025,
            attack: 0.03,
            decay: 0.36,
            peakGain: 0.18,
          });
        });
        break;
      }

      case 'victory': {
        // Triumphant ascending cadence
        const melody = [
          { freq: 293.66, delay: 0, decay: 0.18 },
          { freq: 369.99, delay: 0.09, decay: 0.18 },
          { freq: 440, delay: 0.18, decay: 0.2 },
          { freq: 587.33, delay: 0.28, decay: 0.42 },
        ];
        for (const n of melody) {
          this.playTone(ctx, dest, {
            type: 'triangle',
            freqStart: n.freq,
            startTime: t + n.delay,
            attack: 0.01,
            decay: n.decay,
            peakGain: 0.24,
          });
        }
        break;
      }

      case 'defeat': {
        // Somber descending doom notes
        const melody = [
          { freq: 261.63, delay: 0, decay: 0.22 },
          { freq: 233.08, delay: 0.14, decay: 0.22 },
          { freq: 196.0, delay: 0.28, decay: 0.24 },
          { freq: 130.81, delay: 0.42, decay: 0.45 },
        ];
        for (const n of melody) {
          this.playTone(ctx, dest, {
            type: 'sine',
            freqStart: n.freq,
            freqEnd: n.freq * 0.96,
            startTime: t + n.delay,
            attack: 0.015,
            decay: n.decay,
            peakGain: 0.26,
          });
        }
        break;
      }
    }
  }
}

export const soundManager = new SoundManager();
