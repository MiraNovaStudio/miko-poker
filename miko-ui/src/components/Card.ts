// (c) 2026 MiraNova Studios
import { Container, Sprite, Graphics, Text, type TextStyleOptions } from 'pixi.js';
import { AssetManager } from '../managers/AssetManager.js';
import { SettingsManager } from '../managers/SettingsManager.js';
import { HOLE_CARD_WIDTH, HOLE_CARD_HEIGHT } from '../utils/constants.js';

export interface CardData {
  rank: string;
  suit: string;
}

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: '\u2665',
  diamonds: '\u2666',
  clubs: '\u2663',
  spades: '\u2660',
};

const SUIT_COLORS: Record<string, number> = {
  hearts: 0xcc0000,
  diamonds: 0xcc0000,
  clubs: 0x111111,
  spades: 0x111111,
};

const SUIT_COLORS_4: Record<string, number> = {
  hearts: 0xcc0000,
  diamonds: 0x2266cc,
  clubs: 0x228833,
  spades: 0x111111,
};

const CARD_BG = 0xf5f5f0;
const CARD_BORDER = 0x888888;
const CARD_RADIUS = 6;

// ─── Card back designs ──────────────────────────────────────────

export interface CardBackDesign {
  id: string;
  label: string;
  color: number;       // main background
  pattern: number;     // inner accent / diamond
  border: number;      // inner border tint
  style: 'diamond' | 'cross' | 'stripes' | 'oval';
}

export const CARD_BACK_DESIGNS: CardBackDesign[] = [
  { id: 'classic-blue',  label: 'Classic Blue',  color: 0x2255aa, pattern: 0x1a4488, border: 0xffffff, style: 'diamond' },
  { id: 'royal-red',     label: 'Royal Red',     color: 0x991b1b, pattern: 0x771515, border: 0xffd700, style: 'diamond' },
  { id: 'emerald',       label: 'Emerald',       color: 0x166534, pattern: 0x0d4a22, border: 0xa7f3d0, style: 'cross' },
  { id: 'midnight',      label: 'Midnight',      color: 0x1e1b4b, pattern: 0x312e81, border: 0x818cf8, style: 'stripes' },
  { id: 'burgundy',      label: 'Burgundy',      color: 0x6b1e3a, pattern: 0x4a1528, border: 0xf9a8d4, style: 'oval' },
  { id: 'charcoal',      label: 'Charcoal',      color: 0x2d2d2d, pattern: 0x444444, border: 0xaaaaaa, style: 'cross' },
  { id: 'ocean',         label: 'Ocean',         color: 0x0e4d6e, pattern: 0x0a3a52, border: 0x7dd3fc, style: 'stripes' },
  { id: 'purple-haze',   label: 'Purple Haze',   color: 0x581c87, pattern: 0x3b0764, border: 0xd8b4fe, style: 'diamond' },
];

export class Card extends Container {
  // PNG mode
  private cardSprite: Sprite;
  // Unicode mode
  private unicodeContainer: Container;
  private unicodeBg: Graphics;
  private rankLabel: Text;
  private suitSmallLabel: Text;
  private suitLargeLabel: Text;
  private backContainer: Container;
  private backBg: Graphics;

  private cardData: CardData | null = null;
  private _isFaceUp = false;
  private _cardWidth: number;
  private _cardHeight: number;

