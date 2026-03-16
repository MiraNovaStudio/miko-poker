// (c) 2025 MiraNova Studios
/**
 * Main Texas Hold'em Game Engine
 * Orchestrates all game components and provides the primary API
 */

import { Deck } from './deck.js';
import { Player } from './player.js';
import { PotManager } from './pot.js';
import { BettingRound } from './betting.js';
import { evaluateHand, compareHands, getHandName } from './hand-evaluator.js';
import { PokerAI } from './ai/PokerAI.js';
import type { AIConfig, Playstyle } from './ai/ai-config.js';
import { GameModeManager, STANDARD_STRUCTURES, type BlindStructure } from './game-mode.js';
import { debugLog, debugBettingState } from './debug.js';
import type { Card, Street, PlayerAction, GameConfig, PlayerState } from './types.js';

/**
 * Current game state
 */
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
  gameType?: 'cash' | 'sng' | 'tournament';
  currentBlindLevel?: number;
}

/**
 * Hand result information
 */
/** Per-pot result included in GameResult when side pots exist. */
export interface GamePotResult {
  potIndex: number;  // 0 = main pot, 1+ = side pots
  potLabel: string;  // "Main Pot", "Side Pot 1", etc.
  amount: number;
  winnerIds: string[];
  winningHand: string;
}

export interface GameResult {
  winners: string[];
  winningHand?: string;
  playerHand?: string;
  opponentHand?: string;
  potAmount: number;
  potResults?: GamePotResult[];
}

/**
 * Game events for UI integration
 */
export type GameEvent =
  | { type: 'hand_started' }
  | { type: 'cards_dealt'; playerId: string; cards: Card[] }
  | { type: 'street_changed'; street: Street; communityCards: Card[] }
  | { type: 'player_action'; playerId: string; action: PlayerAction }
  | { type: 'pot_updated'; amount: number }
  | { type: 'hand_complete'; result: GameResult }
  | { type: 'game_over'; winnerId: string }
  | { type: 'blind_posted'; playerId: string; amount: number; isAnte?: boolean }
  | { type: 'level_changed'; level: number; smallBlind: number; bigBlind: number; ante: number }
  | { type: 'game_mode_changed'; gameType: 'cash' | 'sng' | 'tournament' };

/**
 * Main poker game engine
 */
export class PokerGameEngine {
  private config: GameConfig;
  private players: Player[];
  private deck: Deck;
  private pot: PotManager;
  private bettingRound: BettingRound;
  private aiInstances: Map<string, PokerAI>;
  private gameMode: GameModeManager;

  private street: Street;
  private communityCards: Card[];
  private dealerIndex: number;
  private currentPlayerIndex: number;
  private handInProgress: boolean;
  private eventListeners: ((event: GameEvent) => void)[];
  private bettingRoundStartPlayer: number; // First player to act in current betting round
  private playersActedThisRound: Set<number>; // Track who has acted this betting round

  /**
   * Create a new poker game engine
   * @param config Game configuration
   */
  constructor(config?: Partial<GameConfig>) {
    this.config = {
      smallBlind: config?.smallBlind ?? 5,
      bigBlind: config?.bigBlind ?? 10,
      startingChips: config?.startingChips ?? 1000,
      maxPlayers: config?.maxPlayers ?? 2,
      minRaise: config?.minRaise ?? 10,
      gameType: config?.gameType ?? 'cash',
      blindStructure: config?.blindStructure
    };

    this.deck = new Deck();
    this.pot = new PotManager();
    this.bettingRound = new BettingRound(this.config.minRaise ?? 10);
    this.aiInstances = new Map();

    // Initialize game mode manager
    const gameType = this.config.gameType ?? 'cash';
    if (gameType === 'tournament' || gameType === 'sng') {
      const structureName = this.config.blindStructure ?? 'standard';
      const structure = STANDARD_STRUCTURES[structureName] || STANDARD_STRUCTURES.standard;
      this.gameMode = new GameModeManager({
        type: gameType,
        blindStructure: structure,
        currentLevel: 0
      });
      this.gameMode.startLevelTimer();
    } else {
      this.gameMode = new GameModeManager({ type: 'cash' });
    }

    this.players = [];
    this.communityCards = [];
    this.street = 'preflop';
    this.dealerIndex = 0;
    this.currentPlayerIndex = 0;
    this.handInProgress = false;
    this.eventListeners = [];
    this.bettingRoundStartPlayer = 0;
    this.playersActedThisRound = new Set();
  }

