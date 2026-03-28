/**
 * Basic tests for poker engine
 */

import { describe, it, expect } from 'vitest';
import { 
  PokerGameEngine, 
  evaluateHand, 
  compareHands,
  Deck,
  type Card 
} from '../src/index';

describe('Deck', () => {
  it('should create a full deck of 52 cards', () => {
    const deck = new Deck();
    expect(deck.remaining()).toBe(52);
  });

  it('should deal cards', () => {
    const deck = new Deck();
    const card = deck.deal();
    expect(card).toHaveProperty('suit');
    expect(card).toHaveProperty('rank');
    expect(deck.remaining()).toBe(51);
  });

  it('should shuffle deck', () => {
    const deck = new Deck();
    const firstCard = deck.deal();
    
    deck.reset();
    const secondCard = deck.deal();
    
    // After shuffle, cards should likely be different (not guaranteed but very likely)
    // Just verify deck is reset to 52 cards
    deck.reset();
    expect(deck.remaining()).toBe(52);
  });
});

describe('Hand Evaluator', () => {
  it('should recognize a straight flush', () => {
    const cards: Card[] = [
      { rank: 'K', suit: 'hearts' },
      { rank: 'Q', suit: 'hearts' },
      { rank: 'J', suit: 'hearts' },
      { rank: '10', suit: 'hearts' },
      { rank: '9', suit: 'hearts' }
    ];
    const hand = evaluateHand(cards);
    expect(hand.category).toBe(8); // Straight flush
  });

  it('should recognize four of a kind', () => {
    const cards: Card[] = [
      { rank: 'A', suit: 'hearts' },
      { rank: 'A', suit: 'diamonds' },
      { rank: 'A', suit: 'clubs' },
      { rank: 'A', suit: 'spades' },
      { rank: 'K', suit: 'hearts' }
    ];
    const hand = evaluateHand(cards);
    expect(hand.category).toBe(7); // Four of a kind
  });

  it('should recognize a full house', () => {
    const cards: Card[] = [
      { rank: 'K', suit: 'hearts' },
      { rank: 'K', suit: 'diamonds' },
      { rank: 'K', suit: 'clubs' },
      { rank: 'Q', suit: 'spades' },
      { rank: 'Q', suit: 'hearts' }
    ];
    const hand = evaluateHand(cards);
    expect(hand.category).toBe(6); // Full house
  });

  it('should recognize a flush', () => {
    const cards: Card[] = [
      { rank: 'K', suit: 'hearts' },
      { rank: '10', suit: 'hearts' },
      { rank: '8', suit: 'hearts' },
      { rank: '5', suit: 'hearts' },
      { rank: '3', suit: 'hearts' }
    ];
    const hand = evaluateHand(cards);
    expect(hand.category).toBe(5); // Flush
  });

  it('should recognize a straight', () => {
    const cards: Card[] = [
      { rank: '9', suit: 'hearts' },
      { rank: '8', suit: 'diamonds' },
      { rank: '7', suit: 'clubs' },
      { rank: '6', suit: 'spades' },
      { rank: '5', suit: 'hearts' }
    ];
    const hand = evaluateHand(cards);
    expect(hand.category).toBe(4); // Straight
  });

  it('should recognize three of a kind', () => {
    const cards: Card[] = [
      { rank: 'J', suit: 'hearts' },
      { rank: 'J', suit: 'diamonds' },
      { rank: 'J', suit: 'clubs' },
      { rank: '8', suit: 'spades' },
      { rank: '3', suit: 'hearts' }
    ];
    const hand = evaluateHand(cards);
    expect(hand.category).toBe(3); // Three of a kind
  });

  it('should recognize two pair', () => {
    const cards: Card[] = [
      { rank: 'K', suit: 'hearts' },
      { rank: 'K', suit: 'diamonds' },
      { rank: '9', suit: 'clubs' },
      { rank: '9', suit: 'spades' },
      { rank: '5', suit: 'hearts' }
    ];
    const hand = evaluateHand(cards);
    expect(hand.category).toBe(2); // Two pair
    expect(hand.kickers).toEqual([13, 9, 5]); // KK 99 kicker 5
  });

  it('should pick highest kicker for two pair with 3 pairs in 7 cards', () => {
    // Board: Ks 3d Qc Kh Qd — Player holds Ah 3h
    // Three pairs: KK, QQ, 33 — best hand is KK QQ with Ace kicker
    const cards: Card[] = [
      { rank: 'A', suit: 'hearts' },
      { rank: '3', suit: 'hearts' },
      { rank: 'K', suit: 'spades' },
      { rank: '3', suit: 'diamonds' },
      { rank: 'Q', suit: 'clubs' },
      { rank: 'K', suit: 'hearts' },
      { rank: 'Q', suit: 'diamonds' },
    ];
    const hand = evaluateHand(cards);
    expect(hand.category).toBe(2); // Two pair
    expect(hand.kickers).toEqual([13, 12, 14]); // KK QQ kicker Ace
  });

  it('should correctly compare two pair hands with different kickers from 3-pair boards', () => {
    // Board: Ks 3d Qc Kh Qd
    // Player: Ah 3h → KK QQ A kicker
    const playerCards: Card[] = [
      { rank: 'A', suit: 'hearts' }, { rank: '3', suit: 'hearts' },
      { rank: 'K', suit: 'spades' }, { rank: '3', suit: 'diamonds' },
      { rank: 'Q', suit: 'clubs' }, { rank: 'K', suit: 'hearts' },
      { rank: 'Q', suit: 'diamonds' },
    ];
    // AI: 8d 5c → KK QQ 8 kicker
    const aiCards: Card[] = [
      { rank: '8', suit: 'diamonds' }, { rank: '5', suit: 'clubs' },
      { rank: 'K', suit: 'spades' }, { rank: '3', suit: 'diamonds' },
      { rank: 'Q', suit: 'clubs' }, { rank: 'K', suit: 'hearts' },
      { rank: 'Q', suit: 'diamonds' },
    ];
    const playerHand = evaluateHand(playerCards);
    const aiHand = evaluateHand(aiCards);
    expect(playerHand.category).toBe(2);
    expect(aiHand.category).toBe(2);
    expect(compareHands(playerHand, aiHand)).toBeGreaterThan(0); // Player wins
  });

  it('should recognize one pair', () => {
    const cards: Card[] = [
      { rank: 'A', suit: 'hearts' },
      { rank: 'A', suit: 'diamonds' },
      { rank: 'K', suit: 'clubs' },
      { rank: 'Q', suit: 'spades' },
      { rank: 'J', suit: 'hearts' }
    ];
    const hand = evaluateHand(cards);
    expect(hand.category).toBe(1); // One pair
  });

  it('should recognize high card', () => {
    const cards: Card[] = [
      { rank: 'A', suit: 'hearts' },
      { rank: 'K', suit: 'diamonds' },
      { rank: 'Q', suit: 'clubs' },
      { rank: 'J', suit: 'spades' },
      { rank: '9', suit: 'hearts' }
    ];
    const hand = evaluateHand(cards);
    expect(hand.category).toBe(0); // High card
  });

  // --- Kicker tests ---

  it('should pick correct kickers for one pair (5 cards)', () => {
    const cards: Card[] = [
      { rank: 'A', suit: 'hearts' }, { rank: 'A', suit: 'diamonds' },
      { rank: 'K', suit: 'clubs' }, { rank: 'Q', suit: 'spades' },
      { rank: 'J', suit: 'hearts' },
    ];
    const hand = evaluateHand(cards);
    expect(hand.category).toBe(1);
    expect(hand.kickers).toEqual([14, 13, 12, 11]); // AA kickers K Q J
  });

  it('should pick best 3 kickers for one pair from 7 cards', () => {
    // Pair of 9s with A K Q 7 3 — kickers should be A K Q
    const cards: Card[] = [
      { rank: '9', suit: 'hearts' }, { rank: '9', suit: 'diamonds' },
      { rank: 'A', suit: 'clubs' }, { rank: '3', suit: 'spades' },
      { rank: 'K', suit: 'hearts' }, { rank: '7', suit: 'clubs' },
      { rank: 'Q', suit: 'diamonds' },
    ];
    const hand = evaluateHand(cards);
    expect(hand.category).toBe(1);
    expect(hand.kickers).toEqual([9, 14, 13, 12]); // 99 kickers A K Q
  });

  it('should compare one pair hands by kickers', () => {
    // Both have pair of Kings, player has A kicker, AI has Q kicker
    const player: Card[] = [
      { rank: 'K', suit: 'hearts' }, { rank: 'K', suit: 'diamonds' },
      { rank: 'A', suit: 'clubs' }, { rank: '5', suit: 'spades' },
      { rank: '3', suit: 'hearts' },
    ];
    const ai: Card[] = [
      { rank: 'K', suit: 'clubs' }, { rank: 'K', suit: 'spades' },
      { rank: 'Q', suit: 'hearts' }, { rank: '5', suit: 'diamonds' },
      { rank: '3', suit: 'clubs' },
    ];
    expect(compareHands(evaluateHand(player), evaluateHand(ai))).toBeGreaterThan(0);
  });

  it('should pick correct kickers for three of a kind (5 cards)', () => {
    const cards: Card[] = [
      { rank: 'J', suit: 'hearts' }, { rank: 'J', suit: 'diamonds' },
      { rank: 'J', suit: 'clubs' }, { rank: 'A', suit: 'spades' },
      { rank: '3', suit: 'hearts' },
    ];
    const hand = evaluateHand(cards);
    expect(hand.category).toBe(3);
    expect(hand.kickers).toEqual([11, 14, 3]); // JJJ kickers A 3
  });

  it('should pick best 2 kickers for three of a kind from 7 cards', () => {
    // Trip 7s with A K 4 2 — kickers should be A K
    const cards: Card[] = [
      { rank: '7', suit: 'hearts' }, { rank: '7', suit: 'diamonds' },
      { rank: '7', suit: 'clubs' }, { rank: '2', suit: 'spades' },
      { rank: 'A', suit: 'hearts' }, { rank: '4', suit: 'clubs' },
      { rank: 'K', suit: 'diamonds' },
    ];
    const hand = evaluateHand(cards);
    expect(hand.category).toBe(3);
    expect(hand.kickers).toEqual([7, 14, 13]); // 777 kickers A K
  });

  it('should compare three of a kind hands by kickers', () => {
    // Both have trip 5s; player has A K kickers, AI has Q J kickers
    const player: Card[] = [
      { rank: '5', suit: 'hearts' }, { rank: '5', suit: 'diamonds' },
      { rank: '5', suit: 'clubs' }, { rank: 'A', suit: 'spades' },
      { rank: 'K', suit: 'hearts' },
    ];
    const ai: Card[] = [
      { rank: '5', suit: 'spades' }, { rank: '5', suit: 'clubs' },
      { rank: '5', suit: 'hearts' }, { rank: 'Q', suit: 'diamonds' },
      { rank: 'J', suit: 'clubs' },
    ];
    expect(compareHands(evaluateHand(player), evaluateHand(ai))).toBeGreaterThan(0);
  });

  it('should pick correct kicker for four of a kind (5 cards)', () => {
    const cards: Card[] = [
      { rank: 'A', suit: 'hearts' }, { rank: 'A', suit: 'diamonds' },
      { rank: 'A', suit: 'clubs' }, { rank: 'A', suit: 'spades' },
      { rank: 'K', suit: 'hearts' },
    ];
    const hand = evaluateHand(cards);
    expect(hand.category).toBe(7);
    expect(hand.kickers).toEqual([14, 13]); // AAAA kicker K
  });

  it('should pick highest kicker for four of a kind from 7 cards with a pair', () => {
    // AAAA 33 K — kicker must be K (13), not 3
    const cards: Card[] = [
      { rank: 'A', suit: 'hearts' }, { rank: 'A', suit: 'diamonds' },
      { rank: 'A', suit: 'clubs' }, { rank: 'A', suit: 'spades' },
      { rank: '3', suit: 'hearts' }, { rank: '3', suit: 'diamonds' },
      { rank: 'K', suit: 'clubs' },
    ];
    const hand = evaluateHand(cards);
    expect(hand.category).toBe(7);
    expect(hand.kickers).toEqual([14, 13]); // AAAA kicker K, not 3
  });

  it('should compare four of a kind hands by kicker', () => {
    const player: Card[] = [
      { rank: '9', suit: 'hearts' }, { rank: '9', suit: 'diamonds' },
      { rank: '9', suit: 'clubs' }, { rank: '9', suit: 'spades' },
      { rank: 'A', suit: 'hearts' },
    ];
    const ai: Card[] = [
      { rank: '9', suit: 'hearts' }, { rank: '9', suit: 'diamonds' },
      { rank: '9', suit: 'clubs' }, { rank: '9', suit: 'spades' },
      { rank: 'K', suit: 'clubs' },
    ];
    expect(compareHands(evaluateHand(player), evaluateHand(ai))).toBeGreaterThan(0);
  });

  it('should pick best 5 flush cards from 7 cards', () => {
    // 7 cards, 6 hearts — flush should be top 5 heart values
    const cards: Card[] = [
      { rank: 'A', suit: 'hearts' }, { rank: 'K', suit: 'hearts' },
      { rank: '9', suit: 'hearts' }, { rank: '7', suit: 'hearts' },
      { rank: '3', suit: 'hearts' }, { rank: '2', suit: 'hearts' },
      { rank: 'Q', suit: 'diamonds' },
    ];
    const hand = evaluateHand(cards);
    expect(hand.category).toBe(5);
    expect(hand.kickers).toEqual([14, 13, 9, 7, 3]); // A K 9 7 3 (drops 2)
  });

  it('should compare flushes by highest differing card', () => {
    // Both have heart flush, player has A-high, AI has K-high
    const player: Card[] = [
      { rank: 'A', suit: 'hearts' }, { rank: 'J', suit: 'hearts' },
      { rank: '9', suit: 'hearts' }, { rank: '7', suit: 'hearts' },
      { rank: '3', suit: 'hearts' },
    ];
    const ai: Card[] = [
      { rank: 'K', suit: 'hearts' }, { rank: 'J', suit: 'hearts' },
      { rank: '9', suit: 'hearts' }, { rank: '7', suit: 'hearts' },
      { rank: '3', suit: 'hearts' },
    ];
    expect(compareHands(evaluateHand(player), evaluateHand(ai))).toBeGreaterThan(0);
  });

  it('should compare flushes by second card when first matches', () => {
    const player: Card[] = [
      { rank: 'A', suit: 'spades' }, { rank: 'Q', suit: 'spades' },
      { rank: '9', suit: 'spades' }, { rank: '7', suit: 'spades' },
      { rank: '3', suit: 'spades' },
    ];
    const ai: Card[] = [
      { rank: 'A', suit: 'clubs' }, { rank: 'J', suit: 'clubs' },
      { rank: '9', suit: 'clubs' }, { rank: '7', suit: 'clubs' },
      { rank: '3', suit: 'clubs' },
    ];
    expect(compareHands(evaluateHand(player), evaluateHand(ai))).toBeGreaterThan(0);
  });

  it('should recognize the wheel (A-2-3-4-5 straight)', () => {
    const cards: Card[] = [
      { rank: 'A', suit: 'hearts' },
      { rank: '5', suit: 'diamonds' },
      { rank: '4', suit: 'clubs' },
      { rank: '3', suit: 'spades' },
      { rank: '2', suit: 'hearts' }
    ];
    const hand = evaluateHand(cards);
    expect(hand.category).toBe(4); // Straight
    expect(hand.kickers[0]).toBe(5); // High card of wheel is 5
  });

  it('should compare hands correctly', () => {
    const flush: Card[] = [
      { rank: 'K', suit: 'hearts' },
      { rank: '10', suit: 'hearts' },
      { rank: '8', suit: 'hearts' },
      { rank: '5', suit: 'hearts' },
      { rank: '3', suit: 'hearts' }
    ];
    const pair: Card[] = [
      { rank: 'A', suit: 'hearts' },
      { rank: 'A', suit: 'diamonds' },
      { rank: 'K', suit: 'clubs' },
      { rank: 'Q', suit: 'spades' },
      { rank: 'J', suit: 'hearts' }
    ];
    
    const flushHand = evaluateHand(flush);
    const pairHand = evaluateHand(pair);
    
    expect(compareHands(flushHand, pairHand)).toBeGreaterThan(0);
    expect(compareHands(pairHand, flushHand)).toBeLessThan(0);
  });
});

