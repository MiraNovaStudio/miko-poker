import { Container, Graphics, Text, type TextStyleOptions } from 'pixi.js';
import { Card, type CardData } from './Card.js';
import {
  HOLE_CARD_WIDTH, HOLE_CARD_HEIGHT, CARD_SPACING_HOLE,
  CHIP_OVERLAY_WIDTH, CHIP_OVERLAY_HEIGHT, CHIP_OVERLAY_Y,
  COLORS, FONTS, TOP_ROW_SEATS, getBetLabelOffset,
} from '../utils/constants.js';

const CHIP_OVERLAY_RADIUS = 8;

export class PlayerSlot extends Container {
  readonly seatIndex: number;

  // Child display objects
  private nameLabel: Text;
  private chipsLabel: Text;
  private betLabel: Text;
  private statusLabel: Text;
  private chipOverlay: Graphics;
  private cardsContainer: Container;

  private _isHighlighted = false;

  constructor(seatIndex: number, seatPos: { x: number; y: number }) {
    super();
    this.seatIndex = seatIndex;

    // Cards container (above center of slot)
    this.cardsContainer = new Container();
    this.cardsContainer.y = -20;
    this.addChild(this.cardsContainer);

    // Chip overlay bar (dark bg behind chip text, overlapping lower portion of cards)
    this.chipOverlay = new Graphics();
    this.drawChipOverlay(COLORS.darkGray);
    this.chipOverlay.y = CHIP_OVERLAY_Y;
    this.addChild(this.chipOverlay);

    // Chips label (centered on overlay)
    this.chipsLabel = new Text({ text: '', style: FONTS.chipStack as TextStyleOptions });
    this.chipsLabel.anchor.set(0.5);
    this.chipsLabel.y = CHIP_OVERLAY_Y;
    this.addChild(this.chipsLabel);

    // Player name label
    const isTopRow = TOP_ROW_SEATS.includes(seatIndex);
    this.nameLabel = new Text({ text: '', style: FONTS.playerName as TextStyleOptions });
    this.nameLabel.anchor.set(0.5);
    this.nameLabel.y = isTopRow ? -90 : 50;
    this.addChild(this.nameLabel);

    // Bet label (positioned based on seat region)
    const betOffset = getBetLabelOffset(seatIndex, seatPos);
    this.betLabel = new Text({ text: '', style: FONTS.betLabel as TextStyleOptions });
    this.betLabel.anchor.set(0.5);
    this.betLabel.x = betOffset.x;
    this.betLabel.y = betOffset.y;
    this.betLabel.visible = false;
    this.addChild(this.betLabel);

    // Status label (ALL-IN, ELIMINATED)
    this.statusLabel = new Text({ text: '', style: FONTS.statusLabel as TextStyleOptions });
    this.statusLabel.anchor.set(0.5);
    this.statusLabel.y = 90;
    this.statusLabel.visible = false;
    this.addChild(this.statusLabel);
  }

  // --- Public API ---

  setPlayerName(name: string): void {
    this.nameLabel.text = name;
  }

  setChips(amount: number): void {
    this.chipsLabel.text = `$${amount}`;
  }

  setBet(amount: number, actionText?: string): void {
    if (actionText) {
      this.betLabel.text = actionText;
      this.betLabel.visible = true;
    } else if (amount > 0) {
      this.betLabel.text = `$${amount}`;
      this.betLabel.visible = true;
    } else {
      this.betLabel.text = '';
      this.betLabel.visible = false;
    }
  }

  clearBet(): void {
    this.betLabel.text = '';
    this.betLabel.visible = false;
  }

  setStatus(status: string, show = true): void {
    this.statusLabel.text = status;
    this.statusLabel.visible = show;
  }

  clearStatus(): void {
    this.statusLabel.text = '';
    this.statusLabel.visible = false;
  }

  /** Deal hole cards. faceUp = true only for human player. */
  dealCards(cards: CardData[], faceUp: boolean): void {
    this.clearCards();
    this.cardsContainer.visible = true;

    cards.forEach((cardData, index) => {
      const xOffset = index * CARD_SPACING_HOLE - (CARD_SPACING_HOLE / 2);
      const card = new Card(HOLE_CARD_WIDTH, HOLE_CARD_HEIGHT);
      card.x = xOffset;
      card.setCard(cardData, faceUp);
      this.cardsContainer.addChild(card);
    });
  }

  /** Reveal all cards face-up (showdown) */
  revealCards(): void {
    for (const child of this.cardsContainer.children) {
      if (child instanceof Card) {
        child.showFace();
      }
    }
  }

  clearCards(): void {
    this.cardsContainer.removeChildren();
  }

  hideCards(): void {
    this.cardsContainer.visible = false;
  }

  showCards(): void {
    this.cardsContainer.visible = true;
  }

  highlight(active: boolean): void {
    this._isHighlighted = active;
    this.drawChipOverlay(active ? COLORS.activeGreen : COLORS.darkGray);
  }

  /** Reset slot for a new hand (clear cards, bets, status) */
  resetForNewHand(): void {
    this.clearCards();
    this.clearBet();
    this.clearStatus();
    this.highlight(false);
    this.cardsContainer.visible = true;
  }

  // --- Internal ---

  private drawChipOverlay(color: number): void {
    this.chipOverlay.clear();
    this.chipOverlay.roundRect(
      -CHIP_OVERLAY_WIDTH / 2,
      -CHIP_OVERLAY_HEIGHT / 2,
      CHIP_OVERLAY_WIDTH,
      CHIP_OVERLAY_HEIGHT,
      CHIP_OVERLAY_RADIUS,
    );
    this.chipOverlay.fill({ color, alpha: 1 });
  }
}
