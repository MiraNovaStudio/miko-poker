/**
 * AI decision-making for computer opponents
 */

import type { Card, Street, PlayerAction } from './types';
import { evaluateHand } from './hand-evaluator';

export interface AIConfig {
  aggression: number;    // 0-1: how aggressive (0=passive, 1=very aggressive)
  tightness: number;     // 0-1: how tight (0=loose, 1=tight)
  bluffFrequency: number; // 0-1: how often to bluff
  skill: number;         // 0-1: general skill level
}

export interface GameContext {
  street: Street;
  pot: number;
  currentBet: number;
  playerBet: number;     // AI's current bet this street
  playerChips: number;   // AI's remaining chips
  minRaise: number;
  opponentChips: number;
  holeCards: Card[];
  communityCards: Card[];
}

export class PokerAI {
  private config: AIConfig;

  constructor(config?: Partial<AIConfig>) {
    this.config = {
      aggression: config?.aggression ?? 0.5,
      tightness: config?.tightness ?? 0.5,
      bluffFrequency: config?.bluffFrequency ?? 0.2,
      skill: config?.skill ?? 0.7
    };
  }

  /**
   * Make a decision based on current game state
   */
  decide(context: GameContext): PlayerAction {
    const { street, currentBet, playerBet, playerChips, pot, minRaise } = context;
    const toCall = currentBet - playerBet;
    const canCheck = toCall === 0;

    // Calculate hand strength
    const strength = this.evaluateHandStrength(context);
    
    // Calculate pot odds if facing a bet
    const potOdds = toCall > 0 ? toCall / (pot + toCall) : 0;

    // Pre-flop logic
    if (street === 'preflop') {
      return this.decidePreflopAction(context, strength, canCheck);
    }

    // Post-flop logic
    return this.decidePostflopAction(context, strength, potOdds, canCheck);
  }

  /**
   * Pre-flop decision making
   */
  private decidePreflopAction(
    context: GameContext,
    strength: number,
    canCheck: boolean
  ): PlayerAction {
    const { currentBet, playerBet, playerChips, minRaise } = context;
    const toCall = currentBet - playerBet;

    // Simple pre-flop: mostly call/check, occasionally raise with good hands
    if (canCheck) {
      // No bet to face
      if (strength > 0.6 && Math.random() < this.config.aggression * 0.5) {
        const betAmount = Math.min(Math.floor(playerChips * 0.2), playerChips);
        return { type: 'bet', amount: betAmount };
      }
      return { type: 'check' };
    }

    // Facing a bet
    if (toCall >= playerChips) {
      // All-in call decision
      if (strength > 0.7 || (strength > 0.5 && Math.random() < 0.3)) {
        return { type: 'allin', amount: playerChips };
      }
      return { type: 'fold' };
    }

    // Fold if weak and bet is significant
    if (strength < 0.3 && toCall > playerChips * 0.1) {
      return { type: 'fold' };
    }

    // Call or raise based on strength
    if (strength > 0.7 && Math.random() < this.config.aggression) {
      const raiseAmount = Math.min(currentBet + minRaise, playerChips);
      return { type: 'raise', amount: raiseAmount };
    }

    return { type: 'call', amount: toCall };
  }

