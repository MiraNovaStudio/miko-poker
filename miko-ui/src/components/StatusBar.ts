import { Container, Text, type TextStyleOptions } from 'pixi.js';
import { FONTS } from '../utils/constants.js';

export class StatusBar extends Container {
  private potLabel: Text;
  private statusLabel: Text;
  private handLabel: Text;

  constructor() {
    super();

    // Pot label (top center of status area)
    this.potLabel = new Text({ text: 'Pot: $0', style: FONTS.potLabel as TextStyleOptions });
    this.potLabel.anchor.set(0.5);
    this.potLabel.y = -30;
    this.addChild(this.potLabel);

    // Status label (center)
    this.statusLabel = new Text({ text: '', style: FONTS.statusBar as TextStyleOptions });
    this.statusLabel.anchor.set(0.5);
    this.statusLabel.y = 0;
    this.addChild(this.statusLabel);

    // Hand label (below status, shows human's current hand strength)
    this.handLabel = new Text({ text: '', style: FONTS.handLabel as TextStyleOptions });
    this.handLabel.anchor.set(0.5);
    this.handLabel.y = 30;
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
}
