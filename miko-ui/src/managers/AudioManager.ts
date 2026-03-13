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

  /** When true, all sound effects are suppressed */
  muted = false;

  async initialize(): Promise<void> {
    this.audioCtx = new AudioContext();

    const sounds: { name: string; path: string }[] = [
      { name: 'check', path: 'assets/sounds/check_one_knock.wav' },
      { name: 'bet', path: 'assets/sounds/bet_chips_2.wav' },
      { name: 'fold', path: 'assets/sounds/fold.wav' },
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
    if (!this.audioCtx || !this.loaded || this.muted) return;
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
}