  /**
   * Post-flop decision making
   */
  private decidePostflopAction(
    context: GameContext,
    strength: number,
    potOdds: number,
    canCheck: boolean
  ): PlayerAction {
    const { pot, currentBet, playerBet, playerChips, minRaise } = context;
    const toCall = currentBet - playerBet;

    // Bluff factor
    const shouldBluff = Math.random() < this.config.bluffFrequency;

    if (canCheck) {
      // No bet to face - decide whether to bet or check
      
      // Strong hand - value bet
      if (strength > 0.7) {
        const betSize = Math.floor(pot * (0.5 + Math.random() * 0.5)); // 50-100% pot
        const betAmount = Math.min(betSize, playerChips);
        return { type: 'bet', amount: betAmount };
      }

      // Medium hand - sometimes bet, sometimes check
      if (strength > 0.5) {
        if (Math.random() < this.config.aggression) {
          const betAmount = Math.min(Math.floor(pot * 0.5), playerChips);
          return { type: 'bet', amount: betAmount };
        }
        return { type: 'check' };
      }

      // Weak hand - bluff occasionally
      if (shouldBluff && Math.random() < 0.3) {
        const betAmount = Math.min(Math.floor(pot * 0.6), playerChips);
        return { type: 'bet', amount: betAmount };
      }

      return { type: 'check' };
    }

    // Facing a bet
    if (toCall >= playerChips) {
      // All-in call decision
      if (strength > 0.8 || (strength > 0.6 && Math.random() < 0.4)) {
        return { type: 'allin', amount: playerChips };
      }
      return { type: 'fold' };
    }

    // Strong hand - raise or call
    if (strength > 0.75) {
      if (Math.random() < this.config.aggression * 0.7) {
        const raiseSize = Math.floor(pot * (0.5 + Math.random() * 0.5));
        const raiseAmount = Math.min(currentBet + Math.max(minRaise, raiseSize), playerChips);
        return { type: 'raise', amount: raiseAmount };
      }
      return { type: 'call', amount: toCall };
    }

    // Good hand - call if pot odds favorable
    if (strength > 0.6) {
      if (potOdds < 0.3 || Math.random() < 0.7) {
        return { type: 'call', amount: toCall };
      }
      return { type: 'fold' };
    }

    // Medium hand - call if cheap, fold if expensive
    if (strength > 0.4) {
      const callRatio = toCall / pot;
      if (callRatio < 0.3 || (callRatio < 0.5 && Math.random() < 0.5)) {
        return { type: 'call', amount: toCall };
      }
      return { type: 'fold' };
    }

    // Weak hand - bluff raise occasionally, otherwise fold
    if (shouldBluff && Math.random() < 0.15) {
      const raiseAmount = Math.min(currentBet + minRaise, playerChips);
      return { type: 'raise', amount: raiseAmount };
    }

    // Cheap call with weak hand if pot odds very favorable
    if (toCall < pot * 0.15 && Math.random() < 0.3) {
      return { type: 'call', amount: toCall };
    }

    return { type: 'fold' };
  }

  /**
   * Evaluate hand strength (0-1 scale)
   */
  private evaluateHandStrength(context: GameContext): number {
    const { holeCards, communityCards, street } = context;

    // Pre-flop: simple hand strength based on hole cards
    if (street === 'preflop' || communityCards.length === 0) {
      return this.evaluatePreflopHand(holeCards);
    }

    // Post-flop: evaluate actual hand
    const allCards = [...holeCards, ...communityCards];
    if (allCards.length < 5) {
      return this.evaluatePreflopHand(holeCards);
    }

    const hand = evaluateHand(allCards);
    
    // Convert hand category to 0-1 scale
    // Category ranges from 0 (high card) to 8 (straight flush)
    let strength = hand.category / 8;

    // Add kicker strength bonus (small)
    if (hand.kickers.length > 0) {
      const kickerBonus = (hand.kickers[0] / 14) * 0.1;
      strength = Math.min(1, strength + kickerBonus);
    }

    return strength;
  }

  /**
   * Simple pre-flop hand evaluation
   */
  private evaluatePreflopHand(holeCards: Card[]): number {
    if (holeCards.length !== 2) return 0.3;

    const card1 = holeCards[0];
    const card2 = holeCards[1];

    const rankValues: Record<string, number> = {
      'A': 14, 'K': 13, 'Q': 12, 'J': 11, '10': 10,
      '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2
    };

    const val1 = rankValues[card1.rank];
    const val2 = rankValues[card2.rank];
    const maxVal = Math.max(val1, val2);
    const minVal = Math.min(val1, val2);

    const isPair = val1 === val2;
    const isSuited = card1.suit === card2.suit;
    const gap = maxVal - minVal;

    let strength = 0;

    // Pocket pairs
    if (isPair) {
      strength = 0.5 + (maxVal / 14) * 0.4; // 0.5-0.9
      return Math.min(1, strength);
    }

    // High cards
    strength = (maxVal + minVal) / 28; // 0.14-1.0

    // Suited bonus
    if (isSuited) {
      strength += 0.1;
    }

    // Connected cards bonus
    if (gap === 1) {
      strength += 0.05;
    } else if (gap === 2) {
      strength += 0.03;
    }

    return Math.min(1, Math.max(0, strength));
  }

  /**
   * Update AI configuration
   */
  setConfig(config: Partial<AIConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): AIConfig {
    return { ...this.config };
  }
}

