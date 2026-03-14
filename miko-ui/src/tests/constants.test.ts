/**
 * Tests for layout constants and pure utility functions in constants.ts
 */

import { describe, it, expect } from 'vitest';
import {
  SEAT_POSITIONS,
  TOP_ROW_SEATS,
  SIDE_SEATS,
  DEALER_BUTTON_OFFSETS,
  COLORS,
  GAME_CONFIG,
  RANK_TO_FILENAME,
  getBetLabelOffset,
  getCardAssetPath,
  HOLE_CARD_WIDTH,
  HOLE_CARD_HEIGHT,
  COMMUNITY_CARD_WIDTH,
  COMMUNITY_CARD_HEIGHT,
} from '../utils/constants';

// ─────────────────────────────────────────────────────────────────────────────
// Structural validation of constants
// ─────────────────────────────────────────────────────────────────────────────
describe('SEAT_POSITIONS', () => {
  it('should have exactly 8 seats', () => {
    expect(SEAT_POSITIONS).toHaveLength(8);
  });

  it('every seat should have numeric x and y', () => {
    for (const pos of SEAT_POSITIONS) {
      expect(typeof pos.x).toBe('number');
      expect(typeof pos.y).toBe('number');
    }
  });

  it('seat 0 (human) should be at bottom center (x=0, y>0)', () => {
    expect(SEAT_POSITIONS[0].x).toBe(0);
    expect(SEAT_POSITIONS[0].y).toBeGreaterThan(0);
  });

  it('seat 4 should be at top center (x=0, y<0)', () => {
    expect(SEAT_POSITIONS[4].x).toBe(0);
    expect(SEAT_POSITIONS[4].y).toBeLessThan(0);
  });
});

describe('TOP_ROW_SEATS and SIDE_SEATS', () => {
  it('top row seats should be 3, 4, 5', () => {
    expect(TOP_ROW_SEATS).toEqual([3, 4, 5]);
  });

  it('side seats should be 2 and 6', () => {
    expect(SIDE_SEATS).toEqual([2, 6]);
  });

  it('top row seats should have negative y', () => {
    for (const idx of TOP_ROW_SEATS) {
      expect(SEAT_POSITIONS[idx].y).toBeLessThan(0);
    }
  });
});

describe('DEALER_BUTTON_OFFSETS', () => {
  it('should have exactly 8 entries', () => {
    expect(DEALER_BUTTON_OFFSETS).toHaveLength(8);
  });

  it('every entry should have numeric x and y', () => {
    for (const offset of DEALER_BUTTON_OFFSETS) {
      expect(typeof offset.x).toBe('number');
      expect(typeof offset.y).toBe('number');
    }
  });
});

describe('COLORS', () => {
  it('all color values should be valid hex in 0x000000–0xffffff', () => {
    for (const [, value] of Object.entries(COLORS)) {
      expect(value).toBeGreaterThanOrEqual(0x000000);
      expect(value).toBeLessThanOrEqual(0xffffff);
    }
  });
});

describe('GAME_CONFIG', () => {
  it('smallBlind should be less than bigBlind', () => {
    expect(GAME_CONFIG.smallBlind).toBeLessThan(GAME_CONFIG.bigBlind);
  });

  it('bigBlind should be exactly 2x smallBlind', () => {
    expect(GAME_CONFIG.bigBlind).toBe(GAME_CONFIG.smallBlind * 2);
  });

  it('startingChips should be positive', () => {
    expect(GAME_CONFIG.startingChips).toBeGreaterThan(0);
  });

  it('maxPlayers should be 8', () => {
    expect(GAME_CONFIG.maxPlayers).toBe(8);
  });

  it('AI thinking delay min should be less than max', () => {
    expect(GAME_CONFIG.aiThinkingDelayMin).toBeLessThan(GAME_CONFIG.aiThinkingDelayMax);
  });
});

