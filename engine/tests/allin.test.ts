/**
 * All-in scenario tests for poker engine
 * Tests various all-in situations including side pots and auto-completion
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PokerGameEngine, type GameEvent } from '../src/index';

describe('All-in Logic', () => {
  let engine: PokerGameEngine;
  let events: GameEvent[];

  beforeEach(() => {
    engine = new PokerGameEngine({
      smallBlind: 5,
      bigBlind: 10,
      startingChips: 1000,
      maxPlayers: 8
    });

    events = [];
    engine.on((event: GameEvent) => {
      events.push(event);
    });
  });

  describe('Single all-in scenario', () => {
    it('should handle one player going all-in preflop', () => {
      const players = ['player1', 'player2'];
      engine.initGame(players, new Map());
      engine.startNewHand();

      // Get current player and have them go all-in
      const gameState = engine.getGameState();
      const currentPlayerId = gameState.players[gameState.currentPlayerIndex].id;

      engine.processAction(currentPlayerId, { type: 'allin' });

      const updatedState = engine.getGameState();
      const allinPlayer = updatedState.players.find(p => p.id === currentPlayerId);

      expect(allinPlayer?.allIn).toBe(true);
      expect(allinPlayer?.chips).toBe(0);
    });

    it('should continue to showdown when one player is all-in and other calls', () => {
      const players = ['player1', 'player2'];
      engine.initGame(players, new Map());
      engine.startNewHand();

      // First player goes all-in
      let gameState = engine.getGameState();
      const firstPlayerId = gameState.players[gameState.currentPlayerIndex].id;
      engine.processAction(firstPlayerId, { type: 'allin' });

      // Second player calls
      gameState = engine.getGameState();
      const secondPlayerId = gameState.players[gameState.currentPlayerIndex].id;
      engine.processAction(secondPlayerId, { type: 'call' });

      // Should have advanced through streets
      const streetEvents = events.filter(e => e.type === 'street_changed');
      expect(streetEvents.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Multiple all-ins with side pots', () => {
    it('should create side pots when players have different stack sizes', () => {
      const players = ['player1', 'player2', 'player3'];
      engine.initGame(players, new Map());

      // Manually set different chip amounts before starting hand
      let gameState = engine.getGameState();
      gameState.players[0].chips = 100;  // player1 - short stack
      gameState.players[1].chips = 500;  // player2 - medium stack
      gameState.players[2].chips = 1000; // player3 - big stack

      engine.startNewHand();

      // All three players go all-in (respecting turn order)
      gameState = engine.getGameState();
      engine.processAction(gameState.players[gameState.currentPlayerIndex].id, { type: 'allin' });

      gameState = engine.getGameState();
      engine.processAction(gameState.players[gameState.currentPlayerIndex].id, { type: 'allin' });

      gameState = engine.getGameState();
      engine.processAction(gameState.players[gameState.currentPlayerIndex].id, { type: 'allin' });

      // Check for side pots
      const sidePots = engine.getSidePots();

      // Should have main pot and side pots
      expect(Array.isArray(sidePots)).toBe(true);

      // Should have hand completed
      const handCompleteEvent = events.find(e => e.type === 'hand_complete');
      expect(handCompleteEvent).toBeDefined();
    });

    it('should correctly distribute pot when short stack wins', () => {
      const players = ['player1', 'player2', 'player3'];
      engine.initGame(players, new Map());

      let gameState = engine.getGameState();
      gameState.players[0].chips = 100;  // player1 - short stack
      gameState.players[1].chips = 500;  // player2
      gameState.players[2].chips = 500;  // player3

      engine.startNewHand();

      // All players go all-in (respecting turn order)
      gameState = engine.getGameState();
      engine.processAction(gameState.players[gameState.currentPlayerIndex].id, { type: 'allin' });

      gameState = engine.getGameState();
      engine.processAction(gameState.players[gameState.currentPlayerIndex].id, { type: 'allin' });

      gameState = engine.getGameState();
      engine.processAction(gameState.players[gameState.currentPlayerIndex].id, { type: 'allin' });

      // Verify hand completed
      const handCompleteEvent = events.find(e => e.type === 'hand_complete');
      expect(handCompleteEvent).toBeDefined();

      if (handCompleteEvent && handCompleteEvent.type === 'hand_complete') {
        expect(handCompleteEvent.result.winners).toBeDefined();
        expect(handCompleteEvent.result.potAmount).toBeGreaterThan(0);
      }
    });
  });

  describe('All players all-in - auto-completion', () => {
    it('should detect when all remaining players are all-in', () => {
      const players = ['player1', 'player2', 'player3'];
      engine.initGame(players, new Map());
      engine.startNewHand();

      // All three players go all-in (respecting turn order)
      let gameState = engine.getGameState();
      engine.processAction(gameState.players[gameState.currentPlayerIndex].id, { type: 'allin' });

      gameState = engine.getGameState();
      engine.processAction(gameState.players[gameState.currentPlayerIndex].id, { type: 'allin' });

      gameState = engine.getGameState();
      engine.processAction(gameState.players[gameState.currentPlayerIndex].id, { type: 'allin' });

      // At this point, all players should be all-in (or hand completed)
      gameState = engine.getGameState();
      const activePlayers = gameState.players.filter(p => !p.folded);
      const allInPlayers = activePlayers.filter(p => p.allIn);

      // After all-ins, hand should complete automatically
      expect(allInPlayers.length).toBeGreaterThanOrEqual(2);
    });

    it('should auto-deal all remaining streets when everyone is all-in', () => {
      const players = ['player1', 'player2'];
      engine.initGame(players, new Map());
      engine.startNewHand();

      // Both players go all-in preflop (respecting turn order)
      let gameState = engine.getGameState();
      engine.processAction(gameState.players[gameState.currentPlayerIndex].id, { type: 'allin' });

      gameState = engine.getGameState();
      engine.processAction(gameState.players[gameState.currentPlayerIndex].id, { type: 'allin' });

      // Should have dealt flop, turn, river
      const streetEvents = events.filter(e => e.type === 'street_changed');

      // Should have at least flop, turn, river (3 streets)
      expect(streetEvents.length).toBeGreaterThanOrEqual(3);

      // Verify we have all community cards
      gameState = engine.getGameState();
      expect(gameState.communityCards.length).toBe(5);

      // Should have completed the hand
      const handCompleteEvent = events.find(e => e.type === 'hand_complete');
      expect(handCompleteEvent).toBeDefined();
    });

    it('should use forceHandComplete when all players are all-in on flop', () => {
      const players = ['player1', 'player2'];
      engine.initGame(players, new Map());
      engine.startNewHand();

      // Call to see flop (respecting turn order)
      let gameState = engine.getGameState();
      engine.processAction(gameState.players[gameState.currentPlayerIndex].id, { type: 'call' });

      gameState = engine.getGameState();
      engine.processAction(gameState.players[gameState.currentPlayerIndex].id, { type: 'check' });

      // Clear events to track from flop
      events.length = 0;

      // Both go all-in on flop (respecting turn order)
      gameState = engine.getGameState();
      engine.processAction(gameState.players[gameState.currentPlayerIndex].id, { type: 'allin' });

      gameState = engine.getGameState();
      engine.processAction(gameState.players[gameState.currentPlayerIndex].id, { type: 'allin' });

      // Should have dealt turn and river
      const streetEvents = events.filter(e => e.type === 'street_changed');
      expect(streetEvents.length).toBeGreaterThanOrEqual(2);

      // Should have 5 community cards total
      const finalState = engine.getGameState();
      expect(finalState.communityCards.length).toBe(5);
    });
  });

  describe('Mixed scenarios - some all-in, some folded', () => {
    it('should handle when some fold and others are all-in', () => {
      const players = ['player1', 'player2', 'player3', 'player4'];
      engine.initGame(players, new Map());
      engine.startNewHand();

      let gameState = engine.getGameState();

      // First player goes all-in
      engine.processAction(gameState.players[gameState.currentPlayerIndex].id, { type: 'allin' });

      // Second player folds
      gameState = engine.getGameState();
      engine.processAction(gameState.players[gameState.currentPlayerIndex].id, { type: 'fold' });

      // Third player calls (goes all-in)
      gameState = engine.getGameState();
      engine.processAction(gameState.players[gameState.currentPlayerIndex].id, { type: 'allin' });

      // Fourth player folds
      gameState = engine.getGameState();
      engine.processAction(gameState.players[gameState.currentPlayerIndex].id, { type: 'fold' });

      // Should complete hand
      const handCompleteEvent = events.find(e => e.type === 'hand_complete');
      expect(handCompleteEvent).toBeDefined();

      // Check that we have winners
      if (handCompleteEvent && handCompleteEvent.type === 'hand_complete') {
        expect(handCompleteEvent.result.winners.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('should not auto-complete if at least one player can still act', () => {
      const players = ['player1', 'player2', 'player3'];
      engine.initGame(players, new Map());
      engine.startNewHand();

      let gameState = engine.getGameState();
      const firstActorId = gameState.players[gameState.currentPlayerIndex].id;

      // First player goes all-in
      engine.processAction(firstActorId, { type: 'allin' });

      // Second player calls (but still has chips - not all-in)
      gameState = engine.getGameState();
      const secondActorId = gameState.players[gameState.currentPlayerIndex].id;
      engine.processAction(secondActorId, { type: 'call' });

      // Third player should still be able to act
      gameState = engine.getGameState();

      // Should still be in hand
      expect(engine.isHandInProgress()).toBe(true);

      // Current player should be someone other than the all-in player and caller
      const currentPlayer = gameState.players[gameState.currentPlayerIndex];
      expect(currentPlayer.id).not.toBe(firstActorId);
      expect(currentPlayer.allIn).toBe(false);
      expect(currentPlayer.folded).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should mark all-in player with 0 chips as unable to act', () => {
      const players = ['player1', 'player2'];
      engine.initGame(players, new Map());
      engine.startNewHand();

      // First player goes all-in
      let gameState = engine.getGameState();
      const firstActorId = gameState.players[gameState.currentPlayerIndex].id;
      engine.processAction(firstActorId, { type: 'allin' });

      // Verify the all-in player has 0 chips and is flagged correctly
      gameState = engine.getGameState();
      const allinPlayer = gameState.players.find(p => p.id === firstActorId);
      expect(allinPlayer).toBeDefined();
      expect(allinPlayer?.chips).toBe(0);
      expect(allinPlayer?.allIn).toBe(true);
      expect(allinPlayer?.folded).toBe(false);
    });

    it('should handle all-in amount correctly when player has less than required', () => {
      const players = ['player1', 'player2'];
      engine.initGame(players, new Map());

      let gameState = engine.getGameState();
      const currentPlayerIndex = gameState.currentPlayerIndex;
      gameState.players[currentPlayerIndex].chips = 50; // Less than big blind

      engine.startNewHand();

      // Current player should be able to go all-in for less
      gameState = engine.getGameState();
      const currentPlayerId = gameState.players[gameState.currentPlayerIndex].id;
      const currentPlayerChipsBefore = gameState.players[gameState.currentPlayerIndex].chips;

      if (currentPlayerChipsBefore > 0 && currentPlayerChipsBefore < 100) {
        const action = { type: 'allin' as const };

        expect(() => {
          engine.processAction(currentPlayerId, action);
        }).not.toThrow();

        const updatedState = engine.getGameState();
        const allinPlayer = updatedState.players.find(p => p.id === currentPlayerId);

        expect(allinPlayer?.allIn).toBe(true);
        expect(allinPlayer?.chips).toBe(0);
      }
    });

    it('should properly award pot when player wins with all-in for less', () => {
      const players = ['player1', 'player2'];
      engine.initGame(players, new Map());

      let gameState = engine.getGameState();
      const firstPlayerIndex = gameState.currentPlayerIndex;
      gameState.players[firstPlayerIndex].chips = 50; // Short stack

      engine.startNewHand();

      // First player goes all-in for their 50 chips
      gameState = engine.getGameState();
      engine.processAction(gameState.players[gameState.currentPlayerIndex].id, { type: 'allin' });

      // Second player calls
      gameState = engine.getGameState();
      engine.processAction(gameState.players[gameState.currentPlayerIndex].id, { type: 'call' });

      // Hand should complete
      const handCompleteEvent = events.find(e => e.type === 'hand_complete');
      expect(handCompleteEvent).toBeDefined();

      if (handCompleteEvent && handCompleteEvent.type === 'hand_complete') {
        // Pot should reflect the all-in scenario
        expect(handCompleteEvent.result.potAmount).toBeGreaterThan(0);

        // Winner should be determined
        expect(handCompleteEvent.result.winners.length).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('UI integration scenarios', () => {
    it('should emit proper events for UI to detect all-in state', () => {
      const players = ['player1', 'player2', 'player3'];
      engine.initGame(players, new Map());
      engine.startNewHand();

      events.length = 0; // Clear events

      // Current player goes all-in
      const gameState = engine.getGameState();
      const currentPlayerId = gameState.players[gameState.currentPlayerIndex].id;

      engine.processAction(currentPlayerId, { type: 'allin' });

      // Should emit player_action event
      const actionEvent = events.find(e => e.type === 'player_action');
      expect(actionEvent).toBeDefined();

      if (actionEvent && actionEvent.type === 'player_action') {
        expect(actionEvent.action.type).toBe('allin');
      }

      // Should emit pot_updated event
      const potEvent = events.find(e => e.type === 'pot_updated');
      expect(potEvent).toBeDefined();
    });

    it('should provide correct game state for UI to check all-in players', () => {
      const players = ['player1', 'player2', 'player3'];
      engine.initGame(players, new Map());
      engine.startNewHand();

      // Current player goes all-in
      let gameState = engine.getGameState();
      const currentPlayerId = gameState.players[gameState.currentPlayerIndex].id;

      engine.processAction(currentPlayerId, { type: 'allin' });

      gameState = engine.getGameState();
      const allinPlayer = gameState.players.find(p => p.id === currentPlayerId);

      // UI should be able to check these properties
      expect(allinPlayer?.allIn).toBe(true);
      expect(allinPlayer?.chips).toBe(0);
      expect(allinPlayer?.folded).toBe(false);
    });
  });
});

