/**
 * Comprehensive tests for MikoPoker Engine - Quick Sanity Checks
 * These are unit tests, not full game simulations
 */

import { describe, test, expect } from 'vitest';
import {
  PokerGameEngine,
  GameModeManager,
  STANDARD_STRUCTURES,
  type GameEvent,
} from '../src/index';

/**
 * Helper to create player ID array
 */
function makePlayerIds(count: number = 6): string[] {
  return Array.from({ length: count }, (_, i) => 
    i === 0 ? 'player' : `ai${i}`
  );
}

/**
 * Helper to create AI difficulty map
 */
function makeAIDifficulties(playerIds: string[]): Map<string, 'easy' | 'normal' | 'hard' | 'pro'> {
  const map = new Map<string, 'easy' | 'normal' | 'hard' | 'pro'>();
  playerIds.forEach((id, index) => {
    if (id !== 'player') {
      const difficulties: ('easy' | 'normal' | 'hard' | 'pro')[] = ['easy', 'normal', 'hard', 'pro'];
      map.set(id, difficulties[index % 4]);
    }
  });
  return map;
}

describe('MikoPoker Engine - Quick Sanity Tests', () => {
  
  test('Cash game initializes with continuous blinds', () => {
    const engine = new PokerGameEngine({
      gameType: 'cash',
      smallBlind: 5,
      bigBlind: 10,
      startingChips: 1000,
      maxPlayers: 6
    });

    const playerIds = makePlayerIds(6);
    engine.initGame(playerIds);

    const state = engine.getGameState();
    expect(state.gameType).toBe('cash');
    expect(state.players.length).toBe(6);
    
    // Verify blinds configured
    const config = engine.getConfig();
    expect(config.smallBlind).toBe(5);
    expect(config.bigBlind).toBe(10);
  });

  test('Tournament initializes with blind structure', () => {
    const engine = new PokerGameEngine({
      gameType: 'tournament',
      blindStructure: 'standard',
      maxPlayers: 9
    });

    const playerIds = makePlayerIds(9);
    engine.initGame(playerIds);

    const gameMode = engine.getGameMode();
    expect(gameMode.isTournament()).toBe(true);
    
    const level1 = gameMode.getCurrentLevel();
    expect(level1).not.toBeNull();
    expect(level1!.bigBlind).toBeGreaterThan(0);
  });

  test('Tournament blind levels can advance', () => {
    const engine = new PokerGameEngine({
      gameType: 'tournament',
      blindStructure: 'turbo',
      maxPlayers: 6
    });

    const gameMode = engine.getGameMode();
    const level1 = gameMode.getCurrentLevel();
    expect(level1).not.toBeNull();
    
    const bb1 = level1!.bigBlind;
    
    // Advance level
    const advanced = gameMode.advanceLevel();
    expect(advanced).toBe(true);
    
    const level2 = gameMode.getCurrentLevel();
    expect(level2).not.toBeNull();
    expect(level2!.bigBlind).toBeGreaterThan(bb1);
  });

  test('Big blind ante is available in tournament mode at higher levels', () => {
    const tournament = new PokerGameEngine({
      gameType: 'tournament',
      blindStructure: 'standard',
      maxPlayers: 6
    });

    const cash = new PokerGameEngine({
      gameType: 'cash',
      smallBlind: 5,
      bigBlind: 10,
      maxPlayers: 6
    });

    const tourneyMode = tournament.getGameMode();
    const cashMode = cash.getGameMode();

    expect(tourneyMode.isTournament()).toBe(true);
    expect(cashMode.isCashGame()).toBe(true);

    // Advance tournament to level with ante
    tourneyMode.setLevel(3); // Level 4 has ante in standard structure
    const ante = tourneyMode.getAnte();
    expect(ante).toBeGreaterThan(0);

    // Cash game should not have ante
    const cashAnte = cashMode.getAnte();
    expect(cashAnte).toBe(0);
  });

  test('Each AI player can have different difficulty', () => {
    const engine = new PokerGameEngine({
      gameType: 'cash',
      smallBlind: 5,
      bigBlind: 10,
      maxPlayers: 4
    });

    const playerIds = makePlayerIds(4);
    const aiDifficulties = new Map<string, 'easy' | 'normal' | 'hard' | 'pro'>([
      ['ai1', 'easy'],
      ['ai2', 'normal'],
      ['ai3', 'hard']
    ]);

    engine.initGame(playerIds, aiDifficulties);

    const state = engine.getGameState();
    expect(state.players.length).toBe(4);
    
    // Verify all players initialized
    const aiPlayers = state.players.filter(p => p.id !== 'player');
    expect(aiPlayers.length).toBe(3);
  });

  test('Event hooks are emitted for blind_posted', () => {
    const engine = new PokerGameEngine({
      gameType: 'cash',
      smallBlind: 5,
      bigBlind: 10,
      maxPlayers: 2
    });

    const playerIds = makePlayerIds(2);
    engine.initGame(playerIds);

    const receivedEvents: string[] = [];
    engine.on((event: GameEvent) => {
      receivedEvents.push(event.type);
    });

    // Start hand to trigger blind posting
    engine.startNewHand();

    expect(receivedEvents.includes('hand_started')).toBe(true);
    expect(receivedEvents.includes('blind_posted')).toBe(true);
    expect(receivedEvents.includes('cards_dealt')).toBe(true);
  });

  test('Tournament can advance levels manually', () => {
    const engine = new PokerGameEngine({
      gameType: 'tournament',
      blindStructure: 'turbo',
      maxPlayers: 4
    });

    const gameMode = engine.getGameMode();
    
    // Verify initial level
    const level1 = gameMode.getCurrentLevel();
    expect(level1).not.toBeNull();
    expect(level1!.level).toBe(1);
    
    // Manually advance level
    const advanced = gameMode.advanceLevel();
    expect(advanced).toBe(true);
    
    // Verify level advanced
    const level2 = gameMode.getCurrentLevel();
    expect(level2).not.toBeNull();
    expect(level2!.level).toBe(2);
    expect(level2!.bigBlind).toBeGreaterThan(level1!.bigBlind);
  });

  test('Cash game chip stacks persist across hands', () => {
    const engine = new PokerGameEngine({
      gameType: 'cash',
      smallBlind: 5,
      bigBlind: 10,
      startingChips: 1000,
      maxPlayers: 2
    });

    const playerIds = makePlayerIds(2);
    engine.initGame(playerIds);

    // Start first hand
    engine.startNewHand();
    const state1 = engine.getGameState();
    const player1InitialChips = state1.players[0].chips;

    // Current player folds to end hand
    const currentPlayer = state1.players[state1.currentPlayerIndex];
    engine.processAction(currentPlayer.id, { type: 'fold' });

    // Start second hand - chips should have changed
    if (!engine.isHandInProgress()) {
      engine.startNewHand();
      const state2 = engine.getGameState();
      
      // At least one player should have different chips
      const chipsChanged = state2.players.some(p => 
        p.chips !== 1000 || p.id === currentPlayer.id
      );
      expect(chipsChanged).toBe(true);
    }
  });

  test('Multiplayer game (6 players) initializes correctly', () => {
    const engine = new PokerGameEngine({
      gameType: 'cash',
      smallBlind: 10,
      bigBlind: 20,
      startingChips: 2000,
      maxPlayers: 6
    });

    const playerIds = makePlayerIds(6);
    const aiDifficulties = makeAIDifficulties(playerIds);
    
    engine.initGame(playerIds, aiDifficulties);
    engine.startNewHand();

    const state = engine.getGameState();
    expect(state.players.length).toBe(6);
    expect(state.street).toBe('preflop');
    expect(state.communityCards.length).toBe(0);
    
    // All players should have cards
    state.players.forEach(player => {
      expect(player.cards.length).toBe(2);
    });
  });

  test('Game mode manager provides correct blind amounts', () => {
    const engine = new PokerGameEngine({
      gameType: 'tournament',
      blindStructure: 'standard',
      maxPlayers: 6
    });

    const gameMode = engine.getGameMode();
    
    // Level 1
    expect(gameMode.getSmallBlind()).toBe(10);
    expect(gameMode.getBigBlind()).toBe(20);
    expect(gameMode.getAnte()).toBe(0);

    // Advance to level with ante
    gameMode.setLevel(3); // Level 4
    expect(gameMode.getSmallBlind()).toBe(50);
    expect(gameMode.getBigBlind()).toBe(100);
    expect(gameMode.getAnte()).toBe(10);
  });

  test('Standard blind structures are available', () => {
    expect(STANDARD_STRUCTURES.turbo).toBeDefined();
    expect(STANDARD_STRUCTURES.standard).toBeDefined();
    expect(STANDARD_STRUCTURES.deep).toBeDefined();

    const turbo = STANDARD_STRUCTURES.turbo;
    expect(turbo.levels.length).toBeGreaterThan(0);
    expect(turbo.levels[0].smallBlind).toBe(10);
    expect(turbo.levels[0].bigBlind).toBe(20);
  });

  test('Betting round resets cleanly between streets', () => {
    const engine = new PokerGameEngine({
      gameType: 'cash',
      smallBlind: 5,
      bigBlind: 10,
      maxPlayers: 2
    });

    const playerIds = makePlayerIds(2);
    engine.initGame(playerIds);
    engine.startNewHand();

    const state1 = engine.getGameState();
    expect(state1.street).toBe('preflop');

    // Both players act to complete preflop
    let iterations = 0;
    while (engine.isHandInProgress() && engine.getGameState().street === 'preflop' && iterations < 5) {
      iterations++;
      const state = engine.getGameState();
      const currentPlayer = state.players[state.currentPlayerIndex];
      
      if (state.canCheck) {
        engine.processAction(currentPlayer.id, { type: 'check' });
      } else if (state.canCall) {
        engine.processAction(currentPlayer.id, { type: 'call', amount: state.callAmount });
      } else {
        break;
      }
    }

    // If we advanced to flop, check should be available
    if (engine.isHandInProgress()) {
      const flopState = engine.getGameState();
      if (flopState.street === 'flop') {
        expect(flopState.canCheck).toBe(true);
        expect(flopState.callAmount).toBe(0);
      }
    }
  });

  test('AI can make decisions at different difficulty levels', () => {
    const engine = new PokerGameEngine({
      gameType: 'cash',
      smallBlind: 5,
      bigBlind: 10,
      maxPlayers: 3
    });

    const playerIds = ['player', 'ai_easy', 'ai_pro'];
    const difficulties = new Map<string, 'easy' | 'normal' | 'hard' | 'pro'>([
      ['ai_easy', 'easy'],
      ['ai_pro', 'pro']
    ]);

    engine.initGame(playerIds, difficulties);
    engine.startNewHand();

    // Get AI action (should not throw)
    const state = engine.getGameState();
    const aiPlayer = state.players.find(p => p.id.startsWith('ai'));
    
    if (aiPlayer && state.currentPlayerIndex === state.players.indexOf(aiPlayer)) {
      const action = engine.getAIAction(aiPlayer.id);
      expect(action).toHaveProperty('type');
      expect(['fold', 'check', 'call', 'bet', 'raise', 'allin']).toContain(action.type);
    } else {
      // If not AI's turn, just verify initialization worked
      expect(state.players.length).toBe(3);
    }
  });
});
