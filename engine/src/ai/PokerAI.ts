/**
 * Main AI controller for poker decisions
 */

import type { Card, Street, PlayerAction } from '../types';
import type { AIConfig } from './ai-config';
import { getAIPreset, type AIDifficulty } from './ai-config';
import { decidePreflopAction, evaluatePreflopHand } from './preflop';
import { decidePostflopAction, evaluatePostflopHand } from './postflop';

/**
 * Game context for AI decisions
 */
export interface GameContext {
  street: Street;
  pot: number;
  currentBet: number;
  playerBet: number;
  playerChips: number;
  minRaise: number;
  opponentChips: number;
  holeCards: Card[];
  communityCards: Card[];
}

/**
 * Poker AI - makes decisions for computer-controlled players
 */
export class PokerAI {
  private config: AIConfig;
  private playerId: string;

  /**
   * Create a new AI instance
   * @param config AI configuration or difficulty preset
   * @param playerId Optional player ID for this AI
   */
  constructor(config?: AIConfig | AIDifficulty, playerId?: string) {
    if (typeof config === 'string') {
      this.config = getAIPreset(config);
    } else {
      this.config = config ?? getAIPreset('normal');
    }
    this.playerId = playerId ?? 'ai';
  }

  /**
   * Make a decision based on current game state
   * @param context Game context
   * @returns Player action
   */
  decide(context: GameContext): PlayerAction {
    const { street } = context;

    // Calculate hand strength
    const strength = this.evaluateHandStrength(context);

    // Pre-flop logic
    if (street === 'preflop' || context.communityCards.length === 0) {
      return decidePreflopAction(
        {
          pot: context.pot,
          currentBet: context.currentBet,
          playerBet: context.playerBet,
          playerChips: context.playerChips,
          minRaise: context.minRaise,
          opponentChips: context.opponentChips,
          holeCards: context.holeCards
        },
        this.config,
        strength
      );
    }

    // Post-flop logic
    return decidePostflopAction(context, this.config, strength);
  }

  /**
   * Evaluate hand strength (0-1 scale)
   * @param context Game context
   * @returns Hand strength
   */
  private evaluateHandStrength(context: GameContext): number {
    const { street, holeCards, communityCards } = context;

    // Pre-flop: simple hand strength based on hole cards
    if (street === 'preflop' || communityCards.length === 0) {
      return evaluatePreflopHand(holeCards);
    }

    // Post-flop: evaluate actual hand
    return evaluatePostflopHand(holeCards, communityCards);
  }

  /**
   * Update AI configuration
   * @param config New configuration or difficulty preset
   */
  setConfig(config: AIConfig | AIDifficulty): void {
    if (typeof config === 'string') {
      this.config = getAIPreset(config);
    } else {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Get current configuration
   * @returns Current AI configuration
   */
  getConfig(): AIConfig {
    return { ...this.config };
  }

  /**
   * Get player ID for this AI
   * @returns Player ID
   */
  getPlayerId(): string {
    return this.playerId;
  }

  /**
   * Set player ID for this AI
   * @param playerId Player ID
   */
  setPlayerId(playerId: string): void {
    this.playerId = playerId;
  }
}

