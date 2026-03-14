/**
 * Raise amount tests — verifies min-raise calculation is correct
 * across hands and streets, with no stale state leaking.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PokerGameEngine, type GameEvent } from '../src/index';

describe('Raise Amount Correctness', () => {
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

  describe('Preflop min-raise should be 2x BB', () => {
    it('should set minRaiseAmount to 20 on a fresh preflop', () => {
      engine.initGame(['player', 'ai1', 'ai2'], new Map());
      engine.startNewHand();

      const state = engine.getGameState();
      // Min raise preflop with BB=10 should be 20 (currentBet 10 + minRaise 10)
      expect(state.minRaiseAmount).toBe(20);
    });

    it('should not carry stale lastRaiseAmount from previous hand', () => {
      engine.initGame(['player', 'ai1'], new Map());
      engine.startNewHand();

      // Make a big raise in hand 1
      let state = engine.getGameState();
      const firstPlayer = state.players[state.currentPlayerIndex].id;
      engine.processAction(firstPlayer, { type: 'raise', amount: 500 });

      // Second player folds to end the hand
      state = engine.getGameState();
      const secondPlayer = state.players[state.currentPlayerIndex].id;
      engine.processAction(secondPlayer, { type: 'fold' });

      // Start hand 2
      engine.startNewHand();
      state = engine.getGameState();

      // Min raise should be back to 20 (BB*2), NOT inflated by previous hand's raise
      expect(state.minRaiseAmount).toBe(20);
    });

    it('should not carry stale lastRaiseAmount after all-in previous hand', () => {
      engine.initGame(['player', 'ai1'], new Map());
      engine.startNewHand();

      // Both go all-in in hand 1
      let state = engine.getGameState();
      engine.processAction(state.players[state.currentPlayerIndex].id, { type: 'allin' });
      state = engine.getGameState();
      engine.processAction(state.players[state.currentPlayerIndex].id, { type: 'allin' });

      // Hand should be complete
      const handComplete = events.find(e => e.type === 'hand_complete');
      expect(handComplete).toBeDefined();

      // Start hand 2 — winner has chips, loser may be eliminated
      events.length = 0;
      const playersWithChips = engine.getGameState().players.filter(p => p.chips > 0);
      if (playersWithChips.length >= 2) {
        engine.startNewHand();
        state = engine.getGameState();
        // Min raise should be clean 20, not inflated from 1000-chip all-in
        expect(state.minRaiseAmount).toBe(20);
      }
    });
  });

  describe('Raise processes correct amount', () => {
    it('should raise to exactly the specified amount when >= minRaiseTotal', () => {
      engine.initGame(['player', 'ai1', 'ai2'], new Map());
      engine.startNewHand();

      let state = engine.getGameState();
      const currentId = state.players[state.currentPlayerIndex].id;

      // Raise to 30 (above min of 20)
      engine.processAction(currentId, { type: 'raise', amount: 30 });

      state = engine.getGameState();
      const raiser = state.players.find(p => p.id === currentId);
      expect(raiser!.bet).toBe(30);
    });

    it('should enforce minimum raise when amount is too low', () => {
      engine.initGame(['player', 'ai1', 'ai2'], new Map());
      engine.startNewHand();

      let state = engine.getGameState();
      const currentId = state.players[state.currentPlayerIndex].id;

      // Try to raise to 15 (below min of 20) — engine should enforce min
      engine.processAction(currentId, { type: 'raise', amount: 15 });

      state = engine.getGameState();
      const raiser = state.players.find(p => p.id === currentId);
      // Should be raised to at least minRaiseTotal (20)
      expect(raiser!.bet).toBeGreaterThanOrEqual(20);
    });

    it('min re-raise should be last raise size on top of current bet', () => {
      engine.initGame(['player', 'ai1', 'ai2'], new Map());
      engine.startNewHand();

      let state = engine.getGameState();
      const p1 = state.players[state.currentPlayerIndex].id;
      // P1 raises to 40 (raise of 30 on top of BB 10)
      engine.processAction(p1, { type: 'raise', amount: 40 });

      state = engine.getGameState();
      // minRaiseAmount should be 40 + 30 = 70 (current bet + last raise size)
      expect(state.minRaiseAmount).toBe(70);
    });
  });

  describe('Raise across multiple hands stays clean', () => {
    it('should have correct minRaiseAmount across 3 consecutive hands', () => {
      engine.initGame(['player', 'ai1', 'ai2'], new Map());

      for (let hand = 0; hand < 3; hand++) {
        engine.startNewHand();
        const state = engine.getGameState();

        // Every hand should start with minRaiseAmount = 20
        expect(state.minRaiseAmount).toBe(20);

        // Make a big raise, then everyone folds
        const currentId = state.players[state.currentPlayerIndex].id;
        engine.processAction(currentId, { type: 'raise', amount: 200 });

        let s = engine.getGameState();
        const nextId = s.players[s.currentPlayerIndex].id;
        engine.processAction(nextId, { type: 'fold' });

        s = engine.getGameState();
        if (s.players[s.currentPlayerIndex]) {
          const lastId = s.players[s.currentPlayerIndex].id;
          if (engine.isHandInProgress()) {
            engine.processAction(lastId, { type: 'fold' });
          }
        }
      }
    });
  });
});
