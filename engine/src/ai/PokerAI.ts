// (c) 2025 MiraNova Studios
/**
 * Main AI controller for poker decisions
 */

import type { Card, Street, PlayerAction } from '../types.js';
import type { AIConfig, Playstyle } from './ai-config.js';
import { PLAYSTYLE_DEFAULTS } from './ai-config.js';
import { decidePreflopAction, evaluatePreflopHand } from './preflop.js';
import { decidePostflopAction, evaluatePostflopHand } from './postflop.js';

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
  /** Player's position relative to dealer (0 = dealer/button) */
  positionFromDealer?: number;
  /** Number of players still active (not folded) this hand */
  activePlayers?: number;
  /** Big blind amount */
  bigBlind?: number;
}

/**
 * Poker AI — makes decisions based on a playstyle configuration.
 */
export class PokerAI {
  private config: AIConfig;
  private playerId: string;

  constructor(config?: AIConfig | Playstyle, playerId?: string) {
    if (typeof config === 'string') {
      this.config = { ...PLAYSTYLE_DEFAULTS[config] };
    } else {
      this.config = config ?? { ...PLAYSTYLE_DEFAULTS.passive };
    }
    this.playerId = playerId ?? 'ai';
  }

  decide(context: GameContext): PlayerAction {
    const { street } = context;
    const strength = this.evaluateHandStrength(context);

    if (street === 'preflop' || context.communityCards.length === 0) {
      return decidePreflopAction(
        {
          pot: context.pot,
          currentBet: context.currentBet,
          playerBet: context.playerBet,
          playerChips: context.playerChips,
          minRaise: context.minRaise,
          opponentChips: context.opponentChips,
          holeCards: context.holeCards,
          positionFromDealer: context.positionFromDealer,
          activePlayers: context.activePlayers,
          bigBlind: context.bigBlind,
        },
        this.config,
        strength
      );
    }

    return decidePostflopAction(context, this.config, strength);
  }

  private evaluateHandStrength(context: GameContext): number {
    const { street, holeCards, communityCards } = context;
    if (street === 'preflop' || communityCards.length === 0) {
      return evaluatePreflopHand(holeCards);
    }
    return evaluatePostflopHand(holeCards, communityCards);
  }

  setConfig(config: AIConfig | Playstyle): void {
    if (typeof config === 'string') {
      this.config = { ...PLAYSTYLE_DEFAULTS[config] };
    } else {
      this.config = { ...config };
    }
  }

  getConfig(): AIConfig {
    return { ...this.config };
  }

  getPlayerId(): string {
    return this.playerId;
  }

  setPlayerId(playerId: string): void {
    this.playerId = playerId;
  }
}
