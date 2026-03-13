import { Sprite } from 'pixi.js';
import { AssetManager } from '../managers/AssetManager.js';
import { DEALER_BUTTON_SIZE, DEALER_BUTTON_OFFSETS } from '../utils/constants.js';

export class DealerButton extends Sprite {
  constructor() {
    super();
    this.texture = AssetManager.get('dealer_button');
    this.anchor.set(0.5);
    this.width = DEALER_BUTTON_SIZE;
    this.height = DEALER_BUTTON_SIZE;
    this.visible = false;
  }

  /** Position the dealer button relative to a seat, using per-seat offsets to stay on the table */
  positionAt(seatX: number, seatY: number, seatIndex?: number): void {
    const offset = (seatIndex !== undefined && DEALER_BUTTON_OFFSETS[seatIndex])
      ? DEALER_BUTTON_OFFSETS[seatIndex]
      : DEALER_BUTTON_OFFSETS[0];
    this.x = seatX + offset.x;
    this.y = seatY + offset.y;
    this.visible = true;
  }

  hide(): void {
    this.visible = false;
  }
}
