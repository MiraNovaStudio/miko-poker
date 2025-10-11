/**
 * MikoPoker Engine - Pure TypeScript Texas Hold'em Engine
 * UI-agnostic poker game logic
 */

export const version = '0.1.0';

// Main game engine
export { PokerGameEngine } from './game-engine';
export type { GameState, GameResult, GameEvent } from './game-engine';

// Types
export type { 
  Card, 
  Suit, 
  Rank, 
  Street, 
  PlayerAction, 
  PlayerState,
  HandStrength,
  GameConfig 
} from './types';

// Hand evaluation
export { 
  evaluateHand, 
  compareHands, 
  getHandName,
  getRankName
} from './hand-evaluator';

// Components (if needed for advanced usage)
export { Deck } from './deck';
export { Player } from './player';
export { PotManager } from './pot';
export { BettingRound } from './betting';
export { PokerAI } from './ai';
export type { AIConfig, GameContext } from './ai';
