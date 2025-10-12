/**
 * Betting round management
 */

import type { Player } from './player.js';
import type { PlayerAction } from './types.js';

export interface BettingRoundState {
  currentBet: number;
  lastRaiseAmount: number;
  minRaise: number;
  activePlayerIndex: number;
  lastAggressorIndex: number;
  isComplete: boolean;
}

export class BettingRound {
  private currentBet: number;
  private lastRaiseAmount: number;
  private minRaise: number;
  private lastAggressorIndex: number;

  constructor(minRaise: number = 0) {
    this.currentBet = 0;
    this.lastRaiseAmount = 0;
    this.minRaise = minRaise;
    this.lastAggressorIndex = -1;
  }

  /**
   * Get current bet to match
   */
  getCurrentBet(): number {
    return this.currentBet;
  }

  /**
   * Get minimum raise amount
   */
  getMinRaise(): number {
    return Math.max(this.minRaise, this.lastRaiseAmount || this.minRaise);
  }

  /**
   * Process a player action
   */
  processAction(player: Player, action: PlayerAction, playerIndex: number): boolean {
    if (!player.canAct()) return false;

    switch (action.type) {
      case 'fold':
        player.fold();
        return true;

      case 'check':
        if (this.currentBet > player.bet) {
          throw new Error('Cannot check when facing a bet');
        }
        return true;

      case 'call': {
        const toCall = this.currentBet - player.bet;
        // If amount specified, use it; otherwise calculate what's needed to call
        const callAmount = action.amount !== undefined ? action.amount : toCall;
        const amount = player.placeBet(callAmount);
        return true;
      }

      case 'bet': {
        if (this.currentBet > 0) {
          throw new Error('Cannot bet when there is already a bet');
        }
        const amount = player.placeBet(action.amount);
        this.currentBet = player.bet;
        this.lastRaiseAmount = amount;
        this.lastAggressorIndex = playerIndex;
        return true;
      }

      case 'raise': {
        const toCall = this.currentBet - player.bet;
        const minRaiseTotal = this.currentBet + this.getMinRaise();
        const raiseAmount = Math.max(action.amount, minRaiseTotal);

        const amount = player.placeBet(raiseAmount - player.bet);
        const newBet = player.bet;
        this.lastRaiseAmount = newBet - this.currentBet;
        this.currentBet = newBet;
        this.lastAggressorIndex = playerIndex;
        return true;
      }

      case 'allin': {
        // If no amount specified, bet all remaining chips
        const allinAmount = action.amount !== undefined ? action.amount : player.chips;
        const amount = player.placeBet(allinAmount);
        if (player.bet > this.currentBet) {
          this.lastRaiseAmount = player.bet - this.currentBet;
          this.currentBet = player.bet;
          this.lastAggressorIndex = playerIndex;
        }
        return true;
      }

      default:
        return false;
    }
  }

  /**
   * Check if betting round is complete
   * A round is complete when all active players have either:
   * - Folded
   * - Gone all-in
   * - Matched the current bet (and everyone has had a chance to act after the last raise)
   */
  isRoundComplete(players: Player[], startingIndex: number, currentIndex: number): boolean {
    const activePlayers = players.filter(p => p.canAct());

    // If only one player can act, round is complete
    if (activePlayers.length <= 1) {
      return true;
    }

    // Check if all active players have matched the current bet
    const allMatched = activePlayers.every(p => p.bet === this.currentBet);

    if (!allMatched) {
      return false;
    }

    // If there was no aggressor (all checks/calls, no raises)
    // Round completes when we've gone full circle back to starting player
    if (this.lastAggressorIndex === -1) {
      // Check if next player to act would be the starting player
      // This means we've completed one full orbit
      const nextToAct = (currentIndex + 1) % players.length;
      return nextToAct === startingIndex;
    }

    // Round is complete when we're back to the aggressor
    // (everyone after the aggressor has had a chance to respond)
    // This means the next player to act would be the aggressor themselves
    const nextToAct = (currentIndex + 1) % players.length;
    return nextToAct === this.lastAggressorIndex;
  }

  /**
   * Reset for new betting round
   * Ensures clean state for new street
   */
  reset(): void {
    this.currentBet = 0;
    this.lastRaiseAmount = 0;
    this.lastAggressorIndex = -1;
    // Verify clean state
    if (this.currentBet !== 0 || this.lastRaiseAmount !== 0) {
      throw new Error('Betting round reset failed - state not clean');
    }
  }

  /**
   * Set initial bet (for blinds)
   */
  setInitialBet(amount: number): void {
    this.currentBet = amount;
  }

  /**
   * Get state snapshot
   */
  getState(): BettingRoundState {
    return {
      currentBet: this.currentBet,
      lastRaiseAmount: this.lastRaiseAmount,
      minRaise: this.getMinRaise(),
      activePlayerIndex: 0,
      lastAggressorIndex: this.lastAggressorIndex,
      isComplete: false
    };
  }
}

