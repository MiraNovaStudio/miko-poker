// (c) 2025 MiraNova Studio
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

  // Map hand categories to a spread that reflects how strong they actually are.
  // Most showdown hands are high-card/pair/two-pair, so we need granularity there.
  const categoryStrength: Record<number, number> = {
    0: 0.10,  // high card
    1: 0.30,  // one pair
    2: 0.50,  // two pair
    3: 0.65,  // three of a kind
    4: 0.75,  // straight
    5: 0.80,  // flush
    6: 0.88,  // full house
    7: 0.95,  // four of a kind
    8: 1.00,  // straight flush
  };

  let strength = categoryStrength[hand.category] ?? hand.category / 8;

  // Add kicker bonus within the category (up to +0.08)
  if (hand.kickers.length > 0) {
    strength = Math.min(1, strength + (hand.kickers[0] / 14) * 0.08);
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
    // Strong hands (two pair+) — everyone bets these most of the time
    if (strength > config.valueBetThreshold) {
      const betChance = Math.max(config.aggression, 0.6); // at least 60% even for passives
      if (Math.random() < betChance) {
        const betSize = Math.floor(pot * (0.5 + Math.random() * 0.5));
        const amount = Math.min(betSize, playerChips);
        return currentBet > 0
          ? { type: 'raise', amount }
          : { type: 'bet', amount };
      }
    }

    // Made hands (pair+) — bet sometimes, even passives should bet top pair
    if (strength > 0.28) {
      // Passives bet ~35% with made hands, sharks/maniacs much more
      const betChance = config.playstyle === 'passive' ? 0.35 : config.aggression;
      if (Math.random() < betChance) {
        const betSize = Math.floor(pot * (0.3 + Math.random() * 0.4));
        const amount = Math.min(betSize, playerChips);
        return currentBet > 0
          ? { type: 'raise', amount }
          : { type: 'bet', amount };
      }
    }

    // Bluff with weak hands
    if (shouldBluff && strength < 0.2) {
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
    // Passive players are more willing to call but still fold to big bets
    if (config.playstyle === 'passive') {
      if (callRatio < 0.7 || Math.random() < 0.4) {
        return { type: 'call', amount: toCall };
      }
      return { type: 'fold' };
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
