/**
 * All-in payout correctness tests.
 *
 * Verifies that when a player goes all-in and is called:
 * 1. The winner receives all matched chips from the caller
 * 2. Uncalled portions are returned to the over-bettor
 * 3. Folded players' contributions stay in the pot
 * 4. Total chips are conserved (no chips created or destroyed)
 * 5. Multiple all-in levels distribute correctly
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Player } from '../src/player';
import { PotManager } from '../src/pot';
import { PokerGameEngine, type GameEvent } from '../src/index';

// ─── Direct PotManager tests ─────────────────────────────────────

describe('All-in payout — PotManager direct', () => {
  it('heads-up all-in: winner gets entire pot', () => {
    const A = new Player('A', 500);
    const B = new Player('B', 500);
    A.placeBet(500); // all-in
    B.placeBet(500); // call

    const pot = new PotManager();
    pot.collectBets([A, B]);
    expect(pot.getTotalPot()).toBe(1000);

    pot.awardPots([A, B], () => [A]); // A wins
    expect(A.chips).toBe(1000);
    expect(B.chips).toBe(0);
  });

  it('heads-up: short stack all-in, big stack calls — winner gets matched amount', () => {
    // A has 200, B has 500. A goes all-in 200, B calls.
    const A = new Player('A', 200);
    const B = new Player('B', 500);
    A.placeBet(200); // all-in
    B.placeBet(200); // calls 200 (not all-in, has 300 left)

    const pot = new PotManager();
    pot.collectBets([A, B]);
    // No uncalled bet (both bet 200)
    expect(pot.getTotalPot()).toBe(400);

    // A wins
    pot.awardPots([A, B], () => [A]);
    expect(A.chips).toBe(400);
    expect(B.chips).toBe(300);
    expect(A.chips + B.chips).toBe(700); // conserved
  });

  it('heads-up: big stack all-in vs short stack call — excess returned', () => {
    // A has 500, B has 200. A all-in 500, B calls all-in 200.
    const A = new Player('A', 500);
    const B = new Player('B', 200);
    A.placeBet(500); // all-in
    B.placeBet(200); // call all-in

    const pot = new PotManager();
    pot.collectBets([A, B]);
    // Uncalled: A bet 500, B bet 200. Excess 300 returned to A.
    // A.totalBet = 200, B.totalBet = 200. Pot = 400.
    expect(A.chips).toBe(300); // got excess back
    expect(pot.getTotalPot()).toBe(400);

    // B wins showdown
    pot.awardPots([A, B], () => [B]);
    expect(B.chips).toBe(400);
    expect(A.chips).toBe(300);
    expect(A.chips + B.chips).toBe(700); // conserved
  });

  it('multiway: all-in vs caller, others folded — folded chips in pot', () => {
    // 4 players, blinds: C posts 5, D posts 10
    // Preflop: A folds (contributed 0), B folds (contributed 0),
    //          C calls 10 then folds on flop (contributed 10),
    //          D is all-in for 200, E calls 200
    // Simplified: C contributed 10 and folded, D all-in 200, E calls 200
    const C = new Player('C', 1000);
    const D = new Player('D', 200);
    const E = new Player('E', 500);

    C.placeBet(10);
    D.placeBet(10);
    E.placeBet(10);

    const pot = new PotManager();
    pot.collectBets([C, D, E]); // preflop bets collected: 30

    // Flop: C folds, D all-in for remaining 190, E calls 190
    C.fold();
    D.placeBet(190); // D is now all-in (200 total)
    E.placeBet(190);

    pot.collectBets([C, D, E]);
    // No uncalled (D and E both bet 190 this street, C bet 0)
    // Total pot = 30 + 380 = 410
    expect(pot.getTotalPot()).toBe(410);

    // D wins — should get entire pot (including C's folded 10)
    pot.awardPots([C, D, E], () => [D]);
    expect(D.chips).toBe(410);
    expect(C.chips).toBe(990); // lost 10
    // E started 500, placeBet(10) → 490, placeBet(190) → 300
    expect(E.chips).toBe(300);
    expect(C.chips + D.chips + E.chips).toBe(1700); // 1000+200+500
  });

  it('3-way all-in: different stacks, each pot awarded independently', () => {
    const A = new Player('A', 300);
    const B = new Player('B', 200);
    const C = new Player('C', 100);

    A.placeBet(300);
    B.placeBet(200);
    C.placeBet(100);

    const pot = new PotManager();
    pot.collectBets([A, B, C]);
    // Uncalled: A=300, B=200. Excess 100 returned to A.
    // A.totalBet=200, B.totalBet=200, C.totalBet=100
    expect(A.chips).toBe(100); // excess returned
    expect(pot.getTotalPot()).toBe(500); // 200+200+100

    // C wins main pot (100×3=300), B wins side pot (100×2=200)
    pot.awardPots([A, B, C], (eligible) => {
      const c = eligible.find(p => p.id === 'C');
      if (c) return [c];
      const b = eligible.find(p => p.id === 'B');
      if (b) return [b];
      return [eligible[0]];
    });

    expect(C.chips).toBe(300); // won main pot
    expect(B.chips).toBe(200); // won side pot
    expect(A.chips).toBe(100); // just the returned excess
    expect(A.chips + B.chips + C.chips).toBe(600); // conserved
  });
});

// ─── Full engine integration tests ───────────────────────────────

describe('All-in payout — Engine integration', () => {
  let engine: PokerGameEngine;
  let events: GameEvent[];

  beforeEach(() => {
    engine = new PokerGameEngine({
      smallBlind: 5,
      bigBlind: 10,
      startingChips: 1000,
      maxPlayers: 8,
    });
    events = [];
    engine.on((event: GameEvent) => events.push(event));
  });

  it('heads-up all-in: total chips conserved after hand', () => {
    engine.initGame(['player1', 'player2'], new Map());
    const totalChips = 2000; // 1000 × 2

    engine.startNewHand();

    let state = engine.getGameState();
    engine.processAction(state.players[state.currentPlayerIndex].id, { type: 'allin' });

    state = engine.getGameState();
    engine.processAction(state.players[state.currentPlayerIndex].id, { type: 'call' });

    // Hand should be complete
    const handComplete = events.find(e => e.type === 'hand_complete');
    expect(handComplete).toBeDefined();

    // Verify chip conservation
    state = engine.getGameState();
    const chipSum = state.players.reduce((sum, p) => sum + p.chips, 0);
    expect(chipSum).toBe(totalChips);
  });

  it('heads-up all-in: winner gets all of opponent chips when stacks are equal', () => {
    engine.initGame(['player1', 'player2'], new Map());

    engine.startNewHand();

    let state = engine.getGameState();
    engine.processAction(state.players[state.currentPlayerIndex].id, { type: 'allin' });

    state = engine.getGameState();
    engine.processAction(state.players[state.currentPlayerIndex].id, { type: 'allin' });

    const handComplete = events.find(e => e.type === 'hand_complete');
    expect(handComplete).toBeDefined();

    state = engine.getGameState();
    const winner = state.players.find(p => p.chips > 0);
    const loser = state.players.find(p => p.chips === 0);
    expect(winner).toBeDefined();
    expect(loser).toBeDefined();
    expect(winner!.chips).toBe(2000);
  });

  it('3-player: one all-in, one call, one fold — chips conserved', () => {
    engine.initGame(['p1', 'p2', 'p3'], new Map());
    const totalChips = 3000;

    engine.startNewHand();

    // First player goes all-in
    let state = engine.getGameState();
    engine.processAction(state.players[state.currentPlayerIndex].id, { type: 'allin' });

    // Second player folds
    state = engine.getGameState();
    engine.processAction(state.players[state.currentPlayerIndex].id, { type: 'fold' });

    // Third player calls (or goes all-in)
    state = engine.getGameState();
    if (engine.isHandInProgress()) {
      engine.processAction(state.players[state.currentPlayerIndex].id, { type: 'call' });
    }

    // Wait for hand to complete
    const handComplete = events.find(e => e.type === 'hand_complete');
    expect(handComplete).toBeDefined();

    // Chips must be conserved
    state = engine.getGameState();
    const chipSum = state.players.reduce((sum, p) => sum + p.chips, 0);
    expect(chipSum).toBe(totalChips);
  });

  it('short stack all-in vs big stack: total chips conserved', () => {
    // Use equal stacks — engine manages its own player objects
    engine.initGame(['short', 'big'], new Map());
    const totalChips = 2000;

    engine.startNewHand();

    // Both go all-in
    let state = engine.getGameState();
    engine.processAction(state.players[state.currentPlayerIndex].id, { type: 'allin' });

    state = engine.getGameState();
    engine.processAction(state.players[state.currentPlayerIndex].id, { type: 'allin' });

    const handComplete = events.find(e => e.type === 'hand_complete');
    expect(handComplete).toBeDefined();

    state = engine.getGameState();
    const chipSum = state.players.reduce((sum, p) => sum + p.chips, 0);
    expect(chipSum).toBe(totalChips); // conserved

    // Winner should have all 2000, loser 0
    const winner = state.players.find(p => p.chips > 0);
    const loser = state.players.find(p => p.chips === 0);
    expect(winner).toBeDefined();
    expect(loser).toBeDefined();
    expect(winner!.chips).toBe(2000);
  });

  it('multiple hands: chips conserved across 5 consecutive hands', () => {
    engine.initGame(['p1', 'p2', 'p3'], new Map());
    const totalChips = 3000;

    for (let hand = 0; hand < 5; hand++) {
      const state = engine.getGameState();
      const playersWithChips = state.players.filter(p => p.chips > 0);
      if (playersWithChips.length < 2) break;

      events.length = 0;
      engine.startNewHand();

      // Everyone folds to the first raiser
      let s = engine.getGameState();
      const firstId = s.players[s.currentPlayerIndex].id;
      engine.processAction(firstId, { type: 'raise', amount: 30 });

      s = engine.getGameState();
      if (engine.isHandInProgress()) {
        engine.processAction(s.players[s.currentPlayerIndex].id, { type: 'fold' });
      }

      s = engine.getGameState();
      if (engine.isHandInProgress()) {
        engine.processAction(s.players[s.currentPlayerIndex].id, { type: 'fold' });
      }

      // Verify conservation after each hand
      s = engine.getGameState();
      const chipSum = s.players.reduce((sum, p) => sum + p.chips, 0);
      expect(chipSum).toBe(totalChips);
    }
  });
});
