import { Container, Sprite, Texture } from 'pixi.js';
import { AssetManager } from '../managers/AssetManager.js';
import { HOLE_CARD_WIDTH, HOLE_CARD_HEIGHT } from '../utils/constants.js';

export interface CardData {
  rank: string;
  suit: string;
}

export class Card extends Container {
  private cardSprite: Sprite;
  private cardData: CardData | null = null;
  private _isFaceUp = false;
  private _cardWidth: number;
  private _cardHeight: number;

  constructor(width = HOLE_CARD_WIDTH, height = HOLE_CARD_HEIGHT) {
    super();
    this._cardWidth = width;
    this._cardHeight = height;

    this.cardSprite = new Sprite();
    this.cardSprite.anchor.set(0.5);
    this.cardSprite.width = width;
    this.cardSprite.height = height;
    this.addChild(this.cardSprite);
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
  }

  getCardData(): CardData | null {
    return this.cardData;
  }

  isFaceUpCard(): boolean {
    return this._isFaceUp;
  }

  private updateDisplay(): void {
    if (!this.cardData) return;

    let texture: Texture;
    if (this._isFaceUp) {
      texture = AssetManager.getCardTexture(this.cardData.rank, this.cardData.suit);
    } else {
      texture = AssetManager.getCardBack();
    }

    if (texture) {
      this.cardSprite.texture = texture;
    }

    // Re-enforce size after texture swap
    this.cardSprite.width = this._cardWidth;
    this.cardSprite.height = this._cardHeight;
  }
}
