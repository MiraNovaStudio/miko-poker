// (c) 2026 MiraNova Studios
/**
 * PotChips — renders a small stack of poker chip discs above the pot label.
 * Chips are drawn with Graphics primitives (no sprite assets needed).
 * The stack updates when the pot amount changes and can animate
 * chips flying to winner slots on showdown.
 */

import { Container, Graphics } from 'pixi.js';

// ─── Chip denominations and colors ───────────────────────────────

interface ChipDenom {
  value: number;
  fill: number;     // main color
  edge: number;     // darker edge
  stripe: number;   // accent stripe
}

const CHIP_DENOMS: ChipDenom[] = [
  { value: 500, fill: 0x9b59b6, edge: 0x7d3c98, stripe: 0xd2b4de },  // purple
  { value: 100, fill: 0x1a1a1a, edge: 0x000000, stripe: 0xdddddd },  // black
  { value: 25,  fill: 0x27ae60, edge: 0x1e8449, stripe: 0xa9dfbf },   // green
  { value: 10,  fill: 0x2980b9, edge: 0x1f6fa3, stripe: 0x85c1e9 },   // blue
  { value: 5,   fill: 0xe74c3c, edge: 0xc0392b, stripe: 0xf5b7b1 },   // red
  { value: 1,   fill: 0xecf0f1, edge: 0xbdc3c7, stripe: 0x95a5a6 },   // white
];

const CHIP_RADIUS = 12;
const CHIP_HEIGHT = 4;       // visible thickness of each disc
const MAX_CHIPS = 15;        // cap how many discs we draw total
const MAX_PER_STACK = 5;     // max chips per column before starting a new stack
const STACK_SPACING = 28;    // horizontal gap between stack columns

// ─── Component ───────────────────────────────────────────────────

export class PotChips extends Container {
  private chipGraphics: Graphics;
  private _chipStack: ChipDenom[] = [];

  constructor() {
    super();
    this.chipGraphics = new Graphics();
    this.addChild(this.chipGraphics);
  }

  /** Current number of chips in the visual stack. */
  get chipCount(): number {
    return this._chipStack.length;
  }

  /**
   * Rebuild the visual chip stack for a given pot amount.
   * Keeps it modest — caps at MAX_CHIPS discs.
   */
  update(potAmount: number): void {
    this._chipStack = this.decompose(potAmount);
    this.draw();
  }

  /** Clear the stack (e.g., between hands). */
  clear(): void {
    this._chipStack = [];
    this.chipGraphics.clear();
  }

  /** Reduce the visual stack by the given amount and redraw. */
  deduct(amount: number): void {
    let remaining = amount;
    // Remove chips from the stack (largest first) until we've deducted enough
    for (let i = 0; i < this._chipStack.length && remaining > 0; ) {
      if (this._chipStack[i].value <= remaining) {
        remaining -= this._chipStack[i].value;
        this._chipStack.splice(i, 1);
      } else {
        i++;
      }
    }
    // If we couldn't deduct exactly, just remove chips from the end
    while (remaining > 0 && this._chipStack.length > 0) {
      remaining -= this._chipStack.pop()!.value;
    }
    this.draw();
  }

  /**
   * Create flying-chip containers for the win animation.
   * Returns an array of small Graphics objects (clones of the stack)
   * positioned at this component's scene location, ready to be
   * animated by the caller.
   */
  createFlyingChips(count: number): Graphics[] {
    const chips: Graphics[] = [];
    const denomsToUse = this._chipStack.length > 0
      ? this._chipStack
      : this.decompose(100); // fallback

    for (let i = 0; i < Math.min(count, denomsToUse.length); i++) {
      const denom = denomsToUse[i % denomsToUse.length];
      const g = new Graphics();
      this.drawSingleChip(g, denom, 0, 0);
      chips.push(g);
    }
    return chips;
  }

  /** Get the world position of the chip stack center. */
  getScenePosition(): { x: number; y: number } {
    const pos = this.getGlobalPosition();
    // Convert back to scene coords (parent is the scene)
    const scene = this.parent;
    if (scene) {
      return { x: this.x + (scene as Container).x * 0, y: this.y };
    }
    return { x: this.x, y: this.y };
  }

  // ─── Internal ──────────────────────────────────────────────

  /** Break a pot amount into a capped list of chip denominations. */
  private decompose(amount: number): ChipDenom[] {
    const chips: ChipDenom[] = [];
    let remaining = amount;

    for (const denom of CHIP_DENOMS) {
      while (remaining >= denom.value && chips.length < MAX_CHIPS) {
        chips.push(denom);
        remaining -= denom.value;
      }
    }

    // If we capped out, that's fine — we just show a modest stack
    return chips;
  }

  /** Redraw the chip stack, splitting into side-by-side columns. */
  private draw(): void {
    this.chipGraphics.clear();

    const total = this._chipStack.length;
    if (total === 0) return;

    // Decide how many columns: 1 if <=5, 2 if <=10, 3 if more
    const numStacks = Math.min(3, Math.ceil(total / MAX_PER_STACK));
    // Center the columns horizontally
    const totalWidth = (numStacks - 1) * STACK_SPACING;
    const startX = -totalWidth / 2;

    // Distribute chips across columns (fill left to right, bottom up)
    for (let col = 0; col < numStacks; col++) {
      const colStart = col * MAX_PER_STACK;
      const colEnd = Math.min(colStart + MAX_PER_STACK, total);
      const colCount = colEnd - colStart;
      const cx = startX + col * STACK_SPACING;

      // Draw bottom-up within this column
      for (let i = 0; i < colCount; i++) {
        const denom = this._chipStack[colStart + colCount - 1 - i];
        const cy = -i * CHIP_HEIGHT;
        this.drawSingleChip(this.chipGraphics, denom, cx, cy);
      }
    }
  }

  /** Draw one chip disc at (cx, cy). */
  private drawSingleChip(g: Graphics, denom: ChipDenom, cx: number, cy: number): void {
    // Edge (darker bottom ellipse for 3D effect)
    g.ellipse(cx, cy + 2, CHIP_RADIUS, CHIP_RADIUS * 0.45);
    g.fill(denom.edge);

    // Main face
    g.ellipse(cx, cy, CHIP_RADIUS, CHIP_RADIUS * 0.45);
    g.fill(denom.fill);

    // Stripe ring (inner ellipse)
    g.ellipse(cx, cy, CHIP_RADIUS * 0.65, CHIP_RADIUS * 0.3);
    g.stroke({ color: denom.stripe, width: 1.5 });
  }
}
