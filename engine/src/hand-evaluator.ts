// (c) 2025 MiraNova Studios
/**
 * Poker hand evaluation logic
 * Evaluates 5-7 card hands and determines the best possible hand
 */

import type { Card, Rank, Suit, HandStrength } from './types.js';

// Map ranks to numerical values (Ace high = 14)
const RANK_VALUES: Record<Rank, number> = {
  'A': 14, 'K': 13, 'Q': 12, 'J': 11, '10': 10,
  '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2
};

/**
 * Evaluate the best possible 5-card hand from up to 7 cards
 */
export function evaluateHand(cards: Card[]): HandStrength {
  if (cards.length < 5 || cards.length > 7) {
    throw new Error('Hand evaluation requires 5-7 cards');
  }

  // Count cards by rank and suit
  const rankCounts = new Map<number, number>();
  const suitCounts = new Map<Suit, number>();
  const rankValues: number[] = [];

  for (const card of cards) {
    const value = RANK_VALUES[card.rank];
    rankCounts.set(value, (rankCounts.get(value) || 0) + 1);
    suitCounts.set(card.suit, (suitCounts.get(card.suit) || 0) + 1);
    rankValues.push(value);
  }

  rankValues.sort((a, b) => b - a);

  // Check for flush
  let flushSuit: Suit | null = null;
  for (const [suit, count] of suitCounts) {
    if (count >= 5) {
      flushSuit = suit;
      break;
    }
  }

  // Get unique ranks for straight detection
  const uniqueRanks = Array.from(new Set(rankValues)).sort((a, b) => b - a);
  const straightHigh = findStraightHigh(uniqueRanks);

  // Check for straight flush
  if (flushSuit) {
    const flushCards = cards.filter(c => c.suit === flushSuit);
    const flushRanks = Array.from(new Set(flushCards.map(c => RANK_VALUES[c.rank]))).sort((a, b) => b - a);
    const sfHigh = findStraightHigh(flushRanks);
    if (sfHigh > 0) {
      return { category: 8, kickers: [sfHigh] };
    }
  }

  // Group ranks by count (quads, trips, pairs)
  const groups = Array.from(rankCounts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return b.value - a.value;
    });

  // Four of a kind
  if (groups[0]?.count === 4) {
    const fourValue = groups[0].value;
    const kicker = groups.find(g => g.value !== fourValue)!.value;
    return { category: 7, kickers: [fourValue, kicker] };
  }

  // Full house
  if (groups[0]?.count === 3) {
    const tripsValue = groups[0].value;
    const pairValue = groups.find(g => g.count >= 2 && g.value !== tripsValue)?.value;
    if (pairValue) {
      return { category: 6, kickers: [tripsValue, pairValue] };
    }
  }

  // Flush (no straight flush)
  if (flushSuit) {
    const flushValues = cards
      .filter(c => c.suit === flushSuit)
      .map(c => RANK_VALUES[c.rank])
      .sort((a, b) => b - a)
      .slice(0, 5);
    return { category: 5, kickers: flushValues };
  }

  // Straight
  if (straightHigh > 0) {
    return { category: 4, kickers: [straightHigh] };
  }

  // Three of a kind
  if (groups[0]?.count === 3) {
    const tripsValue = groups[0].value;
    const kickers = groups
      .filter(g => g.value !== tripsValue)
      .map(g => g.value)
      .sort((a, b) => b - a)
      .slice(0, 2);
    return { category: 3, kickers: [tripsValue, ...kickers] };
  }

  // Two pair
  const pairs = groups.filter(g => g.count === 2).map(g => g.value);
  if (pairs.length >= 2) {
    const [pair1, pair2] = pairs.slice(0, 2).sort((a, b) => b - a);
    const kicker = groups.find(g => g.value !== pair1 && g.value !== pair2)!.value;
    return { category: 2, kickers: [pair1, pair2, kicker] };
  }

  // One pair
  if (groups[0]?.count === 2) {
    const pairValue = groups[0].value;
    const kickers = groups
      .filter(g => g.value !== pairValue)
      .map(g => g.value)
      .sort((a, b) => b - a)
      .slice(0, 3);
    return { category: 1, kickers: [pairValue, ...kickers] };
  }

  // High card
  const highCardKickers = uniqueRanks.slice(0, 5);
  return { category: 0, kickers: highCardKickers };
}

/**
 * Find the highest card in a straight, returns -1 if no straight exists
 * Handles both regular straights and the wheel (A-2-3-4-5)
 */
function findStraightHigh(sortedUniqueRanks: number[]): number {
  if (sortedUniqueRanks.length < 5) return -1;

  // Add ace as 1 for wheel detection
  const ranks = [...sortedUniqueRanks];
  if (ranks.includes(14)) {
    ranks.push(1);
  }

  let consecutiveCount = 1;
  let bestHigh = -1;

  for (let i = 0; i < ranks.length - 1; i++) {
    if (ranks[i] - 1 === ranks[i + 1]) {
      consecutiveCount++;
      if (consecutiveCount >= 5) {
        // High card of the straight is 4 positions back
        bestHigh = Math.max(bestHigh, ranks[i - 3]);
      }
    } else if (ranks[i] !== ranks[i + 1]) {
      consecutiveCount = 1;
    }
  }

  return bestHigh;
}

/**
 * Compare two hands. Returns:
 * - positive if hand1 wins
 * - negative if hand2 wins
 * - 0 for tie
 */
export function compareHands(hand1: HandStrength, hand2: HandStrength): number {
  if (hand1.category !== hand2.category) {
    return hand1.category - hand2.category;
  }

  const maxKickers = Math.max(hand1.kickers.length, hand2.kickers.length);
  for (let i = 0; i < maxKickers; i++) {
    const k1 = hand1.kickers[i] || 0;
    const k2 = hand2.kickers[i] || 0;
    if (k1 !== k2) return k1 - k2;
  }

  return 0; // Perfect tie
}

/**
 * Get a human-readable description of a hand
 */
export function getHandName(hand: HandStrength): string {
  const categoryNames = [
    'High Card',
    'One Pair',
    'Two Pair',
    'Three of a Kind',
    'Straight',
    'Flush',
    'Full House',
    'Four of a Kind',
    'Straight Flush'
  ];
  if (hand.category === 0) {
    return `${getRankName(hand.kickers[0])} High`;
  }
  if (hand.category === 2 && hand.kickers[0] === 14) {
    return 'Aces Up';
  }
  return categoryNames[hand.category] || `Unknown Hand (${hand.category})`;
}

/**
 * Get rank name from value
 */
export function getRankName(value: number): string {
  const valueToRank: Record<number, string> = {
    14: 'Ace', 13: 'King', 12: 'Queen', 11: 'Jack',
    10: 'Ten', 9: 'Nine', 8: 'Eight', 7: 'Seven',
    6: 'Six', 5: 'Five', 4: 'Four', 3: 'Three', 2: 'Two'
  };
  return valueToRank[value] || value.toString();
}

