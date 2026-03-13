// (c) 2025 MiraNova Studios
/**
 * Post-flop AI decision logic
 */

import type { Card, PlayerAction } from '../types.js';
import type { AIConfig } from './ai-config.js';
import { evaluateHand } from '../hand-evaluator.js';

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
 */
export function evaluatePostflopHand(
  holeCards: Card[],
  communityCards: Card[]
): number {
  if (communityCards.length === 0) return 0.3;

  const allCards = [...holeCards, ...communityCards];
  if (allCards.length < 5) return 0.3;

  const hand = evaluateHand(allCards);
  let strength = hand.category / 8;
  if (hand.kickers.length > 0) {
    strength = Math.min(1, strength + (hand.kickers[0] / 14) * 0.1);
  }
  return strength;
}

/**
 * Make post-flop decision based on playstyle config.
 */
export function decidePostflopAction(
  context: PostflopContext,
  config: AIConfig,
  strength: number
): PlayerAction {
  const { pot, currentBet, playerBet, playerChips, minRaise } = context;
  const toCall = currentBet - playerBet;
  const canCheck = toCall === 0;
  const shouldBluff = Math.random() < config.bluffFrequency;

  // --- Can check (no bet to face) ---
  if (canCheck) {
    // Value bet with strong hands
    if (strength > config.valueBetThreshold) {
      if (Math.random() < config.aggression) {
        const betSize = Math.floor(pot * (0.5 + Math.random() * 0.5));
        const amount = Math.min(betSize, playerChips);
        return currentBet > 0
          ? { type: 'raise', amount }
          : { type: 'bet', amount };
      }
    }

    // Medium hands — aggressive players bet, others check
    if (strength > 0.4 && Math.random() < config.aggression * 0.5) {
      const amount = Math.min(Math.floor(pot * 0.4), playerChips);
      return currentBet > 0
        ? { type: 'raise', amount }
        : { type: 'bet', amount };
    }

    // Bluff with weak hands
    if (shouldBluff && strength < 0.3) {
      const amount = Math.min(Math.floor(pot * (0.5 + Math.random() * 0.3)), playerChips);
      return currentBet > 0
        ? { type: 'raise', amount }
        : { type: 'bet', amount };
    }

    // Maniacs bet with almost anything
    if (config.playstyle === 'maniac' && Math.random() < 0.35) {
      const amount = Math.min(Math.floor(pot * 0.6), playerChips);
      return currentBet > 0
        ? { type: 'raise', amount }
        : { type: 'bet', amount };
    }

    return { type: 'check' };
  }

  // --- Facing a bet ---

  // All-in decision
  if (toCall >= playerChips) {
    if (strength > 0.75) return { type: 'allin', amount: playerChips };
    if (strength > 0.5 && config.playstyle === 'maniac' && Math.random() < 0.3) {
      return { type: 'allin', amount: playerChips };
    }
    if (strength > 0.6 && Math.random() < 0.3) {
      return { type: 'allin', amount: playerChips };
    }
    return { type: 'fold' };
  }

  const callRatio = toCall / pot;

  // Strong hand — call (no re-raising to prevent infinite loops)
  if (strength > 0.7) {
    return { type: 'call', amount: toCall };
  }

  // Above call threshold — call based on pot odds
  if (strength > config.callThreshold) {
    // Passive players call almost everything above their threshold
    if (config.playstyle === 'passive') {
      return { type: 'call', amount: toCall };
    }
    // Others check pot odds
    if (callRatio < 0.5 || Math.random() < 0.6) {
      return { type: 'call', amount: toCall };
    }
    return { type: 'fold' };
  }

  // Below threshold but cheap — occasional call
  if (callRatio < 0.2 && Math.random() < 0.25) {
    return { type: 'call', amount: toCall };
  }

  // Maniacs sometimes call with garbage
  if (config.playstyle === 'maniac' && Math.random() < 0.2) {
    return { type: 'call', amount: toCall };
  }

  return { type: 'fold' };
}
