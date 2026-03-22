// (c) 2026 MiraNova Studios
import { Container, Text, type TextStyleOptions } from 'pixi.js';
import { FONTS } from '../utils/constants.js';

export class StatusBar extends Container {
  private potLabel: Text;
  private statusLabel: Text;
  private handLabel: Text;

  constructor() {
    super();

    // Pot label (center, above the table)
    // Anchor (0.5, 0) so multi-line text (side pots) grows downward from a fixed top
    this.potLabel = new Text({ text: 'Pot: $0', style: FONTS.potLabel as TextStyleOptions });
    this.potLabel.anchor.set(0.5, 0);
    this.potLabel.y = -105;
    this.potLabel.x = -410;
    this.addChild(this.potLabel);

    // Status label ("AI is thinking...", etc.) — bottom-left, aligned with action bar
    // StatusBar is at y=-140, action bar at y=320, so offset = 460
    this.statusLabel = new Text({ text: '', style: FONTS.statusBar as TextStyleOptions });
    this.statusLabel.anchor.set(0, 0.5);
    this.statusLabel.x = -460;
    this.statusLabel.y = 460;
    this.addChild(this.statusLabel);

    // Hand label (hand ranking) — bottom-right, aligned with action bar
    this.handLabel = new Text({ text: '', style: FONTS.handLabel as TextStyleOptions });
    this.handLabel.anchor.set(0, 0.5);
    this.handLabel.x = -460;
    this.handLabel.y = 430;
    this.addChild(this.handLabel);
  }

  setPot(text: string): void {
    this.potLabel.text = text;
  }

  setStatus(text: string): void {
    this.statusLabel.text = text;
  }

  setHand(text: string): void {
    this.handLabel.text = text;
  }

  /** Return the visual center of the first pot line (scene coords).
   *  With anchor (0.5, 0), the top of text is at potLabel.y.
   *  First line center ≈ potLabel.y + half a line height (~11px for fontSize 22). */
  getPotLabelScenePosition(): { x: number; y: number } {
    return {
      x: this.x + this.potLabel.x,
      y: this.y + this.potLabel.y + 11,
    };
  }

  getPotText(): string {
    return this.potLabel.text;
  }
}