  constructor(width = HOLE_CARD_WIDTH, height = HOLE_CARD_HEIGHT) {
    super();
    this._cardWidth = width;
    this._cardHeight = height;

    // --- PNG sprite (hidden when unicode mode) ---
    this.cardSprite = new Sprite();
    this.cardSprite.anchor.set(0.5);
    this.cardSprite.width = width;
    this.cardSprite.height = height;
    this.addChild(this.cardSprite);

    // --- Unicode face container ---
    this.unicodeContainer = new Container();
    this.unicodeContainer.visible = false;
    this.addChild(this.unicodeContainer);

    // Card background with rounded corners
    this.unicodeBg = new Graphics();
    this.unicodeContainer.addChild(this.unicodeBg);

    // Rank label (top-left, bold)
    this.rankLabel = new Text({ text: '', style: {
      fontFamily: 'Arial',
      fontSize: 1, // sized dynamically
      fontWeight: 'bold',
      fill: 0x000000,
    } as TextStyleOptions });
    this.rankLabel.anchor.set(0, 0);
    this.unicodeContainer.addChild(this.rankLabel);

    // Small suit symbol (below rank, top-left)
    this.suitSmallLabel = new Text({ text: '', style: {
      fontFamily: 'Arial',
      fontSize: 1,
      fill: 0x000000,
    } as TextStyleOptions });
    this.suitSmallLabel.anchor.set(0, 0);
    this.unicodeContainer.addChild(this.suitSmallLabel);

    // Large suit symbol (bottom-right area)
    this.suitLargeLabel = new Text({ text: '', style: {
      fontFamily: 'Arial',
      fontSize: 1,
      fill: 0x000000,
    } as TextStyleOptions });
    this.suitLargeLabel.anchor.set(1, 1);
    this.unicodeContainer.addChild(this.suitLargeLabel);

    // --- Unicode back container ---
    this.backContainer = new Container();
    this.backContainer.visible = false;
    this.addChild(this.backContainer);

    this.backBg = new Graphics();
    this.backContainer.addChild(this.backBg);
  }

  setCard(data: CardData, faceUp = true): void {
    this.cardData = data;
    this._isFaceUp = faceUp;
    this.updateDisplay();
  }

  showFace(): void {
    this._isFaceUp = true;
    this.updateDisplay();
  }

  showBack(): void {
    this._isFaceUp = false;
    this.updateDisplay();
  }

  flip(): void {
    this._isFaceUp = !this._isFaceUp;
    this.updateDisplay();
  }

  setSize(width: number, height: number): void {
    this._cardWidth = width;
    this._cardHeight = height;
    this.cardSprite.width = width;
    this.cardSprite.height = height;
    this.updateDisplay();
  }

  getCardData(): CardData | null {
    return this.cardData;
  }

  isFaceUpCard(): boolean {
    return this._isFaceUp;
  }

  /** Force re-render (call after deckType changes) */
  refresh(): void {
    this.updateDisplay();
  }

  private updateDisplay(): void {
    if (!this.cardData) return;

    const isUnicode = SettingsManager.instance.deckType === 'unicode';

    if (isUnicode) {
      this.cardSprite.visible = false;
      if (this._isFaceUp) {
        this.unicodeContainer.visible = true;
        this.backContainer.visible = false;
        this.drawUnicodeFace();
      } else {
        this.unicodeContainer.visible = false;
        this.backContainer.visible = true;
        this.drawUnicodeBack();
      }
    } else {
      // PNG mode — use PNG faces but drawn card backs
      this.unicodeContainer.visible = false;
      if (this._isFaceUp) {
        this.backContainer.visible = false;
        this.cardSprite.visible = true;
        const texture = AssetManager.getCardTexture(this.cardData.rank, this.cardData.suit);
        if (texture) {
          this.cardSprite.texture = texture;
        }
        this.cardSprite.width = this._cardWidth;
        this.cardSprite.height = this._cardHeight;
      } else {
        this.cardSprite.visible = false;
        this.backContainer.visible = true;
        this.drawUnicodeBack();
      }
    }
  }

