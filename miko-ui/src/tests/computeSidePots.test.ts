/**
 * Tests for the UI-side computeSidePots algorithm.
 *
 * GameManager.computeSidePots() is private, so we replicate its algorithm
 * here to verify correctness. This tests the UI's pot display logic which
 * is separate from the engine's pot distribution logic.
 */

import { describe, it, expect } from 'vitest';
import type { PlayerState } from '@engine/index.js';

/**
 * Replicate GameManager.computeSidePots() for isolated testing.
 * This is the exact algorithm from GameManager.ts lines 1088–1131.
 */
function computeSidePots(players: PlayerState[]): { amount: number; eligible: string[] }[] {
  const allInPlayers = players.filter(p => p.allIn);
  if (allInPlayers.length === 0) return [];

  const contributors = players
    .filter(p => p.totalBet > 0)
    .sort((a, b) => a.totalBet - b.totalBet);

  if (contributors.length === 0) return [];

  const allInLevels = Array.from(new Set(allInPlayers.map(p => p.totalBet))).sort((a, b) => a - b);

  const pots: { amount: number; eligible: string[] }[] = [];
  let previousLevel = 0;

  for (const level of allInLevels) {
    const increment = level - previousLevel;
    if (increment <= 0) continue;

    const numContributors = contributors.filter(p => p.totalBet >= level).length;
    if (numContributors <= 1) continue;

    const potAmount = increment * numContributors;
    const eligible = contributors
      .filter(p => p.totalBet >= level && !p.folded)
      .map(p => p.id);

    pots.push({ amount: potAmount, eligible });
    previousLevel = level;
  }

  const highestAllIn = allInLevels[allInLevels.length - 1];
  const sideContributors = contributors.filter(p => p.totalBet > highestAllIn && !p.allIn);
  if (sideContributors.length >= 2) {
    const sideAmount = sideContributors.reduce((sum, p) => sum + (p.totalBet - highestAllIn), 0);
    if (sideAmount > 0) {
      pots.push({ amount: sideAmount, eligible: sideContributors.filter(p => !p.folded).map(p => p.id) });
    }
  }

  return pots;
}

