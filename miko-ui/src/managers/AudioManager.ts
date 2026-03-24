// (c) 2026 MiraNova Studios

const MUTE_KEY = 'miko_muted';
const SHUFFLE_KEY = 'miko_shuffleMusic';

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
  muted = localStorage.getItem(MUTE_KEY) === 'true';

  /** Whether music is currently playing (independent of mute) */
  private _musicPlaying = false;

  /** The HTML audio element used for background music */
  private musicEl: HTMLAudioElement | null = null;

  /** Shuffled playlist of music file paths */
  private playlist: string[] = [];

  /** Current index in the playlist */
  private playlistIndex = 0;

  /** When true, playlist order is randomized */
  private _shuffle = localStorage.getItem(SHUFFLE_KEY) === 'true';

  /** Callback for UI to react to music state changes */
  onMusicStateChange?: (playing: boolean) => void;

  get musicPlaying(): boolean { return this._musicPlaying; }
  get shuffle(): boolean { return this._shuffle; }

  setShuffle(on: boolean): void {
    this._shuffle = on;
    localStorage.setItem(SHUFFLE_KEY, String(on));
    // If music is playing and shuffle was just turned on, jump to a random track
    if (on && this._musicPlaying && this.musicEl && !this.muted) {
      this.playRandomTrack();
    }
  }

  async initialize(): Promise<void> {
    this.audioCtx = new AudioContext();

    const sounds: { name: string; path: string }[] = [
      { name: 'check', path: 'assets/sounds/check_one_knock.wav' },
      { name: 'bet', path: 'assets/sounds/bet_chips_2.wav' },
      { name: 'fold', path: 'assets/sounds/fold.wav' },
      { name: 'win', path: 'assets/sounds/game-bonus-sound-winning-hand-test.mp3' },
      { name: 'knockout', path: 'assets/sounds/freesound_crunchpixstudio-button-394464.mp3' },
      { name: 'gameover', path: 'assets/sounds/alphix-knock-out.mp3' },
      { name: 'victory', path: 'assets/sounds/superpuyofans1234-winner-game-sound-404167.mp3' },
      { name: 'button', path: 'assets/sounds/floraphonic-90s-game-ui-6-185099.mp3' },
      { name: 'fireworks', path: 'assets/sounds/freesound_community-fireworks-generated-31449.mp3' },
      { name: 'chipsCollect', path: 'assets/sounds/freesound_community-poker_chips1-87592.mp3' },
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
    localStorage.setItem(MUTE_KEY, String(muted));
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
    // Load a track if nothing is loaded yet, or playlist finished
    if (!this.musicEl.src || this.playlistIndex >= this.playlist.length) {
      if (this._shuffle) {
        this.playlistIndex = Math.floor(Math.random() * this.playlist.length);
      } else {
        this.playlistIndex = 0;
      }
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

  /** Pick a random track (different from current if possible) and play it */
  private playRandomTrack(): void {
    if (!this.musicEl || this.playlist.length === 0) return;
    if (this.playlist.length > 1) {
      let idx: number;
      do {
        idx = Math.floor(Math.random() * this.playlist.length);
      } while (idx === this.playlistIndex);
      this.playlistIndex = idx;
    }
    this.musicEl.src = this.playlist[this.playlistIndex];
    if (!this.muted) {
      this.musicEl.play().catch(() => {});
    }
  }

  /** Advance to the next track, or stop if playlist is finished */
  private nextTrack(): void {
    if (!this._musicPlaying || this.playlist.length === 0) return;
    if (this._shuffle) {
      this.playRandomTrack();
      return;
    }
    this.playlistIndex++;
    if (this.playlistIndex >= this.playlist.length) {
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
  playWinSound(): void { this.play('win'); }
  playKnockoutSound(): void { this.play('knockout'); }
  playGameOverSound(): void { this.play('gameover'); }
  playVictorySound(): void { this.play('victory'); }
  playButtonSound(): void { this.play('button'); }
  playChipsCollectSound(): void { this.play('chipsCollect'); }

  private fireworksSource: AudioBufferSourceNode | null = null;

  /** Start playing the fireworks sound in a loop */
  playFireworksLoop(): void {
    this.stopFireworksLoop();
    if (!this.audioCtx || !this.loaded || this.muted) return;
    this.ensureResumed();

    const buffer = this.buffers.get('fireworks');
    if (!buffer) return;

    const source = this.audioCtx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = this.audioCtx.createGain();
    gain.gain.value = 0.4;  // lower volume so it doesn't overpower
    source.connect(gain);
    gain.connect(this.audioCtx.destination);
    source.start(0);
    this.fireworksSource = source;
  }

  /** Stop the fireworks loop */
  stopFireworksLoop(): void {
    if (this.fireworksSource) {
      try { this.fireworksSource.stop(); } catch { /* already stopped */ }
      this.fireworksSource = null;
    }
  }
}
