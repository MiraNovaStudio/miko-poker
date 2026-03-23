// (c) 2026 MiraNova Studios
/**
 * GameManager — ports the game-flow orchestration from Cocos GameTable.ts to PixiJS.
 * Engine code is NOT modified; only UI calls change.
 */

import { PokerGameEngine, evaluateHand, getHandName, getRankName, Deck, DEBUG_ENABLED } from '@engine/index.js';
import type { GameEvent, GameResult, GamePotResult, Card as EngineCard, PlayerState, HandStrength } from '@engine/index.js';

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
import { Text, Graphics, Container, Texture, type Renderer, type TextStyleOptions } from 'pixi.js';
import { GAME_CONFIG, SEAT_POSITIONS, CHIP_OVERLAY_Y, FONTS } from '../utils/constants.js';
import { createAvatar, AVATAR_PRESETS } from '../utils/createAvatar.js';
import { PotChips } from '../components/PotChips.js';

type HandPhase = 'idle' | 'starting' | 'dealing' | 'betting' | 'showdown';

export class GameManager {
  // UI references
  private slotLayout: SlotLayout;
  private communityCards: CommunityCards;
  private dealerButton: DealerButton;
  private statusBar: StatusBar;
  private actionBar: ActionBar;
  private audioManager: AudioManager;
  private renderer: Renderer;
  private handHistory: HandHistory;

  // Avatar texture cache (keyed by player display name)
  private avatarTextureCache: Map<string, Texture> = new Map();

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
  private lastHandWinners: string[] = [];
  private _paused = false;
  private _pausedQueue: { fn: () => void; ms: number }[] = [];
  private _pauseOverlay: HTMLDivElement | null = null;

  // Hand tracking
  private playerHoleCards: Map<string, EngineCard[]> = new Map();
  private currentCommunityCards: EngineCard[] = [];
  private humanFolded = false;
  private humanActedThisStreet = false;
  private streetJustChanged = false;

  // All-in runout sequencing
  private allInRunout = false;
  private _foldWinDeferred = false;
  private _lastKoCount = 0;
  private _newlyEliminatedNames: string[] = [];
  private streetQueue: { street: string; cards: EngineCard[] }[] = [];
  private pendingHandResult: GameResult | null = null;

  // Side pot tracking: snapshot chips at hand start for accurate winnings
  private handStartChips: Map<string, number> = new Map();

  // New Game callback (set externally to show/hide game-over modal)
  onGameOver: ((message?: string) => void) | null = null;

  // Generation counter — incremented on restart to cancel stale timer callbacks
  private generation = 0;

  private potChips: PotChips;

  constructor(
    slotLayout: SlotLayout,
    communityCards: CommunityCards,
    dealerButton: DealerButton,
    statusBar: StatusBar,
    actionBar: ActionBar,
    audioManager: AudioManager,
    renderer: Renderer,
    potChips: PotChips,
  ) {
    this.slotLayout = slotLayout;
    this.communityCards = communityCards;
    this.dealerButton = dealerButton;
    this.statusBar = statusBar;
    this.actionBar = actionBar;
    this.audioManager = audioManager;
    this.renderer = renderer;
    this.potChips = potChips;
    this.handHistory = new HandHistory();

    // Wire action bar callbacks: Check/Call, Bet/Raise, Fold
    this.actionBar.setCallbacks(
      () => this.onCheckOrCall(),
      () => this.onBetOrRaise(),
      () => this.onFold(),
    );

    // Refresh UI when settings change (deck type, player name, chip display, avatar)
    SettingsManager.instance.onChange(() => {
      this.refreshAllCards();
      // Update player display name live
      this.displayNameById.set('player', SettingsManager.instance.playerName);
      const slot = this.slotLayout.getSlot(0);
      if (slot) {
        slot.setPlayerName(SettingsManager.instance.playerName);
      }
      // Refresh all avatars (handles show/hide toggle and preset changes)
      this.playerIdBySeat.forEach((pid, idx) => {
        const s = this.slotLayout.getSlot(idx);
        if (s) this.applyAvatar(s, pid);
      });
      // Refresh chip labels and pot when chip display mode changes
      this.updateAllChipLabels();
      this.updatePotLabel();
    });
  }

  // ─── Avatars ──────────────────────────────────────────────

  /** Get (or generate and cache) an avatar texture for a player name. */
  private getAvatarTexture(name: string, gender: 'male' | 'female' = 'male'): Texture {
    let tex = this.avatarTextureCache.get(name);
    if (!tex) {
      const container = createAvatar(name, gender);
      tex = this.renderer.generateTexture(container);
      container.destroy(true);
      this.avatarTextureCache.set(name, tex);
    }
    return tex;
  }

  /** Apply avatar to a slot for the given player ID. */
  private applyAvatar(slot: PlayerSlot, playerId: string): void {
    if (!SettingsManager.instance.showAvatars) {
      slot.clearAvatar();
      return;
    }
    if (playerId === 'player') {
      // Human player uses the selected avatar preset
      const presetId = SettingsManager.instance.avatarPreset;
      const preset = AVATAR_PRESETS.find(p => p.id === presetId) ?? AVATAR_PRESETS[0];
      const tex = this.getAvatarTexture(preset.seed, preset.gender);
      slot.setAvatar(tex);
      return;
    }
    const name = this.getDisplayName(playerId);
    // Use avatarName override from roster if present
    const rosterEntry = PLAYER_ROSTER.find(p => p.name === name);
    const avatarSeed = rosterEntry?.avatarName ?? name;
    const gender = rosterEntry?.gender ?? 'male';
    const tex = this.getAvatarTexture(avatarSeed, gender);
    slot.setAvatar(tex);
  }

  // ─── Public API ────────────────────────────────────────────

  /** Initialize engine and start the first hand */
  start(): void {
    this.initializeEngine();
    this.actionBar.hide();
    this.handHistory.enable();
    this.startFirstHand();
  }

  /**
   * DEBUG: Rig the game so only one AI opponent remains with minimal chips.
   * Call from browser console: window.debugEndgame()
   * Waits for the current hand to finish, then takes effect next hand.
   */
  /**
   * DEBUG: Set the human player's chip stack.
   * Call from browser console: window.debugSetChips(5000)
   */
  debugSetChips(amount: number): void {
    if (!this.engine) { console.warn('Engine not ready'); return; }
    const enginePlayers = (this.engine as any).players as { id: string; chips: number }[];
    const ep = enginePlayers.find(p => p.id === 'player');
    if (ep) {
      ep.chips = amount;
      this.getSlotForPlayer('player')?.setChips(amount);
      console.log(`💰 Player chips set to ${amount}`);
    }
  }

  /** DEBUG: Deal pocket aces every hand */
  private debugPocketAces = false;

  /**
   * DEBUG: Toggle pocket aces mode — player gets AA every hand.
   * Call from browser console: window.debugAces()
   */
  debugAces(): void {
    this.debugPocketAces = !this.debugPocketAces;
    console.log(`🅰️ Pocket Aces mode: ${this.debugPocketAces ? 'ON' : 'OFF'}`);
  }

  /**
   * After a hand is dealt, swap the player's hole cards for two aces.
   * Pure swap — no duplicates: player's originals go where the aces were.
   */
  private rigPlayerAces(): void {
    if (!this.debugPocketAces || !this.engine) return;

    const enginePlayers = (this.engine as any).players as {
      id: string; cards: EngineCard[]; isActive: boolean;
    }[];
    const deckCards = ((this.engine as any).deck as any).cards as EngineCard[];

    const player = enginePlayers.find(p => p.id === 'player');
    if (!player || player.cards.length < 2) return;

    const needSwap = [
      player.cards[0].rank !== 'A' ? 0 : -1,
      player.cards[1].rank !== 'A' ? 1 : -1,
    ].filter(i => i >= 0);

    if (needSwap.length === 0) return; // already AA

    let found = 0;

    // Search other players' hands, then the deck
    const searchLocations = [
      ...enginePlayers.filter(p => p.id !== 'player' && p.isActive).map(p => p.cards),
      deckCards,
    ];

    for (const cards of searchLocations) {
      for (let i = 0; i < cards.length && found < needSwap.length; i++) {
        if (cards[i].rank === 'A') {
          const ace = cards[i];
          const swapIdx = needSwap[found];
          cards[i] = player.cards[swapIdx]; // player's card goes where ace was
          player.cards[swapIdx] = ace;       // ace goes to player
          found++;
        }
      }
      if (found >= needSwap.length) break;
    }

    // Update the UI card display
    const slot = this.getSlotForPlayer('player');
    if (slot) {
      slot.dealCards(
        player.cards.map(c => ({ rank: c.rank, suit: c.suit })),
        true,
      );
    }
    // Update tracking for hand evaluation
    this.playerHoleCards.set('player', [...player.cards]);
    this.updateHumanHandLabel();

    console.log(`🅰️ Rigged: ${player.cards.map(c => c.rank + c.suit).join(', ')}`);
  }

  /** Flag: side pot debug mode — AI always calls */
  private debugSidePotsPending: number | false = false;
  private debugSidePotsCallOnly = false;

  /**
   * DEBUG: Set up a side pot scenario with 1, 2, or 3 side pots.
   * AI will always call any bet (never fold, never raise).
   * Call from browser console: window.debugSidePots(1), debugSidePots(2), or debugSidePots(3)
   *
   * Scenario 1 (1 side pot, 3 players):
   *   You=500, ai1=800, ai2=200
   *
   * Scenario 2 (2 side pots, 4 players):
   *   You=500, ai1=800, ai2=200, ai3=100
   *
   * Scenario 3 (3 side pots, 5 players):
   *   You=500, ai1=800, ai2=200, ai3=100, ai4=50
   */
  debugSidePots(scenario: number): void {
    if (!this.engine) { console.warn('Engine not ready'); return; }
    if (scenario !== 1 && scenario !== 2 && scenario !== 3) {
      console.error('❌ debugSidePots() requires parameter 1, 2, or 3. Example: debugSidePots(2)');
      return;
    }
    this.debugSidePotsPending = scenario;
    console.log(`🎯 Side pot debug (${scenario} side pot${scenario > 1 ? 's' : ''}) will activate after the current hand finishes.`);
    this.statusBar.setStatus(`DEBUG: Side pot scenario ${scenario} queued — finish this hand`);
  }

