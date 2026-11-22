// (c) 2025 MiraNova Studio
/**
 * Core type definitions for the poker engine
 */

export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type Rank = 'A' | 'K' | 'Q' | 'J' | '10' | '9' | '8' | '7' | '6' | '5' | '4' | '3' | '2';

export interface Card {
  suit: Suit;
  rank: Rank;
}

export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

export type PlayerAction =
  | { type: 'fold' }
  | { type: 'check' }
  | { type: 'call'; amount?: number }
  | { type: 'bet'; amount: number }
  | { type: 'raise'; amount: number }
  | { type: 'allin'; amount?: number };

export interface HandStrength {
  category: number;      // 0=high card, 1=pair, ..., 8=straight flush
  kickers: number[];     // tie-break values (descending)
}

export interface PlayerState {
  id: string;
  chips: number;
  bet: number;           // current bet this street
  totalBet: number;      // total bet this hand
  folded: boolean;
  allIn: boolean;
  cards: Card[];
  isDealer: boolean;
  isActive: boolean;     // still in the hand
}

export interface GameConfig {
  smallBlind: number;
  bigBlind: number;
  startingChips: number;
  maxPlayers: number;
  minRaise?: number;
  gameType?: 'cash' | 'sng' | 'tournament';
  blindStructure?: string;  // Name of standard structure or 'custom'
}

