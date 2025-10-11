/**
 * Main Texas Hold'em Game Engine
 * Orchestrates all game components and provides the primary API
 */

import { Deck } from './deck';
import { Player } from './player';
import { PotManager } from './pot';
import { BettingRound } from './betting';
import { evaluateHand, compareHands, getHandName } from './hand-evaluator';
import { PokerAI } from './ai';
import type { Card, Street, PlayerAction, GameConfig, PlayerState } from './types';

export interface GameState {
  street: Street;
  pot: number;
  communityCards: Card[];
  players: PlayerState[];
  currentPlayerIndex: number;
  dealerIndex: number;
  canCheck: boolean;
  canBet: boolean;
  canCall: boolean;
  canRaise: boolean;
  canFold: boolean;
  callAmount: number;
  minRaiseAmount: number;
  minBetAmount: number;
}

export interface GameResult {
  winners: string[]; // player IDs
  winningHand?: string;
  playerHand?: string;
  opponentHand?: string;
  potAmount: number;
}

export type GameEvent = 
  | { type: 'hand_started' }
  | { type: 'cards_dealt'; playerId: string; cards: Card[] }
  | { type: 'street_changed'; street: Street; communityCards: Card[] }
  | { type: 'player_action'; playerId: string; action: PlayerAction }
  | { type: 'pot_updated'; amount: number }
  | { type: 'hand_complete'; result: GameResult }
  | { type: 'game_over'; winnerId: string };

export class PokerGameEngine {
  private config: GameConfig;
  private players: Player[];
  private deck: Deck;
  private pot: PotManager;
  private bettingRound: BettingRound;
  private ai: PokerAI;
  
  private street: Street;
  private communityCards: Card[];
  private dealerIndex: number;
  private currentPlayerIndex: number;
  private handInProgress: boolean;
  private eventListeners: ((event: GameEvent) => void)[];

  constructor(config?: Partial<GameConfig>) {
    this.config = {
      smallBlind: config?.smallBlind ?? 5,
      bigBlind: config?.bigBlind ?? 10,
      startingChips: config?.startingChips ?? 1000,
      maxPlayers: config?.maxPlayers ?? 2,
      minRaise: config?.minRaise ?? 10
    };

    this.deck = new Deck();
    this.pot = new PotManager();
    this.bettingRound = new BettingRound(this.config.minRaise);
    this.ai = new PokerAI({ aggression: 0.6, skill: 0.7 });
    
    this.players = [];
    this.communityCards = [];
    this.street = 'preflop';
    this.dealerIndex = 0;
    this.currentPlayerIndex = 0;
    this.handInProgress = false;
    this.eventListeners = [];
  }

  /**
   * Initialize game with players
   */
  initGame(playerIds: string[]): void {
    if (playerIds.length < 2) {
      throw new Error('Need at least 2 players');
    }
    if (playerIds.length > this.config.maxPlayers) {
      throw new Error(`Maximum ${this.config.maxPlayers} players allowed`);
    }

    this.players = playerIds.map(id => new Player(id, this.config.startingChips));
    this.players[0].isDealer = true;
    this.dealerIndex = 0;
  }

  /**
   * Start a new hand
   */
  startNewHand(): void {
    if (this.players.length < 2) {
      throw new Error('Need at least 2 players to start');
    }

    // Check if game is over (only one player with chips)
    const playersWithChips = this.players.filter(p => p.chips > 0);
    if (playersWithChips.length < 2) {
      this.emitEvent({ type: 'game_over', winnerId: playersWithChips[0]?.id || '' });
      return;
    }

    // Reset for new hand
    this.deck.reset();
    this.pot.reset();
    this.communityCards = [];
    this.street = 'preflop';
    this.handInProgress = true;

    // Reset players
    for (const player of this.players) {
      player.resetForNewHand();
    }

    // Move dealer button
    this.dealerIndex = (this.dealerIndex + 1) % this.players.length;
    this.players.forEach(p => p.isDealer = false);
    this.players[this.dealerIndex].isDealer = true;

    this.emitEvent({ type: 'hand_started' });

    // Deal hole cards
    for (const player of this.players) {
      const cards = this.deck.dealMultiple(2);
      player.dealCards(cards);
      this.emitEvent({ type: 'cards_dealt', playerId: player.id, cards });
    }

    // Post blinds
    this.postBlinds();
    
    // Set first player to act (UTG in multiplayer, dealer in heads-up)
    this.currentPlayerIndex = this.getFirstToActPreflop();

    this.emitEvent({ type: 'pot_updated', amount: this.pot.getTotalPot() });
  }

  /**
   * Process a player action
   */
  processAction(playerId: string, action: PlayerAction): boolean {
    if (!this.handInProgress) {
      throw new Error('No hand in progress');
    }

    const player = this.players.find(p => p.id === playerId);
    if (!player) {
      throw new Error('Player not found');
    }

    if (this.players[this.currentPlayerIndex].id !== playerId) {
      throw new Error('Not this player\'s turn');
    }

    // Process the action
    const success = this.bettingRound.processAction(player, action, this.currentPlayerIndex);
    
    if (success) {
      this.emitEvent({ type: 'player_action', playerId, action });
      this.emitEvent({ type: 'pot_updated', amount: this.getCurrentPot() });

      // Check if hand is over (everyone folded except one)
      const activePlayers = this.players.filter(p => !p.folded);
      if (activePlayers.length === 1) {
        this.endHandByFold(activePlayers[0]);
        return true;
      }

      // Move to next player or next street
      this.advanceAction();
    }

    return success;
  }

