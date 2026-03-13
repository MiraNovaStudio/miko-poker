// (c) 2026 MiraNova Studios
/**
 * GameManager — ports the game-flow orchestration from Cocos GameTable.ts to PixiJS.
 * Engine code is NOT modified; only UI calls change.
 */

import { PokerGameEngine, evaluateHand, getHandName } from '@engine/index.js';
import type { GameEvent, GameResult, Card as EngineCard, PlayerState } from '@engine/index.js';

import { SlotLayout } from '../components/SlotLayout.js';
import { PlayerSlot } from '../components/PlayerSlot.js';
import { CommunityCards } from '../components/CommunityCards.js';
import { DealerButton } from '../components/DealerButton.js';
import { StatusBar } from '../components/StatusBar.js';
import { ActionBar } from '../components/ActionBar.js';
import { AudioManager } from './AudioManager.js';
import { Text, type TextStyleOptions } from 'pixi.js';
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

  // Engine
  private engine: PokerGameEngine | null = null;

  // State
  private playerIdBySeat: string[] = [];
  private seatByPlayerId: Map<string, number> = new Map();
  private eliminatedPlayers: Set<string> = new Set();
  private currentActivePlayer: string | null = null;
  private handCounter = 0;
  private handPhase: HandPhase = 'idle';

  // Hand tracking
  private playerHoleCards: Map<string, EngineCard[]> = new Map();
  private currentCommunityCards: EngineCard[] = [];
  private humanFolded = false;
  private streetJustChanged = false;

  // New Game callback (set externally to show/hide new game button)
  onGameOver: (() => void) | null = null;
  onNewGameReady: (() => void) | null = null;

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

    // Wire action bar callbacks: Check/Call, Bet/Raise, Fold
    this.actionBar.setCallbacks(
      () => this.onCheckOrCall(),
      () => this.onBetOrRaise(),
      () => this.onFold(),
    );
  }

  // ─── Public API ────────────────────────────────────────────

  /** Initialize engine and start the first hand */
  start(): void {
    this.initializeEngine();
    this.actionBar.hide();
    this.startFirstHand();
  }

  /** Restart the game from scratch (New Game button) */
  restart(): void {
    this.eliminatedPlayers.clear();
    this.handCounter = 0;
    this.handPhase = 'idle';
    this.currentActivePlayer = null;
    this.playerHoleCards.clear();
    this.currentCommunityCards = [];
    this.humanFolded = false;

    // Reset all UI slots
    this.slotLayout.getAllSlots().forEach(slot => slot.resetForNewHand());
    this.communityCards.clear();
    this.dealerButton.hide();
    this.actionBar.hide();
    this.statusBar.setStatus('New Game Starting...');
    this.statusBar.setPot('Pot: $0');
    this.statusBar.setHand('');

    this.initializeEngine();
    setTimeout(() => this.startFirstHand(), 500);
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

    this.playerIdBySeat = ['player', 'ai1', 'ai2', 'ai3', 'ai4', 'ai5', 'ai6', 'ai7'];
    this.seatByPlayerId.clear();
    this.playerIdBySeat.forEach((id, i) => this.seatByPlayerId.set(id, i));

    const aiDifficulties = new Map<string, 'easy' | 'normal' | 'hard' | 'pro'>([
      ['ai1', 'normal'], ['ai2', 'normal'], ['ai3', 'normal'], ['ai4', 'normal'],
      ['ai5', 'normal'], ['ai6', 'normal'], ['ai7', 'normal'],
    ]);

    this.engine.initGame(this.playerIdBySeat, aiDifficulties);
    this.engine.on((event: GameEvent) => this.handleGameEvent(event));

    console.log('Engine initialized with 8 players');
  }

  private startFirstHand(): void {
    if (!this.engine) return;
    this.engine.startNewHand();
    setTimeout(() => this.advanceGame(), 500);
  }

  // ─── Game Loop ─────────────────────────────────────────────

  private advanceGame(): void {
    if (this.eliminatedPlayers.has('player')) return;
    if (!this.engine || !this.engine.isHandInProgress()) return;

    // After a street change, wait an extra second so the last action label is visible
    if (this.streetJustChanged) {
      this.streetJustChanged = false;
      setTimeout(() => this.advanceGame(), 1000);
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
      this.engine.forceHandComplete();
      return;
    }

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!currentPlayer) return;

    if (currentPlayer.folded) {
      setTimeout(() => this.advanceGame(), 100);
      return;
    }
    if (currentPlayer.allIn) {
      this.getSlotForPlayer(currentPlayer.id)?.setStatus('ALL-IN', true);
      setTimeout(() => this.advanceGame(), 500);
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
      if (gameState.canBet) validActions.push('bet');
      if (gameState.canRaise) validActions.push('raise');

      this.actionBar.updateLabels(validActions);
      this.actionBar.show();
      this.statusBar.setStatus('Your turn!');
    } else {
      // AI player's turn
      this.statusBar.setStatus(`${currentPlayer.id} is thinking...`);

      const delay = (GAME_CONFIG.aiThinkingDelayMin + Math.random() *
        (GAME_CONFIG.aiThinkingDelayMax - GAME_CONFIG.aiThinkingDelayMin)) * 1000;

      setTimeout(() => {
        try {
          const action = this.engine!.getAIAction(currentPlayer.id);
          this.engine!.processAction(currentPlayer.id, action);
          setTimeout(() => this.advanceGame(), 500);
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
    if (this.winningHandLabel) {
      this.winningHandLabel.parent?.removeChild(this.winningHandLabel);
      this.winningHandLabel.destroy();
      this.winningHandLabel = null;
    }
    if (this.currentActivePlayer) {
      this.unhighlightPlayer(this.currentActivePlayer);
      this.currentActivePlayer = null;
    }

    if (!this.engine) return;
    const gameState = this.engine.getGameState();

    // Update all player slots
    gameState.players.forEach((player, index) => {
      if (this.eliminatedPlayers.has(player.id)) return;

      const slot = this.slotLayout.getSlot(index);
      if (!slot) return;

      slot.resetForNewHand();
      slot.setPlayerName(player.id);
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
    let label: string;
    if (amount === GAME_CONFIG.smallBlind) {
      label = `SB $${amount}`;
    } else if (amount === GAME_CONFIG.bigBlind) {
      label = `BB $${amount}`;
    } else {
      label = `$${amount}`;
    }

    this.getSlotForPlayer(playerId)?.setBet(amount, label);
    this.updatePotLabel();
  }

  private onCardsDealt(playerId: string, cards: EngineCard[]): void {
    if (this.handPhase !== 'dealing') {
      setTimeout(() => this.onCardsDealt(playerId, cards), 50);
      return;
    }

    const slot = this.getSlotForPlayer(playerId);
    if (!slot) {
      setTimeout(() => this.onCardsDealt(playerId, cards), 50);
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
    this.streetJustChanged = true;
    this.updatePotLabel();

    // Delay clearing previous round's bets so the last action label stays visible for 1s
    setTimeout(() => {
      this.slotLayout.getAllSlots().forEach(s => s.clearBet());
    }, 1000);

    // Delay showing community cards to give a brief pause between streets
    setTimeout(() => {
      this.statusBar.setStatus(street.toUpperCase());
      this.currentCommunityCards = cards.slice();
      this.communityCards.display(
        cards.map(c => ({ rank: c.rank, suit: c.suit })),
      );
      this.updateHumanHandLabel();
    }, 1500);
  }

  private onPlayerAction(playerId: string, action: { type: string; amount?: number }): void {
    const actionText = `${playerId} ${action.type}${action.amount ? ` $${action.amount}` : ''}`;
    this.statusBar.setStatus(actionText);

    if (!this.engine) return;
    const gameState = this.engine.getGameState();
    const player = gameState.players.find(p => p.id === playerId);
    const slot = this.getSlotForPlayer(playerId);
    if (!player || !slot) return;

    // Update status if all-in
    if (player.allIn) {
      slot.setStatus('ALL-IN', true);
    }

    // Update bet label and play sound
    if (action.type === 'fold') {
      slot.setBet(0, 'Fold');
      slot.foldCardsTo(this.communityCards.x, this.communityCards.y);
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
  }

  private onHandComplete(result: GameResult): void {
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

    // Display winner status with pot amount
    const winners = result.winners.join(', ');
    let statusMsg = `${winners} wins $${result.potAmount}!`;
    if (result.winningHand) {
      statusMsg += ` — ${result.winningHand}`;
    }
    this.statusBar.setStatus(statusMsg);

    // Show hand names on bet labels at showdown
    if (result.winningHand) {
      this.showShowdownHandNames(result.winners);
    }

    // Highlight winner names temporarily
    this.highlightWinnerNames(result.winners);

    // Animate pot flying to winner's stack (chips update on arrival)
    this.animatePotToWinners(result.winners, preWinChips, postWinChips);

    // Highlight winning cards (raise them up)
    if (result.winningHand) {
      result.winners.forEach(wid => {
        this.highlightWinningBoardCards(wid);
        this.highlightWinningHoleCards(wid);
      });
    }

    // Clear tracking state
    this.currentCommunityCards = [];
    this.playerHoleCards.clear();

    // Schedule next hand
    setTimeout(() => {
      if (this.eliminatedPlayers.has('player')) return;
      if (this.engine && !this.engine.isHandInProgress()) {
        this.engine.startNewHand();
        setTimeout(() => this.advanceGame(), 500);
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
    setTimeout(() => this.advanceGame(), 500);
  }

  private onBetOrRaise(): void {
    if (!this.engine) return;
    const gameState = this.engine.getGameState();
    const actionType = gameState.canBet ? 'bet' : 'raise';
    // Default raise = 2x the current bet; default bet = big blind
    const player = gameState.players[gameState.currentPlayerIndex];
    const currentBet = (player?.bet ?? 0) + gameState.callAmount;
    const defaultAmount = gameState.canBet ? GAME_CONFIG.bigBlind : currentBet * 2;
    const amount = this.actionBar.getBetAmount(defaultAmount);
    this.engine.processAction('player', { type: actionType as 'bet' | 'raise', amount });
    this.actionBar.hide();
    setTimeout(() => this.advanceGame(), 500);
  }

  private onFold(): void {
    if (!this.engine) return;
    this.engine.processAction('player', { type: 'fold' });
    this.actionBar.hide();
    setTimeout(() => this.advanceGame(), 500);
  }

  // ─── UI Helpers ────────────────────────────────────────────

  private getSlotForPlayer(playerId: string): PlayerSlot | null {
    const seat = this.seatByPlayerId.get(playerId);
    if (seat === undefined) return null;
    return this.slotLayout.getSlot(seat);
  }

  private updatePotLabel(): void {
    if (!this.engine) return;
    const gameState = this.engine.getGameState();
    const enginePot = gameState.pot;
    const sidePots = this.engine.getSidePots();

    if (sidePots && sidePots.length > 0) {
      let text = `Main: $${enginePot}`;
      sidePots.forEach((pot: { amount: number }, i: number) => {
        text += ` | Side ${i + 1}: $${pot.amount}`;
      });
      this.statusBar.setPot(text);
    } else {
      this.statusBar.setPot(`Pot: $${enginePot}`);
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
    gameState.players.forEach(player => {
      if (player.chips <= 0 && !this.eliminatedPlayers.has(player.id)) {
        this.eliminatedPlayers.add(player.id);
        const slot = this.getSlotForPlayer(player.id);
        if (slot) {
          slot.setStatus('ELIMINATED', true);
          slot.visible = false;
        }
        if (player.id === 'player') {
          this.statusBar.setStatus('GAME OVER — You ran out of chips!');
          this.actionBar.hide();
          this.handPhase = 'idle';
          this.onGameOver?.();
        }
      }
    });
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
      );
    });
  }

  private showShowdownHandNames(winnerIds: string[]): void {
    if (!this.engine) return;
    const winnerSet = new Set(winnerIds);
    const gameState = this.engine.getGameState();

    gameState.players.forEach((p: PlayerState) => {
      if (!p.cards || p.cards.length === 0 || p.folded) return;
      try {
        const combined = [...(p.cards as EngineCard[]), ...this.currentCommunityCards];
        if (combined.length < 5) return;
        const strength = evaluateHand(combined as EngineCard[]);
        const handName = getHandName(strength);
        const slot = this.getSlotForPlayer(p.id);
        if (!slot) return;
        if (winnerSet.has(p.id)) {
          // Winners: show hand name on bet label position, bold gold
          slot.setBet(0, handName);
        } else {
          // Losers: small italic
          slot.setBetSmallItalic(handName);
        }
      } catch (err) {
        console.warn('Failed to set showdown hand for', p.id, err);
      }
    });

    // Show animated winning hand name above the board
    if (winnerIds.length > 0) {
      const winnerId = winnerIds[0];
      const winner = gameState.players.find(p => p.id === winnerId);
      if (winner?.cards?.length) {
        try {
          const combined = [...(winner.cards as EngineCard[]), ...this.currentCommunityCards];
          if (combined.length >= 5) {
            const strength = evaluateHand(combined as EngineCard[]);
            const handName = getHandName(strength);
            this.showWinningHandAboveBoard(handName);
          }
        } catch (err) {
          console.warn('Failed to evaluate winning hand:', err);
        }
      }
    }
  }

  private winningHandLabel: Text | null = null;

  private showWinningHandAboveBoard(handName: string): void {
    const scene = this.communityCards.parent;
    if (!scene) return;

    // Remove any existing label
    if (this.winningHandLabel) {
      this.winningHandLabel.parent?.removeChild(this.winningHandLabel);
      this.winningHandLabel.destroy();
      this.winningHandLabel = null;
    }

    const label = new Text({
      text: handName,
      style: {
        fontFamily: 'Arial',
        fontSize: 42,
        fontWeight: 'bold',
        fill: 0xffd700,
        stroke: { color: 0x000000, width: 4 },
      } as TextStyleOptions,
    });
    label.anchor.set(0.5);
    label.x = this.communityCards.x;
    label.y = this.communityCards.y - 70;
    label.alpha = 0;
    label.scale.set(0.5);
    scene.addChild(label);
    this.winningHandLabel = label;

    // Animate: scale up + fade in with bounce
    const startTime = performance.now();
    const duration = 600;
    const animate = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1);
      // Elastic ease-out
      const ease = t === 1 ? 1 : 1 - Math.pow(2, -10 * t) * Math.cos((t * 10 - 0.75) * (2 * Math.PI / 3));
      label.alpha = Math.min(t * 2, 1);
      label.scale.set(0.5 + 0.5 * ease);
      if (t < 1) {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);

    // Clean up after 7.5 seconds (before next hand at 8s)
    setTimeout(() => {
      if (this.winningHandLabel === label) {
        label.parent?.removeChild(label);
        label.destroy();
        this.winningHandLabel = null;
      }
    }, 7500);
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
