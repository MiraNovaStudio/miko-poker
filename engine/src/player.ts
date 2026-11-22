// (c) 2025 MiraNova Studio
/**
 * Player state management
 */

import type { Card, PlayerState } from './types.js';

export class Player {
  id: string;
  chips: number;
  bet: number;
  totalBet: number;
  folded: boolean;
  allIn: boolean;
  cards: Card[];
  isDealer: boolean;
  isActive: boolean;

  constructor(id: string, chips: number) {
    this.id = id;
    this.chips = chips;
    this.bet = 0;
    this.totalBet = 0;
    this.folded = false;
    this.allIn = false;
    this.cards = [];
    this.isDealer = false;
    this.isActive = true;
  }

  /**
   * Reset player for a new hand (keep chips)
   */
  resetForNewHand(): void {
    this.bet = 0;
    this.totalBet = 0;
    this.isActive = this.chips > 0;
    this.folded = !this.isActive;
    this.allIn = false;
    this.cards = [];
  }

  /**
   * Reset bet amount for a new street
   */
  resetBetForStreet(): void {
    this.bet = 0;
  }

  /**
   * Place a bet/raise
   */
  placeBet(amount: number): number {
    const actualAmount = Math.min(amount, this.chips);
    this.chips -= actualAmount;
    this.bet += actualAmount;
    this.totalBet += actualAmount;
    
    if (this.chips === 0) {
      this.allIn = true;
    }
    
    return actualAmount;
  }

  /**
   * Fold hand
   */
  fold(): void {
    this.folded = true;
    this.isActive = false;
  }

  /**
   * Add chips (winning pot)
   */
  addChips(amount: number): void {
    this.chips += amount;
  }

  /**
   * Deal cards to player
   */
  dealCards(cards: Card[]): void {
    this.cards = [...cards];
  }

  /**
   * Check if player can act
   */
  canAct(): boolean {
    return this.isActive && !this.folded && !this.allIn;
  }

  /**
   * Get player state snapshot
   */
  getState(): PlayerState {
    return {
      id: this.id,
      chips: this.chips,
      bet: this.bet,
      totalBet: this.totalBet,
      folded: this.folded,
      allIn: this.allIn,
      cards: [...this.cards],
      isDealer: this.isDealer,
      isActive: this.isActive
    };
  }

  /**
   * Get available actions for this player
   */
  getAvailableActions(currentBet: number, minRaise: number): string[] {
    if (!this.canAct()) return [];

    const actions: string[] = [];
    const toCall = currentBet - this.bet;

    if (toCall === 0) {
      actions.push('check');
      actions.push('bet');
    } else {
      actions.push('fold');
      if (this.chips > 0) {
        actions.push('call');
        if (this.chips > toCall) {
          actions.push('raise');
        }
      }
    }

    if (this.chips > 0) {
      actions.push('allin');
    }

    return actions;
  }

  /**
   * Calculate amount needed to call
   */
  getCallAmount(currentBet: number): number {
    return Math.min(currentBet - this.bet, this.chips);
  }

  /**
   * Calculate minimum raise amount
   */
  getMinRaiseAmount(currentBet: number, minRaise: number): number {
    const toCall = currentBet - this.bet;
    return Math.min(toCall + minRaise, this.chips);
  }
}