  /**
   * Get AI decision for current player
   */
  getAIAction(playerId: string): PlayerAction {
    const player = this.players.find(p => p.id === playerId);
    if (!player) {
      throw new Error('Player not found');
    }

    const context = {
      street: this.street,
      pot: this.getCurrentPot(),
      currentBet: this.bettingRound.getCurrentBet(),
      playerBet: player.bet,
      playerChips: player.chips,
      minRaise: this.bettingRound.getMinRaise(),
      opponentChips: this.players.find(p => p.id !== playerId)?.chips || 0,
      holeCards: player.cards,
      communityCards: this.communityCards
    };

    return this.ai.decide(context);
  }

  /**
   * Process AI action for current player
   */
  processAIAction(playerId: string): PlayerAction {
    const action = this.getAIAction(playerId);
    this.processAction(playerId, action);
    return action;
  }

  /**
   * Advance to next player or next street
   */
  private advanceAction(): void {
    // Find next player who can act
    let nextIndex = (this.currentPlayerIndex + 1) % this.players.length;
    let attempts = 0;
    
    while (!this.players[nextIndex].canAct() && attempts < this.players.length) {
      nextIndex = (nextIndex + 1) % this.players.length;
      attempts++;
    }

    // Check if betting round is complete
    const startIndex = (this.dealerIndex + 1) % this.players.length;
    if (this.bettingRound.isRoundComplete(this.players, startIndex, nextIndex)) {
      this.advanceStreet();
    } else {
      this.currentPlayerIndex = nextIndex;
    }
  }

  /**
   * Advance to next street
   */
  private advanceStreet(): void {
    // Collect bets into pot
    this.pot.collectBetsSimple(this.players);
    this.bettingRound.reset();

    // Deal community cards based on street
    if (this.street === 'preflop') {
      this.street = 'flop';
      this.deck.burn();
      this.communityCards = this.deck.dealMultiple(3);
      this.emitEvent({ type: 'street_changed', street: this.street, communityCards: [...this.communityCards] });
      this.startNewBettingRound();
    } else if (this.street === 'flop') {
      this.street = 'turn';
      this.deck.burn();
      this.communityCards.push(this.deck.deal());
      this.emitEvent({ type: 'street_changed', street: this.street, communityCards: [...this.communityCards] });
      this.startNewBettingRound();
    } else if (this.street === 'turn') {
      this.street = 'river';
      this.deck.burn();
      this.communityCards.push(this.deck.deal());
      this.emitEvent({ type: 'street_changed', street: this.street, communityCards: [...this.communityCards] });
      this.startNewBettingRound();
    } else if (this.street === 'river') {
      this.street = 'showdown';
      this.doShowdown();
    }
  }

  /**
   * Start a new betting round
   */
  private startNewBettingRound(): void {
    // First to act postflop is first active player after dealer
    this.currentPlayerIndex = this.getFirstToActPostflop();
  }

  /**
   * Handle showdown
   */
  private doShowdown(): void {
    const activePlayers = this.players.filter(p => !p.folded);
    
    if (activePlayers.length === 0) {
      this.handInProgress = false;
      return;
    }

    if (activePlayers.length === 1) {
      this.endHandByFold(activePlayers[0]);
      return;
    }

    // Evaluate all hands
    const handsWithPlayers = activePlayers.map(player => {
      const allCards = [...player.cards, ...this.communityCards];
      const handStrength = evaluateHand(allCards);
      return { player, handStrength, handName: getHandName(handStrength) };
    });

    // Find winner(s)
    let bestHand = handsWithPlayers[0];
    for (let i = 1; i < handsWithPlayers.length; i++) {
      const comparison = compareHands(handsWithPlayers[i].handStrength, bestHand.handStrength);
      if (comparison > 0) {
        bestHand = handsWithPlayers[i];
      }
    }

    const winners = handsWithPlayers.filter(h => 
      compareHands(h.handStrength, bestHand.handStrength) === 0
    );

    // Award pot
    this.pot.awardPot(winners.map(w => w.player));

    const result: GameResult = {
      winners: winners.map(w => w.player.id),
      winningHand: bestHand.handName,
      playerHand: handsWithPlayers.find(h => h.player.id === this.players[0].id)?.handName,
      opponentHand: handsWithPlayers.find(h => h.player.id === this.players[1]?.id)?.handName,
      potAmount: this.pot.getTotalPot()
    };

    this.emitEvent({ type: 'hand_complete', result });
    this.handInProgress = false;
  }

  /**
   * End hand when all but one player folds
   */
  private endHandByFold(winner: Player): void {
    const potAmount = this.getCurrentPot();
    this.pot.collectBetsSimple(this.players);
    winner.addChips(this.pot.getTotalPot());

    const result: GameResult = {
      winners: [winner.id],
      potAmount
    };

    this.emitEvent({ type: 'hand_complete', result });
    this.handInProgress = false;
  }

