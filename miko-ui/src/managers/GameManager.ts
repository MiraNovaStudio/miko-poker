// (c) 2026 MiraNova Studios
/**
 * GameManager — ports the game-flow orchestration from Cocos GameTable.ts to PixiJS.
 * Engine code is NOT modified; only UI calls change.
 */

import { PokerGameEngine, evaluateHand, getHandName, Deck } from '@engine/index.js';
import type { GameEvent, GameResult, Card as EngineCard, PlayerState } from '@engine/index.js';

import { SlotLayout } from '../components/SlotLayout.js';
import { PlayerSlot } from '../components/PlayerSlot.js';
import { CommunityCards } from '../components/CommunityCards.js';
import { DealerButton } from '../components/DealerButton.js';
import { StatusBar } from '../components/StatusBar.js';
import { ActionBar } from '../components/ActionBar.js';
import { AudioManager } from './AudioManager.js';
import { SettingsManager, formatChips } from './SettingsManager.js';
import { HandHistory } from '../components/HandHistory.js';
import { Card } from '../components/Card.js';
import { PLAYER_ROSTER, pickNewPlayer, type RosterEntry } from '../data/player-roster.js';
import { Text, Container, type TextStyleOptions } from 'pixi.js';
import { GAME_CONFIG, SEAT_POSITIONS, CHIP_OVERLAY_Y, FONTS } from '../utils/constants.js';

type HandPhase = 'idle' | 'starting' | 'dealing' | 'betting' | 'showdown';

export class GameManager {
  // UI references
  private slotLayout: SlotLayout;
  private communityCards: CommunityCards;
  private dealerButton: DealerButton;
  private statusBar: StatusBar;
  private actionBar: ActionBar;
  private audioManager: AudioManager;
  private handHistory: HandHistory;

  // Engine
  private engine: PokerGameEngine | null = null;

  // State
  private playerIdBySeat: string[] = [];
  private seatByPlayerId: Map<string, number> = new Map();
  private displayNameById: Map<string, string> = new Map();
  private eliminatedPlayers: Set<string> = new Set();
  private usedRosterNames: Set<string> = new Set();
  private totalKnockouts = 0;
  private currentActivePlayer: string | null = null;
  private pendingReplacements: { seatIndex: number; engineId: string; entry: RosterEntry }[] = [];
  /** Replacements waiting 1-3 hands before joining */
  private deferredReplacements: { seatIndex: number; engineId: string; entry: RosterEntry; handsRemaining: number }[] = [];
  private handCounter = 0;
  private handPhase: HandPhase = 'idle';

  // Hand tracking
  private playerHoleCards: Map<string, EngineCard[]> = new Map();
  private currentCommunityCards: EngineCard[] = [];
  private humanFolded = false;
  private streetJustChanged = false;

  // All-in runout sequencing
  private allInRunout = false;
  private streetQueue: { street: string; cards: EngineCard[] }[] = [];
  private pendingHandResult: GameResult | null = null;

  // New Game callback (set externally to show/hide game-over modal)
  onGameOver: ((message?: string) => void) | null = null;

  // Generation counter — incremented on restart to cancel stale timer callbacks
  private generation = 0;

  constructor(
    slotLayout: SlotLayout,
    communityCards: CommunityCards,
    dealerButton: DealerButton,
    statusBar: StatusBar,
    actionBar: ActionBar,
    audioManager: AudioManager,
  ) {
    this.slotLayout = slotLayout;
    this.communityCards = communityCards;
    this.dealerButton = dealerButton;
    this.statusBar = statusBar;
    this.actionBar = actionBar;
    this.audioManager = audioManager;
    this.handHistory = new HandHistory();

    // Wire action bar callbacks: Check/Call, Bet/Raise, Fold
    this.actionBar.setCallbacks(
      () => this.onCheckOrCall(),
      () => this.onBetOrRaise(),
      () => this.onFold(),
    );

    // Refresh UI when settings change (deck type, player name, chip display)
    SettingsManager.instance.onChange(() => {
      this.refreshAllCards();
      // Update player display name live
      this.displayNameById.set('player', SettingsManager.instance.playerName);
      const slot = this.slotLayout.getSlot(0);
      if (slot) slot.setPlayerName(SettingsManager.instance.playerName);
      // Refresh chip labels and pot when chip display mode changes
      this.updateAllChipLabels();
      this.updatePotLabel();
    });
  }

  // ─── Public API ────────────────────────────────────────────

  /** Initialize engine and start the first hand */
  start(): void {
    this.initializeEngine();
    this.actionBar.hide();
    this.handHistory.show();
    this.startFirstHand();
  }

  /** Reposition the hand history HTML overlay on resize */
  onResize(screenWidth: number, screenHeight: number, scale: number): void {
    this.handHistory.updatePosition(screenWidth, screenHeight, scale);
  }

  /** Restart the game from scratch (New Game button) */
  restart(): void {
    // Bump generation so any in-flight setTimeout callbacks become no-ops
    this.generation++;

    this.eliminatedPlayers.clear();
    this.usedRosterNames.clear();
    this.displayNameById.clear();
    this.handHistory.clear();
    this.totalKnockouts = 0;
    this.pendingReplacements = [];
    this.deferredReplacements = [];
    this.handCounter = 0;
    this.handPhase = 'idle';
    this.currentActivePlayer = null;
    this.playerHoleCards.clear();
    this.currentCommunityCards = [];
    this.humanFolded = false;
    this.allInRunout = false;
    this.streetQueue = [];
    this.pendingHandResult = null;

    // Clear all UI
    this.slotLayout.getAllSlots().forEach(slot => {
      slot.resetForNewHand();
      slot.clearBet();
      slot.visible = false;
    });
    this.communityCards.clear();
    this.dealerButton.hide();
    this.actionBar.hide();
    this.statusBar.setStatus('');
    this.statusBar.setPot('');
    this.statusBar.setHand('');

    this.initializeEngine();

    const gen = this.generation;
    setTimeout(() => {
      if (this.generation !== gen) return;
      this.startFirstHand();
    }, 500);
  }

  /** Schedule a callback that auto-cancels if the game restarts */
  private delayed(fn: () => void, ms: number): void {
    const gen = this.generation;
    setTimeout(() => {
      if (this.generation !== gen) return;
      fn();
    }, ms);
  }

  // ─── Engine Init ───────────────────────────────────────────

