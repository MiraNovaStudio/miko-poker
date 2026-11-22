// (c) 2025 MiraNova Studio
/**
 * Pre-flop AI decision logic
 */

import type { Card, PlayerAction } from '../types.js';
import type { AIConfig } from './ai-config.js';

export interface PreflopContext {
  pot: number;
  currentBet: number;
  playerBet: number;
  playerChips: number;
  minRaise: number;
  opponentChips: number;
  holeCards: Card[];
  /** Player's position relative to dealer (0 = button, 1 = cutoff, etc.) */
  positionFromDealer?: number;
  /** Number of players still active (not folded) this hand */
  activePlayers?: number;
  /** Big blind amount */
  bigBlind?: number;
}

/**
 * Evaluate pre-flop hand strength (0-1 scale)
 */
export function evaluatePreflopHand(holeCards: Card[]): number {
  if (holeCards.length !== 2) return 0.3;

  const rankValues: Record<string, number> = {
    'A': 14, 'K': 13, 'Q': 12, 'J': 11, '10': 10,
    '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2
  };

  const val1 = rankValues[holeCards[0].rank];
  const val2 = rankValues[holeCards[1].rank];
  const maxVal = Math.max(val1, val2);
  const minVal = Math.min(val1, val2);
  const isPair = val1 === val2;
  const isSuited = holeCards[0].suit === holeCards[1].suit;
  const gap = maxVal - minVal;

  let strength = 0;

  if (isPair) {
    strength = 0.5 + (maxVal / 14) * 0.4; // 0.5–0.9
    return Math.min(1, strength);
  }

  strength = (maxVal + minVal) / 28;
  if (isSuited) strength += 0.1;
  if (gap === 1) strength += 0.05;
  else if (gap === 2) strength += 0.03;

  return Math.min(1, Math.max(0, strength));
}

/**
 * Make pre-flop decision based on playstyle config.
 */
export function decidePreflopAction(
  context: PreflopContext,
  config: AIConfig,
  strength: number
): PlayerAction {
  const { currentBet, playerBet, playerChips, minRaise } = context;
  const toCall = currentBet - playerBet;
  const canCheck = toCall === 0;

  // --- Can check (no bet to face) ---
  if (canCheck) {
    // Premium hands: raise
    if (strength > 0.75 && Math.random() < config.aggression) {
      const amount = Math.min(Math.floor(playerChips * 0.15), playerChips);
      return currentBet > 0
        ? { type: 'raise', amount }
        : { type: 'bet', amount };
    }
    // Maniacs raise with mediocre hands too
    if (config.playstyle === 'maniac' && strength > 0.4 && Math.random() < 0.4) {
      const amount = Math.min(Math.floor(playerChips * 0.12), playerChips);
      return currentBet > 0
        ? { type: 'raise', amount }
        : { type: 'bet', amount };
    }
    return { type: 'check' };
  }

  // --- Facing a bet ---

  // Shark blind steal: raise from button or cutoff when folded to them
  const bb = context.bigBlind ?? 10;
  const pos = context.positionFromDealer ?? 99;
  const isLatePosition = pos <= 1; // 0 = button, 1 = cutoff
  const foldedToUs = currentBet === bb && toCall === bb - playerBet;

  if (config.playstyle === 'shark' && isLatePosition && foldedToUs) {
    // Steal with a wider range: any hand above ~0.30 strength
    if (strength > 0.30) {
      // Strong hand (0.65+): raise 3.5x BB
      if (strength > 0.65) {
        const amount = Math.min(Math.floor(bb * 3.5), playerChips);
        return { type: 'raise', amount };
      }
      // Decent hand: standard 2.5x BB steal raise (~70% of the time)
      if (Math.random() < 0.7) {
        const amount = Math.min(Math.floor(bb * 2.5), playerChips);
        return { type: 'raise', amount };
      }
    }
  }

  // All-in decision
  if (toCall >= playerChips) {
    if (strength > 0.8) return { type: 'allin', amount: playerChips };
    if (config.playstyle === 'maniac' && strength > 0.55 && Math.random() < 0.3) {
      return { type: 'allin', amount: playerChips };
    }
    return { type: 'fold' };
  }

  // VPIP gate: fold if hand is below our threshold (with some randomness)
  if (strength < config.vpipThreshold) {
    // Maniacs sometimes call anyway
    if (config.playstyle === 'maniac' && Math.random() < 0.25) {
      return { type: 'call', amount: toCall };
    }
    // Passive players occasionally limp/call with marginal hands
    if (config.playstyle === 'passive' && strength > config.vpipThreshold - 0.1 && Math.random() < 0.15) {
      return { type: 'call', amount: toCall };
    }
    return { type: 'fold' };
  }

  // Above VPIP threshold — decide whether to raise or call
  const callRatio = toCall / playerChips;

  // Premium (0.75+): raise if aggressive enough
  if (strength > 0.75) {
    if (Math.random() < config.aggression) {
      const raiseAmt = Math.max(minRaise, Math.floor(currentBet * 2.5));
      return { type: 'raise', amount: Math.min(raiseAmt, playerChips) };
    }
    return { type: 'call', amount: toCall };
  }

  // Strong (0.6–0.75): sharks raise, others mostly call
  if (strength > 0.6) {
    if (callRatio > 0.25 && config.playstyle !== 'maniac') {
      return { type: 'fold' };
    }
    if (Math.random() < config.aggression * 0.5) {
      const raiseAmt = Math.max(minRaise, Math.floor(currentBet * 2));
      return { type: 'raise', amount: Math.min(raiseAmt, playerChips) };
    }
    return { type: 'call', amount: toCall };
  }

  // Marginal (vpipThreshold–0.6): call if cheap, fold if expensive
  if (callRatio > 0.15) {
    // Passive players have a slightly higher tolerance for calling
    if (config.playstyle === 'passive' && callRatio <= 0.25) {
      return { type: 'call', amount: toCall };
    }
    return { type: 'fold' };
  }
  return { type: 'call', amount: toCall };
}
