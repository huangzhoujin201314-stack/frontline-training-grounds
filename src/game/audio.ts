/**
 * 100% procedural Web Audio API sound effects synthesizer.
 * Zero external audio assets required.
 */
export class TacticalAudio {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted = false;

  public unlock(): void {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.noiseBuffer = this.createNoiseBuffer(this.ctx, 1.0);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  private createNoiseBuffer(ctx: AudioContext, duration: number): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private ready(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) this.unlock();
    if (!this.ctx || this.ctx.state !== 'running') return null;
    return this.ctx;
  }

  public playGunshot(ads: boolean): void {
    const ctx = this.ready();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;

    // 1. High-energy tactical crack (filtered noise burst)
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(ads ? 1850 : 1500, now);
    filter.frequency.exponentialRampToValueAtTime(380, now + 0.11);
    filter.Q.value = 0.85;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.42, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.14);

    // 2. Low-end muzzle thump
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(165 + Math.random() * 18, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.085);

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.36, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);

    // 3. Crisp metallic bolt snap
    const bolt = ctx.createOscillator();
    bolt.type = 'square';
    bolt.frequency.setValueAtTime(980 + Math.random() * 90, now + 0.012);
    bolt.frequency.exponentialRampToValueAtTime(420, now + 0.045);

    const boltGain = ctx.createGain();
    boltGain.gain.setValueAtTime(0.06, now + 0.012);
    boltGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    bolt.connect(boltGain);
    boltGain.connect(ctx.destination);
    bolt.start(now + 0.012);
    bolt.stop(now + 0.055);
  }

  public playDryFire(): void {
    const ctx = this.ready();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1150, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.025);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.035);
  }

  public playReloadStart(): void {
    const ctx = this.ready();
    if (!ctx) return;
    const now = ctx.currentTime;
    this.metallicClick(ctx, now, 620, 320, 0.06, 0.12);
    this.metallicClick(ctx, now + 0.09, 440, 260, 0.08, 0.09);
  }

  public playReloadMagIn(): void {
    const ctx = this.ready();
    if (!ctx) return;
    const now = ctx.currentTime;
    this.metallicClick(ctx, now, 340, 520, 0.06, 0.14);
    this.metallicClick(ctx, now + 0.05, 880, 540, 0.04, 0.1);
  }

  public playReloadBolt(): void {
    const ctx = this.ready();
    if (!ctx) return;
    const now = ctx.currentTime;
    this.metallicClick(ctx, now, 780, 1250, 0.05, 0.11);
    this.metallicClick(ctx, now + 0.085, 1320, 620, 0.07, 0.14);
  }

  private metallicClick(
    ctx: AudioContext,
    startTime: number,
    freqStart: number,
    freqEnd: number,
    dur: number,
    vol: number,
  ): void {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freqStart, startTime);
    osc.frequency.exponentialRampToValueAtTime(freqEnd, startTime + dur);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = (freqStart + freqEnd) * 0.65;
    filter.Q.value = 3.0;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + dur + 0.01);
  }

  public playHitMarker(headshot: boolean): void {
    const ctx = this.ready();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(headshot ? 2100 : 1280, now);
    osc.frequency.exponentialRampToValueAtTime(headshot ? 1420 : 680, now + 0.045);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(headshot ? 0.22 : 0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);

    if (headshot) {
      // Crisp helmet-dink overtone
      const dink = ctx.createOscillator();
      dink.type = 'sine';
      dink.frequency.setValueAtTime(2950, now + 0.01);
      dink.frequency.exponentialRampToValueAtTime(2200, now + 0.09);
      const dinkGain = ctx.createGain();
      dinkGain.gain.setValueAtTime(0.18, now + 0.01);
      dinkGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      dink.connect(dinkGain);
      dinkGain.connect(ctx.destination);
      dink.start(now + 0.01);
      dink.stop(now + 0.11);
    }
  }

  public playKillConfirm(streak: number): void {
    const ctx = this.ready();
    if (!ctx) return;
    const now = ctx.currentTime;
    const pitchBoost = Math.min(streak - 1, 6) * 55;

    const freqs = [587 + pitchBoost, 880 + pitchBoost * 1.25];
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      const t = now + idx * 0.055;
      osc.frequency.setValueAtTime(freq, t);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.13);
    });
  }

  public playBotCharge(): void {
    const ctx = this.ready();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(980, now + 0.14);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.045, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  public playBotShot(): void {
    const ctx = this.ready();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(640, now);
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.09);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1400;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  public playPlayerHit(armorAbsorbed: boolean): void {
    const ctx = this.ready();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(135, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.14);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);

    if (armorAbsorbed) {
      this.metallicClick(ctx, now, 1100, 740, 0.06, 0.09);
    }
  }

  public playFootstep(sprinting: boolean): void {
    const ctx = this.ready();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = sprinting ? 480 + Math.random() * 120 : 360 + Math.random() * 90;
    filter.Q.value = 1.4;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(sprinting ? 0.07 : 0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.06);
  }

  public playJump(): void {
    const ctx = this.ready();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.07);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.085);
  }

  public playLand(): void {
    const ctx = this.ready();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.075);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  public playWaveComplete(): void {
    const ctx = this.ready();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      const t = now + i * 0.07;
      osc.frequency.setValueAtTime(freq, t);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.26);
    });
  }

  public dispose(): void {
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
    this.noiseBuffer = null;
  }
}
