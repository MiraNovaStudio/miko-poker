import { Container, Sprite, Graphics, Text, type TextStyleOptions } from 'pixi.js';
import { AssetManager } from '../managers/AssetManager.js';
import { AudioManager } from '../managers/AudioManager.js';
import { FONTS } from '../utils/constants.js';

export class StartScene extends Container {
  onStart: (() => void) | null = null;
  private audioManager: AudioManager;

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
    title.y = -80;
    this.addChild(title);

    // Subtitle
    const subtitle = new Text({
      text: 'Texas Hold\'em',
      style: {
        fontFamily: 'Arial',
        fontSize: 22,
        fill: 0x88ccff,
      } as TextStyleOptions,
    });
    subtitle.anchor.set(0.5);
    subtitle.y = -30;
    this.addChild(subtitle);

    // Start button
    const btn = new Container();
    btn.y = 60;

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

    // Initialize audio and start background music on first user interaction
    this.audioManager = new AudioManager();
    this.audioManager.initialize().then(() => {
      // Try to start music immediately — will work if AudioContext is allowed
      this.audioManager.playMusic(0.2);
    });

    // Also attempt to start music on any user click (browser autoplay workaround)
    const resumeMusic = () => {
      this.audioManager.playMusic(0.2);
      document.removeEventListener('pointerdown', resumeMusic);
    };
    document.addEventListener('pointerdown', resumeMusic, { once: true });
  }

  destroy(): void {
    this.audioManager.stopMusic();
    super.destroy();
  }
}