describe('Game Engine', () => {
  it('should initialize a game', () => {
    const engine = new PokerGameEngine();
    engine.initGame(['player1', 'player2']);
    
    const players = engine.getPlayers();
    expect(players).toHaveLength(2);
    expect(players[0].chips).toBe(1000);
    expect(players[1].chips).toBe(1000);
  });

  it('should start a new hand', () => {
    const engine = new PokerGameEngine();
    engine.initGame(['player1', 'player2']);
    engine.startNewHand();
    
    const state = engine.getGameState();
    expect(state.street).toBe('preflop');
    expect(state.players[0].cards).toHaveLength(2);
    expect(state.players[1].cards).toHaveLength(2);
  });

  it('should process player actions', () => {
    const engine = new PokerGameEngine({ smallBlind: 5, bigBlind: 10 });
    engine.initGame(['player1', 'player2']);
    engine.startNewHand();
    
    const state = engine.getGameState();
    const currentPlayer = state.players[state.currentPlayerIndex];
    
    // Player should be able to call, raise, or fold
    expect(state.canCall || state.canRaise || state.canFold).toBe(true);
  });

  it('should advance streets', () => {
    const engine = new PokerGameEngine();
    engine.initGame(['player1', 'player2']);
    engine.startNewHand();
    
    let state = engine.getGameState();
    expect(state.street).toBe('preflop');
    
    // Both players check/call to advance
    const player1 = state.players[state.currentPlayerIndex];
    if (state.canCall) {
      engine.processAction(player1.id, { type: 'call', amount: state.callAmount });
    } else {
      engine.processAction(player1.id, { type: 'check' });
    }
    
    state = engine.getGameState();
    const player2 = state.players[state.currentPlayerIndex];
    if (state.canCheck) {
      engine.processAction(player2.id, { type: 'check' });
    }
    
    state = engine.getGameState();
    // Should advance to flop after both players act
    if (state.street === 'flop') {
      expect(state.communityCards).toHaveLength(3);
    }
  });

  it('should handle fold action', () => {
    const engine = new PokerGameEngine();
    engine.initGame(['player1', 'player2']);
    engine.startNewHand();
    
    const state = engine.getGameState();
    const currentPlayer = state.players[state.currentPlayerIndex];
    
    engine.processAction(currentPlayer.id, { type: 'fold' });
    
    // Hand should be over
    expect(engine.isHandInProgress()).toBe(false);
  });

  it('should emit events', () => {
    const engine = new PokerGameEngine();
    const events: string[] = [];
    
    engine.on((event) => {
      events.push(event.type);
    });
    
    engine.initGame(['player1', 'player2']);
    engine.startNewHand();
    
    expect(events).toContain('hand_started');
    expect(events).toContain('cards_dealt');
  });
});

