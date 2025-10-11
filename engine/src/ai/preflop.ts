/**
 * Pre-flop AI decision logic
 */

import type { Card, PlayerAction } from '../types';
import type { AIConfig } from './ai-config';

/**
 * Game context for AI decisions
 */
export interface PreflopContext {
  pot: number;
  currentBet: number;
  playerBet: number;
  playerChips: number;
  minRaise: number;
  opponentChips: number;
  holeCards: Card[];
}

/**
 * Evaluate pre-flop hand strength (0-1 scale)
 * @param holeCards Player's hole cards
 * @returns Hand strength (0-1)
 */
export function evaluatePreflopHand(holeCards: Card[]): number {
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
 * Make pre-flop decision
 * @param context Game context
 * @param config AI configuration
 * @param strength Hand strength
 * @returns Player action
 */
export function decidePreflopAction(
  context: PreflopContext,
  config: AIConfig,
  strength: number
): PlayerAction {
  const { currentBet, playerBet, playerChips, minRaise } = context;
  const toCall = currentBet - playerBet;
  const canCheck = toCall === 0;

  // Simple pre-flop: mostly call/check, occasionally raise with good hands
  if (canCheck) {
    // No bet to face
    if (strength > 0.6 && Math.random() < config.aggression * 0.5) {
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
  if (strength > 0.7 && Math.random() < config.aggression) {
    const raiseAmount = Math.min(currentBet + minRaise, playerChips);
    return { type: 'raise', amount: raiseAmount };
  }

  return { type: 'call', amount: toCall };
}