/** Helper to create a minimal PlayerState for testing. */
function makePlayer(
  id: string,
  totalBet: number,
  allIn: boolean,
  folded = false,
): PlayerState {
  return {
    id,
    chips: allIn ? 0 : 1000 - totalBet,
    bet: 0,
    totalBet,
    folded,
    allIn,
    cards: [],
    isDealer: false,
    isActive: !folded,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
describe('computeSidePots — no all-in', () => {
  it('should return empty array when no one is all-in', () => {
    const players = [
      makePlayer('A', 100, false),
      makePlayer('B', 100, false),
    ];
    expect(computeSidePots(players)).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('computeSidePots — simple all-in (equal stacks)', () => {
  it('should create one pot when both all-in for same amount', () => {
    const players = [
      makePlayer('A', 100, true),
      makePlayer('B', 100, true),
    ];
    const pots = computeSidePots(players);
    expect(pots).toHaveLength(1);
    expect(pots[0].amount).toBe(200);
    expect(pots[0].eligible).toEqual(expect.arrayContaining(['A', 'B']));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('computeSidePots — one short stack all-in', () => {
  it('should create main pot at short stack level', () => {
    // A bets 100 (not all-in), B all-in for 50
    const players = [
      makePlayer('A', 100, false),
      makePlayer('B', 50, true),
    ];
    const pots = computeSidePots(players);
    // One pot at level 50: 50 × 2 = 100
    expect(pots).toHaveLength(1);
    expect(pots[0].amount).toBe(100);
    expect(pots[0].eligible).toEqual(expect.arrayContaining(['A', 'B']));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('computeSidePots — three players, one short all-in', () => {
  it('should show main pot at all-in level', () => {
    // A: 100, B: 100 (neither all-in), C: all-in 50
    const players = [
      makePlayer('A', 100, false),
      makePlayer('B', 100, false),
      makePlayer('C', 50, true),
    ];
    const pots = computeSidePots(players);
    // Level 50: 50 × 3 = 150 (main pot)
    // Side pot: A and B both have totalBet > 50 and are not all-in → (100-50)*2 = 100
    expect(pots).toHaveLength(2);
    expect(pots[0].amount).toBe(150);
    expect(pots[0].eligible).toEqual(expect.arrayContaining(['A', 'B', 'C']));
    expect(pots[1].amount).toBe(100);
    expect(pots[1].eligible).toEqual(expect.arrayContaining(['A', 'B']));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('computeSidePots — two different all-in sizes', () => {
  it('should create two pots at each all-in level', () => {
    // A: 200 (not all-in), B: all-in 100, C: all-in 50
    const players = [
      makePlayer('A', 200, false),
      makePlayer('B', 100, true),
      makePlayer('C', 50, true),
    ];
    const pots = computeSidePots(players);
    // Level 50: 50 × 3 = 150
    // Level 100: 50 × 2 = 100 (A and B)
    // Side: A has totalBet > 100 and not all-in, but only 1 side contributor → skipped
    expect(pots).toHaveLength(2);
    expect(pots[0].amount).toBe(150);
    expect(pots[1].amount).toBe(100);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('computeSidePots — four players all-in at different levels', () => {
  it('should create pots at each all-in contribution level', () => {
    const players = [
      makePlayer('A', 200, true),
      makePlayer('B', 150, true),
      makePlayer('C', 100, true),
      makePlayer('D', 50, true),
    ];
    const pots = computeSidePots(players);
    // Level 50: 50 × 4 = 200
    // Level 100: 50 × 3 = 150
    // Level 150: 50 × 2 = 100
    // Level 200: A only → numContributors=1 → skipped
    expect(pots).toHaveLength(3);
    expect(pots[0].amount).toBe(200);
    expect(pots[0].eligible).toHaveLength(4);
    expect(pots[1].amount).toBe(150);
    expect(pots[1].eligible).toHaveLength(3);
    expect(pots[2].amount).toBe(100);
    expect(pots[2].eligible).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('computeSidePots — folded player excluded from eligibility', () => {
  it('should include folded player contribution but not in eligible list', () => {
    // A: 100 all-in, B: 100 (not all-in), C: folded after betting 100
    const players = [
      makePlayer('A', 100, true),
      makePlayer('B', 100, false),
      makePlayer('C', 100, false, true), // folded
    ];
    const pots = computeSidePots(players);
    // Level 100: 100 × 3 = 300, eligible = A, B (not C)
    expect(pots).toHaveLength(1);
    expect(pots[0].amount).toBe(300);
    expect(pots[0].eligible).toEqual(expect.arrayContaining(['A', 'B']));
    expect(pots[0].eligible).not.toContain('C');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('computeSidePots — complex 4-player scenario', () => {
  it('should handle A:300, B:200, C:100, D:50 all-in', () => {
    const players = [
      makePlayer('A', 300, true),
      makePlayer('B', 200, true),
      makePlayer('C', 100, true),
      makePlayer('D', 50, true),
    ];
    const pots = computeSidePots(players);
    // Level 50: 50 × 4 = 200
    // Level 100: 50 × 3 = 150
    // Level 200: 100 × 2 = 200
    // Level 300: A only → skipped (numContributors = 1)
    expect(pots).toHaveLength(3);
    expect(pots[0].amount).toBe(200);
    expect(pots[1].amount).toBe(150);
    expect(pots[2].amount).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('computeSidePots — side pot for non-all-in players', () => {
  it('should create side pot when 2+ non-all-in players bet above the all-in level', () => {
    // C all-in 50, A and B both bet 200 (not all-in)
    const players = [
      makePlayer('A', 200, false),
      makePlayer('B', 200, false),
      makePlayer('C', 50, true),
    ];
    const pots = computeSidePots(players);
    // Level 50: 50 × 3 = 150
    // Side: A and B bet 200 > 50, not all-in → (200-50) × 2 = 300
    expect(pots).toHaveLength(2);
    expect(pots[0].amount).toBe(150);
    expect(pots[1].amount).toBe(300);
    expect(pots[1].eligible).toEqual(expect.arrayContaining(['A', 'B']));
    expect(pots[1].eligible).not.toContain('C');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('computeSidePots — duplicate all-in levels', () => {
  it('should deduplicate same all-in amount from multiple players', () => {
    // A, B both all-in 100, C all-in 50
    const players = [
      makePlayer('A', 100, true),
      makePlayer('B', 100, true),
      makePlayer('C', 50, true),
    ];
    const pots = computeSidePots(players);
    // Level 50: 50 × 3 = 150
    // Level 100: 50 × 2 = 100
    expect(pots).toHaveLength(2);
    expect(pots[0].amount).toBe(150);
    expect(pots[1].amount).toBe(100);
  });
});
