import { Container } from 'pixi.js';
import { Card, type CardData } from './Card.js';
import { COMMUNITY_CARD_WIDTH, COMMUNITY_CARD_HEIGHT, CARD_SPACING_COMMUNITY } from '../utils/constants.js';

export class CommunityCards extends Container {
  display(cards: CardData[]): void {
    this.removeChildren();

    const startOffset = -((cards.length - 1) * CARD_SPACING_COMMUNITY) / 2;

    cards.forEach((cardData, index) => {
      const card = new Card(COMMUNITY_CARD_WIDTH, COMMUNITY_CARD_HEIGHT);
      card.x = startOffset + index * CARD_SPACING_COMMUNITY;
      card.setCard(cardData, true);
      this.addChild(card);
    });
  }

  clear(): void {
    this.removeChildren();
  }
}