  private initializeEngine(): void {
    this.engine = new PokerGameEngine({
      gameType: 'cash',
      smallBlind: GAME_CONFIG.smallBlind,
      bigBlind: GAME_CONFIG.bigBlind,
      startingChips: GAME_CONFIG.startingChips,
      maxPlayers: GAME_CONFIG.maxPlayers,
    });

    // Pick 7 roster players for the initial table
    const shuffled = [...PLAYER_ROSTER].sort(() => Math.random() - 0.5);
    const initialRoster = shuffled.slice(0, 7);

    this.playerIdBySeat = ['player'];
    this.displayNameById.set('player', SettingsManager.instance.playerName);
    this.usedRosterNames.clear();

    for (let i = 0; i < 7; i++) {
      const entry = initialRoster[i];
      const engineId = `ai${i + 1}`;
      this.playerIdBySeat.push(engineId);
      this.displayNameById.set(engineId, entry.name);
      this.usedRosterNames.add(entry.name);
    }

    this.seatByPlayerId.clear();
    this.playerIdBySeat.forEach((id, i) => this.seatByPlayerId.set(id, i));

    // Init engine with placeholder AI difficulties (we'll override with custom configs)
    this.engine.initGame(this.playerIdBySeat);

    // Now replace each AI with custom config from roster
    for (let i = 1; i <= 7; i++) {
      const engineId = this.playerIdBySeat[i];
      const name = this.displayNameById.get(engineId)!;
      const entry = PLAYER_ROSTER.find(p => p.name === name)!;
      this.engine.replacePlayer(i, engineId, entry.config);
    }

    this.engine.on((event: GameEvent) => this.handleGameEvent(event));

    console.log('Engine initialized with roster players:', initialRoster.map(r => r.name).join(', '));
  }

  private startFirstHand(): void {
    if (!this.engine) return;
    this.dealForButton();
  }

  // ─── Deal for Button ────────────────────────────────────────