  /**
   * Initialize game with players
   * @param playerIds Array of player IDs
   * @param aiDifficulties Optional map of player ID to AI difficulty
   */
  initGame(playerIds: string[], aiConfigs?: Map<string, AIConfig | Playstyle>): void {
    if (playerIds.length < 2) {
      throw new Error('Need at least 2 players');
    }
    if (playerIds.length > this.config.maxPlayers) {
      throw new Error(`Maximum ${this.config.maxPlayers} players allowed`);
    }

    // Get starting chips from game mode for tournaments
    const startingChips = this.gameMode.isTournament()
      ? (this.gameMode.getConfig().blindStructure?.startingChips ?? this.config.startingChips)
      : this.config.startingChips;

    this.players = playerIds.map(id => new Player(id, startingChips));
    this.players[0].isDealer = true;
    this.dealerIndex = 0;

    // Create AI instances for each AI player
    for (const id of playerIds) {
      if (id !== 'player' && id.startsWith('ai')) {
        const config = aiConfigs?.get(id) ?? 'passive';
        this.aiInstances.set(id, new PokerAI(config, id));
      }
    }
  }

  /**
   * Start a new hand
   */
  startNewHand(): void {
    if (this.players.length < 2) {
      throw new Error('Need at least 2 players to start');
    }

    // Check for blind level advance in tournaments
    if (this.gameMode.shouldAdvanceLevel()) {
      const advanced = this.gameMode.advanceLevel();
      if (advanced) {
        const level = this.gameMode.getCurrentLevel();
        if (level) {
          this.emitEvent({
            type: 'level_changed',
            level: level.level,
            smallBlind: level.smallBlind,
            bigBlind: level.bigBlind,
            ante: level.ante
          });
        }
      }
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
    this.bettingRound.reset();
    debugLog('HAND_START', ` Pot reset to $${this.pot.getTotalPot()} for new hand`);
    this.communityCards = [];
    this.street = 'preflop';
    this.handInProgress = true;

    // Reset players
    for (const player of this.players) {
      player.resetForNewHand();
    }

    // Move dealer button (skip eliminated players)
    this.players.forEach(p => p.isDealer = false);
    let nextDealer = (this.dealerIndex + 1) % this.players.length;
    let attempts = 0;
    while (!this.players[nextDealer].isActive && attempts < this.players.length) {
      nextDealer = (nextDealer + 1) % this.players.length;
      attempts++;
    }
    this.dealerIndex = nextDealer;
    this.players[this.dealerIndex].isDealer = true;

    this.emitEvent({ type: 'hand_started' });

    // Deal hole cards (skip eliminated players with 0 chips)
    for (const player of this.players) {
      if (!player.isActive) continue;
      const cards = this.deck.dealMultiple(2);
      player.dealCards(cards);
      this.emitEvent({ type: 'cards_dealt', playerId: player.id, cards });
    }

    // Post blinds
    this.postBlinds();

    // Set first player to act (UTG in multiplayer, dealer in heads-up)
    this.currentPlayerIndex = this.getFirstToActPreflop();
    this.bettingRoundStartPlayer = this.currentPlayerIndex;
    this.playersActedThisRound = new Set();

    debugLog('START_ROUND', `Betting round started - First to act: ${this.currentPlayerIndex} (${this.players[this.currentPlayerIndex].id})`);

    this.emitEvent({ type: 'pot_updated', amount: this.pot.getTotalPot() });
  }

  /**
   * Process a player action
   * @param playerId Player ID
   * @param action Player action
   * @returns True if action was processed successfully
   */
  processAction(playerId: string, action: PlayerAction): boolean {
    debugLog('ACTION', `───────── PROCESS ACTION START ─────────`);
    const actionStr = action.type === 'fold' || action.type === 'check'
      ? action.type
      : `${action.type} $${action.amount}`;
    debugLog('ACTION', `Player: ${playerId}, Action: ${actionStr}`);

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

    debugBettingState(
      this.bettingRound.getCurrentBet(),
      this.players.map(p => ({ id: p.id, bet: p.bet, chips: p.chips, folded: p.folded, allIn: p.allIn })),
      this.currentPlayerIndex
    );

    // Process the action
    debugLog('ACTION', `Processing action with BettingRound...`);
    const success = this.bettingRound.processAction(player, action, this.currentPlayerIndex);

    if (success) {
      // Mark this player as having acted this round
      this.playersActedThisRound.add(this.currentPlayerIndex);
      debugLog('ACTION', ` Action processed successfully`);
      debugLog('ACTION', `Player ${playerId} bet is now: $${player.bet}`);

      this.emitEvent({ type: 'player_action', playerId, action });
      this.emitEvent({ type: 'pot_updated', amount: this.getCurrentPot() });

      // Check if hand is over (everyone folded except one)
      const activePlayers = this.players.filter(p => !p.folded);
      debugLog('ACTION', `Active players remaining: ${activePlayers.length}`);

      if (activePlayers.length === 1) {
        debugLog('ACTION', ` Only one player left! Hand ends by fold.`);
        this.endHandByFold(activePlayers[0]);
        return true;
      }

      // Check if all remaining players are all-in (no one can act)
      const canActPlayers = activePlayers.filter(p => !p.allIn);
      if (canActPlayers.length === 0 && activePlayers.length > 1) {
        debugLog('ACTION', ` All players are all-in! Auto-completing hand...`);
        this.forceHandComplete();
        return true;
      }

      // Check if betting round is complete
      debugLog('ACTION', `Checking if betting round is complete...`);
      const isComplete = this.isBettingRoundComplete();
      debugLog('ACTION', `Betting round complete? ${isComplete}`);

      if (isComplete) {
        debugLog('ACTION', ` Betting round COMPLETE → calling endBettingRound()`);
        this.endBettingRound();
      } else {
        debugLog('ACTION', `  Betting round NOT complete → advancing to next player`);
        this.advanceToNextPlayer();
      }
    } else {
      debugLog('ACTION', ` Action processing FAILED`);
    }

    debugLog('ACTION', `───────── PROCESS ACTION END ─────────\n`);
    return success;
  }

  /**
   * Check if the current betting round is complete
   * Round is complete when all active players have matched AND we've completed one full orbit
   */
  private isBettingRoundComplete(): boolean {
    debugLog('ROUND_CHECK', ` isBettingRoundComplete() called`);
    debugLog('ROUND_CHECK', `  Starting player for this round: ${this.bettingRoundStartPlayer} (${this.players[this.bettingRoundStartPlayer]?.id})`);
    debugLog('ROUND_CHECK', `  Players who have acted: ${Array.from(this.playersActedThisRound).join(', ')}`);

    const activePlayers = this.players.filter(p => p.canAct());
    debugLog('ROUND_CHECK', `  Active players (can act): ${activePlayers.length}`);
    debugLog('ROUND_CHECK', `  Active player IDs: ${activePlayers.map(p => p.id).join(', ')}`);

    if (activePlayers.length === 0) {
      debugLog('ROUND_CHECK', `   No active players → round complete`);
      return true;
    }

    // Get the highest bet among active players
    const highestBet = this.bettingRound.getCurrentBet();
    debugLog('ROUND_CHECK', `  Highest bet (currentBet): $${highestBet}`);

    // Log each active player's bet
    activePlayers.forEach(p => {
      debugLog('ROUND_CHECK', `    ${p.id}: bet=$${p.bet}, chips=$${p.chips}`);
    });

    // All active players must have matched the highest bet
    const allMatched = activePlayers.every(p => p.bet === highestBet);
    debugLog('ROUND_CHECK', `  All active players matched highest bet? ${allMatched}`);

    if (!allMatched) {
      debugLog('ROUND_CHECK', `   Not all matched → round NOT complete`);
      return false;
    }

    // All bets match, but have all active players had a chance to act?
    // Check if all active players have acted in this round
    const allActivePlayersActed = activePlayers.every((p, idx) => {
      const playerIndex = this.players.indexOf(p);
      return this.playersActedThisRound.has(playerIndex);
    });

    debugLog('ROUND_CHECK', `  Have all active players acted? ${allActivePlayersActed}`);

    if (!allActivePlayersActed) {
      debugLog('ROUND_CHECK', `   Not all active players have acted yet → round NOT complete`);
      return false;
    }

    debugLog('ROUND_CHECK', `   All matched AND all acted → round complete`);
    return true;
  }

  /**
   * End the current betting round
   * Collects all bets into the pot and advances to the next street
   */
  private endBettingRound(): void {
    debugLog('END_ROUND', `═══════ END BETTING ROUND ═══════`);
    debugLog('END_ROUND', `Street: ${this.street}`);

    // Log bets before collection
    const totalBets = this.players.reduce((sum, p) => sum + p.bet, 0);
    debugLog('END_ROUND', `Total bets to collect: $${totalBets}`);
    this.players.forEach(p => {
      if (p.bet > 0) {
        debugLog('END_ROUND', `  ${p.id}: $${p.bet}`);
      }
    });

    // Collect all current bets into the pot
    const potBefore = this.pot.getTotalPot();
    debugLog('END_ROUND', ` BEFORE collectBets: pot=$${potBefore}`);
    this.players.forEach(p => {
      if (p.bet > 0) debugLog('END_ROUND', `   ${p.id}: bet=$${p.bet}`);
    });

    this.pot.collectBets(this.players);

    const potAfter = this.pot.getTotalPot();
    debugLog('END_ROUND', ` AFTER collectBets: pot=$${potAfter}`);
    this.players.forEach(p => {
      debugLog('END_ROUND', `   ${p.id}: bet=$${p.bet} (should be 0)`);
    });

    // Reset betting round state
    this.bettingRound.reset();
    debugLog('END_ROUND', `BettingRound reset()`);

    // Reset all player bets to 0 (redundant safety check)
    this.players.forEach(p => p.bet = 0);
    debugLog('END_ROUND', `All player bets reset to $0`);

    debugLog('END_ROUND', `Advancing to next street...`);
    // Advance to next phase
    this.advanceStreet();
  }

  /**
   * Advance to the next player who can act
   */
  private advanceToNextPlayer(): void {
    const oldIndex = this.currentPlayerIndex;

    let nextIndex = (this.currentPlayerIndex + 1) % this.players.length;
    let attempts = 0;

    debugLog('ADVANCE', `Finding next player from index ${oldIndex}...`);

    while (!this.players[nextIndex].canAct() && attempts < this.players.length) {
      debugLog('ADVANCE', `  Skipping ${nextIndex} (${this.players[nextIndex].id}) - can't act`);
      nextIndex = (nextIndex + 1) % this.players.length;
      attempts++;
    }

    this.currentPlayerIndex = nextIndex;
    debugLog('ADVANCE', `Advanced: ${oldIndex} (${this.players[oldIndex].id}) → ${nextIndex} (${this.players[nextIndex].id})`);
  }

  /**
   * Get AI decision for current player
   * @param playerId Player ID
   * @returns Player action
   */
  getAIAction(playerId: string): PlayerAction {
    const player = this.players.find(p => p.id === playerId);
    if (!player) {
      throw new Error('Player not found');
    }

    const ai = this.aiInstances.get(playerId);
    if (!ai) {
      throw new Error('No AI instance for this player');
    }

    // Calculate position relative to dealer (0 = button, 1 = cutoff, etc.)
    const playerIndex = this.players.findIndex(p => p.id === playerId);
    const numPlayers = this.players.length;
    const posFromDealer = (numPlayers - ((playerIndex - this.dealerIndex + numPlayers) % numPlayers)) % numPlayers;

    const context = {
      street: this.street,
      pot: this.getCurrentPot(),
      currentBet: this.bettingRound.getCurrentBet(),
      playerBet: player.bet,
      playerChips: player.chips,
      minRaise: this.bettingRound.getMinRaise(),
      opponentChips: this.players.find(p => p.id !== playerId)?.chips || 0,
      holeCards: player.cards,
      communityCards: this.communityCards,
      positionFromDealer: posFromDealer,
      activePlayers: this.players.filter(p => !p.folded).length,
      bigBlind: this.config.bigBlind,
    };

    return ai.decide(context);
  }

  /**
   * Process AI action for current player
   * @param playerId Player ID
   * @returns The action taken
   */
  processAIAction(playerId: string): PlayerAction {
    const action = this.getAIAction(playerId);
    this.processAction(playerId, action);
    return action;
  }

  /**
   * Advance to next street (called after betting round ends)
   */
  private advanceStreet(): void {
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
    this.bettingRoundStartPlayer = this.currentPlayerIndex;
    this.playersActedThisRound = new Set();

    debugLog('START_ROUND', `New betting round (${this.street}) - First to act: ${this.currentPlayerIndex} (${this.players[this.currentPlayerIndex].id})`);
  }

  /**
   * Check whether pot award results have at least two pots won by different player sets.
   */
  private static hasDistinctWinners(pots: GamePotResult[]): boolean {
    if (pots.length <= 1) return false;
    const first = pots[0].winnerIds.slice().sort().join(',');
    return pots.some(p => p.winnerIds.slice().sort().join(',') !== first);
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

    // Capture pot amount before awarding (awardPots resets to 0)
    const potAmount = this.pot.getTotalPot();

    // Award main pot and side pots separately based on eligibility
    const potAwards = this.pot.awardPots(this.players, (eligible) => {
      // Among eligible players, find the best hand(s)
      const eligibleHands = handsWithPlayers.filter(h => eligible.includes(h.player));
      if (eligibleHands.length === 0) return [];
      let best = eligibleHands[0];
      for (let i = 1; i < eligibleHands.length; i++) {
        if (compareHands(eligibleHands[i].handStrength, best.handStrength) > 0) {
          best = eligibleHands[i];
        }
      }
      return eligibleHands
        .filter(h => compareHands(h.handStrength, best.handStrength) === 0)
        .map(h => h.player);
    });

    // Build per-pot results with hand names for each pot's winner
    const potResults: GamePotResult[] = potAwards.map(award => {
      // Find the winning hand name for this pot's winners
      const winnerHand = handsWithPlayers.find(h => award.winnerIds.includes(h.player.id));
      return {
        potIndex: award.potIndex,
        potLabel: award.potIndex === 0 ? 'Main Pot' : `Side Pot ${award.potIndex}`,
        amount: award.amount,
        winnerIds: award.winnerIds,
        winningHand: winnerHand?.handName ?? bestHand.handName,
      };
    });

    const result: GameResult = {
      winners: winners.map(w => w.player.id),
      winningHand: bestHand.handName,
      playerHand: handsWithPlayers.find(h => h.player.id === this.players[0].id)?.handName,
      opponentHand: handsWithPlayers.find(h => h.player.id === this.players[1]?.id)?.handName,
      potAmount,
      // Only include per-pot results when different players win different pots.
      // Folded blind contributions can create multiple layers with the same winner —
      // those should be treated as a single pot for display purposes.
      potResults: potResults.length > 1 && PokerGameEngine.hasDistinctWinners(potResults)
        ? potResults : undefined,
    };

    this.emitEvent({ type: 'hand_complete', result });
    this.handInProgress = false;
  }

  /**
   * End hand when all but one player folds
   * @param winner Winner player
   */
  private endHandByFold(winner: Player): void {
    const potAmount = this.getCurrentPot();
    this.pot.collectBets(this.players);
    winner.addChips(this.pot.getTotalPot());
    this.pot.reset();

    const result: GameResult = {
      winners: [winner.id],
      potAmount
    };

    this.emitEvent({ type: 'hand_complete', result });
    this.handInProgress = false;
  }

  /**
   * Force hand to complete when all remaining players are all-in
   * Deals remaining community cards and goes to showdown
   */
  public forceHandComplete(): void {
    debugLog('FORCE_COMPLETE', `⚡ Forcing hand completion - all players all-in or folded`);

    // Collect any outstanding bets
    this.pot.collectBets(this.players);
    this.emitEvent({ type: 'pot_updated', amount: this.pot.getTotalPot() });

    // Deal all remaining community cards
    if (this.street === 'preflop') {
      // Deal flop
      this.street = 'flop';
      this.deck.burn();
      this.communityCards = this.deck.dealMultiple(3);
      debugLog('FORCE_COMPLETE', `  Dealt flop: ${this.communityCards.map(c => c.rank + c.suit).join(', ')}`);
      this.emitEvent({ type: 'street_changed', street: this.street, communityCards: [...this.communityCards] });
    }

    if (this.street === 'flop') {
      // Deal turn
      this.street = 'turn';
      this.deck.burn();
      this.communityCards.push(this.deck.deal());
      debugLog('FORCE_COMPLETE', `  Dealt turn: ${this.communityCards[this.communityCards.length - 1].rank}${this.communityCards[this.communityCards.length - 1].suit}`);
      this.emitEvent({ type: 'street_changed', street: this.street, communityCards: [...this.communityCards] });
    }

    if (this.street === 'turn') {
      // Deal river
      this.street = 'river';
      this.deck.burn();
      this.communityCards.push(this.deck.deal());
      debugLog('FORCE_COMPLETE', `  Dealt river: ${this.communityCards[this.communityCards.length - 1].rank}${this.communityCards[this.communityCards.length - 1].suit}`);
      this.emitEvent({ type: 'street_changed', street: this.street, communityCards: [...this.communityCards] });
    }

    // Now go to showdown
    this.street = 'showdown';
    debugLog('FORCE_COMPLETE', `⚡ All cards dealt, going to showdown`);
    this.doShowdown();
  }

  /**
   * Post blinds based on game mode and player count
   */
  private postBlinds(): void {
    // Get blind amounts from game mode
    const smallBlind = this.gameMode.isTournament()
      ? this.gameMode.getSmallBlind()
      : this.config.smallBlind;
    const bigBlind = this.gameMode.isTournament()
      ? this.gameMode.getBigBlind()
      : this.config.bigBlind;
    const ante = this.gameMode.getAnte();

    if (this.players.length === 2) {
      // Heads-up: Dealer is small blind, other is big blind
      const sbPlayer = this.players[this.dealerIndex];
      const bbPlayer = this.players[(this.dealerIndex + 1) % 2];

      const sbAmount = sbPlayer.placeBet(smallBlind);
      this.emitEvent({ type: 'blind_posted', playerId: sbPlayer.id, amount: sbAmount });

      // Big blind + ante if tournament
      let bbAmount = bbPlayer.placeBet(bigBlind);
      this.emitEvent({ type: 'blind_posted', playerId: bbPlayer.id, amount: bbAmount });

      if (this.gameMode.hasBigBlindAnte()) {
        const anteAmount = bbPlayer.placeBet(ante);
        this.emitEvent({ type: 'blind_posted', playerId: bbPlayer.id, amount: anteAmount, isAnte: true });
        bbAmount += anteAmount;
      }

      this.bettingRound.setInitialBet(bigBlind);
    } else {
      // Multiplayer: Player after dealer is small blind, next is big blind (skip eliminated)
      let sbIndex = (this.dealerIndex + 1) % this.players.length;
      while (!this.players[sbIndex].isActive) {
        sbIndex = (sbIndex + 1) % this.players.length;
      }
      let bbIndex = (sbIndex + 1) % this.players.length;
      while (!this.players[bbIndex].isActive) {
        bbIndex = (bbIndex + 1) % this.players.length;
      }

      const sbPlayer = this.players[sbIndex];
      const bbPlayer = this.players[bbIndex];

      const sbAmount = sbPlayer.placeBet(smallBlind);
      this.emitEvent({ type: 'blind_posted', playerId: sbPlayer.id, amount: sbAmount });

      // Big blind + ante if tournament
      let bbAmount = bbPlayer.placeBet(bigBlind);
      this.emitEvent({ type: 'blind_posted', playerId: bbPlayer.id, amount: bbAmount });

      if (this.gameMode.hasBigBlindAnte()) {
        const anteAmount = bbPlayer.placeBet(ante);
        this.emitEvent({ type: 'blind_posted', playerId: bbPlayer.id, amount: anteAmount, isAnte: true });
        bbAmount += anteAmount;
      }

      this.bettingRound.setInitialBet(bigBlind);
    }
  }

  /**
   * Get first player to act preflop
   * @returns Player index
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
   * @returns Player index
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

  /**
   * Get current game state
   * @returns Current game state
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
      minBetAmount: this.gameMode.isTournament() ? this.gameMode.getBigBlind() : this.config.bigBlind,
      gameType: this.config.gameType,
      currentBlindLevel: this.gameMode.getCurrentLevel()?.level
    };
  }

  /**
   * Get player by ID
   * @param playerId Player ID
   * @returns Player state or undefined
   */
  getPlayer(playerId: string): PlayerState | undefined {
    return this.players.find(p => p.id === playerId)?.getState();
  }

  /**
   * Get all players
   * @returns Array of player states
   */
  getPlayers(): PlayerState[] {
    return this.players.map(p => p.getState());
  }

  /**
   * Get current pot including current bets
   * @returns Total pot amount
   */
  getCurrentPot(): number {
    const currentBets = this.players.reduce((sum, p) => sum + p.bet, 0);
    return this.pot.getTotalPot() + currentBets;
  }

  /**
   * Get main pot amount (excluding side pots)
   */
  getMainPot(): number {
    return this.pot.getMainPot();
  }

  /**
   * Get side pots information (for all-in scenarios)
   * @returns Array of side pots with amounts and eligible players
   */
  getSidePots(): { amount: number; eligiblePlayers: string[] }[] {
    return this.pot.getSidePots();
  }

  /**
   * Check if hand is in progress
   * @returns True if hand is active
   */
  isHandInProgress(): boolean {
    return this.handInProgress;
  }

  /**
   * Get community cards
   * @returns Array of community cards
   */
  getCommunityCards(): Card[] {
    return [...this.communityCards];
  }

  /**
   * Get current street
   * @returns Current street
   */
  getCurrentStreet(): Street {
    return this.street;
  }

  /**
   * Get game mode manager
   * @returns GameModeManager instance
   */
  getGameMode(): GameModeManager {
    return this.gameMode;
  }

  /**
   * Replace a player at the given seat index with a new player (buy-in).
   * Only allowed between hands. The new player gets startingChips.
   */
  replacePlayer(seatIndex: number, newId: string, aiConfig?: AIConfig | Playstyle): void {
    if (this.handInProgress) {
      throw new Error('Cannot replace player during a hand');
    }
    const startingChips = this.gameMode.isTournament()
      ? (this.gameMode.getConfig().blindStructure?.startingChips ?? this.config.startingChips)
      : this.config.startingChips;

    const oldPlayer = this.players[seatIndex];

    // Remove old AI instance if any
    if (oldPlayer) {
      this.aiInstances.delete(oldPlayer.id);
    }

    // Create new player
    const newPlayer = new Player(newId, startingChips);
    this.players[seatIndex] = newPlayer;

    // Create AI instance for new player
    if (newId !== 'player') {
      const config = aiConfig ?? 'passive';
      this.aiInstances.set(newId, new PokerAI(config, newId));
    }
  }

  /**
   * Set the dealer index directly (used for deal-for-button ceremony)
   * The next startNewHand() will advance from this position.
   * Pass the index BEFORE the desired first dealer so that
   * startNewHand()'s +1 rotation lands on the correct seat.
   */
  setDealerIndex(index: number): void {
    this.dealerIndex = index;
  }

  /**
   * Subscribe to game events
   * @param listener Event listener function
   */
  on(listener: (event: GameEvent) => void): void {
    this.eventListeners.push(listener);
  }

  /**
   * Unsubscribe from game events
   * @param listener Event listener function
   */
  off(listener: (event: GameEvent) => void): void {
    const index = this.eventListeners.indexOf(listener);
    if (index > -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  /**
   * Emit game event to all listeners
   * @param event Game event
   */
  private emitEvent(event: GameEvent): void {
    for (const listener of this.eventListeners) {
      listener(event);
    }
  }

  /**
   * Update game configuration
   * @param config Partial game configuration
   */
  updateConfig(config: Partial<GameConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.minRaise !== undefined) {
      this.bettingRound = new BettingRound(config.minRaise);
    }
  }

  /**
   * Get game configuration
   * @returns Current game configuration
   */
  getConfig(): GameConfig {
    return { ...this.config };
  }

  /**
   * Set AI configuration for a specific player
   * @param playerId Player ID
   * @param config AI configuration or difficulty
   */
  setAIConfig(playerId: string, config: AIConfig | Playstyle): void {
    const ai = this.aiInstances.get(playerId);
    if (ai) {
      ai.setConfig(config);
    }
  }
}