describe('Card dimensions', () => {
  it('hole cards should have valid dimensions', () => {
    expect(HOLE_CARD_WIDTH).toBeGreaterThan(0);
    expect(HOLE_CARD_HEIGHT).toBeGreaterThan(HOLE_CARD_WIDTH);
  });

  it('community cards should be larger than hole cards', () => {
    expect(COMMUNITY_CARD_WIDTH).toBeGreaterThan(HOLE_CARD_WIDTH);
    expect(COMMUNITY_CARD_HEIGHT).toBeGreaterThan(HOLE_CARD_HEIGHT);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getBetLabelOffset
// ─────────────────────────────────────────────────────────────────────────────
describe('getBetLabelOffset', () => {
  it('top row seats (3, 4, 5) should return y=95 (below chips)', () => {
    for (const idx of [3, 4, 5]) {
      const offset = getBetLabelOffset(idx, SEAT_POSITIONS[idx]);
      expect(offset).toEqual({ x: 0, y: 95 });
    }
  });

  it('bottom seats (y > 100) should return y=-117 (above cards)', () => {
    // Seats 0, 1, 7 have y=220 > 100
    for (const idx of [0, 1, 7]) {
      const offset = getBetLabelOffset(idx, SEAT_POSITIONS[idx]);
      expect(offset).toEqual({ x: 0, y: -117 });
    }
  });

  it('left side seat (x < 0) should offset label to the right', () => {
    // Seat 2: x=-380, y=0
    const offset = getBetLabelOffset(2, SEAT_POSITIONS[2]);
    expect(offset.x).toBeGreaterThan(0); // label to the right
  });

  it('right side seat (x > 0) should offset label to the left', () => {
    // Seat 6: x=380, y=0
    const offset = getBetLabelOffset(6, SEAT_POSITIONS[6]);
    expect(offset.x).toBeLessThan(0); // label to the left
  });

  it('fallback position should return y=-120', () => {
    // Custom position at origin (not top row, not bottom, not side)
    const offset = getBetLabelOffset(99, { x: 0, y: 0 });
    expect(offset).toEqual({ x: 0, y: -120 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getCardAssetPath
// ─────────────────────────────────────────────────────────────────────────────
describe('getCardAssetPath', () => {
  it('should build correct path for face cards', () => {
    expect(getCardAssetPath('A', 'spades')).toBe('assets/cards/ace_of_spades.png');
    expect(getCardAssetPath('K', 'hearts')).toBe('assets/cards/king_of_hearts.png');
    expect(getCardAssetPath('Q', 'diamonds')).toBe('assets/cards/queen_of_diamonds.png');
    expect(getCardAssetPath('J', 'clubs')).toBe('assets/cards/jack_of_clubs.png');
  });

  it('should build correct path for number cards', () => {
    expect(getCardAssetPath('10', 'spades')).toBe('assets/cards/10_of_spades.png');
    expect(getCardAssetPath('2', 'hearts')).toBe('assets/cards/2_of_hearts.png');
    expect(getCardAssetPath('9', 'clubs')).toBe('assets/cards/9_of_clubs.png');
  });

  it('should handle all 13 ranks', () => {
    const ranks = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
    for (const rank of ranks) {
      const path = getCardAssetPath(rank, 'spades');
      expect(path).toMatch(/^assets\/cards\/\w+_of_spades\.png$/);
    }
  });

  it('should handle unknown rank gracefully via lowercase fallback', () => {
    const path = getCardAssetPath('X', 'hearts');
    expect(path).toBe('assets/cards/x_of_hearts.png');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RANK_TO_FILENAME
// ─────────────────────────────────────────────────────────────────────────────
describe('RANK_TO_FILENAME', () => {
  it('should map all 13 standard ranks', () => {
    expect(Object.keys(RANK_TO_FILENAME)).toHaveLength(13);
  });

  it('should map face cards to full names', () => {
    expect(RANK_TO_FILENAME['A']).toBe('ace');
    expect(RANK_TO_FILENAME['K']).toBe('king');
    expect(RANK_TO_FILENAME['Q']).toBe('queen');
    expect(RANK_TO_FILENAME['J']).toBe('jack');
  });

  it('should map number cards to their string value', () => {
    for (const n of ['2', '3', '4', '5', '6', '7', '8', '9', '10']) {
      expect(RANK_TO_FILENAME[n]).toBe(n);
    }
  });
});