  private static readonly RANK_VALUE: Record<string, number> = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
    '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
  };
  private static readonly SUIT_VALUE: Record<string, number> = {
    clubs: 0, diamonds: 1, hearts: 2, spades: 3,
  };

  /** Deal one card face-up to each player; highest card gets the button. */
  private dealForButton(): void {
    const deck = new Deck();
    const numPlayers = this.playerIdBySeat.length;
    const dealtCards: EngineCard[] = [];

    // Deal one card per seat
    for (let i = 0; i < numPlayers; i++) {
      dealtCards.push(deck.deal());
    }

    // Find the highest card (rank first, then suit: spades > hearts > diamonds > clubs)
    let winnerIdx = 0;
    let bestRank = GameManager.RANK_VALUE[dealtCards[0].rank];
    let bestSuit = GameManager.SUIT_VALUE[dealtCards[0].suit];

    for (let i = 1; i < numPlayers; i++) {
      const rank = GameManager.RANK_VALUE[dealtCards[i].rank];
      const suit = GameManager.SUIT_VALUE[dealtCards[i].suit];
      if (rank > bestRank || (rank === bestRank && suit > bestSuit)) {
        winnerIdx = i;
        bestRank = rank;
        bestSuit = suit;
      }
    }

    // Set dealer index so startNewHand()'s +1 rotation lands on the winner
    const prevIdx = (winnerIdx - 1 + numPlayers) % numPlayers;
    this.engine!.setDealerIndex(prevIdx);

    // Set up all slots with names and chips first
    this.playerIdBySeat.forEach((pid, idx) => {
      const slot = this.slotLayout.getSlot(idx);
      if (!slot) return;
      slot.resetForNewHand();
      slot.setPlayerName(this.getDisplayName(pid));
      slot.setChips(GAME_CONFIG.startingChips);
      slot.visible = true;
    });

    // No animation: show cards instantly, display winner, then start hand
    if (!SettingsManager.instance.cardAnimations) {
      this.statusBar.setStatus('Dealing for the button...');
      this.statusBar.setPot('');
      this.statusBar.setHand('');

      // Show all dealt cards face-up instantly (no animation)
      dealtCards.forEach((card, idx) => {
        const slot = this.slotLayout.getSlot(idx);
        if (!slot) return;
        slot.dealCards([{ rank: card.rank, suit: card.suit }], true, true);
      });

      // Show winner status and BUTTON label
      const winnerName = this.getDisplayName(this.playerIdBySeat[winnerIdx]);
      const winCard = dealtCards[winnerIdx];
      this.statusBar.setStatus(
        `${winnerName} has the high card (${winCard.rank} of ${winCard.suit}) — dealing!`
      );
      const winnerSlot = this.slotLayout.getSlot(winnerIdx);
      if (winnerSlot) winnerSlot.showButtonLabel(3000);

      // After a brief pause, clear and start the real hand
      this.delayed(() => {
        this.slotLayout.getAllSlots().forEach(s => s.resetForNewHand());
        this.engine!.startNewHand();
        this.delayed(() => this.advanceGame(), 500);
      }, 3000);
      return;
    }

    this.statusBar.setStatus('Dealing for the button...');
    this.statusBar.setPot('');
    this.statusBar.setHand('');

    // Stagger dealing: show each card with a small delay
    const dealDelay = 300; // ms between each player's card
    dealtCards.forEach((card, idx) => {
      this.delayed(() => {
        const slot = this.slotLayout.getSlot(idx);
        if (!slot) return;
        slot.dealCards([{ rank: card.rank, suit: card.suit }], true);
        this.audioManager.playFoldSound();
      }, idx * dealDelay);
    });

    // After all cards are dealt, show the winner
    const revealTime = numPlayers * dealDelay + 1500;
    this.delayed(() => {
      const winnerName = this.getDisplayName(this.playerIdBySeat[winnerIdx]);
      const winCard = dealtCards[winnerIdx];
      this.statusBar.setStatus(
        `${winnerName} has the high card (${winCard.rank} of ${winCard.suit}) — dealing!`
      );

      // Show BUTTON animation on the winner's slot
      const winnerSlot = this.slotLayout.getSlot(winnerIdx);
      if (winnerSlot) winnerSlot.showButtonLabel(3000);

      // After the BUTTON label has shown, clear and start the real hand
      this.delayed(() => {
        this.slotLayout.getAllSlots().forEach(s => s.resetForNewHand());
        this.engine!.startNewHand();
        this.delayed(() => this.advanceGame(), 500);
      }, 3000);
    }, revealTime);
  }

  // ─── Game Loop ─────────────────────────────────────────────

  private advanceGame(): void {
    if (this.eliminatedPlayers.has('player')) return;
    if (!this.engine || !this.engine.isHandInProgress()) return;

    // After a street change, wait an extra second so the last action label is visible
    if (this.streetJustChanged) {
      this.streetJustChanged = false;
      this.delayed(() => this.advanceGame(), 1000);
      return;
    }

    if (this.handPhase === 'dealing') {
      this.handPhase = 'betting';
    }

    const gameState = this.engine.getGameState();

    // Check if all remaining players are all-in
    const activePlayers = gameState.players.filter((p: PlayerState) => !p.folded);
    const canActPlayers = activePlayers.filter((p: PlayerState) => !p.allIn);

    if (canActPlayers.length === 0 && activePlayers.length > 1) {
      // Engine normally auto-calls forceHandComplete() inside processAction,
      // but if we reach here, trigger it manually with runout sequencing.
      if (!this.allInRunout) {
        this.revealAllCardsAtShowdown();
        this.allInRunout = true;
        this.streetQueue = [];
        this.pendingHandResult = null;
        this.engine.forceHandComplete();
      }
      return;
    }

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!currentPlayer) return;

    if (currentPlayer.folded) {
      this.delayed(() => this.advanceGame(), 100);
      return;
    }
    if (currentPlayer.allIn) {
      this.getSlotForPlayer(currentPlayer.id)?.showAllIn();
      this.delayed(() => this.advanceGame(), 500);
      return;
    }

    // Highlight current player
    this.highlightPlayer(currentPlayer.id);

    if (currentPlayer.id === 'player') {
      // Human player's turn
      const validActions: string[] = [];
      if (gameState.canFold) validActions.push('fold');
      if (gameState.canCheck) validActions.push('check');
      if (gameState.canCall) validActions.push('call');
      // BB preflop: show "raise" instead of "bet" since blinds are already in
      if (gameState.canBet) {
        const isPreflop = gameState.street === 'preflop';
        validActions.push(isPreflop ? 'raise' : 'bet');
      }
      if (gameState.canRaise) validActions.push('raise');

      this.actionBar.updateLabels(validActions);
      // Show min raise/bet in input placeholder so user knows the default
      const isPreflop = gameState.street === 'preflop';
      const minAmount = gameState.canBet
        ? (isPreflop ? gameState.minRaiseAmount : gameState.minBetAmount)
        : gameState.minRaiseAmount;
      this.actionBar.setMinBet(minAmount);
      this.actionBar.show();
      this.statusBar.setStatus('Your turn!');
    } else {
      // AI player's turn
      this.statusBar.setStatus(`${this.getDisplayName(currentPlayer.id)} is thinking...`);

      const delay = (GAME_CONFIG.aiThinkingDelayMin + Math.random() *
        (GAME_CONFIG.aiThinkingDelayMax - GAME_CONFIG.aiThinkingDelayMin)) * 1000;

      this.delayed(() => {
        try {
          const action = this.engine!.getAIAction(currentPlayer.id);
          this.engine!.processAction(currentPlayer.id, action);
          this.delayed(() => this.advanceGame(), 500);
        } catch (error) {
          console.error('Error processing AI action:', error);
        }
      }, delay);
    }
  }

  // ─── Event Handling ────────────────────────────────────────

  private handleGameEvent(event: GameEvent): void {
    switch (event.type) {
      case 'hand_started':
        this.onHandStarted();
        break;
      case 'blind_posted':
        this.onBlindPosted(event.playerId, event.amount);
        break;
      case 'cards_dealt':
        this.onCardsDealt(event.playerId, event.cards);
        break;
      case 'street_changed':
        this.onStreetChanged(event.street, event.communityCards);
        break;
      case 'player_action':
        this.onPlayerAction(event.playerId, event.action);
        break;
      case 'pot_updated':
        this.updatePotLabel();
        break;
      case 'hand_complete':
        this.onHandComplete(event.result);
        break;
      case 'game_over':
        console.log('Game Over!', event.winnerId);
        break;
    }
  }

  // ─── Hand Lifecycle ────────────────────────────────────────

  private onHandStarted(): void {
    this.handCounter++;
    this.handPhase = 'starting';
    this.currentCommunityCards = [];
    this.playerHoleCards.clear();
    this.humanFolded = false;

    // Reset UI
    this.communityCards.clear();
    this.statusBar.setHand('');
    this.clearWinningHandLabels();
    if (this.currentActivePlayer) {
      this.unhighlightPlayer(this.currentActivePlayer);
      this.currentActivePlayer = null;
    }

    if (!this.engine) return;
    const gameState = this.engine.getGameState();

    // Update all player slots
    gameState.players.forEach((player, index) => {
      if (this.eliminatedPlayers.has(player.id)) {
        const slot = this.slotLayout.getSlot(index);
        if (slot) slot.visible = false;
        return;
      }

      const slot = this.slotLayout.getSlot(index);
      if (!slot) return;

      slot.resetForNewHand();
      slot.setPlayerName(this.getDisplayName(player.id));
      slot.setChips(player.chips);
      slot.visible = true;
    });

    // Position dealer button
    const dealerSeat = SEAT_POSITIONS[gameState.dealerIndex];
    if (dealerSeat) {
      this.dealerButton.positionAt(dealerSeat.x, dealerSeat.y, gameState.dealerIndex);
    }

    this.updatePotLabel();
    this.statusBar.setStatus('New Hand - Dealing Cards...');
    this.handPhase = 'dealing';
  }

  private onBlindPosted(playerId: string, amount: number): void {
    const label = formatChips(amount);

    const slot = this.getSlotForPlayer(playerId);
    if (slot) {
      slot.setBet(amount, label);
      slot.setBetColor(0xffff00); // yellow for blind amounts
    }
    this.updatePotLabel();
  }

  private onCardsDealt(playerId: string, cards: EngineCard[]): void {
    if (this.handPhase !== 'dealing') {
      this.delayed(() => this.onCardsDealt(playerId, cards), 50);
      return;
    }

    const slot = this.getSlotForPlayer(playerId);
    if (!slot) {
      this.delayed(() => this.onCardsDealt(playerId, cards), 50);
      return;
    }

    this.playerHoleCards.set(playerId, cards.slice());

    const isFaceUp = playerId === 'player';
    slot.dealCards(
      cards.map(c => ({ rank: c.rank, suit: c.suit })),
      isFaceUp,
    );

    if (playerId === 'player') {
      this.updateHumanHandLabel();
    }
  }

  private onStreetChanged(street: string, cards: EngineCard[]): void {
    // During all-in runout, queue events for sequential replay
    if (this.allInRunout) {
      this.streetQueue.push({ street, cards: cards.slice() });
      return;
    }

    this.streetJustChanged = true;
    this.updatePotLabel();

    // Delay clearing previous round's bets so the last action label stays visible for 1s
    this.delayed(() => {
      this.slotLayout.getAllSlots().forEach(s => s.clearBet());
    }, 1000);

    // Delay showing community cards to give a brief pause between streets
    this.delayed(() => {
      this.statusBar.setStatus(street.toUpperCase());
      this.currentCommunityCards = cards.slice();
      this.communityCards.display(
        cards.map(c => ({ rank: c.rank, suit: c.suit })),
      );
      this.updateHumanHandLabel();
    }, 1500);
  }

  /** Replay queued street_changed events with delays between each street */
  private processStreetQueue(): void {
    const queue = this.streetQueue;
    if (queue.length === 0) {
      // No new streets (all-in on river) — process hand result immediately
      if (this.pendingHandResult) {
        const result = this.pendingHandResult;
        this.allInRunout = false;
        this.pendingHandResult = null;
        this.onHandComplete(result);
      }
      return;
    }

    const streetDelay = 2000; // 2s between each street reveal

    // Clear bets before the runout starts
    this.slotLayout.getAllSlots().forEach(s => s.clearBet());

    queue.forEach((item, idx) => {
      this.delayed(() => {
        this.statusBar.setStatus(item.street.toUpperCase());
        this.currentCommunityCards = item.cards.slice();
        this.communityCards.display(
          item.cards.map(c => ({ rank: c.rank, suit: c.suit })),
        );
        this.updateHumanHandLabel();

        // After the last street is revealed, process hand completion
        if (idx === queue.length - 1 && this.pendingHandResult) {
          this.delayed(() => {
            const result = this.pendingHandResult!;
            this.allInRunout = false;
            this.pendingHandResult = null;
            this.onHandComplete(result);
          }, streetDelay);
        }
      }, (idx + 1) * streetDelay); // +1 so first street has a pause too
    });
  }

  private onPlayerAction(playerId: string, action: { type: string; amount?: number }): void {
    const displayName = this.getDisplayName(playerId);
    const actionText = `${displayName} ${action.type}${action.amount ? ` ${formatChips(action.amount)}` : ''}`;
    this.statusBar.setStatus(actionText);

    if (!this.engine) return;
    const gameState = this.engine.getGameState();
    const player = gameState.players.find(p => p.id === playerId);
    const slot = this.getSlotForPlayer(playerId);
    if (!player || !slot) return;

    // Update chip overlay if all-in
    if (player.allIn) {
      slot.showAllIn();
    }

    // Update bet label and play sound
    if (action.type === 'fold') {
      slot.setBet(0, 'Fold');
      slot.setBetColor(0x888888);
      if (SettingsManager.instance.cardAnimations) {
        slot.foldCardsTo(this.communityCards.x, this.communityCards.y);
      } else {
        slot.hideCards();
      }
      this.audioManager.playFoldSound();
      if (playerId === 'player') {
        this.humanFolded = true;
        this.statusBar.setHand('');
      }
    } else if (action.type === 'check') {
      slot.setBet(0, 'Check');
      this.audioManager.playCheckSound();
    } else {
      // bet, call, raise, allin
      slot.setBet(player.bet);
      this.audioManager.playBetSound();
    }

    // Update all chip labels
    this.updateAllChipLabels();
    this.updatePotLabel();

    // Detect all-in condition: engine will auto-call forceHandComplete() inside
    // processAction, so street_changed events are about to fire synchronously.
    // Set allInRunout BEFORE those events arrive.
    if (!this.allInRunout && this.engine) {
      const gs = this.engine.getGameState();
      const active = gs.players.filter((p: PlayerState) => !p.folded);
      const canAct = active.filter((p: PlayerState) => !p.allIn);
      if (canAct.length === 0 && active.length > 1) {
        this.revealAllCardsAtShowdown();
        this.allInRunout = true;
        this.streetQueue = [];
        this.pendingHandResult = null;
      }
    }
  }

  private onHandComplete(result: GameResult): void {
    // During all-in runout, defer until board is fully revealed
    if (this.allInRunout && !this.pendingHandResult) {
      this.pendingHandResult = result;
      // Kick off sequential board reveal (called once, after all events are queued)
      this.delayed(() => this.processStreetQueue(), 0);
      return;
    }

    this.handPhase = 'showdown';
    this.actionBar.hide();

    // Clear bets but do NOT update chip labels yet — wait for pot animation
    this.slotLayout.getAllSlots().forEach(s => s.clearBet());

    // Snapshot chip amounts: engine has already updated, so derive pre-win from post-win
    const postWinChips = new Map<string, number>();
    const preWinChips = new Map<string, number>();
    if (this.engine) {
      const gameState = this.engine.getGameState();
      const potPerWinner = Math.floor(result.potAmount / result.winners.length);

      // Capture post-win chips for ALL players
      gameState.players.forEach(p => {
        postWinChips.set(p.id, p.chips);
      });

      // Calculate pre-win chips for winners
      for (const pid of result.winners) {
        const postChips = postWinChips.get(pid) ?? 0;
        preWinChips.set(pid, postChips - potPerWinner);
      }
    }

    // Show pre-win chip amounts for winners, current amounts for others
    this.slotLayout.getAllSlots().forEach((slot, idx) => {
      const pid = this.playerIdBySeat[idx];
      if (!pid) return;
      const pre = preWinChips.get(pid);
      const post = postWinChips.get(pid);
      slot.setChips(pre !== undefined ? pre : (post ?? 0));
    });

    this.checkForEliminatedPlayers();

    // Reveal cards at showdown (not fold wins)
    if (result.winningHand) {
      this.revealAllCardsAtShowdown();
    }

    // Display winner status with pot amount and full hand
    const winners = result.winners.map(id => this.getDisplayName(id)).join(', ');
    let statusMsg = `${winners} wins ${formatChips(result.potAmount)}!`;
    if (result.winningHand && this.engine) {
      const handDesc = this.getWinningHandDescription(result.winners[0]);
      statusMsg += ` — ${result.winningHand}${handDesc ? ` (${handDesc})` : ''}`;
    }
    this.statusBar.setStatus(statusMsg);
    this.handHistory.addEntry(statusMsg);

    // Show hand names on bet labels at showdown
    if (result.winningHand) {
      this.showShowdownHandNames(result.winners);
    }

    // Highlight winner names temporarily
    this.highlightWinnerNames(result.winners);

    // Animate pot flying to winner's stack (chips update on arrival)
    this.animatePotToWinners(result.winners, preWinChips, postWinChips);

    // Highlight winning cards (raise them up) and dim non-winning cards
    if (result.winningHand) {
      result.winners.forEach(wid => {
        this.highlightWinningBoardCards(wid);
        this.highlightWinningHoleCards(wid);
      });
      this.dimNonWinningCards(result.winners);
    }

    // Clear tracking state
    this.currentCommunityCards = [];
    this.playerHoleCards.clear();

    // Schedule next hand
    this.delayed(() => {
      if (this.eliminatedPlayers.has('player')) return;
      // Check win condition before starting next hand
      if (this.totalKnockouts >= PLAYER_ROSTER.length) return;

      if (this.engine && !this.engine.isHandInProgress()) {
        // Tick down deferred replacements; promote those that have waited enough hands
        if (this.deferredReplacements.length > 0) {
          const stillWaiting: typeof this.deferredReplacements = [];
          for (const dr of this.deferredReplacements) {
            dr.handsRemaining--;
            if (dr.handsRemaining <= 0) {
              this.pendingReplacements.push(dr);
            } else {
              stillWaiting.push(dr);
            }
          }
          this.deferredReplacements = stillWaiting;
        }

        // Check if player is last one standing (all AI eliminated, none incoming)
        const activeAI = this.playerIdBySeat.filter(
          id => id !== 'player' && !this.eliminatedPlayers.has(id)
        );
        const noReplacements = this.pendingReplacements.length === 0
          && this.deferredReplacements.length === 0;
        if (activeAI.length === 0 && noReplacements) {
          this.statusBar.setStatus('YOU WIN! All opponents eliminated!');
          this.actionBar.hide();
          this.handPhase = 'idle';
          this.onGameOver?.('You eliminated all opponents!');
          return;
        }

        // Apply pending with slide-in animation, then start hand
        if (this.pendingReplacements.length > 0) {
          this.applyPendingReplacementsAnimated(() => {
            this.engine!.startNewHand();
            this.delayed(() => this.advanceGame(), 500);
          });
        } else {
          this.engine.startNewHand();
          this.delayed(() => this.advanceGame(), 500);
        }
      }
    }, 8000);
  }

  // ─── Player Actions ──────────────────────────────────────

  private onCheckOrCall(): void {
    if (!this.engine) return;
    const gameState = this.engine.getGameState();
    const actionType = gameState.canCheck ? 'check' : 'call';
    this.engine.processAction('player', { type: actionType as 'check' | 'call' });
    this.actionBar.hide();
    this.delayed(() => this.advanceGame(), 500);
  }

  private onBetOrRaise(): void {
    if (!this.engine) return;
    const gameState = this.engine.getGameState();
    const isPreflop = gameState.street === 'preflop';
    // Preflop BB option: canBet is true but currentBet > 0, so use 'raise' not 'bet'
    const actionType = (gameState.canBet && !isPreflop) ? 'bet' : 'raise';
    const defaultAmount = gameState.canBet
      ? (isPreflop ? gameState.minRaiseAmount : gameState.minBetAmount)
      : gameState.minRaiseAmount;
    const amount = this.actionBar.getBetAmount(defaultAmount);
    this.engine.processAction('player', { type: actionType as 'bet' | 'raise', amount });
    this.actionBar.hide();
    this.delayed(() => this.advanceGame(), 500);
  }

  private onFold(): void {
    if (!this.engine) return;
    this.engine.processAction('player', { type: 'fold' });
    this.actionBar.hide();
    this.delayed(() => this.advanceGame(), 500);
  }

  // ─── UI Helpers ────────────────────────────────────────────

  /** Walk all visible Card instances and re-render for new deck type */
  private refreshAllCards(): void {
    const visit = (container: Container) => {
      for (const child of container.children) {
        if (child instanceof Card) {
          child.refresh();
        } else if (child instanceof Container) {
          visit(child);
        }
      }
    };
    // Refresh cards in all player slots
    for (const slot of this.slotLayout.getAllSlots()) {
      visit(slot);
    }
    // Refresh community cards
    visit(this.communityCards);
  }

  private getDisplayName(engineId: string): string {
    return this.displayNameById.get(engineId) ?? engineId;
  }

  private getSlotForPlayer(playerId: string): PlayerSlot | null {
    const seat = this.seatByPlayerId.get(playerId);
    if (seat === undefined) return null;
    return this.slotLayout.getSlot(seat);
  }

  private updatePotLabel(): void {
    if (!this.engine) return;
    const totalPot = this.engine.getCurrentPot();
    const sidePots = this.engine.getSidePots();

    if (sidePots && sidePots.length > 0) {
      let text = `Pot: ${formatChips(totalPot)}`;
      sidePots.forEach((pot: { amount: number }, i: number) => {
        text += `\nSP${i + 1}: ${formatChips(pot.amount)}`;
      });
      this.statusBar.setPot(text);
    } else {
      this.statusBar.setPot(`Pot: ${formatChips(totalPot)}`);
    }
  }

  /** Get the best 5-card hand as a short string like "KKJJT" */
  private getWinningHandDescription(winnerId: string): string {
    if (!this.engine) return '';
    const gameState = this.engine.getGameState();
    const winner = gameState.players.find(p => p.id === winnerId);
    if (!winner?.cards?.length) return '';

    const combined = [...(winner.cards as EngineCard[]), ...this.currentCommunityCards];
    if (combined.length < 5) return '';

    try {
      const strength = evaluateHand(combined as EngineCard[]);
      // Build best 5 cards from kickers based on hand category
      const kickers = strength.kickers;
      const valToRank: Record<number, string> = {
        14: 'A', 13: 'K', 12: 'Q', 11: 'J', 10: 'T',
        9: '9', 8: '8', 7: '7', 6: '6', 5: '5', 4: '4', 3: '3', 2: '2',
      };

      // For most hands, kickers represent the key cards; build full 5-card representation
      switch (strength.category) {
        case 8: // Straight Flush
        case 4: { // Straight
          const high = kickers[0];
          if (high === 5) return '5432A';
          const cards = [];
          for (let i = 0; i < 5; i++) cards.push(valToRank[high - i] ?? '?');
          return cards.join('');
        }
        case 7: // Four of a Kind — [quad, kicker]
          return (valToRank[kickers[0]] ?? '').repeat(4) + (valToRank[kickers[1]] ?? '');
        case 6: // Full House — [trips, pair]
          return (valToRank[kickers[0]] ?? '').repeat(3) + (valToRank[kickers[1]] ?? '').repeat(2);
        case 5: // Flush — [5 kickers]
          return kickers.slice(0, 5).map(k => valToRank[k] ?? '?').join('');
        case 3: // Three of a Kind — [trips, k1, k2]
          return (valToRank[kickers[0]] ?? '').repeat(3) + kickers.slice(1, 3).map(k => valToRank[k] ?? '?').join('');
        case 2: // Two Pair — [pair1, pair2, kicker]
          return (valToRank[kickers[0]] ?? '').repeat(2) + (valToRank[kickers[1]] ?? '').repeat(2) + (valToRank[kickers[2]] ?? '');
        case 1: // One Pair — [pair, k1, k2, k3]
          return (valToRank[kickers[0]] ?? '').repeat(2) + kickers.slice(1, 4).map(k => valToRank[k] ?? '?').join('');
        case 0: // High Card — [5 kickers]
          return kickers.slice(0, 5).map(k => valToRank[k] ?? '?').join('');
        default:
          return '';
      }
    } catch {
      return '';
    }
  }

  private updateAllChipLabels(): void {
    if (!this.engine) return;
    const gameState = this.engine.getGameState();
    gameState.players.forEach(player => {
      this.getSlotForPlayer(player.id)?.setChips(player.chips);
    });
  }

  private updateHumanHandLabel(): void {
    if (this.humanFolded) {
      this.statusBar.setHand('');
      return;
    }
    const hole = this.playerHoleCards.get('player');
    if (!hole || hole.length === 0) {
      this.statusBar.setHand('');
      return;
    }
    try {
      const cardsForEval: EngineCard[] = [...hole, ...this.currentCommunityCards];
      let name = '';
      if (cardsForEval.length >= 5) {
        const strength = evaluateHand(cardsForEval as EngineCard[]);
        name = getHandName(strength);
      } else {
        const [c1, c2] = hole;
        name = (c1 && c2 && c1.rank === c2.rank) ? 'One Pair' : 'High Card';
      }
      this.statusBar.setHand(name);
    } catch (err) {
      console.warn('Failed to evaluate hand:', err);
    }
  }

  private highlightPlayer(playerId: string): void {
    if (this.currentActivePlayer) {
      this.unhighlightPlayer(this.currentActivePlayer);
    }
    this.getSlotForPlayer(playerId)?.highlight(true);
    this.currentActivePlayer = playerId;
  }

  private unhighlightPlayer(playerId: string): void {
    this.getSlotForPlayer(playerId)?.highlight(false);
  }

  private checkForEliminatedPlayers(): void {
    if (!this.engine) return;
    const gameState = this.engine.getGameState();
    const newlyEliminated: { id: string; seatIndex: number }[] = [];

    gameState.players.forEach((player, index) => {
      if (player.chips <= 0 && !this.eliminatedPlayers.has(player.id)) {
        this.eliminatedPlayers.add(player.id);
        newlyEliminated.push({ id: player.id, seatIndex: index });

        const slot = this.getSlotForPlayer(player.id);
        if (slot) {
          slot.showKnockedOutLabel(7000);
        }

        if (player.id === 'player') {
          this.statusBar.setStatus('GAME OVER — You ran out of chips!');
          this.actionBar.hide();
          this.handPhase = 'idle';
          this.onGameOver?.('You ran out of chips!');
          return;
        }

        this.totalKnockouts++;
      }
    });

    // If human is eliminated, stop here
    if (this.eliminatedPlayers.has('player')) return;

    // Check win condition: all 32 roster players knocked out
    if (this.totalKnockouts >= PLAYER_ROSTER.length) {
      this.statusBar.setStatus('YOU WIN! All opponents eliminated!');
      this.actionBar.hide();
      this.handPhase = 'idle';
      this.onGameOver?.('You eliminated all opponents!');
      return;
    }

    // Replace eliminated AI players with new roster players
    for (const { id, seatIndex } of newlyEliminated) {
      if (id === 'player') continue;

      const newEntry = pickNewPlayer(this.usedRosterNames);
      if (!newEntry) {
        // No more roster players — hide the seat
        const slot = this.getSlotForPlayer(id);
        if (slot) slot.visible = false;
        continue;
      }

      this.usedRosterNames.add(newEntry.name);
      const engineId = id; // reuse same engine slot ID (ai1, ai2, etc.)

      // Defer replacement: wait 1-3 hands before new player joins
      const handsRemaining = 2 + Math.floor(Math.random() * 3); // 2, 3, or 4 (1-3 hands played short-handed)
      this.deferredReplacements.push({ seatIndex, engineId, entry: newEntry, handsRemaining });
    }
  }

  /** Apply pending player replacements before the next hand starts */
  private applyPendingReplacements(): void {
    if (!this.engine || this.pendingReplacements.length === 0) return;

    for (const { seatIndex, engineId, entry } of this.pendingReplacements) {
      // Replace in engine
      this.engine.replacePlayer(seatIndex, engineId, entry.config);

      // Update display name mapping
      this.displayNameById.set(engineId, entry.name);

      // Update UI slot
      const slot = this.slotLayout.getSlot(seatIndex);
      if (slot) {
        slot.resetForNewHand();
        slot.setPlayerName(entry.name);
        slot.setChips(GAME_CONFIG.startingChips);
        slot.visible = true;
        slot.clearStatus();
      }

      // Remove from eliminated set so they can play
      this.eliminatedPlayers.delete(engineId);

      this.statusBar.setStatus(`${entry.name} has joined the table!`);
      console.log(`New player joined: ${entry.name} at seat ${seatIndex}`);
    }

    this.pendingReplacements = [];
  }

  /** Apply pending replacements with a slide-in animation, then call onComplete */
  private applyPendingReplacementsAnimated(onComplete: () => void): void {
    if (!this.engine || this.pendingReplacements.length === 0) {
      onComplete();
      return;
    }

    // Upper-left origin for animation (same as community card deal origin)
    const originX = -480;
    const originY = -340;

    const promises: Promise<void>[] = [];

    for (const { seatIndex, engineId, entry } of this.pendingReplacements) {
      // Replace in engine
      this.engine.replacePlayer(seatIndex, engineId, entry.config);

      // Update display name mapping
      this.displayNameById.set(engineId, entry.name);

      // Update UI slot — set up content but keep hidden until animation
      const slot = this.slotLayout.getSlot(seatIndex);
      if (slot) {
        slot.resetForNewHand();
        slot.setPlayerName(entry.name);
        slot.setChips(GAME_CONFIG.startingChips);
        slot.visible = false; // hidden until animation starts
        slot.clearStatus();

        // Animate slide-in from upper-left to seat position
        const seatPos = SEAT_POSITIONS[seatIndex];
        if (seatPos) {
          promises.push(slot.slideInFrom(originX, originY, 600));
        } else {
          slot.visible = true;
        }
      }

      // Remove from eliminated set so they can play
      this.eliminatedPlayers.delete(engineId);

      this.statusBar.setStatus(`${entry.name} has joined the table!`);
    }

    this.pendingReplacements = [];

    // Wait for all slide-in animations, then start the hand
    if (promises.length > 0) {
      Promise.all(promises).then(() => {
        this.delayed(onComplete, 500); // brief pause after animation
      });
    } else {
      onComplete();
    }
  }

  private revealAllCardsAtShowdown(): void {
    if (!this.engine) return;
    const gameState = this.engine.getGameState();
    gameState.players.forEach((player, index) => {
      if (!player.cards || player.cards.length === 0 || player.folded) return;
      const slot = this.slotLayout.getSlot(index);
      if (!slot) return;
      slot.showCards();
      slot.revealCards();
      // Also re-set with actual card data for AI cards that were face-down
      slot.dealCards(
        player.cards.map((c: EngineCard) => ({ rank: c.rank, suit: c.suit })),
        true,
        true, // skipAnim — showdown reveal, not a fresh deal
      );
    });
  }

  private showShowdownHandNames(winnerIds: string[]): void {
    if (!this.engine) return;
    const winnerSet = new Set(winnerIds);
    const gameState = this.engine.getGameState();

    gameState.players.forEach((p: PlayerState) => {
      if (!p.cards || p.cards.length === 0 || p.folded) return;
      if (winnerSet.has(p.id)) return; // winners get the animated label at their position
      try {
        const combined = [...(p.cards as EngineCard[]), ...this.currentCommunityCards];
        if (combined.length < 5) return;
        const strength = evaluateHand(combined as EngineCard[]);
        const handName = getHandName(strength);
        const slot = this.getSlotForPlayer(p.id);
        if (!slot) return;
        slot.setBetSmallItalic(handName);
      } catch (err) {
        console.warn('Failed to set showdown hand for', p.id, err);
      }
    });

    // Show animated winning hand name at winner's bet label position
    winnerIds.forEach(winnerId => {
      const winner = gameState.players.find(p => p.id === winnerId);
      if (!winner?.cards?.length) return;
      try {
        const combined = [...(winner.cards as EngineCard[]), ...this.currentCommunityCards];
        if (combined.length < 5) return;
        const strength = evaluateHand(combined as EngineCard[]);
        const handName = getHandName(strength);
        const slot = this.getSlotForPlayer(winnerId);
        if (slot) this.showWinningHandAtSlot(handName, slot);
      } catch (err) {
        console.warn('Failed to evaluate winning hand:', err);
      }
    });
  }

  private winningHandLabels: Text[] = [];

  private showWinningHandAtSlot(handName: string, slot: PlayerSlot): void {
    const scene = slot.parent;
    if (!scene) return;

    // Position at the slot's bet label location
    const betLabelPos = slot.getBetLabelPosition();

    const label = new Text({
      text: handName,
      style: {
        fontFamily: 'Arial',
        fontSize: 32,
        fontWeight: 'bold',
        fill: 0xffd700,
        stroke: { color: 0x000000, width: 3 },
      } as TextStyleOptions,
    });
    label.anchor.set(0.5);
    // Side seats (ai2=2, ai6=6): position under name label instead of at bet label
    const seatIdx = slot.seatIndex;
    if (seatIdx === 2 || seatIdx === 6) {
      label.x = slot.x;
      label.y = slot.y + 70; // below name label at y=50
    } else if (seatIdx === 3 || seatIdx === 4 || seatIdx === 5) {
      label.x = slot.x + betLabelPos.x;
      label.y = slot.y + betLabelPos.y - 20;
    } else {
      label.x = slot.x + betLabelPos.x;
      label.y = slot.y + betLabelPos.y;
    }
    label.alpha = 0;
    label.scale.set(0.5);
    scene.addChild(label);
    this.winningHandLabels.push(label);

    // Animate: scale up + fade in with elastic bounce
    const startTime = performance.now();
    const duration = 600;
    const animate = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1);
      const ease = t === 1 ? 1 : 1 - Math.pow(2, -10 * t) * Math.cos((t * 10 - 0.75) * (2 * Math.PI / 3));
      label.alpha = Math.min(t * 2, 1);
      label.scale.set(0.5 + 0.5 * ease);
      if (t < 1) {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);

    // Clean up after 7.5 seconds
    setTimeout(() => {
      const idx = this.winningHandLabels.indexOf(label);
      if (idx >= 0) this.winningHandLabels.splice(idx, 1);
      label.parent?.removeChild(label);
      label.destroy();
    }, 7500);
  }

  private clearWinningHandLabels(): void {
    this.winningHandLabels.forEach(label => {
      label.parent?.removeChild(label);
      label.destroy();
    });
    this.winningHandLabels = [];
  }

  private highlightWinnerNames(winnerIds: string[]): void {
    winnerIds.forEach(pid => {
      const slot = this.getSlotForPlayer(pid);
      if (!slot) return;
      slot.showWinnerLabel(8000);
    });
  }

  /** Animate the pot label flying to each winner's chip stack, then pulse and count up */
  private animatePotToWinners(winnerIds: string[], preWinChips: Map<string, number>, postWinChips: Map<string, number>): void {
    const potPos = this.statusBar.getPotLabelScenePosition();
    const potText = this.statusBar.getPotText();
    const scene = this.statusBar.parent;
    if (!scene) return;

    // Hide the pot label until next hand
    this.statusBar.setPot('');

    winnerIds.forEach((pid, idx) => {
      const slot = this.getSlotForPlayer(pid);
      if (!slot) return;

      // Target: center of the chip overlay in scene coords
      const targetX = slot.x;
      const targetY = slot.y + CHIP_OVERLAY_Y;

      // Create a floating pot text clone
      const floatingText = new Text({
        text: potText,
        style: FONTS.potLabel as TextStyleOptions,
      });
      floatingText.anchor.set(0.5);
      floatingText.x = potPos.x;
      floatingText.y = potPos.y;
      scene.addChild(floatingText);

      // Stagger multiple winners slightly
      const delay = idx * 300;

      setTimeout(() => {
        const startX = floatingText.x;
        const startY = floatingText.y;
        const startTime = performance.now();
        const flyDuration = 1400;

        const animate = (now: number) => {
          const t = Math.min((now - startTime) / flyDuration, 1);
          // Ease-in-out cubic
          const ease = t < 0.5
            ? 4 * t * t * t
            : 1 - Math.pow(-2 * t + 2, 3) / 2;

          floatingText.x = startX + (targetX - startX) * ease;
          floatingText.y = startY + (targetY - startY) * ease;
          // Shrink slightly as it arrives
          floatingText.scale.set(1 - 0.3 * ease);
          floatingText.alpha = 1 - 0.2 * ease;

          if (t < 1) {
            requestAnimationFrame(animate);
          } else {
            // Remove the floating text
            scene.removeChild(floatingText);
            floatingText.destroy();

            // Pulse the chip overlay
            slot.pulseChipOverlay();

            // Animate chip count spinning up from pre-win to post-win
            const fromChips = preWinChips.get(pid) ?? 0;
            const toChips = postWinChips.get(pid) ?? fromChips;
            slot.animateChipsTo(fromChips, toChips);
          }
        };
        requestAnimationFrame(animate);
      }, delay);
    });
  }

  // ─── Winning card highlighting ─────────────────────────────

  private highlightWinningBoardCards(winnerId: string): void {
    if (!this.engine) return;
    const gameState = this.engine.getGameState();
    const winner = gameState.players.find(p => p.id === winnerId);
    if (!winner?.cards?.length) return;

    const board = this.currentCommunityCards;
    if (!board.length) return;

    const combined = [...(winner.cards as EngineCard[]), ...board];
    let hand: { category: number; kickers: number[] };
    try {
      hand = evaluateHand(combined as EngineCard[]) as { category: number; kickers: number[] };
    } catch { return; }

    const indices = this.computeBoardIndicesForHand(hand, winner.cards as EngineCard[], board);
    const raiseBy = -25; // Negative Y = upward in PixiJS

    indices.forEach(idx => {
      const card = this.communityCards.children[idx];
      if (card) card.y += raiseBy;
    });
  }

  private highlightWinningHoleCards(winnerId: string): void {
    if (!this.engine) return;
    const gameState = this.engine.getGameState();
    const winnerIndex = gameState.players.findIndex(p => p.id === winnerId);
    if (winnerIndex < 0) return;

    const winner = gameState.players[winnerIndex];
    if (!winner?.cards?.length) return;

    const board = this.currentCommunityCards;
    const hole = winner.cards as EngineCard[];
    const combined = [...hole, ...board];

    let hand: { category: number; kickers: number[] };
    try {
      hand = evaluateHand(combined as EngineCard[]) as { category: number; kickers: number[] };
    } catch { return; }

    const slot = this.slotLayout.getSlot(winnerIndex);
    if (!slot) return;

    const raiseBy = -25;
    hole.forEach((card, idx) => {
      if (!this.isHoleCardUsed(card, hand, combined)) return;
      // Cards are in slot's cardsContainer which is the first child
      const slotCards = slot.children[0]; // cardsContainer is first child
      if (slotCards && slotCards.children[idx]) {
        slotCards.children[idx].y += raiseBy;
      }
    });
  }

  /** Dim all cards not part of the winning hand to 85% opacity */
  private dimNonWinningCards(winnerIds: string[]): void {
    if (!this.engine) return;
    const gameState = this.engine.getGameState();
    const board = this.currentCommunityCards;
    const winnerSet = new Set(winnerIds);
    const DIM_ALPHA = 0.25;

    // Collect board indices used by any winner
    const usedBoardIndices = new Set<number>();
    for (const wid of winnerIds) {
      const winner = gameState.players.find(p => p.id === wid);
      if (!winner?.cards?.length || !board.length) continue;
      const combined = [...(winner.cards as EngineCard[]), ...board];
      try {
        const hand = evaluateHand(combined as EngineCard[]) as { category: number; kickers: number[] };
        const indices = this.computeBoardIndicesForHand(hand, winner.cards as EngineCard[], board);
        indices.forEach(i => usedBoardIndices.add(i));
      } catch { /* skip */ }
    }

    // Dim board cards not used in winning hand
    board.forEach((_, idx) => {
      if (usedBoardIndices.has(idx)) return;
      const card = this.communityCards.children[idx];
      if (card) card.alpha = 1 - DIM_ALPHA;
    });

    // Dim losing players' hole cards and winner's unused hole cards
    gameState.players.forEach((player, seatIdx) => {
      if (!player.cards || player.cards.length === 0 || player.folded) return;
      const slot = this.slotLayout.getSlot(seatIdx);
      if (!slot) return;
      const slotCards = slot.children[0]; // cardsContainer
      if (!slotCards) return;

      if (!winnerSet.has(player.id)) {
        // Losing player — dim all hole cards
        slotCards.children.forEach(c => { c.alpha = 1 - DIM_ALPHA; });
      } else {
        // Winner — dim only unused hole cards
        const hole = player.cards as EngineCard[];
        const combined = [...hole, ...board];
        try {
          const hand = evaluateHand(combined as EngineCard[]) as { category: number; kickers: number[] };
          hole.forEach((card, idx) => {
            if (!this.isHoleCardUsed(card, hand, combined)) {
              if (slotCards.children[idx]) {
                slotCards.children[idx].alpha = 1 - DIM_ALPHA;
              }
            }
          });
        } catch { /* skip */ }
      }
    });
  }

  private isHoleCardUsed(
    card: EngineCard,
    hand: { category: number; kickers: number[] },
    combined: EngineCard[],
  ): boolean {
    const rankToVal: Record<string, number> = {
      'A': 14, 'K': 13, 'Q': 12, 'J': 11, '10': 10,
      '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2,
    };
    const v = rankToVal[card.rank];

    const getFlushSuit = (): string | null => {
      const counts = new Map<string, number>();
      combined.forEach(c => counts.set(c.suit, (counts.get(c.suit) || 0) + 1));
      for (const [s, ct] of counts) { if (ct >= 5) return s; }
      return null;
    };

    const getStraightValues = (high: number): Set<number> => {
      const seq = high === 5 ? [5, 4, 3, 2, 14] : [high, high - 1, high - 2, high - 3, high - 4];
      return new Set(seq);
    };

    switch (hand.category) {
      case 8: { // Straight Flush
        const needed = getStraightValues(hand.kickers[0]);
        return card.suit === getFlushSuit() && needed.has(v);
      }
      case 7: return v === hand.kickers[0] || v === hand.kickers[1]; // Four of a Kind
      case 6: return v === hand.kickers[0] || v === hand.kickers[1]; // Full House
      case 5: return card.suit === getFlushSuit(); // Flush
      case 4: return getStraightValues(hand.kickers[0]).has(v); // Straight
      case 3: return v === hand.kickers[0]; // Trips
      case 2: return v === hand.kickers[0] || v === hand.kickers[1] || v === hand.kickers[2]; // Two Pair
      case 1: return v === hand.kickers[0] || v === hand.kickers[1] || v === hand.kickers[2]; // One Pair
      default: { // High card
        const sorted = [...combined.map(c => rankToVal[c.rank])].sort((a, b) => b - a).slice(0, 5);
        return sorted.includes(v);
      }
    }
  }

  private computeBoardIndicesForHand(
    hand: { category: number; kickers: number[] },
    hole: EngineCard[],
    board: EngineCard[],
  ): number[] {
    const rankToVal: Record<string, number> = {
      'A': 14, 'K': 13, 'Q': 12, 'J': 11, '10': 10,
      '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2,
    };
    const val = (r: string) => rankToVal[r];
    const all = [...hole, ...board];

    const getFlushSuit = (): string | null => {
      const counts = new Map<string, number>();
      all.forEach(c => counts.set(c.suit, (counts.get(c.suit) || 0) + 1));
      for (const [s, ct] of counts) { if (ct >= 5) return s; }
      return null;
    };

    const getStraightValues = (high: number): Set<number> => {
      const seq = high === 5 ? [5, 4, 3, 2, 14] : [high, high - 1, high - 2, high - 3, high - 4];
      return new Set(seq);
    };

    const indices: number[] = [];
    const flushSuit = getFlushSuit();

    switch (hand.category) {
      case 8: {
        const needed = getStraightValues(hand.kickers[0]);
        board.forEach((c, i) => { if (c.suit === flushSuit && needed.has(val(c.rank))) indices.push(i); });
        break;
      }
      case 7: board.forEach((c, i) => { if (val(c.rank) === hand.kickers[0]) indices.push(i); }); break;
      case 6: board.forEach((c, i) => { const v = val(c.rank); if (v === hand.kickers[0] || v === hand.kickers[1]) indices.push(i); }); break;
      case 5: board.forEach((c, i) => { if (c.suit === flushSuit) indices.push(i); }); break;
      case 4: { const needed = getStraightValues(hand.kickers[0]); board.forEach((c, i) => { if (needed.has(val(c.rank))) indices.push(i); }); break; }
      case 3: board.forEach((c, i) => { if (val(c.rank) === hand.kickers[0]) indices.push(i); }); break;
      case 2: board.forEach((c, i) => { const v = val(c.rank); if (v === hand.kickers[0] || v === hand.kickers[1]) indices.push(i); }); break;
      case 1: board.forEach((c, i) => { if (val(c.rank) === hand.kickers[0]) indices.push(i); }); break;
      default: break;
    }

    return [...new Set(indices)];
  }
}
