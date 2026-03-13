import { Sprite } from 'pixi.js';
import { AssetManager } from '../managers/AssetManager.js';
import { DEALER_BUTTON_SIZE, DEALER_BUTTON_OFFSET } from '../utils/constants.js';

export class DealerButton extends Sprite {
  constructor() {
    super();
    this.texture = AssetManager.get('dealer_button');
    this.anchor.set(0.5);
    this.width = DEALER_BUTTON_SIZE;
    this.height = DEALER_BUTTON_SIZE;
    this.visible = false;
  }

  /** Position the dealer button relative to a seat's world position */
  positionAt(seatX: number, seatY: number): void {
    this.x = seatX + DEALER_BUTTON_OFFSET.x;
    this.y = seatY + DEALER_BUTTON_OFFSET.y;
    this.visible = true;
  }

  hide(): void {
    this.visible = false;
  }
}
