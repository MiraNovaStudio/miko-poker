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

  /** When true, playlist order is randomized */
  private _shuffle = false;

  /** Callback for UI to react to music state changes */
  onMusicStateChange?: (playing: boolean) => void;

  get musicPlaying(): boolean { return this._musicPlaying; }
  get shuffle(): boolean { return this._shuffle; }

  setShuffle(on: boolean): void {
    this._shuffle = on;
    if (on) {
      this.shufflePlaylist();
    } else {
      // Restore original order, keep current track playing
      const currentSrc = this.musicEl?.src ?? '';
      this.playlist = this.buildPlaylist();
      // Find the current track in the restored order
      const idx = this.playlist.findIndex(t => currentSrc.endsWith(t.replace(/ /g, '%20')));
      this.playlistIndex = idx >= 0 ? idx : 0;
    }
  }

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

    // Build playlist (plays in filename order, loops)
    this.playlist = this.buildPlaylist();

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
    // Load first track if nothing is loaded yet, or restart from beginning if playlist finished
    if (!this.musicEl.src || this.playlistIndex >= this.playlist.length) {
      this.playlistIndex = 0;
      this.musicEl.src = this.playlist[this.playlistIndex];
    }
    if (!this.muted) {
      this.musicEl.play().catch(() => {});
    }
    this.onMusicStateChange?.(true);
  }

  /** Pause music playback (resumes from same position on next play) */
  stopMusic(): void {
    if (!this.musicEl) return;
    this._musicPlaying = false;
    this.musicEl.pause();
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

  /** Fisher-Yates shuffle, preserving current track position */
  private shufflePlaylist(): void {
    const currentSrc = this.musicEl?.src ?? '';
    for (let i = this.playlist.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.playlist[i], this.playlist[j]] = [this.playlist[j], this.playlist[i]];
    }
    const idx = this.playlist.findIndex(t => currentSrc.endsWith(t.replace(/ /g, '%20')));
    this.playlistIndex = idx >= 0 ? idx : 0;
  }

  /** Advance to the next track, or stop if playlist is finished */
  private nextTrack(): void {
    if (!this._musicPlaying || this.playlist.length === 0) return;
    this.playlistIndex++;
    if (this.playlistIndex >= this.playlist.length) {
      // Playlist finished — stop instead of looping
      this.stopMusic();
      return;
    }
    this.musicEl!.src = this.playlist[this.playlistIndex];
    if (!this.muted) {
      this.musicEl!.play().catch(() => {});
    }
  }

  /** Build the list of music file paths */
  private buildPlaylist(): string[] {
    const tracks = [
      '01 - hitslab-chiptune-video-game-games-music-457939.mp3',
      '02 - hitslab-game-gaming-video-game-music-459876.mp3',
      '03 - viacheslavstarostin-gaming-game-video-game-music-474517.mp3',
      '04 - mfcc-roblox-minecraft-fortnite-video-game-music-350759.mp3',
      '05 - hitslab-game-gaming-minecraft-background-music-362185.mp3',
    ];
    return tracks.map(t => `assets/music/${t}`);
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
