// (c) 2026 MiraNova Studio
import { Sprite } from 'pixi.js';
import { AssetManager } from '../managers/AssetManager.js';
import { DEALER_BUTTON_SIZE, DEALER_BUTTON_OFFSETS } from '../utils/constants.js';

export class DealerButton extends Sprite {
  // The correct scale values after width/height are set to DEALER_BUTTON_SIZE
  private _normalScaleX = 1;
  private _normalScaleY = 1;

  constructor() {
    super();
    this.texture = AssetManager.get('dealer_button');
    this.anchor.set(0.5);
    this.width = DEALER_BUTTON_SIZE;
    this.height = DEALER_BUTTON_SIZE;
    // Capture the scale that PixiJS computed for the desired size
    this._normalScaleX = this.scale.x;
    this._normalScaleY = this.scale.y;
    this.visible = false;
  }

  /** Position the dealer button relative to a seat, using per-seat offsets to stay on the table */
  positionAt(seatX: number, seatY: number, seatIndex?: number): void {
    const offset = (seatIndex !== undefined && DEALER_BUTTON_OFFSETS[seatIndex])
      ? DEALER_BUTTON_OFFSETS[seatIndex]
      : DEALER_BUTTON_OFFSETS[0];
    this.x = seatX + offset.x;
    this.y = seatY + offset.y;
    this.scale.set(this._normalScaleX, this._normalScaleY);
    this.visible = true;
  }

  /** Animate the dealer button flying from the center of the table to the target seat */
  flyTo(seatX: number, seatY: number, seatIndex?: number, duration = 800): void {
    const offset = (seatIndex !== undefined && DEALER_BUTTON_OFFSETS[seatIndex])
      ? DEALER_BUTTON_OFFSETS[seatIndex]
      : DEALER_BUTTON_OFFSETS[0];
    const targetX = seatX + offset.x;
    const targetY = seatY + offset.y;
    const sx = this._normalScaleX;
    const sy = this._normalScaleY;

    // Start from center of table at small size
    this.x = 0;
    this.y = 0;
    this.alpha = 0;
    this.scale.set(sx * 0.3, sy * 0.3);
    this.visible = true;

    const startTime = performance.now();
    const animate = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);

      this.x = targetX * ease;
      this.y = targetY * ease;
      this.alpha = Math.min(t * 2, 1);
      const s = 0.3 + 0.7 * ease;
      this.scale.set(sx * s, sy * s);

      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        this.x = targetX;
        this.y = targetY;
        this.alpha = 1;
        this.scale.set(sx, sy);
      }
    };
    requestAnimationFrame(animate);
  }

  hide(): void {
    this.visible = false;
  }
}