  /**
   * Get current game state
   */
  getGameState(): GameState {
    const currentPlayer = this.players[this.currentPlayerIndex];
    const currentBet = this.bettingRound.getCurrentBet();
    const toCall = currentBet - currentPlayer.bet;

    return {
      street: this.street,
      pot: this.getCurrentPot(),
      communityCards: [...this.communityCards],
      players: this.players.map(p => p.getState()),
      currentPlayerIndex: this.currentPlayerIndex,
      dealerIndex: this.dealerIndex,
      canCheck: toCall === 0,
      canBet: toCall === 0 && currentPlayer.chips > 0,
      canCall: toCall > 0 && currentPlayer.chips >= toCall,
      canRaise: toCall > 0 && currentPlayer.chips > toCall,
      canFold: toCall > 0,
      callAmount: Math.min(toCall, currentPlayer.chips),
      minRaiseAmount: currentBet + this.bettingRound.getMinRaise(),
      minBetAmount: this.config.bigBlind
    };
  }

  /**
   * Get player by ID
   */
  getPlayer(playerId: string): PlayerState | undefined {
    return this.players.find(p => p.id === playerId)?.getState();
  }

  /**
   * Get all players
   */
  getPlayers(): PlayerState[] {
    return this.players.map(p => p.getState());
  }

  /**
   * Get current pot including current bets
   */
  getCurrentPot(): number {
    const currentBets = this.players.reduce((sum, p) => sum + p.bet, 0);
    return this.pot.getTotalPot() + currentBets;
  }

  /**
   * Check if hand is in progress
   */
  isHandInProgress(): boolean {
    return this.handInProgress;
  }

  /**
   * Get community cards
   */
  getCommunityCards(): Card[] {
    return [...this.communityCards];
  }

  /**
   * Get current street
   */
  getCurrentStreet(): Street {
    return this.street;
  }

  /**
   * Subscribe to game events
   */
  on(listener: (event: GameEvent) => void): void {
    this.eventListeners.push(listener);
  }

  /**
   * Unsubscribe from game events
   */
  off(listener: (event: GameEvent) => void): void {
    const index = this.eventListeners.indexOf(listener);
    if (index > -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  /**
   * Emit game event to all listeners
   */
  private emitEvent(event: GameEvent): void {
    for (const listener of this.eventListeners) {
      listener(event);
    }
  }

  /**
   * Update game configuration
   */
  updateConfig(config: Partial<GameConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.minRaise !== undefined) {
      this.bettingRound = new BettingRound(config.minRaise);
    }
  }

  /**
   * Get game configuration
   */
  getConfig(): GameConfig {
    return { ...this.config };
  }

  /**
   * Set AI configuration
   */
  setAIConfig(config: Parameters<typeof this.ai.setConfig>[0]): void {
    this.ai.setConfig(config);
  }

  /**
   * Post blinds based on player count
   */
  private postBlinds(): void {
    if (this.players.length === 2) {
      // Heads-up: Dealer is small blind, other is big blind
      const sbPlayer = this.players[this.dealerIndex];
      const bbPlayer = this.players[(this.dealerIndex + 1) % 2];
      
      sbPlayer.placeBet(this.config.smallBlind);
      bbPlayer.placeBet(this.config.bigBlind);
      
      this.bettingRound.setInitialBet(this.config.bigBlind);
    } else {
      // Multiplayer: Player after dealer is small blind, next is big blind
      const sbIndex = (this.dealerIndex + 1) % this.players.length;
      const bbIndex = (this.dealerIndex + 2) % this.players.length;
      
      const sbPlayer = this.players[sbIndex];
      const bbPlayer = this.players[bbIndex];
      
      sbPlayer.placeBet(this.config.smallBlind);
      bbPlayer.placeBet(this.config.bigBlind);
      
      this.bettingRound.setInitialBet(this.config.bigBlind);
    }
  }

  /**
   * Get first player to act preflop
   */
  private getFirstToActPreflop(): number {
    if (this.players.length === 2) {
      // Heads-up: Dealer (small blind) acts first preflop
      return this.dealerIndex;
    } else {
      // Multiplayer: UTG (player after big blind) acts first
      let firstIndex = (this.dealerIndex + 3) % this.players.length;
      
      // Find first active player
      let attempts = 0;
      while (!this.players[firstIndex].canAct() && attempts < this.players.length) {
        firstIndex = (firstIndex + 1) % this.players.length;
        attempts++;
      }
      
      return firstIndex;
    }
  }

  /**
   * Get first player to act postflop
   */
  private getFirstToActPostflop(): number {
    // First active player after dealer (small blind position in multiplayer)
    let firstIndex = (this.dealerIndex + 1) % this.players.length;
    
    let attempts = 0;
    while (!this.players[firstIndex].canAct() && attempts < this.players.length) {
      firstIndex = (firstIndex + 1) % this.players.length;
      attempts++;
    }
    
    return firstIndex;
  }
}