  private drawUnicodeFace(): void {
    if (!this.cardData) return;

    const w = this._cardWidth;
    const h = this._cardHeight;
    const suit = this.cardData.suit;
    const colorMap = SettingsManager.instance.fourColorDeck ? SUIT_COLORS_4 : SUIT_COLORS;
    const color = colorMap[suit] ?? 0x000000;
    const suitSymbol = SUIT_SYMBOLS[suit] ?? '?';
    const r = Math.max(CARD_RADIUS * (w / 80), 3);
    const pad = w * 0.07;

    // Draw card background
    this.unicodeBg.clear();
    this.unicodeBg.roundRect(-w / 2, -h / 2, w, h, r);
    this.unicodeBg.fill({ color: CARD_BG });
    this.unicodeBg.roundRect(-w / 2, -h / 2, w, h, r);
    this.unicodeBg.stroke({ color: CARD_BORDER, width: 1 });

    // Scale font sizes — big bold rank, massive center suit
    const rankSize = Math.round(h * 0.26);
    const suitSmallSize = Math.round(h * 0.15);
    const suitLargeSize = Math.round(h * 0.6);

    // Rank label (top-left corner, bold)
    this.rankLabel.style.fontSize = rankSize;
    this.rankLabel.style.fill = color;
    this.rankLabel.text = this.cardData.rank;
    this.rankLabel.x = -w / 2 + pad;
    this.rankLabel.y = -h / 2 + pad * 0.4;

    // Small suit symbol (below rank, top-left)
    this.suitSmallLabel.style.fontSize = suitSmallSize;
    this.suitSmallLabel.style.fill = color;
    this.suitSmallLabel.text = suitSymbol;
    this.suitSmallLabel.anchor.set(0.5, 0);
    this.suitSmallLabel.x = this.rankLabel.x + rankSize * 0.3;
    this.suitSmallLabel.y = this.rankLabel.y + rankSize * 0.9;

    // Massive center suit symbol — dominates the card like ACR
    this.suitLargeLabel.style.fontSize = suitLargeSize;
    this.suitLargeLabel.style.fill = color;
    this.suitLargeLabel.text = suitSymbol;
    this.suitLargeLabel.anchor.set(0.5, 0.5);
    this.suitLargeLabel.x = w * 0.08;
    this.suitLargeLabel.y = h * 0.08;
  }

  private drawUnicodeBack(): void {
    const w = this._cardWidth;
    const h = this._cardHeight;
    const r = Math.max(CARD_RADIUS * (w / 80), 3);
    const inset = w * 0.08;

    const designId = SettingsManager.instance.cardBack;
    const design = CARD_BACK_DESIGNS.find(d => d.id === designId) ?? CARD_BACK_DESIGNS[0];

    this.backBg.clear();
    // Outer card shape
    this.backBg.roundRect(-w / 2, -h / 2, w, h, r);
    this.backBg.fill({ color: design.color });
    this.backBg.roundRect(-w / 2, -h / 2, w, h, r);
    this.backBg.stroke({ color: design.border, width: 1 });

    // Inner decorative border
    const innerR = Math.max(r - 2, 2);
    this.backBg.roundRect(-w / 2 + inset, -h / 2 + inset, w - inset * 2, h - inset * 2, innerR);
    this.backBg.stroke({ color: design.border, width: 1, alpha: 0.4 });

    // Center pattern varies by style
    switch (design.style) {
      case 'diamond': {
        const dw = w * 0.18;
        const dh = h * 0.14;
        this.backBg.moveTo(0, -dh);
        this.backBg.lineTo(dw, 0);
        this.backBg.lineTo(0, dh);
        this.backBg.lineTo(-dw, 0);
        this.backBg.closePath();
        this.backBg.fill({ color: design.pattern, alpha: 0.6 });
        this.backBg.stroke({ color: design.border, width: 1, alpha: 0.3 });
        break;
      }
      case 'cross': {
        const armW = w * 0.08;
        const armH = h * 0.22;
        // Vertical bar
        this.backBg.roundRect(-armW / 2, -armH, armW, armH * 2, 2);
        this.backBg.fill({ color: design.pattern, alpha: 0.5 });
        // Horizontal bar
        this.backBg.roundRect(-armH * 0.6, -armW / 2, armH * 1.2, armW, 2);
        this.backBg.fill({ color: design.pattern, alpha: 0.5 });
        break;
      }
      case 'stripes': {
        const stripeW = w * 0.06;
        const count = 3;
        const gap = w * 0.14;
        const startX = -(count - 1) * gap / 2;
        for (let i = 0; i < count; i++) {
          const sx = startX + i * gap;
          this.backBg.roundRect(sx - stripeW / 2, -h / 2 + inset + 2, stripeW, h - inset * 2 - 4, 2);
          this.backBg.fill({ color: design.pattern, alpha: 0.4 });
        }
        break;
      }
      case 'oval': {
        this.backBg.ellipse(0, 0, w * 0.2, h * 0.16);
        this.backBg.fill({ color: design.pattern, alpha: 0.5 });
        this.backBg.ellipse(0, 0, w * 0.2, h * 0.16);
        this.backBg.stroke({ color: design.border, width: 1, alpha: 0.3 });
        break;
      }
    }
  }
}
