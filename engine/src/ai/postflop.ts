/**
 * Post-flop AI decision logic
 */

import type { Card, PlayerAction } from '../types';
import type { AIConfig } from './ai-config';
import { evaluateHand } from '../hand-evaluator';

/**
 * Game context for post-flop decisions
 */
export interface PostflopContext {
  pot: number;
  currentBet: number;
  playerBet: number;
  playerChips: number;
  minRaise: number;
  opponentChips: number;
  holeCards: Card[];
  communityCards: Card[];
}

/**
 * Evaluate post-flop hand strength (0-1 scale)
 * @param holeCards Player's hole cards
 * @param communityCards Community cards
 * @returns Hand strength (0-1)
 */
export function evaluatePostflopHand(
  holeCards: Card[],
  communityCards: Card[]
): number {
  if (communityCards.length === 0) {
    return 0.3; // Shouldn't happen, but fallback
  }

  const allCards = [...holeCards, ...communityCards];
  if (allCards.length < 5) {
    return 0.3;
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
 * Make post-flop decision
 * @param context Game context
 * @param config AI configuration
 * @param strength Hand strength
 * @returns Player action
 */
export function decidePostflopAction(
  context: PostflopContext,
  config: AIConfig,
  strength: number
): PlayerAction {
  const { pot, currentBet, playerBet, playerChips, minRaise } = context;
  const toCall = currentBet - playerBet;
  const canCheck = toCall === 0;
  const potOdds = toCall > 0 ? toCall / (pot + toCall) : 0;

  // Bluff factor
  const shouldBluff = Math.random() < config.bluffFrequency;

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
      if (Math.random() < config.aggression) {
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
    if (Math.random() < config.aggression * 0.7) {
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

