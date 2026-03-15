// (c) 2026 MiraNova Studios
import { Container, Graphics, Sprite, Text, Texture, type TextStyleOptions } from 'pixi.js';
import { Card, type CardData } from './Card.js';
import {
  HOLE_CARD_WIDTH, HOLE_CARD_HEIGHT, CARD_SPACING_HOLE,
  CHIP_OVERLAY_WIDTH, CHIP_OVERLAY_HEIGHT, CHIP_OVERLAY_Y,
  COLORS, FONTS, TOP_ROW_SEATS, SIDE_SEATS, getBetLabelOffset,
} from '../utils/constants.js';
import { SettingsManager, formatChips } from '../managers/SettingsManager.js';

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
  private avatarSprite: Sprite | null = null;
  private winnerLabel: Text | null = null;
  private winnerTimer: ReturnType<typeof setTimeout> | null = null;

  private _isHighlighted = false;
  private _folded = false;
  private _foldedCards: CardData[] = [];
  private _allIn = false;
  private _isSideSeat: boolean;
  private _seatPos: { x: number; y: number };
  /** Bet label offset when side seat should show label toward center (preflop–turn). */
  private _betOffsetMiddle: { x: number; y: number };
  /** Bet label offset when side seat should show label below board (river). */
  private _betOffsetWide: { x: number; y: number };

  constructor(seatIndex: number, seatPos: { x: number; y: number }) {
    super();
    this.seatIndex = seatIndex;
    this._seatPos = seatPos;
    this._isSideSeat = SIDE_SEATS.includes(seatIndex);
    this._betOffsetWide = getBetLabelOffset(seatIndex, seatPos);
    // Middle position: closer to center, between player and community area
    if (seatPos.x < 0) {
      this._betOffsetMiddle = { x: 160, y: -30 };
    } else if (seatPos.x > 0) {
      this._betOffsetMiddle = { x: -160, y: -30 };
    } else {
      this._betOffsetMiddle = this._betOffsetWide;
    }

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

    // Bet label (positioned based on seat region; side seats start in middle)
    const betOffset = this._isSideSeat ? this._betOffsetMiddle : this._betOffsetWide;

    this.betLabel = new Text({ text: '', style: FONTS.betLabel as TextStyleOptions });
    this.betLabel.anchor.set(0.5);
    this.betLabel.x = betOffset.x;
    this.betLabel.y = betOffset.y;
    this.betLabel.visible = false;
    this.addChild(this.betLabel);

    // Status label (ALL-IN, ELIMINATED)
    this.statusLabel = new Text({ text: '', style: FONTS.statusLabel as TextStyleOptions });
    this.statusLabel.anchor.set(0.5);
    this.statusLabel.y = isTopRow ? 130 : 90;
    this.statusLabel.visible = false;
    this.addChild(this.statusLabel);
  }

  // --- Public API ---

  /**
   * Move the bet label for side seats based on the current street.
   * Preflop/flop/turn → middle position (toward center, clear of board).
   * River → wide position (below the board, clear of 5th community card).
   */
  updateBetLabelForStreet(street: string): void {
    if (!this._isSideSeat) return;
    const offset = street === 'river' ? this._betOffsetWide : this._betOffsetMiddle;
    this.betLabel.x = offset.x;
    this.betLabel.y = offset.y;
  }

  setPlayerName(name: string): void {
    this.nameLabel.text = name;
  }

  /** Set the player's avatar from a pre-generated texture. */
  setAvatar(texture: Texture): void {
    if (this.avatarSprite) {
      this.removeChild(this.avatarSprite);
      this.avatarSprite.destroy();
    }

    this.avatarSprite = new Sprite(texture);
    this.avatarSprite.anchor.set(0.5);
    this.avatarSprite.width = 80;
    this.avatarSprite.height = 80;

    // Sit on top of chip overlay — bottom of avatar aligns with top edge of stack box
    this.avatarSprite.y = CHIP_OVERLAY_Y - CHIP_OVERLAY_HEIGHT / 2 - 40;

    // Insert behind cards container so dealt cards overlap the avatar
    const cardsIdx = this.getChildIndex(this.cardsContainer);
    this.addChildAt(this.avatarSprite, cardsIdx);
  }

  /** Remove the avatar sprite. */
  clearAvatar(): void {
    if (this.avatarSprite) {
      this.removeChild(this.avatarSprite);
      this.avatarSprite.destroy();
      this.avatarSprite = null;
    }
  }

  setChips(amount: number): void {
    if (this._allIn) return; // preserve "ALL IN" label
    this.chipsLabel.text = formatChips(amount);
  }

  setBet(amount: number, actionText?: string): void {
    // Reset to default style
    this.betLabel.style.fontSize = (FONTS.betLabel as { fontSize: number }).fontSize;
    this.betLabel.style.fontStyle = 'normal';
    this.betLabel.style.fill = COLORS.white;
    if (actionText) {
      this.betLabel.text = actionText;
      this.betLabel.visible = true;

    } else if (amount > 0) {
      this.betLabel.style.fill = COLORS.yellow;
      this.betLabel.text = formatChips(amount);
      this.betLabel.visible = true;

    } else {
      this.betLabel.text = '';
      this.betLabel.visible = false;
    }
  }

  getBetLabelPosition(): { x: number; y: number } {
    return { x: this.betLabel.x, y: this.betLabel.y };
  }

  setBetColor(color: number): void {
    this.betLabel.style.fill = color;
  }

  setBetSmallItalic(text: string): void {
    this.betLabel.style.fontSize = 16;
    this.betLabel.style.fontStyle = 'italic';
    this.betLabel.text = text;
    this.betLabel.visible = true;
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

  /** Show "ALL IN" in bold red inside the chip overlay, replacing the chip count */
  showAllIn(): void {
    this._allIn = true;
    this.chipsLabel.text = 'ALL IN';
    this.chipsLabel.style.fill = COLORS.statusRed;
  }

  /** Restore chip label to normal yellow style */
  clearAllIn(): void {
    this._allIn = false;
    this.chipsLabel.style.fill = (FONTS.chipStack as { fill: number }).fill;
  }

  /** Deal hole cards. faceUp = true only for human player.
   *  When card animations are on, cards slide in from the table center (0,0 in scene coords).
   *  Pass skipAnim=true to bypass animation (e.g. showdown reveal). */
  dealCards(cards: CardData[], faceUp: boolean, skipAnim = false): void {
    this.clearCards();
    this._foldedCards = cards.slice();
    this.cardsContainer.visible = true;

    const animate = !skipAnim && SettingsManager.instance.cardAnimations;

    cards.forEach((cardData, index) => {
      const targetX = index * CARD_SPACING_HOLE - (CARD_SPACING_HOLE / 2);
      const card = new Card(HOLE_CARD_WIDTH, HOLE_CARD_HEIGHT);
      card.setCard(cardData, faceUp);
      this.cardsContainer.addChild(card);

      if (animate) {
        // Start from table center in slot-local coords
        const startX = -this.x - this.cardsContainer.x;
        const startY = -this.y - this.cardsContainer.y;
        card.x = startX;
        card.y = startY;
        card.scale.set(0.3);
        card.alpha = 0;

        const delay = index * 150;
        const duration = 350;

        setTimeout(() => {
          const t0 = performance.now();
          const anim = (now: number) => {
            const t = Math.min((now - t0) / duration, 1);
            const ease = 1 - (1 - t) * (1 - t); // ease-out quad
            card.x = startX + (targetX - startX) * ease;
            card.y = startY + (0 - startY) * ease;
            card.scale.set(0.3 + 0.7 * ease);
            card.alpha = Math.min(1, t * 2);
            if (t < 1) requestAnimationFrame(anim);
          };
          requestAnimationFrame(anim);
        }, delay);
      } else {
        card.x = targetX;
      }
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
    this._folded = true;
    this.cardsContainer.visible = false;
    this.setupFoldHover();
  }

  /** Animate cards flying to a target position (scene coords), then hide */
  foldCardsTo(targetX: number, targetY: number): void {
    this._folded = true;
    if (this.cardsContainer.children.length === 0) {
      this.cardsContainer.visible = false;
      this.setupFoldHover();
      return;
    }

    // Convert target from scene coords to this slot's local coords
    const localTargetX = targetX - this.x;
    const localTargetY = targetY - this.y - this.cardsContainer.y;

    const cards = [...this.cardsContainer.children];
    const startPositions = cards.map(c => ({ x: c.x, y: c.y }));
    const startTime = performance.now();
    const duration = 400;

    const animate = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1);
      const ease = t * t;

      cards.forEach((card, i) => {
        const start = startPositions[i];
        card.x = start.x + (localTargetX - start.x) * ease;
        card.y = start.y + (localTargetY - start.y) * ease;
        card.alpha = 1 - ease * 0.7;
        card.scale.set(1 - ease * 0.5);
      });

      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        this.cardsContainer.visible = false;
        cards.forEach((card, i) => {
          card.x = startPositions[i].x;
          card.y = startPositions[i].y;
          card.alpha = 1;
          card.scale.set(1);
        });
        this.setupFoldHover();
      }
    };
    requestAnimationFrame(animate);
  }

  showCards(): void {
    this.cardsContainer.visible = true;
  }

  highlight(active: boolean): void {
    this._isHighlighted = active;
    this.drawChipOverlay(active ? COLORS.activeGreen : COLORS.darkGray);
  }

  /** Show an animated "WINNER!" label over the cards area */
  showWinnerLabel(duration = 8000): void {
    this.hideWinnerLabel();

    this.winnerLabel = new Text({
      text: 'WINNER!',
      style: {
        fontFamily: 'Arial',
        fontSize: 42,
        fontWeight: 'bold',
        fill: COLORS.yellow,
        stroke: { color: COLORS.black, width: 3 },
      } as TextStyleOptions,
    });
    this.winnerLabel.anchor.set(0.5);
    this.winnerLabel.y = -20; // centered on cards area
    this.winnerLabel.scale.set(0);
    this.winnerLabel.alpha = 0;
    this.addChild(this.winnerLabel);

    // Animate: scale up + fade in over ~300ms using requestAnimationFrame
    const startTime = performance.now();
    const animDuration = 300;
    const label = this.winnerLabel;
    const animate = (now: number) => {
      const t = Math.min((now - startTime) / animDuration, 1);
      // Ease-out back for a slight overshoot bounce
      const ease = 1 - Math.pow(1 - t, 3);
      const overshoot = t < 1 ? 1 + 0.3 * Math.sin(t * Math.PI) : 1;
      label.scale.set(ease * overshoot);
      label.alpha = ease;
      if (t < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);

    this.winnerTimer = setTimeout(() => this.hideWinnerLabel(), duration);
  }

  /** Show an animated "BUTTON" label over the cards area */
  showButtonLabel(duration = 3000): void {
    this.hideWinnerLabel();

    this.winnerLabel = new Text({
      text: 'BUTTON',
      style: {
        fontFamily: 'Arial',
        fontSize: 42,
        fontWeight: 'bold',
        fill: COLORS.yellow,
        stroke: { color: COLORS.black, width: 3 },
      } as TextStyleOptions,
    });
    this.winnerLabel.anchor.set(0.5);
    this.winnerLabel.y = -20;
    this.winnerLabel.scale.set(0);
    this.winnerLabel.alpha = 0;
    this.addChild(this.winnerLabel);

    const startTime = performance.now();
    const animDuration = 300;
    const label = this.winnerLabel;
    const animate = (now: number) => {
      const t = Math.min((now - startTime) / animDuration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      const overshoot = t < 1 ? 1 + 0.3 * Math.sin(t * Math.PI) : 1;
      label.scale.set(ease * overshoot);
      label.alpha = ease;
      if (t < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);

    this.winnerTimer = setTimeout(() => this.hideWinnerLabel(), duration);
  }

  /** Show an animated "KNOCKED OUT" label over the cards area */
  showKnockedOutLabel(duration = 7000): void {
    this.hideWinnerLabel();

    this.winnerLabel = new Text({
      text: 'K.O.',
      style: {
        fontFamily: 'Arial',
        fontSize: 32,
        fontWeight: 'bold',
        fill: 0xff4444,
        stroke: { color: COLORS.black, width: 3 },
      } as TextStyleOptions,
    });
    this.winnerLabel.anchor.set(0.5);
    this.winnerLabel.y = -20;
    this.winnerLabel.scale.set(0);
    this.winnerLabel.alpha = 0;
    this.addChild(this.winnerLabel);

    // Animate: shake + scale up
    const startTime = performance.now();
    const animDuration = 500;
    const label = this.winnerLabel;
    const animate = (now: number) => {
      const t = Math.min((now - startTime) / animDuration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      label.scale.set(ease);
      label.alpha = ease;
      // Shake effect during animation
      if (t < 0.8) {
        label.x = (Math.random() - 0.5) * 6 * (1 - t);
      } else {
        label.x = 0;
      }
      if (t < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);

    this.winnerTimer = setTimeout(() => this.hideWinnerLabel(), duration);
  }

  hideWinnerLabel(): void {
    if (this.winnerTimer) {
      clearTimeout(this.winnerTimer);
      this.winnerTimer = null;
    }
    if (this.winnerLabel) {
      this.removeChild(this.winnerLabel);
      this.winnerLabel.destroy();
      this.winnerLabel = null;
    }
  }

  /** Reset slot for a new hand (clear cards, bets, status) */
  resetForNewHand(): void {
    this.clearCards();
    this.clearBet();
    this.clearStatus();
    this.clearAllIn();
    this.highlight(false);
    this.hideWinnerLabel();
    this._folded = false;
    this._foldedCards = [];
    this.chipOverlay.eventMode = 'none';
    this.chipOverlay.cursor = 'default';
    this.chipOverlay.removeAllListeners();
    this.cardsContainer.visible = true;
    // Reset side seat bet label to middle position for new hand
    if (this._isSideSeat) {
      this.betLabel.x = this._betOffsetMiddle.x;
      this.betLabel.y = this._betOffsetMiddle.y;
    }
  }

  /** For human player only: toggle folded cards at 50% opacity on click of stack box */
  private setupFoldHover(): void {
    if (this.seatIndex !== 0 || !this._folded || this._foldedCards.length === 0) return;

    // Re-deal the cards face-up but hidden, ready for toggle
    this.clearCards();
    this._foldedCards.forEach((cardData, index) => {
      const xOffset = index * CARD_SPACING_HOLE - (CARD_SPACING_HOLE / 2);
      const card = new Card(HOLE_CARD_WIDTH, HOLE_CARD_HEIGHT);
      card.x = xOffset;
      card.setCard(cardData, true);
      this.cardsContainer.addChild(card);
    });
    this.cardsContainer.visible = false;

    // Make chip overlay clickable to toggle folded cards
    this.chipOverlay.eventMode = 'static';
    this.chipOverlay.cursor = 'pointer';

    this.chipOverlay.on('pointerdown', () => {
      if (!this._folded) return;
      if (this.cardsContainer.visible) {
        this.cardsContainer.visible = false;
        this.cardsContainer.alpha = 1;
      } else {
        this.cardsContainer.visible = true;
        this.cardsContainer.alpha = 0.5;
      }
    });
  }

  /** Animate the chip count spinning from one value to another */
  animateChipsTo(from: number, to: number, duration = 1000): void {
    const startTime = performance.now();
    const label = this.chipsLabel;

    const animate = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1);
      // Ease-out quad for a smooth deceleration
      const ease = 1 - (1 - t) * (1 - t);
      const current = Math.round(from + (to - from) * ease);
      label.text = formatChips(current);
      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        label.text = formatChips(to);
      }
    };
    requestAnimationFrame(animate);
  }

  /** Pulse the chip overlay to indicate chips received */
  pulseChipOverlay(): void {
    const startTime = performance.now();
    const pulseDuration = 600;
    const overlay = this.chipOverlay;
    const label = this.chipsLabel;
    const originalScaleX = overlay.scale.x;
    const originalScaleY = overlay.scale.y;

    const animate = (now: number) => {
      const t = Math.min((now - startTime) / pulseDuration, 1);
      // Pulse: scale up then back down
      const pulse = 1 + 0.3 * Math.sin(t * Math.PI);
      overlay.scale.set(originalScaleX * pulse, originalScaleY * pulse);
      label.scale.set(pulse);
      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        overlay.scale.set(originalScaleX, originalScaleY);
        label.scale.set(1);
      }
    };
    requestAnimationFrame(animate);
  }

  /** Animate this slot sliding in from a given scene position.
   *  Returns a promise that resolves when the animation completes. */
  slideInFrom(fromX: number, fromY: number, duration = 600): Promise<void> {
    return new Promise(resolve => {
      const targetX = this.x;
      const targetY = this.y;
      this.x = fromX;
      this.y = fromY;
      this.alpha = 0;
      this.scale.set(0.5);
      this.visible = true;

      const startTime = performance.now();
      const animate = (now: number) => {
        const t = Math.min((now - startTime) / duration, 1);
        // Ease-out cubic
        const ease = 1 - Math.pow(1 - t, 3);
        this.x = fromX + (targetX - fromX) * ease;
        this.y = fromY + (targetY - fromY) * ease;
        this.alpha = Math.min(1, t * 2);
        this.scale.set(0.5 + 0.5 * ease);
        if (t < 1) {
          requestAnimationFrame(animate);
        } else {
          this.x = targetX;
          this.y = targetY;
          this.alpha = 1;
          this.scale.set(1);
          resolve();
        }
      };
      requestAnimationFrame(animate);
    });
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
