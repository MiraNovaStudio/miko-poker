export class AudioManager {
  private static _instance: AudioManager | null = null;

  /** Get or create the shared AudioManager singleton */
  static get instance(): AudioManager {
    if (!AudioManager._instance) {
      AudioManager._instance = new AudioManager();
    }
    return AudioManager._instance;
  }

  private audioCtx: AudioContext | null = null;
  private buffers: Map<string, AudioBuffer> = new Map();
  private loaded = false;
  private musicSource: AudioBufferSourceNode | null = null;
  private musicGain: GainNode | null = null;
  musicPlaying = false;

  async initialize(): Promise<void> {
    this.audioCtx = new AudioContext();

    const sounds: { name: string; path: string }[] = [
      { name: 'check', path: 'assets/sounds/check_one_knock.wav' },
      { name: 'bet', path: 'assets/sounds/bet_chips_2.wav' },
      { name: 'fold', path: 'assets/sounds/fold.wav' },
      { name: 'music', path: 'assets/sounds/Funky-Chiptune.ogg' },
    ];

    await Promise.all(
      sounds.map(async ({ name, path }) => {
        try {
          const response = await fetch(path);
          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await this.audioCtx!.decodeAudioData(arrayBuffer);
          this.buffers.set(name, audioBuffer);
        } catch (err) {
          console.warn(`AudioManager: failed to load ${name}`, err);
        }
      }),
    );

    this.loaded = true;
    console.log(`AudioManager: loaded ${this.buffers.size} sounds`);
  }

  private ensureResumed(): void {
    if (this.audioCtx?.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  private play(name: string): void {
    if (!this.audioCtx || !this.loaded) return;
    this.ensureResumed();

    const buffer = this.buffers.get(name);
    if (!buffer) return;

    const source = this.audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioCtx.destination);
    source.start(0);
  }

  playCheckSound(): void { this.play('check'); }
  playBetSound(): void { this.play('bet'); }
  playFoldSound(): void { this.play('fold'); }

  /** Start looping background music */
  playMusic(volume = 0.3): void {
    if (!this.audioCtx || !this.loaded) return;
    this.stopMusic();
    this.ensureResumed();

    const buffer = this.buffers.get('music');
    if (!buffer) return;

    this.musicGain = this.audioCtx.createGain();
    this.musicGain.gain.value = volume;
    this.musicGain.connect(this.audioCtx.destination);

    this.musicSource = this.audioCtx.createBufferSource();
    this.musicSource.buffer = buffer;
    this.musicSource.loop = true;
    this.musicSource.connect(this.musicGain);
    this.musicSource.start(0);
    this.musicPlaying = true;
  }

  /** Stop background music */
  stopMusic(): void {
    if (this.musicSource) {
      try { this.musicSource.stop(); } catch { /* already stopped */ }
      this.musicSource.disconnect();
      this.musicSource = null;
    }
    if (this.musicGain) {
      this.musicGain.disconnect();
      this.musicGain = null;
    }
    this.musicPlaying = false;
  }
}
