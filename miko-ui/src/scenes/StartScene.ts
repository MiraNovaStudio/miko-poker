// (c) 2026 MiraNova Studio
import { Container, Sprite, Graphics, Text, type TextStyleOptions } from 'pixi.js';
import { AssetManager } from '../managers/AssetManager.js';
import { FONTS } from '../utils/constants.js';

export class StartScene extends Container {
  onStart: (() => void) | null = null;

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
      this.onStart?.();
    });
    this.addChild(btn);
  }
}