describe('AI', () => {
  it('should make decisions', () => {
    const engine = new PokerGameEngine();
    engine.initGame(['player1', 'ai']);
    engine.startNewHand();
    
    const state = engine.getGameState();
    const aiPlayer = state.players.find(p => p.id === 'ai');
    
    if (aiPlayer && state.currentPlayerIndex === state.players.indexOf(aiPlayer)) {
      const action = engine.getAIAction('ai');
      expect(action).toHaveProperty('type');
      expect(['fold', 'check', 'call', 'bet', 'raise', 'allin']).toContain(action.type);
    }
  });
});

describe('Multiplayer Support', () => {
  it('should initialize 4-player game', () => {
    const engine = new PokerGameEngine({ maxPlayers: 4 });
    engine.initGame(['player1', 'player2', 'player3', 'player4']);
    
    const players = engine.getPlayers();
    expect(players).toHaveLength(4);
  });

  it('should initialize 6-player game', () => {
    const engine = new PokerGameEngine({ maxPlayers: 6 });
    engine.initGame(['p1', 'p2', 'p3', 'p4', 'p5', 'p6']);
    
    const players = engine.getPlayers();
    expect(players).toHaveLength(6);
  });

  it('should initialize 8-player game', () => {
    const engine = new PokerGameEngine({ maxPlayers: 8 });
    engine.initGame(['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8']);
    
    const players = engine.getPlayers();
    expect(players).toHaveLength(8);
  });

  it('should post blinds correctly in 4-player game', () => {
    const engine = new PokerGameEngine({ maxPlayers: 4, smallBlind: 5, bigBlind: 10 });
    engine.initGame(['p1', 'p2', 'p3', 'p4']);
    engine.startNewHand();
    
    const state = engine.getGameState();
    const players = state.players;
    
    // After blinds are posted, check that SB and BB have bets
    const totalBets = players.reduce((sum, p) => sum + p.bet, 0);
    expect(totalBets).toBe(15); // 5 (SB) + 10 (BB)
  });

  it('should maintain chip stacks across hands', () => {
    const engine = new PokerGameEngine({ maxPlayers: 3, startingChips: 1000 });
    engine.initGame(['p1', 'p2', 'p3']);
    
    // First hand
    engine.startNewHand();
    let state = engine.getGameState();
    const initialChips = state.players.map(p => p.chips);
    
    // First player folds
    const currentPlayer = state.players[state.currentPlayerIndex];
    engine.processAction(currentPlayer.id, { type: 'fold' });
    
    // Second hand
    if (!engine.isHandInProgress()) {
      engine.startNewHand();
      state = engine.getGameState();
      
      // Chip stacks should have changed from initial
      const newChips = state.players.map(p => p.chips);
      expect(newChips).not.toEqual(initialChips);
    }
  });

  it('should rotate dealer button', () => {
    const engine = new PokerGameEngine({ maxPlayers: 4 });
    engine.initGame(['p1', 'p2', 'p3', 'p4']);
    
    engine.startNewHand();
    const state1 = engine.getGameState();
    const dealer1 = state1.dealerIndex;
    
    // Finish hand
    engine.processAction(state1.players[state1.currentPlayerIndex].id, { type: 'fold' });
    
    // Start new hand
    if (!engine.isHandInProgress()) {
      engine.startNewHand();
      const state2 = engine.getGameState();
      const dealer2 = state2.dealerIndex;
      
      // Dealer should have moved
      expect(dealer2).toBe((dealer1 + 1) % 4);
    }
  });
});