  /** Called between hands to set up the side pot scenario */
  private applyDebugSidePots(): void {
    if (this.debugSidePotsPending === false || !this.engine) return;
    const scenario = this.debugSidePotsPending;
    this.debugSidePotsPending = false;
    this.debugSidePotsCallOnly = true;

    // Determine which AI to keep based on scenario
    const keepIds: Set<string> = new Set(['player', 'ai1', 'ai2']);
    if (scenario >= 2) keepIds.add('ai3');
    if (scenario >= 3) keepIds.add('ai4');

    // Eliminate all others (but clear MikoPoker's display name mapping
    // so the victory check won't trigger a false "knocked out MikoPoker" win)
    for (const id of this.playerIdBySeat) {
      if (keepIds.has(id)) continue;
      if (!this.eliminatedPlayers.has(id)) {
        this.eliminatedPlayers.add(id);
      }
      // Remove MikoPoker display name from debug-eliminated players
      // to prevent false victory triggers
      if (this.displayNameById.get(id) === 'MikoPoker') {
        this.displayNameById.set(id, '[debug-removed]');
      }
      const seat = this.seatByPlayerId.get(id);
      if (seat !== undefined) {
        const slot = this.slotLayout.getSlot(seat);
        if (slot) slot.visible = false;
      }
    }

    // Cancel replacements so no new players join
    this.pendingReplacements = [];
    this.deferredReplacements = [];
    this.totalKnockouts = PLAYER_ROSTER.length;

    // Chip stacks per scenario (all have distinct amounts to create side pots)
    const chipConfig: Record<string, number> = {
      player: 500,
      ai1: 800,
      ai2: 200,
    };
    if (scenario >= 2) chipConfig.ai3 = 100;
    if (scenario >= 3) chipConfig.ai4 = 50;

    const enginePlayers = (this.engine as any).players as { id: string; chips: number }[];
    for (const ep of enginePlayers) {
      const chips = chipConfig[ep.id];
      if (chips !== undefined) {
        ep.chips = chips;
        this.getSlotForPlayer(ep.id)?.setChips(chips);
      } else {
        ep.chips = 0;
      }
    }

    const names = Object.entries(chipConfig)
      .map(([id, chips]) => `${id === 'player' ? 'You' : (this.displayNameById.get(id) ?? id)}=$${chips}`)
      .join(', ');
    console.log(`🎯 SIDE POT DEBUG (${scenario}): ${names}. AI will always call.`);
    this.statusBar.setStatus(`DEBUG: ${scenario} side pot${scenario > 1 ? 's' : ''} — AI calls everything`);
  }

  /** Flag: apply endgame rig between hands */
  private debugEndgamePending = false;

  debugEndgame(): void {
    if (!this.engine) { console.warn('Engine not ready'); return; }
    this.debugEndgamePending = true;
    console.log('🎯 Endgame will activate after the current hand finishes. Play it out!');
    this.statusBar.setStatus('DEBUG: Endgame queued — finish this hand');
  }

  /** Flag: apply MikoPoker KO rig between hands */
  private debugMikoKOPending = false;
  private _fastMode = false;

  get fastMode(): boolean { return this._fastMode; }

  setFastMode(on: boolean): void {
    this._fastMode = on;
    console.log(`⚡ Fast mode: ${this._fastMode ? 'ON' : 'OFF'}`);
  }

  debugFastMode(): void {
    this._fastMode = !this._fastMode;
    console.log(`⚡ Fast mode: ${this._fastMode ? 'ON' : 'OFF'}`);
  }

  debugMikoKO(): void {
    if (!this.engine) { console.warn('Engine not ready'); return; }
    this.debugMikoKOPending = true;
    console.log('🎯 MikoPoker endgame will activate after the current hand finishes. Play it out!');
    this.statusBar.setStatus('DEBUG: MikoPoker KO queued — finish this hand');
  }

  debugHideCards(): void {
    this.slotLayout.getAllSlots().forEach(s => s.clearCards());
    this.communityCards.display([]);
    console.log('🃏 Cards hidden');
  }

  /** Reset all debug flags to defaults (called on restart / quit) */
  private resetDebugState(): void {
    this._fastMode = false;
    this.debugPocketAces = false;
    this.debugSidePotsPending = false;
    this.debugSidePotsCallOnly = false;
    this.debugEndgamePending = false;
    this.debugMikoKOPending = false;
    this.debugClearTablePending = false;
    // Unpause if paused
    if (this._paused) this.unpause();
  }

  /** Flag: clear entire table between hands */
  private debugClearTablePending = false;

  /**
   * DEBUG: Eliminate ALL AI opponents — triggers victory after current hand.
   * Call from browser console: window.debugClearTable()
   */
  debugClearTable(): void {
    if (!this.engine) { console.warn('Engine not ready'); return; }
    this.debugClearTablePending = true;
    console.log('🎯 Table clear will activate after the current hand finishes. Play it out!');
    this.statusBar.setStatus('DEBUG: Table clear queued — finish this hand');
  }

  /** Called between hands to eliminate all AI and trigger victory */
  private applyDebugClearTable(): void {
    if (!this.debugClearTablePending || !this.engine) return;
    this.debugClearTablePending = false;

    // Eliminate every AI
    for (const id of this.playerIdBySeat) {
      if (id === 'player') continue;
      if (!this.eliminatedPlayers.has(id)) {
        this.eliminatedPlayers.add(id);
      }
      const seat = this.seatByPlayerId.get(id);
      if (seat !== undefined) {
        const slot = this.slotLayout.getSlot(seat);
        if (slot) slot.visible = false;
      }
    }

    // Cancel all replacements and max out knockouts
    this.pendingReplacements = [];
    this.deferredReplacements = [];
    this.totalKnockouts = PLAYER_ROSTER.length;

    // Zero all AI chips in engine
    const enginePlayers = (this.engine as any).players as { id: string; chips: number }[];
    for (const ep of enginePlayers) {
      if (ep.id === 'player') {
        ep.chips = 10000;
        this.getSlotForPlayer('player')?.setChips(10000);
      } else {
        ep.chips = 0;
      }
    }

    if (DEBUG_ENABLED) console.log('🏆 All opponents eliminated! Victory incoming...');
    this.audioManager.playVictorySound();
    this.statusBar.setStatus('YOU WIN! All opponents eliminated!');
    this.actionBar.hide();
    this.handPhase = 'idle';
    this.onGameOver?.('You eliminated all opponents!');
  }

  /** Called between hands to actually rig the endgame state */
  private applyDebugEndgame(): void {
    if (!this.debugEndgamePending || !this.engine) return;
    this.debugEndgamePending = false;

    // Pick the first non-eliminated AI to keep
    const keepId = this.playerIdBySeat.find(
      id => id !== 'player' && !this.eliminatedPlayers.has(id)
    );
    if (!keepId) { console.warn('No AI players left'); return; }

    // Eliminate all other AI
    for (const id of this.playerIdBySeat) {
      if (id === 'player' || id === keepId) continue;
      if (!this.eliminatedPlayers.has(id)) {
        this.eliminatedPlayers.add(id);
        this.totalKnockouts++;
      }
      const seat = this.seatByPlayerId.get(id);
      if (seat !== undefined) {
        const slot = this.slotLayout.getSlot(seat);
        if (slot) slot.visible = false;
      }
    }

    // Cancel any pending/deferred replacements
    this.pendingReplacements = [];
    this.deferredReplacements = [];

    // Count all 32 roster players as knocked out except the one we kept
    this.totalKnockouts = PLAYER_ROSTER.length - 1;

    // Set chips in engine: eliminated AI → 0, kept AI → 20, player → 10000
    // When engine calls resetForNewHand(), chips=0 players get folded/deactivated automatically
    const enginePlayers = (this.engine as any).players as { id: string; chips: number }[];
    for (const ep of enginePlayers) {
      if (ep.id === 'player') {
        ep.chips = 10000;
        this.getSlotForPlayer('player')?.setChips(10000);
      } else if (ep.id === keepId) {
        ep.chips = 20;
        this.getSlotForPlayer(keepId)?.setChips(20);
      } else {
        ep.chips = 0;
      }
    }

    const keepName = this.displayNameById.get(keepId) ?? keepId;
    console.log(`🎯 ENDGAME RIGGED: Only ${keepName} remains with 20 chips. You have 10,000.`);
    this.statusBar.setStatus(`DEBUG: Final opponent — ${keepName}`);
  }

  /** Called between hands to rig a heads-up vs MikoPoker */
  private applyDebugMikoKO(): void {
    if (!this.debugMikoKOPending || !this.engine) return;
    this.debugMikoKOPending = false;

    // Find MikoPoker in the roster
    const mikoEntry = PLAYER_ROSTER.find(e => e.name === 'MikoPoker');
    if (!mikoEntry) { console.warn('MikoPoker not found in roster'); return; }

    // Pick one AI seat to keep and swap MikoPoker into it
    const keepId = this.playerIdBySeat.find(
      id => id !== 'player' && !this.eliminatedPlayers.has(id)
    );
    if (!keepId) { console.warn('No AI players left'); return; }

    const keepSeat = this.seatByPlayerId.get(keepId);
    if (keepSeat === undefined) return;

    // Eliminate all other AI
    for (const id of this.playerIdBySeat) {
      if (id === 'player' || id === keepId) continue;
      if (!this.eliminatedPlayers.has(id)) {
        this.eliminatedPlayers.add(id);
        this.totalKnockouts++;
      }
      const seat = this.seatByPlayerId.get(id);
      if (seat !== undefined) {
        const slot = this.slotLayout.getSlot(seat);
        if (slot) slot.visible = false;
      }
    }

    // Cancel any pending/deferred replacements
    this.pendingReplacements = [];
    this.deferredReplacements = [];
    this.totalKnockouts = PLAYER_ROSTER.length - 1;

    // Swap MikoPoker into the kept seat
    this.engine.replacePlayer(keepSeat, keepId, mikoEntry.config);
    this.displayNameById.set(keepId, mikoEntry.name);
    this.usedRosterNames.add(mikoEntry.name);

    // Set chips: MikoPoker → 20, player → 10000
    const enginePlayers = (this.engine as any).players as { id: string; chips: number }[];
    for (const ep of enginePlayers) {
      if (ep.id === 'player') {
        ep.chips = 10000;
        this.getSlotForPlayer('player')?.setChips(10000);
      } else if (ep.id === keepId) {
        ep.chips = 20;
        const slot = this.getSlotForPlayer(keepId);
        if (slot) {
          slot.setChips(20);
          slot.setPlayerName(mikoEntry.name);
          slot.setAvatar(this.getAvatarTexture(mikoEntry.avatarName ?? mikoEntry.name, mikoEntry.gender));
        }
      } else {
        ep.chips = 0;
      }
    }

    console.log('🎯 MIKO KO RIGGED: MikoPoker has 20 chips. You have 10,000. Knock them out to win!');
    this.statusBar.setStatus('DEBUG: Final opponent — MikoPoker');
  }

  /** Reposition the hand history HTML overlay on resize */
  onResize(screenWidth: number, sceneCenterY: number, scale: number): void {
    this.handHistory.updatePosition(screenWidth, sceneCenterY, scale);
  }

