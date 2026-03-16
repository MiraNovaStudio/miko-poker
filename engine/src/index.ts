// (c) 2025 MiraNova Studios
/**
 * MikoPoker Engine - Pure TypeScript Texas Hold'em Engine
 * UI-agnostic poker game logic
 */

export const version = '0.1.0';

// Main game engine
export { PokerGameEngine } from './game-engine.js';
export type { GameState, GameResult, GamePotResult, GameEvent } from './game-engine.js';

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
} from './types.js';

// Hand evaluation
export { 
  evaluateHand, 
  compareHands, 
  getHandName,
  getRankName
} from './hand-evaluator.js';

// Components (if needed for advanced usage)
export { Deck } from './deck.js';
export { Player } from './player.js';
export { PotManager } from './pot.js';
export type { PotAwardResult } from './pot.js';
export { BettingRound } from './betting.js';

// AI
export { PokerAI } from './ai/PokerAI.js';
export type { GameContext } from './ai/PokerAI.js';
export type { AIConfig, Playstyle } from './ai/ai-config.js';
export { PLAYSTYLE_DEFAULTS, getPlaystyleConfig } from './ai/ai-config.js';

// Game modes
export { GameModeManager, STANDARD_STRUCTURES } from './game-mode.js';
export type { 
  GameType, 
  BlindLevel, 
  BlindStructure, 
  GameModeConfig 
} from './game-mode.js';

// Debug utilities
export { DEBUG_ENABLED } from './debug.js';
