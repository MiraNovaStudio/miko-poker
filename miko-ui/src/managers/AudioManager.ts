// (c) 2026 MiraNova Studios
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

  /** When true, all sound effects and music are suppressed */
  muted = false;

  /** Whether music is currently playing (independent of mute) */
  private _musicPlaying = false;

  /** The HTML audio element used for background music */
  private musicEl: HTMLAudioElement | null = null;

  /** Shuffled playlist of music file paths */
  private playlist: string[] = [];

  /** Current index in the playlist */
  private playlistIndex = 0;

  /** Callback for UI to react to music state changes */
  onMusicStateChange?: (playing: boolean) => void;

  get musicPlaying(): boolean { return this._musicPlaying; }

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

    // Build and shuffle playlist
    this.playlist = this.buildPlaylist();
    this.shufflePlaylist();

    // Create the music audio element
    this.musicEl = document.createElement('audio');
    this.musicEl.volume = 0.35;
    this.musicEl.addEventListener('ended', () => this.nextTrack());
  }

  /** Toggle mute. When muting, pause music; when unmuting, resume if was playing. */
  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.musicEl) {
      if (muted) {
        this.musicEl.pause();
      } else if (this._musicPlaying) {
        this.musicEl.play().catch(() => {});
      }
    }
  }

  /** Start playing music from the playlist */
  playMusic(): void {
    if (!this.musicEl || this.playlist.length === 0) return;
    this._musicPlaying = true;
    this.musicEl.src = this.playlist[this.playlistIndex];
    if (!this.muted) {
      this.musicEl.play().catch(() => {});
    }
    this.onMusicStateChange?.(true);
  }

  /** Stop music playback */
  stopMusic(): void {
    if (!this.musicEl) return;
    this._musicPlaying = false;
    this.musicEl.pause();
    this.musicEl.currentTime = 0;
    this.onMusicStateChange?.(false);
  }

  /** Toggle music on/off */
  toggleMusic(): void {
    if (this._musicPlaying) {
      this.stopMusic();
    } else {
      this.playMusic();
    }
  }

  /** Advance to the next track in the playlist */
  private nextTrack(): void {
    if (!this._musicPlaying || this.playlist.length === 0) return;
    this.playlistIndex = (this.playlistIndex + 1) % this.playlist.length;
    // Reshuffle when we loop back to the start
    if (this.playlistIndex === 0) {
      this.shufflePlaylist();
    }
    this.musicEl!.src = this.playlist[this.playlistIndex];
    if (!this.muted) {
      this.musicEl!.play().catch(() => {});
    }
  }

  /** Build the list of music file paths */
  private buildPlaylist(): string[] {
    const tracks = [
      '01 - Stellar Drift.mp3',
      '02 - Nightfall.mp3',
      '03 - Racing Through Time.mp3',
      '04 - Midnight City Lights.mp3',
      '05 - Ultravox.mp3',
      '06 - Neon Voyager.mp3',
      '07 - Shadows In Motion.mp3',
      '08 - Dreamscore.mp3',
      '09 - Holographic Love.mp3',
      '10 - Future Vibes.mp3',
      '11 - Through The Grid.mp3',
      '12 - Eternal Waves.mp3',
      '13 - Quantum Dancer.mp3',
      '14 - Hyperion.mp3',
      '15 - Cosmic Eclipse.mp3',
      '16 - Lunar Frequencies.mp3',
      '17 - Chasing Stars.mp3',
      '18 - Retropolis.mp3',
      '19 - The Galactic Pulse.mp3',
      '20 - Lazerscape.mp3',
    ];
    return tracks.map(t => `assets/music/${t}`);
  }

  /** Fisher-Yates shuffle */
  private shufflePlaylist(): void {
    for (let i = this.playlist.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.playlist[i], this.playlist[j]] = [this.playlist[j], this.playlist[i]];
    }
    this.playlistIndex = 0;
  }

  // ─── Sound effects ─────────────────────────────────────────

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