  /** Restart the game from scratch (New Game button) */
  restart(): void {
    // Bump generation so any in-flight setTimeout callbacks become no-ops
    this.generation++;

    this.eliminatedPlayers.clear();
    this.usedRosterNames.clear();
    this.displayNameById.clear();
    this.originalAIConfigs.clear();
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
    this.humanActedThisStreet = false;
    this.allInRunout = false;
    this._foldWinDeferred = false;
    this.streetQueue = [];
    this.pendingHandResult = null;

    // Reset all debug state
    this.resetDebugState();

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

  /** Rebuy: give the human player $1000 and continue the current game */
  rebuy(): void {
    if (!this.engine) return;

    // Replace player at seat 0 with a fresh 'player' entry (resets chips to startingChips)
    this.engine.replacePlayer(0, 'player');
    this.eliminatedPlayers.delete('player');
    this.humanFolded = false;
    this.handPhase = 'idle';

    // Re-show the player slot with new chips
    const slot = this.slotLayout.getSlot(0);
    if (slot) {
      slot.resetForNewHand();
      slot.setPlayerName(this.getDisplayName('player'));
      slot.setChips(GAME_CONFIG.startingChips);
      slot.visible = true;
    }

    this.statusBar.setStatus('Rebuy! Back in the game.');

    // Start the next hand after a brief pause
    const gen = this.generation;
    setTimeout(() => {
      if (this.generation !== gen) return;
      this.adjustAIForTableSize(); this.engine!.startNewHand();
      this.delayed(() => this.advanceGame(), 500);
    }, 1500);
  }

  /** Check if there are unused roster players available for Keep Playing */
  canKeepPlaying(): boolean {
    const available = pickNewPlayer(this.usedRosterNames);
    return available !== null;
  }

  /** Keep playing after a victory — fill table with new opponents and continue */
  keepPlaying(): void {
    if (!this.engine) return;

    this.handPhase = 'betting';
    this.totalKnockouts = 0;
    this.pendingReplacements = [];
    this.deferredReplacements = [];

    // Queue replacements for all eliminated AI seats
    for (const id of this.playerIdBySeat) {
      if (id === 'player') continue;
      if (!this.eliminatedPlayers.has(id)) continue;

      const seatIndex = this.seatByPlayerId.get(id);
      if (seatIndex === undefined) continue;

      const newEntry = pickNewPlayer(this.usedRosterNames);
      if (!newEntry) continue;

      this.usedRosterNames.add(newEntry.name);
      this.pendingReplacements.push({ seatIndex, engineId: id, entry: newEntry });
    }

    this.statusBar.setStatus('New opponents joining...');

    // Apply replacements with animation, then start the next hand
    this.applyPendingReplacementsAnimated(() => {
      this.adjustAIForTableSize();
      this.engine!.startNewHand();
      this.delayed(() => this.advanceGame(), 500);
    });
  }

  /** Schedule a callback that auto-cancels if the game restarts */
  private delayed(fn: () => void, ms: number): void {
    if (this._paused) {
      this._pausedQueue.push({ fn, ms });
      return;
    }
    const gen = this.generation;
    setTimeout(() => {
      if (this.generation !== gen) return;
      if (this._paused) {
        this._pausedQueue.push({ fn, ms: 0 });
        return;
      }
      fn();
    }, ms);
  }

  /** Toggle pause state. P key handler calls this. */
  togglePause(): void {
    if (this._paused) {
      this.unpause();
    } else {
      this.pause();
    }
  }

  private pause(): void {
    this._paused = true;
    // Create overlay
    if (!this._pauseOverlay) {
      const overlay = document.createElement('div');
      overlay.id = 'pause-overlay';
      overlay.style.cssText = `
        position: fixed; inset: 0; z-index: 8000;
        background: rgba(0, 0, 0, 0.45);
        display: flex; align-items: center; justify-content: center;
        pointer-events: none;
      `;
      const label = document.createElement('div');
      label.style.cssText = `
        color: rgba(255, 255, 255, 0.7);
        font-family: Arial, sans-serif;
        font-size: 48px; font-weight: bold;
        text-shadow: 0 2px 8px rgba(0,0,0,0.5);
        letter-spacing: 8px;
      `;
      label.textContent = 'PAUSED';
      overlay.appendChild(label);
      document.body.appendChild(overlay);
      this._pauseOverlay = overlay;
    }
    console.log('⏸️ Game paused');
  }

  private unpause(): void {
    this._paused = false;
    // Remove overlay
    if (this._pauseOverlay) {
      this._pauseOverlay.remove();
      this._pauseOverlay = null;
    }
    // Flush queued callbacks
    const queue = this._pausedQueue.splice(0);
    for (const { fn, ms } of queue) {
      this.delayed(fn, ms);
    }
    console.log('▶️ Game resumed');
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

    // Set up all slots with names, chips, and avatars
    this.playerIdBySeat.forEach((pid, idx) => {
      const slot = this.slotLayout.getSlot(idx);
      if (!slot) return;
      slot.resetForNewHand();
      slot.setPlayerName(this.getDisplayName(pid));
      this.applyAvatar(slot, pid);
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
      this.handHistory.addEntry(`Button: ${winnerName}`);
      const winnerSlot = this.slotLayout.getSlot(winnerIdx);
      if (winnerSlot) winnerSlot.showButtonLabel(3000);
      const winnerSeat = SEAT_POSITIONS[winnerIdx];
      if (winnerSeat) this.dealerButton.flyTo(winnerSeat.x, winnerSeat.y, winnerIdx);

      // After a brief pause, clear and start the real hand
      this.delayed(() => {
        this.slotLayout.getAllSlots().forEach(s => s.resetForNewHand());
        this.adjustAIForTableSize(); this.engine!.startNewHand();
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
      this.handHistory.addEntry(`Button: ${winnerName}`);

      // Show BUTTON animation on the winner's slot and fly the dealer button
      const winnerSlot = this.slotLayout.getSlot(winnerIdx);
      if (winnerSlot) winnerSlot.showButtonLabel(3000);
      const winnerSeat = SEAT_POSITIONS[winnerIdx];
      if (winnerSeat) this.dealerButton.flyTo(winnerSeat.x, winnerSeat.y, winnerIdx);

      // After the BUTTON label has shown, clear and start the real hand
      this.delayed(() => {
        this.slotLayout.getAllSlots().forEach(s => s.resetForNewHand());
        this.adjustAIForTableSize(); this.engine!.startNewHand();
        this.delayed(() => this.advanceGame(), 500);
      }, 3000);
    }, revealTime);
  }

  private _advanceRetries = 0;

  // ─── Game Loop ─────────────────────────────────────────────

  private advanceGame(): void {
    if (this.eliminatedPlayers.has('player')) return;
    if (!this.engine || !this.engine.isHandInProgress()) return;

    // After a street change, wait an extra second so the last action label is visible
    if (this.streetJustChanged) {
      this.streetJustChanged = false;
      this._advanceRetries = 0;
      this.delayed(() => this.advanceGame(), 1000);
      return;
    }

    if (this.handPhase === 'dealing') {
      this.handPhase = 'betting';
    }

    const gameState = this.engine.getGameState();

    // Check if all remaining players are all-in (no one left to act)
    // — board should auto-run only when nobody can make a decision
    const activePlayers = gameState.players.filter((p: PlayerState) => !p.folded);
    const canActPlayers = activePlayers.filter((p: PlayerState) => !p.allIn);

    // Safety: if only 1 active player remains (all others folded), force hand completion
    if (activePlayers.length <= 1) {
      console.warn('[SAFETY] Only 0-1 active players — forcing hand completion');
      if (activePlayers.length === 1) {
        this.engine.forceHandComplete();
      }
      return;
    }

    // Trigger all-in runout when:
    // 1) Everyone is all-in (canAct === 0), OR
    // 2) Only one player can act, all opponents are all-in, AND that player
    //    has already matched the highest bet (no outstanding call).
    //    If they still owe chips, let them act first (call/fold).
    const highBet = activePlayers.reduce((max: number, p: PlayerState) => Math.max(max, p.bet), 0);
    const soloOwes = canActPlayers.length === 1 && canActPlayers[0].bet < highBet;
    const allOpponentsAllIn = activePlayers.length > 1
      && activePlayers.some((p: PlayerState) => p.allIn)
      && (canActPlayers.length === 0 || (canActPlayers.length === 1 && !soloOwes));
    if (activePlayers.some((p: PlayerState) => p.allIn)) {
      if (DEBUG_ENABLED) console.log(`[ALL-IN CHECK] canAct=${canActPlayers.length}, active=${activePlayers.length}, highBet=${highBet}, soloOwes=${soloOwes}, trigger=${allOpponentsAllIn}`,
        canActPlayers.map(p => `${p.id} bet=${p.bet}`).join(', '));
    }
    if (allOpponentsAllIn) {
      if (!this.allInRunout) {
        // Clear turn indicator — no more decisions to make
        if (this.currentActivePlayer) {
          this.unhighlightPlayer(this.currentActivePlayer);
          this.currentActivePlayer = null;
        }
        // Show ALL IN label on every all-in player's slot
        for (const p of activePlayers) {
          if (p.allIn) this.getSlotForPlayer(p.id)?.showAllIn();
        }
        this.revealAllCardsAtShowdown();
        this.allInRunout = true;
        this.streetQueue = [];
        this.pendingHandResult = null;
        this.actionBar.hide();
        // Snapshot pot label (including side pots) before forceHandComplete resets it
        const gameStateBefore = this.engine.getGameState();
        const potsBefore = this.computeSidePots(gameStateBefore.players);
        const potBeforeAward = this.engine.getCurrentPot();
        this.engine.forceHandComplete();
        // Refresh chip labels — uncalled bets have been returned by collectBets
        this.updateAllChipLabels();
        // Show the frozen pot breakdown (engine pot is 0 after awardPots)
        if (potsBefore.length > 1) {
          let text = `Main: ${formatChips(potsBefore[0].amount)}`;
          for (let i = 1; i < potsBefore.length; i++) {
            text += `\nSide: ${formatChips(potsBefore[i].amount)}`;
          }
          this.statusBar.setPot(text);
        } else {
          this.statusBar.setPot(`Pot: ${formatChips(potBeforeAward)}`);
        }
      }
      return;
    }

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!currentPlayer) {
      console.warn('[SAFETY] currentPlayer is null at index', gameState.currentPlayerIndex);
      return;
    }

    if (currentPlayer.folded || currentPlayer.allIn) {
      this._advanceRetries++;
      // Safety: if we've been stuck on folded/all-in players for too many cycles,
      // the engine's currentPlayerIndex isn't advancing. Force completion.
      if (this._advanceRetries > gameState.players.length * 2) {
        console.warn(`[SAFETY] advanceGame stuck (${this._advanceRetries} retries on ${currentPlayer.id}). Forcing hand completion.`);
        this._advanceRetries = 0;
        this.engine.forceHandComplete();
        return;
      }
      if (currentPlayer.allIn) {
        this.getSlotForPlayer(currentPlayer.id)?.showAllIn();
      }
      this.delayed(() => this.advanceGame(), 100);
      return;
    }
    this._advanceRetries = 0;

    // Highlight current player
    this.highlightPlayer(currentPlayer.id);

    if (currentPlayer.id === 'player') {
      // Sit out mode — auto-check in BB when possible, auto-fold otherwise
      if (this.handHistory.sitOut) {
        this.actionBar.hidePreaction();
        this.humanActedThisStreet = true;
        if (gameState.canCheck) {
          this.engine.processAction('player', { type: 'check' });
        } else {
          this.engine.processAction('player', { type: 'fold' });
          this.humanFolded = true;
          this.statusBar.setHand('');
        }
        this.delayed(() => this.advanceGame(), 500);
        return;
      }

      // Human player's turn — check if preaction should auto-execute
      if (this.actionBar.preactionActive) {
        const preType = this.actionBar.preactionType;
        this.actionBar.hidePreaction();
        this.humanActedThisStreet = true;
        if (preType === 'checkfold') {
          // Check if we can, otherwise fold
          if (gameState.canCheck) {
            this.engine.processAction('player', { type: 'check' });
          } else {
            this.engine.processAction('player', { type: 'fold' });
          }
          this.delayed(() => this.advanceGame(), 500);
          return;
        } else {
          // Pure fold
          this.engine.processAction('player', { type: 'fold' });
          this.delayed(() => this.advanceGame(), 500);
          return;
        }
      }

      this.actionBar.hidePreaction();

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
      let minAmount: number;
      if (gameState.canBet) {
        minAmount = gameState.minBetAmount;
      } else {
        minAmount = gameState.minRaiseAmount;
      }
      this.actionBar.setMinBet(minAmount);
      // Configure slider range: min bet to all-in (player's total available)
      const playerChips = currentPlayer.chips + currentPlayer.bet;
      this.actionBar.setBetLimits(minAmount, playerChips, gameState.pot, gameState.callAmount);
      this.actionBar.show();
      this.statusBar.setStatus('Your turn!');
    } else {
      // AI player's turn — show preaction for human while waiting
      if (!this.humanFolded) {
        const humanPlayer = gameState.players.find((p: PlayerState) => p.id === 'player');
        if (humanPlayer && !humanPlayer.folded) {
          const highBet = gameState.players.reduce((max: number, p: PlayerState) => Math.max(max, p.bet), 0);
          if (!this.humanActedThisStreet) {
            // Human hasn't acted yet — show Check/Fold or Fold
            // Check if human can check: their bet >= the current highest bet
            const canCheck = humanPlayer.bet >= highBet;
            this.actionBar.showPreaction(canCheck);
          } else if (highBet > (humanPlayer.bet || 0)) {
            // Human already acted but someone raised — new decision needed, show Fold
            this.humanActedThisStreet = false;
            this.actionBar.showPreaction(false);
          }
          // Otherwise human acted and no raise occurred — keep button hidden
        }
      }

      this.statusBar.setStatus(`${this.getDisplayName(currentPlayer.id)} is thinking...`);

      const delay = this._fastMode ? 0
        : (GAME_CONFIG.aiThinkingDelayMin + Math.random() *
          (GAME_CONFIG.aiThinkingDelayMax - GAME_CONFIG.aiThinkingDelayMin)) * 1000;

      this.delayed(() => {
        try {
          let action = this.engine!.getAIAction(currentPlayer.id);

          // Side pot debug: force AI to always go all-in
          if (this.debugSidePotsCallOnly) {
            action = { type: 'allin', amount: currentPlayer.chips };
          }

          // Pot odds override: never fold when the call is tiny relative to the pot.
          // e.g., $13 to call into a $5000 pot is an auto-call regardless of hand.
          if (action.type === 'fold') {
            const gs = this.engine!.getGameState();
            const toCall = gs.callAmount;
            if (toCall > 0 && toCall <= currentPlayer.chips) {
              const potOdds = toCall / (gs.pot + toCall);
              // If calling costs less than 15% of pot, always call
              if (potOdds < 0.15) {
                action = toCall >= currentPlayer.chips
                  ? { type: 'allin', amount: currentPlayer.chips }
                  : { type: 'call', amount: toCall };
              }
            }
          }

          // Short-handed override: AI folds too often against raises
          // due to hardcoded engine thresholds. Override folds based on table size.
          if (action.type === 'fold') {
            const activePlayers = this.playerIdBySeat.filter(
              id => !this.eliminatedPlayers.has(id)
            ).length;
            // Heads-up: call 75% of folds, fold only 25%
            // 3-handed: call 50% of folds
            // 4-handed: call 30% of folds
            const callOverride = activePlayers <= 2 ? 0.75
              : activePlayers === 3 ? 0.50
              : activePlayers === 4 ? 0.30
              : 0;
            if (callOverride > 0 && Math.random() < callOverride) {
              const gs = this.engine!.getGameState();
              const toCall = gs.callAmount;
              if (toCall > 0 && toCall < currentPlayer.chips) {
                action = { type: 'call', amount: toCall };
              } else if (toCall >= currentPlayer.chips) {
                action = { type: 'allin', amount: currentPlayer.chips };
              }
            }
          }
          this.engine!.processAction(currentPlayer.id, action);
          this.delayed(() => this.advanceGame(), 500);
        } catch (error) {
          console.error('Error processing AI action:', error);
          // Don't let the game loop die — try to continue
          this.delayed(() => this.advanceGame(), 1000);
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
        this.updateAllChipLabels();
        this.updatePotLabel();
        break;
      case 'side_pot_awarded':
        this.onSidePotAwarded(event.winnerId, event.amount);
        break;
      case 'hand_complete':
        this.onHandComplete(event.result);
        break;
      case 'game_over':
        console.log('Game Over! Winner:', event.winnerId, 'onGameOver set:', !!this.onGameOver);
        if (event.winnerId === 'player') {
          this.audioManager.playVictorySound();
          this.statusBar.setStatus('YOU WIN! All opponents eliminated!');
          this.actionBar.hide();
          this.handPhase = 'idle';
          console.log('🏆 Triggering victory screen...');
          this.onGameOver?.('You eliminated all opponents!');
        }
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
    this.humanActedThisStreet = false;
    this.allInRunout = false;
    this._foldWinDeferred = false;
    this._advanceRetries = 0;
    this._lastKoCount = 0;
    this._newlyEliminatedNames = [];
    this.streetQueue = [];
    this.pendingHandResult = null;
    this.actionBar.hidePreaction();

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

    // Snapshot chips at hand start for accurate per-player winnings later
    this.handStartChips.clear();
    gameState.players.forEach(p => this.handStartChips.set(p.id, p.chips));

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

  /** Handle immediate award of an uncontested side pot */
  private onSidePotAwarded(winnerId: string, amount: number): void {
    const slot = this.getSlotForPlayer(winnerId);
    if (!slot) return;
    const displayName = this.getDisplayName(winnerId);
    this.statusBar.setStatus(`Side pot (${formatChips(amount)}) awarded to ${displayName} — uncontested`);
    // Animate the award
    if (this.engine) {
      const player = this.engine.getGameState().players.find(p => p.id === winnerId);
      if (player) {
        const toChips = player.chips;
        const fromChips = toChips - amount;
        this.animateSinglePotAward(winnerId, amount, fromChips, toChips);
      }
    }
    // Update chip labels and pot display
    this.updateAllChipLabels();
    this.updatePotLabel();
  }

  private onBlindPosted(playerId: string, amount: number): void {
    const label = formatChips(amount);

    const slot = this.getSlotForPlayer(playerId);
    if (slot) {
      slot.setBet(amount, label);
      slot.setBetColor(0xffff00); // yellow for blind amounts
    }

    // If posting the blind put this player all-in, show the label
    if (this.engine) {
      const p = this.engine.getGameState().players.find(pl => pl.id === playerId);
      if (p?.allIn) slot?.showAllIn();
    }

    this.updatePotLabel();
  }

  private onCardsDealt(playerId: string, cards: EngineCard[], retries = 0): void {
    if (this.handPhase !== 'dealing') {
      if (retries < 20) this.delayed(() => this.onCardsDealt(playerId, cards, retries + 1), 50);
      else console.warn(`onCardsDealt: gave up waiting for dealing phase for ${playerId}`);
      return;
    }

    const slot = this.getSlotForPlayer(playerId);
    if (!slot) {
      if (retries < 20) this.delayed(() => this.onCardsDealt(playerId, cards, retries + 1), 50);
      else console.warn(`onCardsDealt: no slot found for ${playerId} after retries`);
      return;
    }

    this.playerHoleCards.set(playerId, cards.slice());

    const isFaceUp = playerId === 'player';
    slot.dealCards(
      cards.map(c => ({ rank: c.rank, suit: c.suit })),
      isFaceUp,
    );

    if (playerId === 'player') {
      this.rigPlayerAces();
      this.updateHumanHandLabel();
    }
  }

  private onStreetChanged(street: string, cards: EngineCard[]): void {
    // During all-in runout, queue events for sequential replay
    if (this.allInRunout) {
      this.streetQueue.push({ street, cards: cards.slice() });
      return;
    }

    // Clear preaction on street change — bet state is different now
    this.actionBar.clearPreaction();
    this.humanActedThisStreet = false;

    this.streetJustChanged = true;
    // Refresh chip labels — uncalled bets may have been returned by collectBets
    this.updateAllChipLabels();
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
      // Move side-seat bet labels when cards actually appear (middle preflop/flop, wide on turn/river)
      this.slotLayout.getAllSlots().forEach(s => s.updateBetLabelForStreet(street));
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
        // Move side-seat bet labels for river
        this.slotLayout.getAllSlots().forEach(s => s.updateBetLabelForStreet(item.street));

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

      // A raise reopens action — clear stale "Check" labels from players
      // who will need to act again (they haven't folded and aren't all-in)
      if (action.type === 'raise' || action.type === 'bet') {
        gameState.players.forEach(p => {
          if (p.id === playerId || p.folded || p.allIn) return;
          const s = this.getSlotForPlayer(p.id);
          if (!s) return;
          // Restore their current bet amount, or clear if no bet
          if (p.bet > 0) {
            s.setBet(p.bet);
          } else {
            s.clearBet();
          }
        });
      }
    }

    // Update all chip labels
    this.updateAllChipLabels();
    this.updatePotLabel();

    // Flash action name in chip overlay AFTER chip labels are updated
    if (action.type === 'call' || action.type === 'raise' || action.type === 'bet') {
      const actionName = action.type === 'call' ? 'Call' : action.type === 'raise' ? 'Raise' : 'Bet';
      slot.flashAction(actionName, player.chips);
    }

    // Detect all-in condition: engine will auto-call forceHandComplete() inside
    // processAction when canAct === 0, so street_changed events fire synchronously.
    // Set allInRunout BEFORE those events arrive so they get queued.
    // IMPORTANT: only trigger when canAct === 0 (not <= 1). The <= 1 case is
    // handled by advanceGame() which explicitly calls forceHandComplete().
    // Setting allInRunout here for canAct === 1 would block advanceGame without
    // anyone ever completing the hand → freeze.
    if (!this.allInRunout && this.engine) {
      const gs = this.engine.getGameState();
      const active = gs.players.filter((p: PlayerState) => !p.folded);
      const canAct = active.filter((p: PlayerState) => !p.allIn);
      if (canAct.length === 0 && active.length > 1) {
        for (const p of active) {
          if (p.allIn) this.getSlotForPlayer(p.id)?.showAllIn();
        }
        this.revealAllCardsAtShowdown();
        this.allInRunout = true;
        this.streetQueue = [];
        this.pendingHandResult = null;

        // Freeze the pot label with side pot breakdown (same as advanceGame path).
        // Engine will call forceHandComplete() after this handler returns, which
        // zeroes the pot — so snapshot now before that happens.
        const potsBefore = this.computeSidePots(gs.players);
        const potBeforeAward = this.engine.getCurrentPot();
        if (potsBefore.length > 1) {
          let text = `Main: ${formatChips(potsBefore[0].amount)}`;
          for (let i = 1; i < potsBefore.length; i++) {
            text += `\nSide: ${formatChips(potsBefore[i].amount)}`;
          }
          this.statusBar.setPot(text);
        } else {
          this.statusBar.setPot(`Pot: ${formatChips(potBeforeAward)}`);
        }
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

    // For fold wins (no winningHand), defer so the last action label (e.g. "Fold")
    // stays visible before we clear bets and show the winner. The engine fires
    // hand_complete synchronously after player_action, so without this delay the
    // fold label would be cleared in the same frame it was set.
    const isFoldWin = !result.winningHand;
    if (isFoldWin && !this._foldWinDeferred) {
      this._foldWinDeferred = true;
      this.delayed(() => {
        // Don't reset _foldWinDeferred here — leave it true so the
        // recursive onHandComplete call falls through to process the result.
        // It gets reset in onHandStarted for the next hand.
        this.onHandComplete(result);
      }, 1200);
      return;
    }
    this._foldWinDeferred = false;

    this.handPhase = 'showdown';
    this.actionBar.hide();

    // Clear active player highlight — action is over
    if (this.currentActivePlayer) {
      this.unhighlightPlayer(this.currentActivePlayer);
    }

    // Clear bets but do NOT update chip labels yet — wait for pot animation
    this.slotLayout.getAllSlots().forEach(s => s.clearBet());

    // Compute actual per-player winnings using chip deltas from hand start.
    // Engine's awardPots() has already distributed chips correctly per pot layer.
    const postWinChips = new Map<string, number>();
    const preWinChips = new Map<string, number>();
    const perPlayerWinnings = new Map<string, number>();
    if (this.engine) {
      const gameState = this.engine.getGameState();

      // Capture post-win chips for ALL players
      gameState.players.forEach(p => {
        postWinChips.set(p.id, p.chips);
      });

      // Compute pre-win and winnings from hand start snapshot
      for (const p of gameState.players) {
        const startChips = this.handStartChips.get(p.id) ?? p.chips;
        const endChips = p.chips;
        // preWin = what they had after committing bets but before receiving winnings
        // = startChips - totalBet
        const preWin = startChips - p.totalBet;
        preWinChips.set(p.id, preWin);

        // Winnings = endChips - preWin (can be 0 for losers, positive for winners)
        const winnings = endChips - preWin;
        if (winnings > 0) {
          perPlayerWinnings.set(p.id, winnings);
        }
      }
    }

    // Show pre-win chip amounts for players who won something, current for others
    this.slotLayout.getAllSlots().forEach((slot, idx) => {
      const pid = this.playerIdBySeat[idx];
      if (!pid) return;
      const winnings = perPlayerWinnings.get(pid);
      if (winnings && winnings > 0) {
        slot.setChips(preWinChips.get(pid) ?? (postWinChips.get(pid) ?? 0));
      } else {
        slot.setChips(postWinChips.get(pid) ?? 0);
      }
    });

    // Track who won this hand for MikoPoker KO victory check
    this.lastHandWinners = result.winners ?? [];

    // Reveal cards at showdown (not fold wins) — do this BEFORE elimination
    // detection so knockout animations aren't interrupted by card reveals.
    if (result.winningHand) {
      this.revealAllCardsAtShowdown();
    }

    // Clear ALL-IN state on winners before shipping the pot
    const allWinnerIds = result.potResults
      ? result.potResults.flatMap(pr => pr.winnerIds)
      : result.winners;
    for (const wid of new Set(allWinnerIds)) {
      this.getSlotForPlayer(wid)?.clearAllIn();
    }

    // Show hand names on bet labels at showdown
    if (result.winningHand) {
      this.showShowdownHandNames(result.winners);
    }

    const handNum = String(this.handCounter).padStart(3, '0');
    let extraDelay = 0;

    if (DEBUG_ENABLED) console.log('[POT AWARD] potResults:', JSON.stringify(result.potResults), 'length:', result.potResults?.length);
    if (DEBUG_ENABLED) console.log('[POT AWARD] potLabel on screen:', JSON.stringify(this.statusBar.getPotText()));

    if (result.potResults && result.potResults.length > 1) {
      // ── SEQUENTIAL POT AWARDS ──
      // Award side pots first (reverse order), then main pot.
      // Labels stay in place; each awarded line is removed only after its
      // fly animation completes, so remaining labels stay visible.
      const orderedPots = [...result.potResults].reverse();
      const POT_DELAY = 2500;
      extraDelay = (orderedPots.length - 1) * POT_DELAY;

      // Track running chip totals for incremental display
      const runningChips = new Map<string, number>();
      preWinChips.forEach((chips, id) => runningChips.set(id, chips));

      // Keep a mutable copy of the pot label lines (Main first, then Sides).
      // orderedPots is reversed (last side → main), and each awarded pot
      // corresponds to the LAST line currently showing.
      let currentPotLines = this.statusBar.getPotText().split('\n');

      // Award each pot sequentially
      orderedPots.forEach((potResult, idx) => {
        this.delayed(() => {
          // Update status bar message
          const names = potResult.winnerIds.map(id => this.getDisplayName(id)).join(', ');
          const potName = potResult.potIndex === 0 ? 'Main' : 'Side';
          this.statusBar.setStatus(
            `${potName}: ${formatChips(potResult.amount)} → ${names} wins — ${potResult.winningHand}`
          );

          // Log each pot award individually to hand history
          this.handHistory.addEntry(
            `Hand ${handNum}: ${potName} Pot: ${names} wins ${formatChips(potResult.amount)} — ${potResult.winningHand}`
          );

          // Show WINNER! on this pot's winners with pot type subtitle
          this.audioManager.playWinSound();
          const potSubtitle = potResult.potIndex === 0 ? 'Main Pot' : 'Side Pot';
          this.highlightWinnerNames(potResult.winnerIds, potSubtitle);

          // Calculate per-winner share for this pot
          const perWinner = Math.floor(potResult.amount / potResult.winnerIds.length);
          const remainder = potResult.amount % potResult.winnerIds.length;

          // Animate chips flying to each winner of this pot
          potResult.winnerIds.forEach((pid, widx) => {
            const winAmount = perWinner + (widx < remainder ? 1 : 0);
            const fromChips = runningChips.get(pid) ?? 0;
            const toChips = fromChips + winAmount;
            runningChips.set(pid, toChips);

            this.animateSinglePotAward(pid, winAmount, fromChips, toChips);
          });

          // Remove the awarded line from the pot label AFTER the fly animation
          // lands (1400ms), so the remaining labels stay visible during flight.
          this.delayed(() => {
            currentPotLines = currentPotLines.slice(0, -1);
            this.statusBar.setPot(currentPotLines.join('\n'));
          }, 1400);

          // On last pot, highlight winning cards
          if (idx === orderedPots.length - 1) {
            this.delayed(() => {
              if (result.winningHand) {
                result.winners.forEach(wid => {
                  this.highlightWinningBoardCards(wid);
                  this.highlightWinningHoleCards(wid);
                });
                this.dimNonWinningCards(result.winners);
              }
            }, 1500);
          }
        }, idx * POT_DELAY);
      });
    } else {
      // ── SINGLE POT — existing display logic ──
      // Only show awards for actual hand winners (not uncalled-bet returns)
      const winnerSet = new Set(result.winners);
      const actualWinnerIds = result.winners.filter(pid => {
        const w = perPlayerWinnings.get(pid);
        return w !== undefined && w > 0;
      });
      // Use result.winners if perPlayerWinnings has no matching entries
      const displayWinners = actualWinnerIds.length > 0 ? actualWinnerIds : result.winners;
      const winnerParts: string[] = [];
      for (const pid of displayWinners) {
        const amt = perPlayerWinnings.get(pid) ?? result.potAmount;
        winnerParts.push(`${this.getDisplayName(pid)} wins ${formatChips(amt)}`);
      }
      let statusMsg = winnerParts.join(', ');
      if (result.winningHand && this.engine) {
        const handDesc = this.getWinningHandDescription(result.winners[0]);
        statusMsg += ` — ${result.winningHand}${handDesc ? ` (${handDesc})` : ''}`;
      }
      this.statusBar.setStatus(statusMsg);
      this.handHistory.addEntry(`Hand ${handNum}: ${statusMsg}`);

      // Highlight winner names
      this.highlightWinnerNames(result.winners);

      // Animate pot flying only to actual winners
      this.audioManager.playWinSound();
      this.animatePotToWinners(displayWinners, preWinChips, postWinChips, perPlayerWinnings);

      // Highlight winning cards (raise them up) and dim non-winning cards
      if (result.winningHand) {
        result.winners.forEach(wid => {
          this.highlightWinningBoardCards(wid);
          this.highlightWinningHoleCards(wid);
        });
        this.dimNonWinningCards(result.winners);
      }
    }

    // Clear tracking state
    this.currentCommunityCards = [];
    this.playerHoleCards.clear();

    // After pot award fly animations land (~1400ms + sequential pot delays),
    // detect eliminations and play knockout animations.
    const knockoutDelay = extraDelay + 1800;
    this.delayed(() => {
      this.checkForEliminatedPlayers(true);

      // Schedule game-over and next hand AFTER we know how many KOs there are.
      // Each KO animation takes ~2800ms; wait for all to finish before proceeding.
      const koTime = this._lastKoCount * 2800;

      // Trigger deferred game-over after all KO animations complete
      this.delayed(() => this.triggerDeferredGameOver(), koTime + 1500);

      // Schedule next hand after KO animations + viewing time
      this.delayed(() => {
        this.scheduleNextHand();
      }, koTime + 4000);
    }, knockoutDelay);
  }

  /** Start the next hand (extracted for reuse after knockout animations) */
  private scheduleNextHand(): void {
    this.delayed(() => {
      if (this.eliminatedPlayers.has('player')) return;
      // Check win condition before starting next hand
      if (this.totalKnockouts >= PLAYER_ROSTER.length) return;

      if (this.engine && !this.engine.isHandInProgress()) {
        // Apply debug rigs if queued
        this.applyDebugSidePots();
        this.applyDebugEndgame();
        this.applyDebugMikoKO();
        this.applyDebugClearTable();
        if (this.handPhase === 'idle') return;  // victory was triggered

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
          // Check if the player knocked out MikoPoker THIS hand (not an AI in a previous hand)
          const lastWasMiko = this.lastHandWinners.includes('player')
            && this._newlyEliminatedNames.includes('MikoPoker');
          const winMsg = lastWasMiko ? 'You knocked out MikoPoker!' : 'You eliminated all opponents!';
          this.statusBar.setStatus(`YOU WIN! ${winMsg}`);
          this.actionBar.hide();
          this.handPhase = 'idle';
          this.onGameOver?.(winMsg);
          return;
        }

        // Apply pending with slide-in animation, then start hand
        if (this.pendingReplacements.length > 0) {
          this.applyPendingReplacementsAnimated(() => {
            this.adjustAIForTableSize(); this.engine!.startNewHand();
            this.delayed(() => this.advanceGame(), 500);
          });
        } else {
          this.adjustAIForTableSize(); this.engine.startNewHand();
          this.delayed(() => this.advanceGame(), 500);
        }
      }
    }, 0);
  }

  // ─── Player Actions ──────────────────────────────────────

  private onCheckOrCall(): void {
    if (!this.engine) return;
    const gameState = this.engine.getGameState();
    const actionType = gameState.canCheck ? 'check' : 'call';
    this.engine.processAction('player', { type: actionType as 'check' | 'call' });
    this.humanActedThisStreet = true;
    this.actionBar.hide();
    this.delayed(() => this.advanceGame(), 500);
  }

  private onBetOrRaise(): void {
    if (!this.engine) return;
    const gameState = this.engine.getGameState();
    const isPreflop = gameState.street === 'preflop';
    // Preflop BB option: canBet is true but currentBet > 0, so use 'raise' not 'bet'
    const actionType = (gameState.canBet && !isPreflop) ? 'bet' : 'raise';
    const defaultAmount = gameState.canBet ? gameState.minBetAmount : gameState.minRaiseAmount;
    const amount = this.actionBar.getBetAmount(defaultAmount);
    this.engine.processAction('player', { type: actionType as 'bet' | 'raise', amount });
    this.humanActedThisStreet = true;
    this.actionBar.hide();
    this.delayed(() => this.advanceGame(), 500);
  }

  private onFold(): void {
    if (!this.engine) return;
    this.engine.processAction('player', { type: 'fold' });
    this.humanActedThisStreet = true;
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

  /**
   * Compute side pot display from all-in player contribution levels.
   * Pot splits only occur at all-in player totalBet levels — mid-street
   * betting differences among active players don't create extra pots.
   *
   * With 1 all-in player: Main pot (all-in level × contributors) + Side pot (rest)
   * With N all-in players at different levels: Main + SP1 + SP2 ...
   */
  private computeSidePots(players: PlayerState[]): { amount: number; eligible: string[] }[] {
    const allInPlayers = players.filter(p => p.allIn);
    if (allInPlayers.length === 0) return [];

    const contributors = players
      .filter(p => p.totalBet > 0)
      .sort((a, b) => a.totalBet - b.totalBet);

    if (contributors.length === 0) return [];

    // Only split at all-in player contribution levels (deduplicated, sorted)
    const allInLevels = Array.from(new Set(allInPlayers.map(p => p.totalBet))).sort((a, b) => a - b);

    const pots: { amount: number; eligible: string[] }[] = [];
    let previousLevel = 0;

    for (const level of allInLevels) {
      const increment = level - previousLevel;
      if (increment <= 0) continue;

      const numContributors = contributors.filter(p => p.totalBet >= level).length;
      if (numContributors <= 1) continue;

      const potAmount = increment * numContributors;
      const eligible = contributors
        .filter(p => p.totalBet >= level && !p.folded)
        .map(p => p.id);

      pots.push({ amount: potAmount, eligible });
      previousLevel = level;
    }

    // Side pot: everything above the highest all-in level.
    // Exists whenever any player has bet above the all-in amount — even if only
    // 1 player remains (they win the side pot by default).
    const highestAllIn = allInLevels[allInLevels.length - 1];
    const sideContributors = contributors.filter(p => p.totalBet > highestAllIn && !p.allIn);
    if (sideContributors.length >= 1) {
      const sideAmount = sideContributors.reduce((sum, p) => sum + (p.totalBet - highestAllIn), 0);
      if (sideAmount > 0) {
        pots.push({ amount: sideAmount, eligible: sideContributors.filter(p => !p.folded).map(p => p.id) });
      }
    }

    return pots;
  }

  private updatePotLabel(): void {
    if (!this.engine) return;
    // During all-in runout, the engine pot is already awarded — don't overwrite the frozen label
    if (this.allInRunout) return;
    const totalPot = this.engine.getCurrentPot();
    const gameState = this.engine.getGameState();

    // Compute side pots (only when someone is all-in)
    const pots = this.computeSidePots(gameState.players);

    // Check if anyone is all-in to determine main/side pot display.
    // A side pot only exists when a non-all-in player has bet MORE than the
    // lowest all-in level (i.e., there are chips the all-in player can't win).
    const allInPlayers = gameState.players.filter((p: PlayerState) => p.allIn);
    const hasSidePot = allInPlayers.length > 0 && (() => {
      const lowestAllIn = Math.min(...allInPlayers.map((p: PlayerState) => p.totalBet));
      const lowestAllInBet = Math.min(...allInPlayers.map((p: PlayerState) => p.bet));
      // Side pot exists if:
      // 1) Multiple all-in levels
      const allInLevels = new Set(allInPlayers.map((p: PlayerState) => p.totalBet));
      if (allInLevels.size > 1) return true;
      // 2) Any non-all-in, non-folded player has bet above the all-in level (across all streets)
      if (gameState.players.some((p: PlayerState) =>
        !p.allIn && !p.folded && p.totalBet > lowestAllIn
      )) return true;
      // 3) Any non-all-in, non-folded player has a current-street bet higher
      //    than the all-in player's current-street bet (they bet more than the
      //    all-in player could match — e.g. all-in for $39 into a $409 bet)
      if (gameState.players.some((p: PlayerState) =>
        !p.allIn && !p.folded && p.bet > lowestAllInBet
      )) return true;
      // 4) Any non-all-in, non-folded player has any current-street bet
      //    when all-in player has no street bet (all-in from previous street)
      return gameState.players.some((p: PlayerState) =>
        !p.allIn && !p.folded && p.bet > 0
      );
    })();

    if (hasSidePot && totalPot > 0) {
      // Build pot boundaries from all-in levels
      const allInLevels = Array.from(new Set(allInPlayers.map((p: PlayerState) => p.totalBet))).sort((a, b) => a - b);
      const contributors = gameState.players.filter((p: PlayerState) => p.totalBet > 0);

      // Compute each pot layer by summing each player's actual contribution
      // at that level. Only include layers where at least 2 non-folded players
      // are eligible (otherwise the excess gets returned, no real side pot).
      const boundaries = [...allInLevels];
      const rawLayers: { amount: number; eligible: number }[] = [];
      let prevBound = 0;
      const nonFolded = gameState.players.filter((p: PlayerState) => !p.folded && p.totalBet > 0);

      for (const bound of boundaries) {
        let layerTotal = 0;
        for (const p of contributors) {
          const contrib = Math.min(p.totalBet, bound) - Math.min(p.totalBet, prevBound);
          if (contrib > 0) layerTotal += contrib;
        }
        // Count non-folded players eligible at this level
        const eligibleCount = nonFolded.filter((p: PlayerState) => p.totalBet >= bound).length;
        if (layerTotal > 0) rawLayers.push({ amount: layerTotal, eligible: eligibleCount });
        prevBound = bound;
      }

      // Anything above the highest all-in level
      const highestAllIn = boundaries[boundaries.length - 1];
      let topLayer = 0;
      for (const p of contributors) {
        const excess = p.totalBet - highestAllIn;
        if (excess > 0) topLayer += excess;
      }
      if (topLayer > 0) {
        const topEligible = nonFolded.filter((p: PlayerState) => p.totalBet > highestAllIn).length;
        rawLayers.push({ amount: topLayer, eligible: topEligible });
      }

      // Merge layers with 0 eligible players into the previous layer
      // (no one can win that slice). During active play, layers with eligible === 1
      // are legitimate side pots — other players may still call/fold.
      const potLayers: number[] = [];
      for (const layer of rawLayers) {
        if (layer.eligible === 0 && potLayers.length > 0) {
          potLayers[potLayers.length - 1] += layer.amount;
        } else {
          potLayers.push(layer.amount);
        }
      }

      // Display: first layer is Main, rest are Side pots
      if (potLayers.length >= 2) {
        let text = `Main: ${formatChips(potLayers[0])}`;
        for (let i = 1; i < potLayers.length; i++) {
          text += `\nSide: ${formatChips(potLayers[i])}`;
        }
        this.statusBar.setPot(text);
      } else {
        this.statusBar.setPot(`Pot: ${formatChips(totalPot)}`);
      }
    } else {
      this.statusBar.setPot(`Pot: ${formatChips(totalPot)}`);
    }

    // Update visual chip stack
    this.potChips.update(totalPot);
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
      const slot = this.getSlotForPlayer(player.id);
      if (!slot) return;
      // If engine says player is no longer all-in (e.g. uncalled bet returned),
      // clear the ALL IN label so the chip count is shown instead
      if (!player.allIn) {
        slot.clearAllIn();
      }
      slot.setChips(player.chips);
    });
  }

  /**
   * Get a detailed hand name that distinguishes sets from trips and
   * uses "Pair of X" instead of "One Pair".
   *
   * - Category 1: "Pair of Kings" instead of "One Pair"
   * - Category 3: "Set of Sixes" if both hole cards are the trip rank,
   *               otherwise "Three of a Kind" (trips)
   */
  private getDetailedHandName(
    strength: HandStrength,
    holeCards?: EngineCard[],
  ): string {
    const rankVal = strength.kickers[0];
    const rankName = getRankName(rankVal);
    // Pluralize rank name
    const plural = rankName === 'Six' ? 'Sixes' : rankName + 's';

    if (strength.category === 1) {
      return `Pair of ${plural}`;
    }

    if (strength.category === 7) {
      return `Quad ${plural}`;
    }

    if (strength.category === 3 && holeCards && holeCards.length === 2) {
      // Map rank string → numeric value for comparison
      const rankToVal: Record<string, number> = {
        'A': 14, 'K': 13, 'Q': 12, 'J': 11, '10': 10,
        '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2,
      };
      const h1 = rankToVal[holeCards[0].rank] ?? 0;
      const h2 = rankToVal[holeCards[1].rank] ?? 0;
      // Set = pocket pair matching the trip rank
      if (h1 === rankVal && h2 === rankVal) {
        return `Set of ${plural}`;
      }
      return `Trip ${plural}`;
    }

    return getHandName(strength);
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
        name = this.getDetailedHandName(strength, hole);
      } else {
        const [c1, c2] = hole;
        if (c1 && c2 && c1.rank === c2.rank) {
          const rankToVal: Record<string, number> = {
            'A': 14, 'K': 13, 'Q': 12, 'J': 11, '10': 10,
            '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2,
          };
          const val = rankToVal[c1.rank] ?? 0;
          const rn = getRankName(val);
          const pl = rn === 'Six' ? 'Sixes' : rn + 's';
          name = `Pair of ${pl}`;
        } else {
          name = 'High Card';
        }
      }
      this.statusBar.setHand(name);
    } catch (err) {
      console.warn('Failed to evaluate hand:', err);
    }
  }

  /** Original AI configs — stored so short-handed adjustments don't compound */
  private originalAIConfigs: Map<string, any> = new Map();

  /**
   * Adjust AI configs based on active player count.
   * Fewer players → looser VPIP, lower call thresholds.
   * Heads-up → everyone plays almost every hand.
   */
  private adjustAIForTableSize(): void {
    if (!this.engine) return;
    const activePlayers = this.playerIdBySeat.filter(
      id => !this.eliminatedPlayers.has(id)
    ).length;

    const aiInstances = (this.engine as any).aiInstances as Map<string, { getConfig: () => any; setConfig: (c: any) => void }>;

    // Snapshot original configs on first call
    for (const [id, ai] of aiInstances) {
      if (!this.originalAIConfigs.has(id)) {
        this.originalAIConfigs.set(id, ai.getConfig());
      }
    }

    // Full table (6+): restore originals
    if (activePlayers >= 6) {
      for (const [id, ai] of aiInstances) {
        const orig = this.originalAIConfigs.get(id);
        if (orig) ai.setConfig(orig);
      }
      return;
    }

    for (const [id, ai] of aiInstances) {
      const orig = this.originalAIConfigs.get(id);
      if (!orig) continue;
      const config = { ...orig };

      // Scale VPIP threshold down as table gets shorter
      // 5 players: 85% of original, 4: 70%, 3: 55%, 2 (heads-up): 40%
      const vpipScale = activePlayers <= 2 ? 0.40
        : activePlayers === 3 ? 0.55
        : activePlayers === 4 ? 0.70
        : 0.85;

      // Scale call threshold down similarly
      const callScale = activePlayers <= 2 ? 0.45
        : activePlayers === 3 ? 0.60
        : activePlayers === 4 ? 0.75
        : 0.85;

      // Boost aggression for short-handed play
      const aggrBoost = activePlayers <= 2 ? 0.25
        : activePlayers === 3 ? 0.15
        : activePlayers === 4 ? 0.10
        : 0.05;

      config.vpipThreshold *= vpipScale;
      config.callThreshold *= callScale;
      config.aggression = Math.min(1, config.aggression + aggrBoost);
      // Heads-up: increase bluff frequency
      if (activePlayers <= 2) {
        config.bluffFrequency = Math.min(0.5, config.bluffFrequency + 0.15);
      }

      ai.setConfig(config);
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

  /**
   * Check for eliminated players. When deferGameOver is true, knockout labels
   * and history entries are recorded but the game-over modal is NOT shown —
   * call triggerDeferredGameOver() later after animations finish.
   */
  private checkForEliminatedPlayers(deferGameOver = false): void {
    if (!this.engine) return;
    const gameState = this.engine.getGameState();
    const newlyEliminated: { id: string; seatIndex: number }[] = [];

    if (DEBUG_ENABLED) console.log('[ELIM CHECK] Player chips:', gameState.players.map(p => `${p.id}=$${p.chips}`).join(', '));
    if (DEBUG_ENABLED) console.log('[ELIM CHECK] totalKnockouts:', this.totalKnockouts, '/ ROSTER:', PLAYER_ROSTER.length);

    gameState.players.forEach((player, index) => {
      if (player.chips <= 0 && !this.eliminatedPlayers.has(player.id)) {
        if (DEBUG_ENABLED) console.log(`[ELIM] ${player.id} knocked out (${player.chips} chips)`);
        this.eliminatedPlayers.add(player.id);
        newlyEliminated.push({ id: player.id, seatIndex: index });

        const eliminatedName = this.getDisplayName(player.id);
        const handNum = String(this.handCounter).padStart(3, '0');
        this.handHistory.addEntry(`Hand ${handNum}: Player ${eliminatedName} eliminated.`);

        if (deferGameOver) {
          if (player.id !== 'player') this.totalKnockouts++;
        } else if (player.id === 'player') {
          this.audioManager.playGameOverSound();
          this.statusBar.setStatus('GAME OVER — You ran out of chips!');
          this.actionBar.hide();
          this.handPhase = 'idle';
        } else {
          this.totalKnockouts++;
          if (eliminatedName === 'MikoPoker' && this.lastHandWinners?.includes('player')) {
            if (DEBUG_ENABLED) console.log('[ELIM] 🏆 MikoPoker knocked out by player! Victory!');
            this.audioManager.playVictorySound();
            this.statusBar.setStatus('YOU WIN! You knocked out MikoPoker!');
            this.actionBar.hide();
            this.handPhase = 'idle';
          }
        }
      }
    });

    // Play knockout animations sequentially (one at a time) with sound
    const KO_ANIM_DURATION = 2800; // time per KO animation before starting next
    newlyEliminated.forEach(({ id, seatIndex }, idx) => {
      this.delayed(() => {
        const slot = this.getSlotForPlayer(id);
        const name = this.getDisplayName(id);
        this.audioManager.playKnockoutSound();
        if (slot) {
          if (DEBUG_ENABLED) console.log(`[KO] ${name} knocked out (seat ${seatIndex})`);
          slot.playKnockoutAnimation();
        } else {
          if (DEBUG_ENABLED) console.warn(`[KO] ${name} knocked out but no slot found (seat ${seatIndex})`);
        }
      }, idx * KO_ANIM_DURATION);
    });

    // Store KO info so downstream timing and game-over checks can use it
    this._lastKoCount = newlyEliminated.length;
    this._newlyEliminatedNames = newlyEliminated.map(({ id }) => this.getDisplayName(id));

    // Replace eliminated AI players with new roster players (always, even when deferring game-over)
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

      // Defer replacement: wait 2-4 hands before new player joins
      // (decremented at start of each new hand, so effective wait is 1-3 hands with empty seat)
      const handsRemaining = 2 + Math.floor(Math.random() * 3); // 2, 3, or 4 ticks → 1-3 hands empty
      this.deferredReplacements.push({ seatIndex, engineId, entry: newEntry, handsRemaining });
    }

    if (deferGameOver) return;

    // If human is eliminated, stop here
    if (this.eliminatedPlayers.has('player')) return;

    // Check win condition: all 32 roster players knocked out
    if (DEBUG_ENABLED) console.log('[ELIM CHECK] After processing — totalKnockouts:', this.totalKnockouts, 'needed:', PLAYER_ROSTER.length);
    if (this.totalKnockouts >= PLAYER_ROSTER.length) {
      if (DEBUG_ENABLED) console.log('[ELIM] 🏆 WIN CONDITION MET via checkForEliminatedPlayers!');
      const lastWasMiko = this.lastHandWinners.includes('player')
        && this._newlyEliminatedNames.includes('MikoPoker');
      const winMsg = lastWasMiko ? 'You knocked out MikoPoker!' : 'You eliminated all opponents!';
      this.audioManager.playVictorySound();
      this.statusBar.setStatus(`YOU WIN! ${winMsg}`);
      this.actionBar.hide();
      this.handPhase = 'idle';
      this.onGameOver?.(winMsg);
    }
  }

  /**
   * Trigger game-over modal after pot award animations have finished.
   * Only fires if the player (or MikoPoker) was eliminated during the
   * deferred checkForEliminatedPlayers call.
   */
  private triggerDeferredGameOver(): void {
    if (this.eliminatedPlayers.has('player')) {
      this.audioManager.playGameOverSound();
      this.statusBar.setStatus('GAME OVER — You ran out of chips!');
      this.actionBar.hide();
      this.handPhase = 'idle';
      this.onGameOver?.('You ran out of chips!');
      return;
    }

    // Check MikoPoker knockout win — only if MikoPoker was eliminated THIS hand
    // AND the player won the hand (i.e., player took MikoPoker's chips)
    const mikoKnockedOutThisHand = this._newlyEliminatedNames.includes('MikoPoker');
    if (mikoKnockedOutThisHand && this.lastHandWinners.includes('player')) {
      this.audioManager.playVictorySound();
      this.statusBar.setStatus('YOU WIN! You knocked out MikoPoker!');
      this.actionBar.hide();
      this.handPhase = 'idle';
      this.onGameOver?.('You knocked out MikoPoker!');
      return;
    }

    // Check all-opponents-eliminated win
    if (this.totalKnockouts >= PLAYER_ROSTER.length) {
      this.audioManager.playVictorySound();
      this.statusBar.setStatus('YOU WIN! All opponents eliminated!');
      this.actionBar.hide();
      this.handPhase = 'idle';
      this.onGameOver?.('You eliminated all opponents!');
    }
  }

  /** Apply pending player replacements before the next hand starts */
  private applyPendingReplacements(): void {
    if (!this.engine || this.pendingReplacements.length === 0) return;

    for (const { seatIndex, engineId, entry } of this.pendingReplacements) {
      // Replace in engine
      this.engine.replacePlayer(seatIndex, engineId, entry.config);

      // Update seat ↔ ID mappings
      const oldId = this.playerIdBySeat[seatIndex];
      if (oldId) this.seatByPlayerId.delete(oldId);
      this.playerIdBySeat[seatIndex] = engineId;
      this.seatByPlayerId.set(engineId, seatIndex);

      // Update display name mapping
      this.displayNameById.set(engineId, entry.name);

      // Update UI slot
      const slot = this.slotLayout.getSlot(seatIndex);
      if (slot) {
        slot.resetForNewHand();
        slot.setPlayerName(entry.name);
        slot.setAvatar(this.getAvatarTexture(entry.avatarName ?? entry.name, entry.gender));
        slot.setChips(GAME_CONFIG.startingChips);
        slot.visible = true;
        slot.clearStatus();
      }

      // Remove from eliminated set so they can play
      this.eliminatedPlayers.delete(engineId);

      this.statusBar.setStatus(`${entry.name} has joined the table!`);
      const nextHandNum = String(this.handCounter + 1).padStart(3, '0');
      this.handHistory.addEntry(`Hand ${nextHandNum}: ${entry.name} has entered the game.`);
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

      // Update seat ↔ ID mappings
      const oldId = this.playerIdBySeat[seatIndex];
      if (oldId) this.seatByPlayerId.delete(oldId);
      this.playerIdBySeat[seatIndex] = engineId;
      this.seatByPlayerId.set(engineId, seatIndex);

      // Update display name mapping
      this.displayNameById.set(engineId, entry.name);

      // Update UI slot — set up content but keep hidden until animation
      const slot = this.slotLayout.getSlot(seatIndex);
      if (slot) {
        slot.resetForNewHand();
        slot.setPlayerName(entry.name);
        slot.setAvatar(this.getAvatarTexture(entry.avatarName ?? entry.name, entry.gender));
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
      const nextHandNum = String(this.handCounter + 1).padStart(3, '0');
      this.handHistory.addEntry(`Hand ${nextHandNum}: ${entry.name} has entered the game.`);
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
      if (this.eliminatedPlayers.has(p.id)) return; // skip players with knockout animation playing
      try {
        const combined = [...(p.cards as EngineCard[]), ...this.currentCommunityCards];
        if (combined.length < 5) return;
        const strength = evaluateHand(combined as EngineCard[]);
        const handName = this.getDetailedHandName(strength, p.cards as EngineCard[]);
        const slot = this.getSlotForPlayer(p.id);
        if (!slot) return;
        // Top-row seats: show hand name as a scene-level label above the
        // community cards, since bet labels inside slots get occluded
        if (slot.seatIndex === 3 || slot.seatIndex === 4 || slot.seatIndex === 5) {
          this.showLosingHandAtSlot(handName, slot);
        } else {
          slot.setBetSmallItalic(handName);
        }
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
        const handName = this.getDetailedHandName(strength, winner.cards as EngineCard[]);
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
    // Position hand labels so they don't get covered by raised community cards
    const seatIdx = slot.seatIndex;
    if (seatIdx === 2 || seatIdx === 6) {
      // Side seats: position under name label
      label.x = slot.x;
      label.y = slot.y + 70;
    } else if (seatIdx === 3 || seatIdx === 4 || seatIdx === 5) {
      // Top row: place ABOVE the cards so raised board cards don't cover them
      label.x = slot.x;
      label.y = slot.y - 95;
    } else {
      label.x = slot.x + betLabelPos.x;
      label.y = slot.y + betLabelPos.y;
    }
    label.alpha = 0;
    label.scale.set(0.5);
    label.zIndex = 100; // ensure hand labels render above raised cards
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

  /** Show a losing hand name at a top-row slot — smaller, muted style */
  private showLosingHandAtSlot(handName: string, slot: PlayerSlot): void {
    const scene = slot.parent;
    if (!scene) return;

    const label = new Text({
      text: handName,
      style: {
        fontFamily: 'Arial',
        fontSize: 16,
        fontStyle: 'italic',
        fill: 0xffff00,
        stroke: { color: 0x000000, width: 2 },
      } as TextStyleOptions,
    });
    label.anchor.set(0.5);
    label.x = slot.x;
    label.y = slot.y + 48;
    label.alpha = 0;
    label.zIndex = 100;
    scene.addChild(label);
    this.winningHandLabels.push(label);

    // Simple fade in
    const startTime = performance.now();
    const duration = 400;
    const animate = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1);
      label.alpha = t * 0.85;
      if (t < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);

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

  private highlightWinnerNames(winnerIds: string[], subtitle?: string): void {
    winnerIds.forEach(pid => {
      const slot = this.getSlotForPlayer(pid);
      if (!slot) return;
      slot.showWinnerLabel(8000, subtitle);
    });
  }

  /** Animate per-player winnings flying from pot to each winner's chip stack */
  private animatePotToWinners(
    winnerIds: string[],
    preWinChips: Map<string, number>,
    postWinChips: Map<string, number>,
    perPlayerWinnings?: Map<string, number>,
  ): void {
    const potPos = this.statusBar.getPotLabelScenePosition();
    const scene = this.statusBar.parent;
    if (!scene) return;

    // Hide the pot label and chip stack
    this.statusBar.setPot('');

    // Create flying chip graphics from the pot stack before clearing it
    const flyingChipSets: Graphics[][] = [];
    const chipsPerWinner = Math.max(2, Math.min(5, Math.ceil(this.potChips.chipCount || 6) / Math.max(winnerIds.length, 1)));
    for (let i = 0; i < winnerIds.length; i++) {
      flyingChipSets.push(this.potChips.createFlyingChips(chipsPerWinner));
    }
    this.potChips.clear();

    const gen = this.generation;

    winnerIds.forEach((pid, idx) => {
      const slot = this.getSlotForPlayer(pid);
      if (!slot) return;

      // Target: center of the chip overlay in scene coords
      const targetX = slot.x;
      const targetY = slot.y + CHIP_OVERLAY_Y;

      // Show per-player winnings amount on the floating label
      const winAmount = perPlayerWinnings?.get(pid) ?? 0;
      const labelText = winAmount > 0 ? `+${formatChips(winAmount)}` : this.statusBar.getPotText();

      // Create a floating pot text clone
      const floatingText = new Text({
        text: labelText,
        style: FONTS.potLabel as TextStyleOptions,
      });
      floatingText.anchor.set(0.5);
      floatingText.x = potPos.x;
      floatingText.y = potPos.y;
      scene.addChild(floatingText);

      // Add flying chip graphics to the scene with slight scatter
      const flyingChips = flyingChipSets[idx] ?? [];
      const chipStartX = this.potChips.x;
      const chipStartY = this.potChips.y;
      const chipOrigins: { x: number; y: number }[] = [];
      flyingChips.forEach((chip, ci) => {
        const ox = chipStartX + (Math.random() - 0.5) * 16;
        const oy = chipStartY - ci * 3;
        chip.x = ox;
        chip.y = oy;
        chipOrigins.push({ x: ox, y: oy });
        scene.addChild(chip);
      });

      // Stagger multiple winners
      const delay = idx * 600;

      setTimeout(() => {
        const startX = floatingText.x;
        const startY = floatingText.y;
        const startTime = performance.now();
        const flyDuration = 1400;

        const animate = (now: number) => {
          // If game restarted or tab was hidden too long, skip animation
          const stale = this.generation !== gen;
          const t = Math.min((now - startTime) / flyDuration, 1);

          if (stale || t >= 1) {
            // Clean up visuals immediately
            scene.removeChild(floatingText);
            floatingText.destroy();
            flyingChips.forEach(chip => {
              scene.removeChild(chip);
              chip.destroy();
            });

            // Only play completion effects if still in same hand
            if (!stale) {
              slot.pulseChipOverlay();
              const fromChips = preWinChips.get(pid) ?? 0;
              const toChips = postWinChips.get(pid) ?? fromChips;
              slot.animateChipsTo(fromChips, toChips);
            }
            return;
          }

          // Ease-in-out cubic
          const ease = t < 0.5
            ? 4 * t * t * t
            : 1 - Math.pow(-2 * t + 2, 3) / 2;

          floatingText.x = startX + (targetX - startX) * ease;
          floatingText.y = startY + (targetY - startY) * ease;
          // Shrink slightly as it arrives
          floatingText.scale.set(1 - 0.3 * ease);
          floatingText.alpha = 1 - 0.2 * ease;

          // Animate flying chips with slight spread and varying speed
          flyingChips.forEach((chip, ci) => {
            const chipDelay = ci * 0.06; // stagger each chip slightly
            const chipT = Math.max(0, Math.min((t - chipDelay) / (1 - chipDelay), 1));
            const chipEase = chipT < 0.5
              ? 4 * chipT * chipT * chipT
              : 1 - Math.pow(-2 * chipT + 2, 3) / 2;

            const origin = chipOrigins[ci] ?? { x: chipStartX, y: chipStartY };
            chip.x = origin.x + (targetX - origin.x) * chipEase;
            chip.y = origin.y + (targetY - origin.y) * chipEase;
            chip.alpha = 1 - 0.3 * chipEase;
            chip.scale.set(1 - 0.4 * chipEase);
          });

          requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
      }, delay);
    });
  }

  /** Animate a single pot award: chips fly from pot position to one player. */
  private animateSinglePotAward(
    pid: string,
    winAmount: number,
    fromChips: number,
    toChips: number,
  ): void {
    const potPos = this.statusBar.getPotLabelScenePosition();
    const scene = this.statusBar.parent;
    if (!scene) return;

    const slot = this.getSlotForPlayer(pid);
    if (!slot) return;

    const targetX = slot.x;
    const targetY = slot.y + CHIP_OVERLAY_Y;

    // Create floating text showing the pot award amount
    const floatingText = new Text({
      text: `+${formatChips(winAmount)}`,
      style: FONTS.potLabel as TextStyleOptions,
    });
    floatingText.anchor.set(0.5);
    floatingText.x = potPos.x;
    floatingText.y = potPos.y;
    scene.addChild(floatingText);

    // Create a few flying chip graphics
    const flyingChips = this.potChips.createFlyingChips(3);
    const chipStartX = this.potChips.x;
    const chipStartY = this.potChips.y;
    const chipOrigins: { x: number; y: number }[] = [];
    flyingChips.forEach((chip, ci) => {
      const ox = chipStartX + (Math.random() - 0.5) * 16;
      const oy = chipStartY - ci * 3;
      chip.x = ox;
      chip.y = oy;
      chipOrigins.push({ x: ox, y: oy });
      scene.addChild(chip);
    });

    // Animate text and chips flying to the winner
    const startX = floatingText.x;
    const startY = floatingText.y;
    const startTime = performance.now();
    const flyDuration = 1400;
    const gen = this.generation;

    const animate = (now: number) => {
      // If game restarted or tab was hidden too long, skip animation
      const stale = this.generation !== gen;
      const t = Math.min((now - startTime) / flyDuration, 1);

      if (stale || t >= 1) {
        scene.removeChild(floatingText);
        floatingText.destroy();
        flyingChips.forEach(chip => {
          scene.removeChild(chip);
          chip.destroy();
        });
        if (!stale) {
          slot.pulseChipOverlay();
          slot.animateChipsTo(fromChips, toChips);
        }
        return;
      }

      const ease = t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;

      floatingText.x = startX + (targetX - startX) * ease;
      floatingText.y = startY + (targetY - startY) * ease;
      floatingText.scale.set(1 - 0.3 * ease);
      floatingText.alpha = 1 - 0.2 * ease;

      flyingChips.forEach((chip, ci) => {
        const chipDelay = ci * 0.06;
        const chipT = Math.max(0, Math.min((t - chipDelay) / (1 - chipDelay), 1));
        const chipEase = chipT < 0.5
          ? 4 * chipT * chipT * chipT
          : 1 - Math.pow(-2 * chipT + 2, 3) / 2;

        const origin = chipOrigins[ci] ?? { x: chipStartX, y: chipStartY };
        chip.x = origin.x + (targetX - origin.x) * chipEase;
        chip.y = origin.y + (targetY - origin.y) * chipEase;
        chip.alpha = 1 - 0.3 * chipEase;
        chip.scale.set(1 - 0.4 * chipEase);
      });

      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
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
      // Skip eliminated players — knockout animation will play after pot awards
      if (player.chips <= 0) return;
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

  destroy(): void {
    this.resetDebugState();
    this.handHistory.destroy();
  }
}
