import { Container, Sprite, Graphics, Text, type TextStyleOptions } from 'pixi.js';
import { AssetManager } from '../managers/AssetManager.js';
import { AudioManager } from '../managers/AudioManager.js';
import { FONTS } from '../utils/constants.js';

export class StartScene extends Container {
  onStart: (() => void) | null = null;
  private audioManager: AudioManager;
  private musicPlaying = false;

  constructor() {
    super();

    // Background image
    const bg = new Sprite(AssetManager.get('start_screen'));
    bg.anchor.set(0.5);
    bg.width = 960;
    bg.height = 540;
    this.addChild(bg);

    // Dim overlay for readability
    const overlay = new Graphics();
    overlay.rect(-480, -270, 960, 540);
    overlay.fill({ color: 0x000000, alpha: 0.4 });
    this.addChild(overlay);

    // Title
    const title = new Text({
      text: 'MikoPoker',
      style: {
        fontFamily: 'Arial',
        fontSize: 64,
        fontWeight: 'bold',
        fill: 0xffffff,
        stroke: { color: 0x000000, width: 4 },
      } as TextStyleOptions,
    });
    title.anchor.set(0.5);
    title.y = -220;
    this.addChild(title);

    // Start button
    const btn = new Container();
    btn.y = 210;

    const btnBg = new Graphics();
    const drawBtn = (color: number) => {
      btnBg.clear();
      btnBg.roundRect(-100, -30, 200, 60, 12);
      btnBg.fill({ color, alpha: 1 });
      btnBg.stroke({ color: 0x4ade80, width: 3 });
    };
    drawBtn(0x2a6e3f);
    btn.addChild(btnBg);

    const btnLabel = new Text({
      text: 'Play',
      style: { ...FONTS.button, fontSize: 28, fill: 0x4ade80 } as TextStyleOptions,
    });
    btnLabel.anchor.set(0.5);
    btn.addChild(btnLabel);

    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.on('pointerover', () => drawBtn(0x3a8e5f));
    btn.on('pointerout', () => drawBtn(0x2a6e3f));
    btn.on('pointerdown', () => {
      this.audioManager.stopMusic();
      this.onStart?.();
    });
    this.addChild(btn);

    // Music toggle button (top-right corner, muted by default)
    const musicBtn = new Container();
    musicBtn.x = 430;
    musicBtn.y = -250;

    const musicBg = new Graphics();
    const musicIcon = new Text({
      text: '',
      style: { fontFamily: 'Arial', fontSize: 28, fill: 0xffffff } as TextStyleOptions,
    });
    musicIcon.anchor.set(0.5);

    const drawMusicBtn = (hovered: boolean) => {
      musicBg.clear();
      musicBg.roundRect(-22, -22, 44, 44, 8);
      musicBg.fill({ color: hovered ? 0x445566 : 0x334455, alpha: 0.8 });
      musicBg.stroke({ color: 0x5588aa, width: 2 });
      musicIcon.text = this.musicPlaying ? '\u{1F50A}' : '\u{1F507}';
    };
    drawMusicBtn(false);

    musicBtn.addChild(musicBg);
    musicBtn.addChild(musicIcon);
    musicBtn.eventMode = 'static';
    musicBtn.cursor = 'pointer';
    musicBtn.on('pointerover', () => drawMusicBtn(true));
    musicBtn.on('pointerout', () => drawMusicBtn(false));
    musicBtn.on('pointerdown', () => {
      if (this.musicPlaying) {
        this.audioManager.stopMusic();
        this.musicPlaying = false;
      } else {
        this.audioManager.playMusic(0.2);
        this.musicPlaying = true;
      }
      drawMusicBtn(true);
    });
    this.addChild(musicBtn);

    // Initialize audio (muted by default — user clicks music button to enable)
    this.audioManager = new AudioManager();
    this.audioManager.initialize();
  }

  destroy(): void {
    this.audioManager.stopMusic();
    super.destroy();
  }
}
