// (c) 2026 MiraNova Studios
import { Container } from 'pixi.js';
import { PlayerSlot } from './PlayerSlot.js';
import { SEAT_POSITIONS } from '../utils/constants.js';

export class SlotLayout extends Container {
  private slots: PlayerSlot[] = [];

  constructor() {
    super();
    this.createSlots();
  }

  private createSlots(): void {
    for (let i = 0; i < SEAT_POSITIONS.length; i++) {
      const pos = SEAT_POSITIONS[i];
      const slot = new PlayerSlot(i, pos);
      slot.x = pos.x;
      slot.y = pos.y;
      this.slots.push(slot);
      this.addChild(slot);
    }
  }

  getSlot(seatIndex: number): PlayerSlot | null {
    return this.slots[seatIndex] ?? null;
  }

  getAllSlots(): PlayerSlot[] {
    return [...this.slots];
  }
}
