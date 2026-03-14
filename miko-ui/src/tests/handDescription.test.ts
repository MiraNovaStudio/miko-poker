/**
 * Tests for hand description formatting logic.
 *
 * The getWinningHandDescription method in GameManager converts
 * HandStrength (category + kickers) into a short display string
 * like "KKJJT" or "5432A". We test the pure formatting logic here.
 */

import { describe, it, expect } from 'vitest';
import type { HandStrength } from '@engine/index.js';

/**
 * Pure formatting logic extracted from GameManager.getWinningHandDescription().
 * Converts a HandStrength into a compact 5-card string representation.
 */
function formatHandDescription(strength: HandStrength): string {
  const kickers = strength.kickers;
  const valToRank: Record<number, string> = {
    14: 'A', 13: 'K', 12: 'Q', 11: 'J', 10: 'T',
    9: '9', 8: '8', 7: '7', 6: '6', 5: '5', 4: '4', 3: '3', 2: '2',
  };

  switch (strength.category) {
    case 8: // Straight Flush
    case 4: { // Straight
      const high = kickers[0];
      if (high === 5) return '5432A';
      const cards = [];
      for (let i = 0; i < 5; i++) cards.push(valToRank[high - i] ?? '?');
      return cards.join('');
    }
    case 7: // Four of a Kind — [quad, kicker]
      return (valToRank[kickers[0]] ?? '').repeat(4) + (valToRank[kickers[1]] ?? '');
    case 6: // Full House — [trips, pair]
      return (valToRank[kickers[0]] ?? '').repeat(3) + (valToRank[kickers[1]] ?? '').repeat(2);
    case 5: // Flush — [5 kickers]
      return kickers.slice(0, 5).map(k => valToRank[k] ?? '?').join('');
    case 3: // Three of a Kind — [trips, k1, k2]
      return (valToRank[kickers[0]] ?? '').repeat(3) + kickers.slice(1, 3).map(k => valToRank[k] ?? '?').join('');
    case 2: // Two Pair — [pair1, pair2, kicker]
      return (valToRank[kickers[0]] ?? '').repeat(2) + (valToRank[kickers[1]] ?? '').repeat(2) + (valToRank[kickers[2]] ?? '');
    case 1: // One Pair — [pair, k1, k2, k3]
      return (valToRank[kickers[0]] ?? '').repeat(2) + kickers.slice(1, 4).map(k => valToRank[k] ?? '?').join('');
    case 0: // High Card — [5 kickers]
      return kickers.slice(0, 5).map(k => valToRank[k] ?? '?').join('');
    default:
      return '';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
describe('Hand Description — High Card (category 0)', () => {
  it('should format high card as 5 rank characters', () => {
    const result = formatHandDescription({ category: 0, kickers: [14, 13, 11, 9, 7] });
    expect(result).toBe('AKJ97');
  });

  it('should handle low high card', () => {
    const result = formatHandDescription({ category: 0, kickers: [9, 8, 7, 5, 3] });
    expect(result).toBe('98753');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Hand Description — One Pair (category 1)', () => {
  it('should show pair doubled + 3 kickers', () => {
    // Pair of Kings with A, J, 9 kickers
    const result = formatHandDescription({ category: 1, kickers: [13, 14, 11, 9] });
    expect(result).toBe('KKAJ9');
  });

  it('should handle pair of twos', () => {
    const result = formatHandDescription({ category: 1, kickers: [2, 14, 13, 12] });
    expect(result).toBe('22AKQ');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Hand Description — Two Pair (category 2)', () => {
  it('should show both pairs doubled + kicker', () => {
    // Kings and Jacks with T kicker
    const result = formatHandDescription({ category: 2, kickers: [13, 11, 10] });
    expect(result).toBe('KKJJT');
  });

  it('should handle aces and twos', () => {
    const result = formatHandDescription({ category: 2, kickers: [14, 2, 13] });
    expect(result).toBe('AA22K');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Hand Description — Three of a Kind (category 3)', () => {
  it('should show trips tripled + 2 kickers', () => {
    const result = formatHandDescription({ category: 3, kickers: [10, 14, 13] });
    expect(result).toBe('TTTAK');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Hand Description — Straight (category 4)', () => {
  it('should show 5 consecutive cards from high card', () => {
    // Broadway straight (A-high)
    const result = formatHandDescription({ category: 4, kickers: [14] });
    expect(result).toBe('AKQJT');
  });

  it('should handle middle straight', () => {
    // 9-high straight
    const result = formatHandDescription({ category: 4, kickers: [9] });
    expect(result).toBe('98765');
  });

  it('should handle ace-low straight (wheel)', () => {
    const result = formatHandDescription({ category: 4, kickers: [5] });
    expect(result).toBe('5432A');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Hand Description — Flush (category 5)', () => {
  it('should show 5 kicker ranks', () => {
    const result = formatHandDescription({ category: 5, kickers: [14, 12, 10, 8, 6] });
    expect(result).toBe('AQT86');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Hand Description — Full House (category 6)', () => {
  it('should show trips×3 + pair×2', () => {
    const result = formatHandDescription({ category: 6, kickers: [14, 13] });
    expect(result).toBe('AAAKK');
  });

  it('should handle low full house', () => {
    const result = formatHandDescription({ category: 6, kickers: [3, 2] });
    expect(result).toBe('33322');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Hand Description — Four of a Kind (category 7)', () => {
  it('should show quad×4 + kicker', () => {
    const result = formatHandDescription({ category: 7, kickers: [14, 13] });
    expect(result).toBe('AAAAK');
  });

  it('should handle quad twos', () => {
    const result = formatHandDescription({ category: 7, kickers: [2, 14] });
    expect(result).toBe('2222A');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Hand Description — Straight Flush (category 8)', () => {
  it('should format like a straight', () => {
    // Royal flush (A-high straight flush)
    const result = formatHandDescription({ category: 8, kickers: [14] });
    expect(result).toBe('AKQJT');
  });

  it('should handle wheel straight flush', () => {
    const result = formatHandDescription({ category: 8, kickers: [5] });
    expect(result).toBe('5432A');
  });

  it('should handle mid straight flush', () => {
    const result = formatHandDescription({ category: 8, kickers: [8] });
    expect(result).toBe('87654');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Hand Description — edge cases', () => {
  it('should return empty string for unknown category', () => {
    const result = formatHandDescription({ category: 99, kickers: [14] });
    expect(result).toBe('');
  });

  it('should use "T" for 10', () => {
    const result = formatHandDescription({ category: 0, kickers: [10, 9, 8, 7, 6] });
    expect(result).toBe('T9876');
  });

  it('all rank mappings should produce single characters', () => {
    for (const val of [14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2]) {
      const result = formatHandDescription({ category: 0, kickers: [val, 2, 3, 4, 5] });
      expect(result.length).toBe(5);
    }
  });
});
