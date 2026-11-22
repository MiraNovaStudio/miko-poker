// (c) 2026 MiraNova Studio
import { Container } from 'pixi.js';
import { Card, type CardData } from './Card.js';
import { COMMUNITY_CARD_WIDTH, COMMUNITY_CARD_HEIGHT, CARD_SPACING_COMMUNITY } from '../utils/constants.js';
import { SettingsManager } from '../managers/SettingsManager.js';

/** Upper-left origin for deal animation (in parent/scene coords) */
const DEAL_ORIGIN_X = -480;
const DEAL_ORIGIN_Y = -340;

export class CommunityCards extends Container {
  private previousCount = 0;

  display(cards: CardData[]): void {
    this.removeChildren();

    const animate = SettingsManager.instance.cardAnimations;
    const startOffset = -((cards.length - 1) * CARD_SPACING_COMMUNITY) / 2;
    const newStartIndex = this.previousCount; // cards already shown last call

    cards.forEach((cardData, index) => {
      const card = new Card(COMMUNITY_CARD_WIDTH, COMMUNITY_CARD_HEIGHT);
      const targetX = startOffset + index * CARD_SPACING_COMMUNITY;
      card.setCard(cardData, true);
      this.addChild(card);

      if (animate && index >= newStartIndex) {
        // Animate new cards from upper-left corner (convert to local coords)
        const startX = DEAL_ORIGIN_X - this.x;
        const startY = DEAL_ORIGIN_Y - this.y;
        card.x = startX;
        card.y = startY;
        card.scale.set(0.2);
        card.alpha = 0;

        const delay = (index - newStartIndex) * 200;
        const duration = 400;

        setTimeout(() => {
          if (document.hidden) {
            card.x = targetX;
            card.y = 0;
            card.scale.set(1);
            card.alpha = 1;
            return;
          }
          const t0 = performance.now();
          const anim = (now: number) => {
            const t = Math.min((now - t0) / duration, 1);
            const ease = 1 - (1 - t) * (1 - t); // ease-out quad
            card.x = startX + (targetX - startX) * ease;
            card.y = startY + (0 - startY) * ease;
            card.scale.set(0.2 + 0.8 * ease);
            card.alpha = Math.min(1, t * 2);
            if (t < 1) requestAnimationFrame(anim);
          };
          requestAnimationFrame(anim);
        }, delay);
      } else {
        card.x = targetX;
      }
    });

    this.previousCount = cards.length;
  }

  clear(): void {
    this.removeChildren();
    this.previousCount = 0;
  }
}
