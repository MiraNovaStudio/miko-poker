/**
 * Deck management
 */

import type { Card, Suit, Rank } from './types.js';

export class Deck {
  private cards: Card[];
  
  constructor() {
    this.cards = [];
    this.reset();
  }

  /**
   * Reset deck to full 52 cards and shuffle
   */
  reset(): void {
    this.cards = [];
    const suits: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
    const ranks: Rank[] = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
    
    for (const suit of suits) {
      for (const rank of ranks) {
        this.cards.push({ suit, rank });
      }
    }
    
    this.shuffle();
  }

  /**
   * Fisher-Yates shuffle
   */
  shuffle(): void {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  /**
   * Deal one card from the top
   */
  deal(): Card {
    const card = this.cards.pop();
    if (!card) throw new Error('Deck is empty');
    return card;
  }

  /**
   * Deal multiple cards
   */
  dealMultiple(count: number): Card[] {
    const dealt: Card[] = [];
    for (let i = 0; i < count; i++) {
      dealt.push(this.deal());
    }
    return dealt;
  }

  /**
   * Burn a card (discard without revealing)
   */
  burn(): void {
    this.cards.pop();
  }

  /**
   * Get remaining cards count
   */
  remaining(): number {
    return this.cards.length;
  }
}

