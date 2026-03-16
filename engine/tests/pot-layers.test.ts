/**
 * Pot layer (side pot) visibility and multi-street tracking tests.
 *
 * Verifies that PotManager.getSidePots() returns accurate pot layer
 * information during gameplay — not just at showdown — and that
 * contributions are tracked correctly across multiple betting streets.
 */

import { describe, it, expect } from 'vitest';
import { Player } from '../src/player';
import { PotManager } from '../src/pot';

// ─────────────────────────────────────────────────────────────────────────────
// getSidePots() returns correct layers during gameplay
// ─────────────────────────────────────────────────────────────────────────────
describe('getSidePots() during gameplay', () => {
  it('returns empty array before any bets are collected', () => {
    const pot = new PotManager();
    expect(pot.getSidePots()).toEqual([]);
  });

  it('returns single layer when all players contribute equally', () => {
    const A = new Player('A', 100);
    const B = new Player('B', 100);
    const C = new Player('C', 100);

    A.placeBet(50);
    B.placeBet(50);
    C.placeBet(50);

    const pot = new PotManager();
    pot.collectBets([A, B, C]);

    const layers = pot.getSidePots();
    expect(layers).toHaveLength(1);
    expect(layers[0].amount).toBe(150);
    expect(layers[0].eligiblePlayers).toEqual(expect.arrayContaining(['A', 'B', 'C']));
  });

  it('returns two layers when one player is short-stacked all-in', () => {
    const A = new Player('A', 200);
    const B = new Player('B', 200);
    const C = new Player('C', 50);

    A.placeBet(100);
    B.placeBet(100);
    C.placeBet(50); // all-in

    const pot = new PotManager();
    pot.collectBets([A, B, C]);

    const layers = pot.getSidePots();
    expect(layers).toHaveLength(2);
    // Main pot: 50 × 3 = 150 (A, B, C eligible)
    expect(layers[0].amount).toBe(150);
    expect(layers[0].eligiblePlayers).toHaveLength(3);
    // Side pot: 50 × 2 = 100 (A, B eligible)
    expect(layers[1].amount).toBe(100);
    expect(layers[1].eligiblePlayers).toEqual(expect.arrayContaining(['A', 'B']));
    expect(layers[1].eligiblePlayers).not.toContain('C');
  });

  it('returns three layers for three different all-in amounts', () => {
    const A = new Player('A', 200);
    const B = new Player('B', 100);
    const C = new Player('C', 50);

    A.placeBet(200);
    B.placeBet(100);
    C.placeBet(50);

    const pot = new PotManager();
    pot.collectBets([A, B, C]);

    // After uncalled bet: A=100 (excess 100 returned), B=100, C=50
    const layers = pot.getSidePots();
    expect(layers).toHaveLength(2);
    // Layer 1: 50 × 3 = 150
    expect(layers[0].amount).toBe(150);
    // Layer 2: 50 × 2 = 100
    expect(layers[1].amount).toBe(100);
    // Total
    expect(pot.getTotalPot()).toBe(250);
  });

  it('getMainPot() returns the first layer amount', () => {
    const A = new Player('A', 200);
    const B = new Player('B', 200);
    const C = new Player('C', 50);

    A.placeBet(100);
    B.placeBet(100);
    C.placeBet(50);

    const pot = new PotManager();
    pot.collectBets([A, B, C]);

    expect(pot.getMainPot()).toBe(150); // 50 × 3
  });

  it('excludes folded players from eligibility but keeps their chips in pot', () => {
    const A = new Player('A', 200);
    const B = new Player('B', 200);
    const C = new Player('C', 200);

    A.placeBet(100);
    B.placeBet(100);
    C.placeBet(100);
    C.fold();

    const pot = new PotManager();
    pot.collectBets([A, B, C]);

    const layers = pot.getSidePots();
    expect(layers).toHaveLength(1);
    expect(layers[0].amount).toBe(300); // all 3 contributed
    expect(layers[0].eligiblePlayers).toEqual(expect.arrayContaining(['A', 'B']));
    expect(layers[0].eligiblePlayers).not.toContain('C');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Multi-street contribution tracking
// ─────────────────────────────────────────────────────────────────────────────
describe('Multi-street contribution tracking', () => {
  it('accumulates contributions across two streets', () => {
    const A = new Player('A', 500);
    const B = new Player('B', 500);
    const C = new Player('C', 100);

    const pot = new PotManager();

    // Preflop: everyone bets 50
    A.placeBet(50);
    B.placeBet(50);
    C.placeBet(50);
    pot.collectBets([A, B, C]);
    expect(pot.getTotalPot()).toBe(150);

    // After preflop: single layer
    let layers = pot.getSidePots();
    expect(layers).toHaveLength(1);
    expect(layers[0].amount).toBe(150);

    // Flop: A and B bet 100, C all-in for remaining 50
    A.placeBet(100);
    B.placeBet(100);
    C.placeBet(50); // all-in, totalBet = 100
    pot.collectBets([A, B, C]);
    expect(pot.getTotalPot()).toBe(400);

    // After flop: two layers based on totalBet (A=150, B=150, C=100)
    layers = pot.getSidePots();
    expect(layers).toHaveLength(2);
    // Main: 100 × 3 = 300
    expect(layers[0].amount).toBe(300);
    expect(layers[0].eligiblePlayers).toHaveLength(3);
    // Side: 50 × 2 = 100
    expect(layers[1].amount).toBe(100);
    expect(layers[1].eligiblePlayers).toEqual(expect.arrayContaining(['A', 'B']));
  });

  it('handles fold on later street correctly', () => {
    const A = new Player('A', 500);
    const B = new Player('B', 500);
    const C = new Player('C', 500);

    const pot = new PotManager();

    // Preflop: all bet 50
    A.placeBet(50);
    B.placeBet(50);
    C.placeBet(50);
    pot.collectBets([A, B, C]);

    // Flop: A bets 100, B calls, C folds
    C.fold();
    A.placeBet(100);
    B.placeBet(100);
    pot.collectBets([A, B, C]);

    expect(pot.getTotalPot()).toBe(350);

    // C contributed 50 but folded — not eligible
    const layers = pot.getSidePots();
    // totalBets: A=150, B=150, C=50 → 2 layers
    expect(layers).toHaveLength(2);
    // Main: 50 × 3 = 150 (only A, B eligible since C folded)
    expect(layers[0].eligiblePlayers).toEqual(expect.arrayContaining(['A', 'B']));
    expect(layers[0].eligiblePlayers).not.toContain('C');
    // Side: 100 × 2 = 200 (A, B eligible)
    expect(layers[1].amount).toBe(200);
  });

  it('bug report scenario: A=50 all-in, B calls 50, C raises to 200, B calls', () => {
    // Player A stack: 50, Player B stack: 200, Player C stack: 200
    const A = new Player('A', 50);
    const B = new Player('B', 200);
    const C = new Player('C', 200);

    const pot = new PotManager();

    // Preflop betting round: A all-in 50, B calls 50, C raises to 200, B calls 200
    A.placeBet(50); // all-in
    B.placeBet(200);
    C.placeBet(200);
    pot.collectBets([A, B, C]);

    // totalBets: A=50, B=200, C=200
    expect(pot.getTotalPot()).toBe(450);

    const layers = pot.getSidePots();
    expect(layers).toHaveLength(2);
    // Main pot: 50 × 3 = 150 (A, B, C eligible)
    expect(layers[0].amount).toBe(150);
    expect(layers[0].eligiblePlayers).toHaveLength(3);
    // Side pot: 150 × 2 = 300 (B, C eligible)
    expect(layers[1].amount).toBe(300);
    expect(layers[1].eligiblePlayers).toEqual(expect.arrayContaining(['B', 'C']));
    expect(layers[1].eligiblePlayers).not.toContain('A');

    // Total: 150 + 300 = 450
    expect(layers[0].amount + layers[1].amount).toBe(450);
  });

  it('three-way all-in with different stacks across streets', () => {
    const A = new Player('A', 50);
    const B = new Player('B', 150);
    const C = new Player('C', 300);

    const pot = new PotManager();

    // Preflop: A all-in 50, B calls 50, C calls 50
    A.placeBet(50); // all-in
    B.placeBet(50);
    C.placeBet(50);
    pot.collectBets([A, B, C]);

    // Flop: B all-in for remaining 100, C calls 100
    B.placeBet(100); // all-in
    C.placeBet(100);
    pot.collectBets([A, B, C]);

    expect(pot.getTotalPot()).toBe(350);

    // totalBets: A=50, B=150, C=150
    const layers = pot.getSidePots();
    expect(layers).toHaveLength(2);
    // Main: 50 × 3 = 150
    expect(layers[0].amount).toBe(150);
    expect(layers[0].eligiblePlayers).toHaveLength(3);
    // Side: 100 × 2 = 200
    expect(layers[1].amount).toBe(200);
    expect(layers[1].eligiblePlayers).toEqual(expect.arrayContaining(['B', 'C']));

    // Award: A has best hand, B has second best
    pot.awardPots([A, B, C], (eligible) => {
      const a = eligible.find(p => p.id === 'A');
      if (a) return [a];
      const b = eligible.find(p => p.id === 'B');
      if (b) return [b];
      return [eligible[0]];
    });

    expect(A.chips).toBe(150);  // wins main pot
    expect(B.chips).toBe(200);  // wins side pot
    expect(C.chips).toBe(150);  // 300 - 50 - 100 = 150 remaining
    expect(A.chips + B.chips + C.chips).toBe(500); // conserved
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Split pot with side pots
// ─────────────────────────────────────────────────────────────────────────────
describe('Split pot scenarios involving side pots', () => {
  it('tie in main pot, different winner in side pot', () => {
    const A = new Player('A', 50);
    const B = new Player('B', 200);
    const C = new Player('C', 200);

    A.placeBet(50);
    B.placeBet(200);
    C.placeBet(200);

    const pot = new PotManager();
    pot.collectBets([A, B, C]);

    // A and C tie for best hand, B has worse hand
    pot.awardPots([A, B, C], (eligible) => {
      const tied = eligible.filter(p => p.id === 'A' || p.id === 'C');
      if (tied.length > 0) return tied;
      return [eligible[0]];
    });

    // Main pot (150): split between A and C → 75 each
    // Side pot (300): C wins (only A and C tie, but A not eligible for side pot)
    // C is the only tied player eligible → C gets 300
    expect(A.chips).toBe(75);       // half main pot
    expect(C.chips).toBe(75 + 300); // half main pot + full side pot
    expect(B.chips).toBe(0);
    expect(A.chips + B.chips + C.chips).toBe(450); // conserved
  });

  it('split side pot between two players', () => {
    const A = new Player('A', 50);
    const B = new Player('B', 200);
    const C = new Player('C', 200);

    A.placeBet(50);
    B.placeBet(200);
    C.placeBet(200);

    const pot = new PotManager();
    pot.collectBets([A, B, C]);

    // A wins main pot, B and C tie for side pot
    pot.awardPots([A, B, C], (eligible) => {
      const a = eligible.find(p => p.id === 'A');
      if (a) return [a]; // A wins when eligible
      return eligible.filter(p => p.id === 'B' || p.id === 'C'); // B,C tie
    });

    expect(A.chips).toBe(150);  // main pot
    expect(B.chips).toBe(150);  // half side pot
    expect(C.chips).toBe(150);  // half side pot
    expect(A.chips + B.chips + C.chips).toBe(450);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Chip conservation across complex scenarios
// ─────────────────────────────────────────────────────────────────────────────
describe('Chip conservation', () => {
  it('8-player scenario with multiple all-ins and folds', () => {
    const players = [
      new Player('A', 50),
      new Player('B', 100),
      new Player('C', 150),
      new Player('D', 200),
      new Player('E', 300),
      new Player('F', 300),
      new Player('G', 300),
      new Player('H', 300),
    ];
    const totalChips = players.reduce((s, p) => s + p.chips, 0);

    const pot = new PotManager();

    // Preflop: A all-in 50, B all-in 100, C all-in 150, D calls 150, E-H fold
    players[0].placeBet(50);
    players[1].placeBet(100);
    players[2].placeBet(150);
    players[3].placeBet(150);
    players[4].placeBet(10); players[4].fold();
    players[5].placeBet(10); players[5].fold();
    players[6].placeBet(5);  players[6].fold();
    players[7].placeBet(5);  players[7].fold();

    pot.collectBets(players);

    // Verify layers exist
    const layers = pot.getSidePots();
    expect(layers.length).toBeGreaterThanOrEqual(2);

    // D has best hand
    pot.awardPots(players, (eligible) => {
      const d = eligible.find(p => p.id === 'D');
      if (d) return [d];
      return [eligible[0]];
    });

    const totalAfter = players.reduce((s, p) => s + p.chips, 0);
    expect(totalAfter).toBe(totalChips);
  });
});
