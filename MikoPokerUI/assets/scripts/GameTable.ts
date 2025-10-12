/**
 * GameTable - Main integration component connecting the poker engine to Cocos UI
 * Manages an 8-max cash game with card dealing, chip display, and player actions
 */

import { _decorator, Component, Node, Label, Sprite, SpriteFrame, Vec3, UITransform, Color, resources, Prefab, instantiate, Button, EditBox, game, director, profiler } from 'cc';
import { SlotLayoutManager } from './SlotLayoutManager';
import { Card as CardComponent, type CardData } from './Card';
import { AudioManager } from './AudioManager';

// Import poker engine (from main index to get all exports)
import { PokerGameEngine } from '../../../engine/dist/index.js';
import type { GameEvent, Card as EngineCard, PlayerState } from '../../../engine/dist/index.js';

const { ccclass, property } = _decorator;

// UI Debug flag - Set to false to disable UI logging
const DEBUG_UI = true;

// UI debug logging helper
function uiLog(...args: any[]): void {
    if (DEBUG_UI) {
        console.log(...args);
    }
}

@ccclass('GameTable')
export class GameTable extends Component {
    // === Scene References ===

    @property(SlotLayoutManager)
    slotLayoutManager: SlotLayoutManager | null = null;

    @property(Label)
    potLabel: Label | null = null;

    @property(Label)
    statusLabel: Label | null = null;

    @property(Node)
    communityCardsNode: Node | null = null;

    // === Action Buttons ===

    @property(Node)
    leftButton: Node | null = null; // Check or Call

    @property(Node)
    middleButton: Node | null = null; // Bet or Raise

    @property(Node)
    rightButton: Node | null = null; // Fold

    @property(EditBox)
    betInput: EditBox | null = null; // For entering bet/raise amount

    @property(Node)
    newGameButton: Node | null = null; // New Game button (shown when player is eliminated)

    // === Card Prefab ===

    @property(Prefab)
    cardPrefab: Prefab | null = null;

    // === Game Configuration ===

    @property
    smallBlind: number = 5;

    @property
    bigBlind: number = 10;

    @property
    startingChips: number = 1000;

    // === Private State ===

    private engine: PokerGameEngine | null = null;
    private playerSlots: Map<string, Node> = new Map(); // playerId -> slot node
    private playerBetLabels: Map<string, Label> = new Map(); // playerId -> bet label
    private playerNameLabels: Map<string, Label> = new Map(); // playerId -> name label
    private playerChipLabels: Map<string, Label> = new Map(); // playerId -> chip label
    private playerStatusLabels: Map<string, Label> = new Map(); // playerId -> status label (ALL-IN, etc.)
    private dealerButtonNode: Node | null = null;
    private currentActivePlayer: string | null = null; // Track whose turn it is
    private eliminatedPlayers: Set<string> = new Set(); // Track eliminated players
    private audioManager: AudioManager | null = null; // Audio manager for sound playback

    // Pot tracking (proper poker logic)
    private potAmount: number = 0;        // Accumulated pot from completed rounds
    private outstandingAmount: number = 0; // Current bets in progress (not yet in pot)

    // DEBUG: Hand tracking and phase management
    private handCounter: number = 0;
    private handPhase: 'idle' | 'starting' | 'dealing' | 'betting' | 'showdown' = 'idle';

    start() {
        // Disable FPS and debug stats display
        try {
            profiler.hideStats();
            console.log('Debug stats disabled');
        } catch (err) {
            console.warn('Could not disable stats:', err);
        }

        console.log('=== GameTable.start() ===');
        console.log('SlotLayoutManager:', this.slotLayoutManager ? 'Assigned' : 'Missing');
        console.log('Card Prefab:', this.cardPrefab ? 'Assigned' : 'Missing');
        console.log('Pot Label:', this.potLabel ? 'Assigned' : 'Missing');
        console.log('Status Label:', this.statusLabel ? 'Assigned' : 'Missing');
        console.log('Community Cards Node:', this.communityCardsNode ? 'Assigned' : 'Missing');
        console.log('Left Button:', this.leftButton ? 'Assigned' : 'Missing');
        console.log('Middle Button:', this.middleButton ? 'Assigned' : 'Missing');
        console.log('Right Button:', this.rightButton ? 'Assigned' : 'Missing');
        console.log('Bet Input:', this.betInput ? 'Assigned' : 'Missing');
        console.log('New Game Button:', this.newGameButton ? 'Assigned' : 'Missing');

        this.initializeEngine();
        this.createDealerButton();
        this.setupButtonHandlers();
        this.initializeAudioManager();
        this.hideActionButtons(); // Hide until player's turn
        this.hideNewGameButton(); // Hide until game over

        // Wait a frame for SlotLayoutManager to create slots
        this.scheduleOnce(() => {
            console.log('=== Starting First Hand (delayed) ===');
            this.debugSlots();
        this.startFirstHand();
        }, 0.1);
    }

    /**
     * Debug: Log all slot positions
     */
    private debugSlots() {
        if (!this.slotLayoutManager) {
            console.error(' SlotLayoutManager is null!');
            return;
        }

        const slots = this.slotLayoutManager.getAllSlots();
        console.log(` Total slots created: ${slots.length}`);
        slots.forEach((slot, index) => {
            const pos = slot.getPosition();
            console.log(`  Slot ${index}: position (${pos.x.toFixed(0)}, ${pos.y.toFixed(0)}), active: ${slot.active}`);
        });
    }

    /**
     * Initialize the poker engine with 8 players
     */
    private initializeEngine() {
        // Create engine instance
        this.engine = new PokerGameEngine({
            gameType: 'cash',
            smallBlind: this.smallBlind,
            bigBlind: this.bigBlind,
            startingChips: this.startingChips,
            maxPlayers: 8
        });

        // Create player IDs: 1 human + 7 AI
        const playerIds: string[] = ['player', 'ai1', 'ai2', 'ai3', 'ai4', 'ai5', 'ai6', 'ai7'];

        // Set AI difficulties (all Normal for now)
        const aiDifficulties = new Map<string, 'easy' | 'normal' | 'hard' | 'pro'>([
            ['ai1', 'normal'],
            ['ai2', 'normal'],
            ['ai3', 'normal'],
            ['ai4', 'normal'],
            ['ai5', 'normal'],
            ['ai6', 'normal'],
            ['ai7', 'normal']
        ]);

        // Initialize game
        this.engine.initGame(playerIds, aiDifficulties);

        // Subscribe to engine events
        this.engine.on((event: GameEvent) => this.handleGameEvent(event));

        console.log(' Engine initialized with 8 players');
    }

    /**
     * Create dealer button node
     */
    private createDealerButton() {
        this.dealerButtonNode = new Node('DealerButton');
        this.dealerButtonNode.setParent(this.node);

        // Add UITransform
        const transform = this.dealerButtonNode.addComponent(UITransform);
        transform.setContentSize(30, 30);

        // Add sprite and set to CUSTOM size mode
        const sprite = this.dealerButtonNode.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM; // Set BEFORE loading sprite frame

        // Load dealer button sprite
        resources.load('dealer_button/spriteFrame', SpriteFrame, (err, spriteFrame) => {
            if (err) {
                console.error('Failed to load dealer button sprite', err);
                // Fallback to text label
                const label = this.dealerButtonNode!.addComponent(Label);
        label.string = 'D';
                label.fontSize = 16;
                label.color = new Color(255, 255, 255, 255);
                return;
            }
            sprite.spriteFrame = spriteFrame;
            // Size mode already set above, UITransform already set to 30x30
            console.log(' Dealer button loaded and sized to 30x30 (CUSTOM mode)');
        });

        this.dealerButtonNode.active = false; // Hide until we position it
    }

    /**
     * Initialize audio manager
     */
    private initializeAudioManager() {
        // Create AudioManager as a child node
        const audioNode = new Node('AudioManager');
        audioNode.setParent(this.node);
        this.audioManager = audioNode.addComponent(AudioManager);
        this.audioManager.initialize();
    }

    /**
     * Start the first hand
     */
    private startFirstHand() {
        if (this.engine) {
            console.log(' Starting first hand...');
            this.engine.startNewHand();

            // After starting hand, begin the auto-advance loop
            this.scheduleOnce(() => {
                this.advanceGame();
            }, 0.5); // Small delay to let cards appear
        }
    }

    /**
     * Auto-advance the game - checks whose turn it is and either shows buttons or processes AI action
     */
    private advanceGame() {
        // Stop if human player is eliminated
        if (this.eliminatedPlayers.has('player')) {
            console.log(`[HAND #${this.handCounter}]  Player eliminated, stopping game`);
            return;
        }

        if (!this.engine || !this.engine.isHandInProgress()) {
            console.log(`[HAND #${this.handCounter}]  No hand in progress, stopping auto-advance`);
            return;
        }

        // Set to betting phase on first advance after dealing
        if (this.handPhase === 'dealing') {
            this.handPhase = 'betting';
            console.log(`[HAND #${this.handCounter}]  Phase → BETTING`);
        }

        const gameState = this.engine.getGameState();

        // CRITICAL: Check if all remaining players are all-in or folded
        // If so, skip remaining betting and go straight to showdown
        const activePlayers = gameState.players.filter((p: any) => !p.folded);
        const canActPlayers = activePlayers.filter((p: any) => !p.allIn);

        if (canActPlayers.length === 0 && activePlayers.length > 1) {
            console.log(`[HAND #${this.handCounter}] 🚀 All players are all-in! Auto-advancing to showdown...`);
            // Force hand to complete - all remaining players are all-in
            this.engine.forceHandComplete();
            return;
        }

        const currentPlayer = gameState.players[gameState.currentPlayerIndex];

        if (!currentPlayer) {
            console.error(`[HAND #${this.handCounter}]  No current player found!`);
            return;
        }

        console.log(`\n[HAND #${this.handCounter}] ⏳ Current turn: ${currentPlayer.id} (index ${gameState.currentPlayerIndex})`);

        // Check if current player has already folded or is all-in
        if (currentPlayer.folded) {
            console.log(`   Player ${currentPlayer.id} folded - skipping`);
            this.scheduleOnce(() => this.advanceGame(), 0.1);
            return;
        }

        if (currentPlayer.allIn) {
            console.log(`   Player ${currentPlayer.id} is ALL-IN - skipping`);
            this.updatePlayerStatus(currentPlayer.id, 'ALL-IN', true);
            this.scheduleOnce(() => this.advanceGame(), 0.5);
            return;
        }

        // Highlight current player
        this.highlightPlayer(currentPlayer.id);

        if (currentPlayer.id === 'player') {
            // Human player's turn - show buttons with valid actions
            const validActions: string[] = [];
            if (gameState.canFold) validActions.push('fold');
            if (gameState.canCheck) validActions.push('check');
            if (gameState.canCall) validActions.push('call');
            if (gameState.canBet) validActions.push('bet');
            if (gameState.canRaise) validActions.push('raise');

            this.onActionRequired(currentPlayer.id, validActions);
            // Don't schedule another advanceGame - wait for player to click a button
        } else {
            // AI player's turn - automatically process action
            console.log(`   AI player ${currentPlayer.id} is deciding...`);

            if (this.statusLabel) {
                this.statusLabel.string = `${currentPlayer.id} is thinking...`;
            }

            // Get AI decision and process it
            this.scheduleOnce(() => {
                try {
                    const action = this.engine!.getAIAction(currentPlayer.id);
                    console.log(`   AI ${currentPlayer.id} chose:`, action);
                    this.engine!.processAction(currentPlayer.id, action);

                    // Continue to next player
                    this.scheduleOnce(() => this.advanceGame(), 0.5);
                } catch (error) {
                    console.error(` Error processing AI action:`, error);
                }
            }, 2.0); // 2 second delay to simulate thinking
        }
    }

    /**
     * Handle all game events from the engine
     */
    private handleGameEvent(event: GameEvent) {
        console.log(' Game Event:', event.type);

        switch (event.type) {
            case 'hand_started':
                this.onHandStarted();
                break;

            case 'blind_posted':
                this.onBlindPosted(event.playerId, event.amount, event.isAnte);
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
                this.onPotUpdated(event.amount);
                break;

            case 'hand_complete':
                this.onHandEnded(event.result);
                break;

            case 'game_over':
                console.log('🏆 Game Over!', event.winnerId);
                break;
        }
    }

    /**
     * Called when a new hand starts
     */
    private onHandStarted() {
        // ═══════════════════════════════════════════════════════
        // DEBUG: Hand boundary tracking
        this.handCounter++;
        this.handPhase = 'starting';
        console.log('');
        console.log('═══════════════════════════════════════════════════════');
        console.log(` HAND #${this.handCounter} STARTED - Phase: ${this.handPhase}`);
        console.log('═══════════════════════════════════════════════════════');
        // ═══════════════════════════════════════════════════════

        if (!this.engine) {
            console.error(' Engine is null!');
            return;
        }

        if (!this.slotLayoutManager) {
            console.error(' SlotLayoutManager is null!');
            return;
        }

        // Clear community cards from previous hand
        if (this.communityCardsNode) {
            this.communityCardsNode.removeAllChildren();
            console.log(`[HAND #${this.handCounter}]  Cleared community cards for new hand`);
        }

        const gameState = this.engine.getGameState();
        const sbIndex = (gameState.dealerIndex + 1) % gameState.players.length;
        const bbIndex = (gameState.dealerIndex + 2) % gameState.players.length;
        const utgIndex = (gameState.dealerIndex + 3) % gameState.players.length;

        console.log(`Players: ${gameState.players.length}, Dealer: ${gameState.dealerIndex} (${gameState.players[gameState.dealerIndex]?.id})`);
        console.log(`  SB: ${sbIndex} (${gameState.players[sbIndex]?.id})`);
        console.log(`  BB: ${bbIndex} (${gameState.players[bbIndex]?.id})`);
        console.log(`  UTG (first to act): ${utgIndex} (${gameState.players[utgIndex]?.id})`);
        console.log(`  Current player to act: ${gameState.currentPlayerIndex} (${gameState.players[gameState.currentPlayerIndex]?.id})`);

        // Reset player highlighting
        if (this.currentActivePlayer) {
            this.unhighlightPlayer(this.currentActivePlayer);
            this.currentActivePlayer = null;
        }

        // Initialize pot labels
        this.initializeLabels();

        // Clear all player status labels for new hand
        this.clearAllPlayerStatuses();

        console.log(`[HAND #${this.handCounter}]  Updating all player slots...`);

        // Update all player slots BEFORE dealing cards (skip eliminated players)
        gameState.players.forEach((player, index) => {
            // Skip eliminated players (they're already hidden)
            if (this.eliminatedPlayers.has(player.id)) {
                console.log(`[HAND #${this.handCounter}]  SKIP_SLOT seat=${index} pid=${player.id} (eliminated)`);
                return;
            }

            console.log(`[HAND #${this.handCounter}]  UPDATE_SLOT seat=${index} pid=${player.id}`);
            this.updatePlayerSlot(player, index);
        });

        // Verify all slots are mapped
        console.log(`[HAND #${this.handCounter}]  SLOTS_READY:`, Array.from(this.playerSlots.keys()));

        // NOW ready to deal cards
        this.handPhase = 'dealing';
        console.log(`[HAND #${this.handCounter}]  Phase → DEALING (ready for cards_dealt events)`);

        // Position dealer button
        this.positionDealerButton(gameState.dealerIndex);

        // Update status
        if (this.statusLabel) {
            this.statusLabel.string = 'New Hand - Dealing Cards...';
        }

        console.log(`[HAND #${this.handCounter}] === Hand Started Complete ===`);
    }

    /**
     * Initialize pot labels at start of hand
     */
    private initializeLabels() {
        // Update labels from engine state
        this.updateAllPotLabels();

        // Clear all bet labels
        this.playerBetLabels.forEach((label, playerId) => {
            label.string = '';
            label.node.active = false;
        });

        console.log(' Labels initialized from engine');
    }

    /**
     * Update pot label
     * Uses engine's pot directly for accurate display
     */
    private updateAllPotLabels() {
        if (!this.engine) return;

        const gameState = this.engine.getGameState();

        // Pot = what's been collected into the pot by the engine
        const enginePot = gameState.pot;

        if (this.potLabel) {
            // Check if there are side pots
            const sidePots = this.engine.getSidePots();
            if (sidePots && sidePots.length > 0) {
                // Display main pot + side pots
                let potText = `Main: $${enginePot}`;
                sidePots.forEach((pot: any, index: number) => {
                    potText += ` | Side ${index + 1}: $${pot.amount}`;
                });
                this.potLabel.string = potText;
            } else {
                this.potLabel.string = `Pot: $${enginePot}`;
            }
        }

        // Logging
        console.log(` [POT UPDATE] Street: ${gameState.street.toUpperCase()}, EnginePot=$${enginePot}`);
        console.log(`   Player bets:`, gameState.players.map((p: any) => `${p.id}=$${p.bet}`).join(', '));
    }

    /**
     * Called when betting round completes (street changes)
     * Just update labels - engine handles pot collection
     */
    private finalizeBettingRound() {
        console.log(` Round finalized - engine collected bets into pot`);

        // Update labels to show new pot state
        this.updateAllPotLabels();
    }

    /**
     * Update a player's bet label
     */
    private updatePlayerBetLabel(playerId: string, amount: number, actionText?: string) {
        const betLabel = this.playerBetLabels.get(playerId);
        if (!betLabel) {
            console.error(`   No bet label found for ${playerId}`);
            console.log(`  Available bet labels:`, Array.from(this.playerBetLabels.keys()));
            return;
        }

        if (actionText) {
            // Show action text (Check, Fold, SB, BB, etc.)
            betLabel.string = actionText;
            betLabel.node.active = true;
            const nodePos = betLabel.node.getPosition();
            const worldPos = betLabel.node.getWorldPosition();
            console.log(`   ${playerId} bet label SET: "${actionText}"`);
            console.log(`      Node active: ${betLabel.node.active}, parent: ${betLabel.node.parent?.name}`);
            console.log(`      Position: (${nodePos.x.toFixed(0)}, ${nodePos.y.toFixed(0)}), World: (${worldPos.x.toFixed(0)}, ${worldPos.y.toFixed(0)})`);
            console.log(`      Font size: ${betLabel.fontSize}, Color: (${betLabel.color.r}, ${betLabel.color.g}, ${betLabel.color.b}, ${betLabel.color.a})`);
        } else if (amount > 0) {
            // Show bet amount
            betLabel.string = `$${amount}`;
            betLabel.node.active = true;
            const nodePos = betLabel.node.getPosition();
            const worldPos = betLabel.node.getWorldPosition();
            console.log(`   ${playerId} bet label SET: "$${amount}"`);
            console.log(`      Node active: ${betLabel.node.active}, parent: ${betLabel.node.parent?.name}`);
            console.log(`      Position: (${nodePos.x.toFixed(0)}, ${nodePos.y.toFixed(0)}), World: (${worldPos.x.toFixed(0)}, ${worldPos.y.toFixed(0)})`);
        } else {
            // Hide label
            betLabel.string = '';
            betLabel.node.active = false;
            console.log(`   ${playerId} bet label HIDDEN`);
        }
    }

    /**
     * Clear all player bet labels (called at end of betting round)
     */
    private clearAllBetLabels() {
        console.log(' Clearing all bet labels');
        this.playerBetLabels.forEach((label, playerId) => {
            label.string = '';
            label.node.active = false;
        });
    }

    /**
     * Hide a player's cards when they fold
     */
    private hidePlayerCards(playerId: string) {
        const slotNode = this.playerSlots.get(playerId);
        if (!slotNode) {
            console.error(` No slot found for ${playerId} to hide cards`);
            return;
        }

        const cardsContainer = slotNode.getChildByName('Cards');
        if (cardsContainer) {
            cardsContainer.active = false;
            console.log(` ${playerId} cards hidden (folded)`);
        }
    }

    /**
     * Update player status label (ALL-IN, ELIMINATED, etc.)
     */
    private updatePlayerStatus(playerId: string, status: string, show: boolean = true) {
        const statusLabel = this.playerStatusLabels.get(playerId);
        if (statusLabel) {
            statusLabel.string = status;
            statusLabel.node.active = show;
            if (show) {
                console.log(` ${playerId} status: ${status}`);
            }
        }
    }

    /**
     * Clear all player status labels
     */
    private clearAllPlayerStatuses() {
        this.playerStatusLabels.forEach((label, playerId) => {
            label.string = '';
            label.node.active = false;
        });
    }

    /**
     * Eliminate a player from the table
     */
    private eliminatePlayer(playerId: string) {
        console.log(`[HAND #${this.handCounter}]  ELIMINATING ${playerId} (out of chips)`);

        this.eliminatedPlayers.add(playerId);
        this.updatePlayerStatus(playerId, 'ELIMINATED', true);

        // Optionally hide their slot completely
        const slotNode = this.playerSlots.get(playerId);
        if (slotNode) {
            slotNode.active = false; // Hide eliminated player's seat
        }

        // Check if the human player was eliminated
        if (playerId === 'player') {
            console.log(' GAME OVER - Human player eliminated!');
            this.onGameOver();
        }
    }

    /**
     * Handle game over when human player is eliminated
     */
    private onGameOver() {
        console.log(' GAME OVER');

        // Update status message
        if (this.statusLabel) {
            this.statusLabel.string = ' GAME OVER\n\nYou ran out of chips!';
        }

        // Hide action buttons
        this.hideActionButtons();

        // Show New Game button
        this.showNewGameButton();

        // Stop the auto-advance loop
        this.handPhase = 'idle';
    }

    /**
     * Check for eliminated players and remove them
     */
    private checkForEliminatedPlayers() {
        if (!this.engine) return;

        const gameState = this.engine.getGameState();
        gameState.players.forEach((player: any) => {
            if (player.chips <= 0 && !this.eliminatedPlayers.has(player.id)) {
                this.eliminatePlayer(player.id);
            }
        });
    }

    /**
     * Update all player chip labels from current game state
     */
    private updateAllChipLabels() {
        if (!this.engine) return;

        const gameState = this.engine.getGameState();
        gameState.players.forEach(player => {
            const chipLabel = this.playerChipLabels.get(player.id);
            if (chipLabel) {
                chipLabel.string = `$${player.chips}`;
            }
        });
    }

    /**
     * Highlight a player's labels when it's their turn
     */
    private highlightPlayer(playerId: string) {
        // Unhighlight previous player
        if (this.currentActivePlayer) {
            this.unhighlightPlayer(this.currentActivePlayer);
        }

        const nameLabel = this.playerNameLabels.get(playerId);
        const chipLabel = this.playerChipLabels.get(playerId);

        if (nameLabel) {
            nameLabel.isBold = true;
            nameLabel.fontSize = 18; // Slightly larger when active
        }

        if (chipLabel) {
            chipLabel.isBold = true;
            chipLabel.fontSize = 16; // Slightly larger when active
        }

        this.currentActivePlayer = playerId;
        console.log(` Highlighted ${playerId}`);
    }

    /**
     * Remove highlight from a player's labels
     */
    private unhighlightPlayer(playerId: string) {
        const nameLabel = this.playerNameLabels.get(playerId);
        const chipLabel = this.playerChipLabels.get(playerId);

        if (nameLabel) {
            nameLabel.isBold = false;
            nameLabel.fontSize = 16; // Back to normal size
        }

        if (chipLabel) {
            chipLabel.isBold = false;
            chipLabel.fontSize = 14; // Back to normal size
        }
    }

    /**
     * Update a player slot with current information
     */
    private updatePlayerSlot(player: PlayerState, seatIndex: number) {
        if (!this.slotLayoutManager) {
            console.error(` SlotLayoutManager is null when updating seat ${seatIndex}`);
            return;
        }

        const slotNode = this.slotLayoutManager.getSlot(seatIndex);
        if (!slotNode) {
            console.error(` Could not get slot node for seat ${seatIndex}`);
            return;
        }

        console.log(`[HAND #${this.handCounter}] ⚙️ UPDATE_SLOT seat=${seatIndex} pid=${player.id}`);
        const slotPos = slotNode.getPosition();
        console.log(`[HAND #${this.handCounter}]   Slot position: (${slotPos.x.toFixed(0)}, ${slotPos.y.toFixed(0)})`);

        // Store mapping
        this.playerSlots.set(player.id, slotNode);

        // CRITICAL FIX: Preserve Cards, Overlay, PlayerStatus, and Label nodes
        // Only destroy nodes that need refreshing (PlayerName, PlayerChips)
        const children = slotNode.children;
        console.log(`[HAND #${this.handCounter}]    SLOT_CLEANUP before: ${children.length} children:`, children.map(c => c.name).join(', '));

        for (let i = children.length - 1; i >= 0; i--) {
            const child = children[i];
            const keep = (child.name === 'Label' || child.name === 'Overlay' || child.name === 'Cards' || child.name === 'PlayerStatus');

            if (keep) {
                console.log(`[HAND #${this.handCounter}]      KEEP: ${child.name}`);

                // If Cards container exists, clear its children but keep the container
                if (child.name === 'Cards') {
                    const cardsChildCount = child.children.length;
                    if (cardsChildCount > 0) {
                        console.log(`[HAND #${this.handCounter}]        Clearing ${cardsChildCount} cards from Cards container`);
                        child.removeAllChildren();
                    }
                    // Ensure it's active for next hand
                    child.active = true;
                }
            } else {
                console.log(`[HAND #${this.handCounter}]      DESTROY: ${child.name}`);
                child.destroy();
            }
        }

        console.log(`[HAND #${this.handCounter}]    SLOT_CLEANUP after: ${slotNode.children.length} children:`, slotNode.children.map(c => c.name).join(', '));

        // Create player name label
        const nameNode = new Node('PlayerName');
        nameNode.setParent(slotNode);
        nameNode.setPosition(0, -50, 0);

        const nameLabel = nameNode.addComponent(Label);
        nameLabel.string = player.id;
        nameLabel.fontSize = 16;
        nameLabel.color = new Color(255, 255, 255, 255);

        // Store name label reference
        this.playerNameLabels.set(player.id, nameLabel);

        // Create chips label
        const chipsNode = new Node('PlayerChips');
        chipsNode.setParent(slotNode);
        chipsNode.setPosition(0, -70, 0);

        const chipsLabel = chipsNode.addComponent(Label);
        chipsLabel.string = `$${player.chips}`;
        chipsLabel.fontSize = 14;
        chipsLabel.color = new Color(255, 255, 0, 255);

        // Store chip label reference
        this.playerChipLabels.set(player.id, chipsLabel);

        // Create status label (for ALL-IN, ELIMINATED, etc.)
        const statusNode = new Node('PlayerStatus');
        statusNode.setParent(slotNode);
        statusNode.setPosition(0, -90, 0); // Below chips

        const statusLabel = statusNode.addComponent(Label);
        statusLabel.string = '';
        statusLabel.fontSize = 14;
        statusLabel.color = new Color(255, 100, 100, 255); // Reddish for status
        statusLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        statusLabel.enableOutline = true;
        statusLabel.outlineColor = new Color(0, 0, 0, 255);
        statusLabel.outlineWidth = 1;
        statusNode.active = false; // Hidden initially

        // Store status label reference
        this.playerStatusLabels.set(player.id, statusLabel);

        // Create or get Overlay container (always rendered on top)
        let overlayNode = slotNode.getChildByName('Overlay');
        if (!overlayNode) {
            overlayNode = new Node('Overlay');
            overlayNode.setParent(slotNode);
            overlayNode.addComponent(UITransform);
            console.log(`    🎨 Created Overlay container for ${player.id}`);
        }

        // Ensure Overlay is the last child (rendered on top)
        overlayNode.setSiblingIndex(slotNode.children.length - 1);

        // Calculate bet label position based on seat location
        let betLabelX = 0;
        let betLabelY = 40; // Default: above cards

        if (slotPos.y < -100) {
            // Bottom players (slots 0, 1, 7) - place label ABOVE cards
            betLabelY = 120;
        } else if (slotPos.y > 100) {
            // Top players (slots 3, 4, 5) - place label BELOW cards/name/stack
            betLabelY = -120; // Further down to avoid name/stack overlap
        } else {
            // Side players (slots 2, 6) - place label to the side
            if (slotPos.x < 0) {
                // Left side - place to the right
                betLabelX = 120;
                betLabelY = 0;
            } else {
                // Right side - place to the left
                betLabelX = -120;
                betLabelY = 0;
            }
        }

        // Create bet label under Overlay (initially hidden)
        const betNode = new Node('PlayerBet');
        betNode.setParent(overlayNode);
        betNode.setPosition(betLabelX, betLabelY, 0);

        // Add UITransform for proper sizing
        const betTransform = betNode.addComponent(UITransform);
        betTransform.setContentSize(120, 40);

        const betLabel = betNode.addComponent(Label);
        betLabel.string = '';
        betLabel.fontSize = 24;
        betLabel.color = player.id === 'player'
            ? new Color(255, 255, 0, 255)  // Bright yellow for human player
            : new Color(255, 255, 255, 255); // White for AI
        betLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        betLabel.lineHeight = 40;
        // Add outline for better visibility
        betLabel.enableOutline = true;
        betLabel.outlineColor = new Color(0, 0, 0, 255);
        betLabel.outlineWidth = 2;
        betNode.active = false; // Hidden initially

        // Store bet label reference
        this.playerBetLabels.set(player.id, betLabel);

        console.log(`     Bet label created in Overlay for ${player.id} at position (${betLabelX}, ${betLabelY})`);
        console.log(`     Slot ${seatIndex} updated: ${player.id} - $${player.chips}`);
    }

    /**
     * Position dealer button at dealer seat
     */
    private positionDealerButton(dealerIndex: number) {
        if (!this.dealerButtonNode || !this.slotLayoutManager) return;

        // Validate dealer button node is still valid
        if (!this.dealerButtonNode.isValid) {
            console.error(`[HAND #${this.handCounter}]  Dealer button node is invalid, recreating...`);
            this.createDealerButton();
            if (!this.dealerButtonNode) return;
        }

        const dealerSlot = this.slotLayoutManager.getSlot(dealerIndex);
        if (!dealerSlot || !dealerSlot.isValid) {
            console.error(`[HAND #${this.handCounter}]  Dealer slot ${dealerIndex} is invalid!`);
            return;
        }

        // Remove from current parent first to avoid corruption
        if (this.dealerButtonNode.parent) {
            this.dealerButtonNode.removeFromParent();
        }

        // Now safely set new parent
        this.dealerButtonNode.setParent(dealerSlot);
        this.dealerButtonNode.setPosition(50, 50, 0); // Relative to slot

        // CRITICAL: Set sprite to CUSTOM mode and enforce size
        const sprite = this.dealerButtonNode.getComponent(Sprite);
        if (sprite) {
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        }

        const transform = this.dealerButtonNode.getComponent(UITransform);
        if (transform) {
            transform.setContentSize(30, 30);
        }

        this.dealerButtonNode.active = true;
        console.log(`[HAND #${this.handCounter}] 🔘 Dealer button at seat ${dealerIndex}, size 30x30`);
    }

    /**
     * Called when blind is posted
     */
    private onBlindPosted(playerId: string, amount: number, isAnte?: boolean) {
        const type = isAnte ? 'ante' : 'blind';
        console.log(` ${playerId} posted ${type}: $${amount}`);

        // Update player's bet label to show SB/BB label
        if (!this.engine) return;
        const gameState = this.engine.getGameState();
        const player = gameState.players.find(p => p.id === playerId);
        if (player) {
            // Determine if this is SB or BB based on amount
            let blindLabel = '';
            if (amount === this.smallBlind) {
                blindLabel = `SB $${amount}`;
            } else if (amount === this.bigBlind) {
                blindLabel = `BB $${amount}`;
            } else {
                blindLabel = `$${amount}`;
            }

            this.updatePlayerBetLabel(playerId, player.bet, blindLabel);
        }

        // Update pot label
        this.updateAllPotLabels();
    }

    /**
     * Called when cards are dealt to a player
     */
    private onCardsDealt(playerId: string, cards: EngineCard[]) {
        console.log(`[HAND #${this.handCounter}]  CARDS_DEALT pid=${playerId} phase=${this.handPhase}`);
        console.log(`  Cards:`, cards.map(c => `${c.rank}${c.suit}`).join(', '));

        // DEFENSIVE: Ensure we're in dealing phase and slot exists
        if (this.handPhase !== 'dealing') {
            console.warn(`   cards_dealt arrived in wrong phase (${this.handPhase}), rescheduling...`);
            this.scheduleOnce(() => this.onCardsDealt(playerId, cards), 0);
            return;
        }

        const slotNode = this.playerSlots.get(playerId);
        if (!slotNode) {
            console.error(`   No slot node found for ${playerId}`);
            console.log(`  Available slots:`, Array.from(this.playerSlots.keys()));
            console.warn(`   Slot mapping not ready, rescheduling...`);
            this.scheduleOnce(() => this.onCardsDealt(playerId, cards), 0);
            return;
        }

        const slotPos = slotNode.getPosition();
        console.log(`  Slot position: (${slotPos.x.toFixed(0)}, ${slotPos.y.toFixed(0)})`);

        // Find or create card container
        let cardsNode = slotNode.getChildByName('Cards');
        if (!cardsNode) {
            cardsNode = new Node('Cards');
        cardsNode.setParent(slotNode);
        cardsNode.setPosition(0, 20, 0);
            cardsNode.active = true; // Ensure active
            console.log(`[HAND #${this.handCounter}]  CREATED Cards container for ${playerId}`);
        } else {
            // Clear existing cards (but PRESERVE the container)
            console.log(`[HAND #${this.handCounter}]  REUSING Cards container for ${playerId} (active=${cardsNode.active}, children=${cardsNode.children.length})`);
            cardsNode.removeAllChildren();

            // CRITICAL: Re-enable Cards container (may have been hidden when player folded)
            const wasActive = cardsNode.active;
            cardsNode.active = true;
            console.log(`[HAND #${this.handCounter}]   👁️ Cards visibility: ${wasActive ? 'was active' : 'WAS HIDDEN'} → now ACTIVE`);
        }

        // Display both cards
        const isFaceUp = playerId === 'player'; // Only show player's cards face-up
        console.log(`[HAND #${this.handCounter}]   Cards will be ${isFaceUp ? 'FACE-UP' : 'FACE-DOWN'}`);
        console.log(`[HAND #${this.handCounter}]   📊 BEFORE creating - active=${cardsNode.active}, children=${cardsNode.children.length}`);

        cards.forEach((card, index) => {
            const xOffset = index * 35 - 17.5;
            console.log(`[HAND #${this.handCounter}]   Creating card ${index + 1}: ${card.rank}${card.suit} at x=${xOffset}`);
            this.createCard(cardsNode!, card, xOffset, isFaceUp);
        });

        console.log(`[HAND #${this.handCounter}]   📊 AFTER creating - active=${cardsNode.active}, children=${cardsNode.children.length}`);
        console.log(`[HAND #${this.handCounter}]   📊 Slot children: ${slotNode.children.map(c => c.name).join(', ')}`);

        // Ensure Overlay stays as last child (for bet labels to render on top)
        const overlayNode = slotNode.getChildByName('Overlay');
        if (overlayNode) {
            overlayNode.setSiblingIndex(slotNode.children.length - 1);
        }

        // WATCHDOG: Check if cards survive after a delay
        this.scheduleOnce(() => {
            if (cardsNode && cardsNode.isValid) {
                const childCount = cardsNode.children.length;
                console.log(`[HAND #${this.handCounter}] 🔍 WATCHDOG ${playerId}: Cards still has ${childCount} children (expected 2)`);
                if (childCount < 2) {
                    console.error(`[HAND #${this.handCounter}]  CRITICAL: Cards disappeared! ${playerId} cards lost after creation`);
                }
            } else {
                console.error(`[HAND #${this.handCounter}]  CRITICAL: Cards container destroyed! ${playerId}`);
            }
        }, 0.1);

        console.log(`[HAND #${this.handCounter}] === CARDS_DEALT complete for ${playerId} ===`);
    }

    /**
     * Create a card from prefab
     * @param parent Parent node to attach to
     * @param cardData Card data from engine
     * @param xOffset X position offset
     * @param faceUp Whether to show face up or back
     */
    private createCard(parent: Node, cardData: EngineCard, xOffset: number, faceUp: boolean) {
        console.log(`[HAND #${this.handCounter}]  CREATE_CARD: ${cardData.rank}${cardData.suit}, x=${xOffset}, faceUp=${faceUp}`);

        if (!this.cardPrefab) {
            console.error(`[HAND #${this.handCounter}]    Card prefab not assigned! Using fallback.`);
            this.createFallbackCard(parent, cardData, xOffset, faceUp);
            return;
        }

        console.log(`[HAND #${this.handCounter}]   ⚙️ Instantiating card from prefab...`);

        // Instantiate card from prefab
        const cardNode = instantiate(this.cardPrefab);

        // IMPORTANT: Set card size immediately after instantiation
        const cardTransform = cardNode.getComponent(UITransform);
        if (cardTransform) {
            cardTransform.setContentSize(60, 84);
        }

        cardNode.setParent(parent);
        cardNode.setPosition(xOffset, 0, 0);
        cardNode.active = true; // Make sure it's active

        // Get Card component and set data
        const cardComponent = cardNode.getComponent(CardComponent);
        if (cardComponent) {
            const data: CardData = {
                rank: cardData.rank,
                suit: cardData.suit
            };

            console.log(`[HAND #${this.handCounter}]     🔍 CardComponent found, cardSprite: ${cardComponent.cardSprite ? 'EXISTS' : 'NULL'}`);

            // Delay setCard slightly to ensure component is fully initialized
            this.scheduleOnce(() => {
                if (cardNode.isValid && cardComponent) {
                    cardComponent.setCard(data, faceUp);
                    console.log(`[HAND #${this.handCounter}]      Card data set: ${cardData.rank}${cardData.suit}`);
                }
            }, 0);

            console.log(`[HAND #${this.handCounter}]    Card node created (data will be set next frame)`);
        } else {
            console.error(`[HAND #${this.handCounter}]    Card component not found on prefab!`);
            this.createFallbackCard(parent, cardData, xOffset, faceUp);
        }
    }

    /**
     * Create a fallback card if prefab is missing
     */
    private createFallbackCard(parent: Node, cardData: EngineCard, xOffset: number, faceUp: boolean) {
        const cardNode = new Node('CardFallback');
        cardNode.setParent(parent);
        cardNode.setPosition(xOffset, 0, 0);

        // Add transform
        const transform = cardNode.addComponent(UITransform);
        transform.setContentSize(60, 84);

        // Add label showing card
        const label = cardNode.addComponent(Label);
        label.string = faceUp ? `${cardData.rank}${cardData.suit}` : '??';
        label.fontSize = 16;
        label.color = new Color(255, 255, 255, 255);

        console.log(`  ├─ Fallback card: ${faceUp ? cardData.rank + cardData.suit : 'face-down'}`);
    }

    /**
     * Called when street changes (flop, turn, river)
     */
    private onStreetChanged(street: string, communityCards: EngineCard[]) {
        console.log(` Street: ${street.toUpperCase()} - Betting round ended, moving bets to pot`);

        // Finalize betting round: move outstanding bets to pot
        this.finalizeBettingRound();

        // Clear bet labels for new round
        this.clearAllBetLabels();

        if (this.statusLabel) {
            this.statusLabel.string = street.toUpperCase();
        }

        this.displayCommunityCards(communityCards);
    }

    /**
     * Display community cards
     */
    private displayCommunityCards(cards: EngineCard[]) {
        if (!this.communityCardsNode) return;

        // Clear existing cards
        this.communityCardsNode.removeAllChildren();

        console.log(` Community Cards (${cards.length}):`, cards);

        // Display each community card (all face-up)
        // Cards are 60px wide, so use 70px spacing for 10px gap between cards
        const cardSpacing = 70;
        const startOffset = -((cards.length - 1) * cardSpacing) / 2; // Center the cards

        cards.forEach((card, index) => {
            const xPos = startOffset + (index * cardSpacing);
            this.createCard(this.communityCardsNode!, card, xPos, true);
        });
    }

    /**
     * Called when a player takes an action
     */
    private onPlayerAction(playerId: string, action: any) {
        const actionText = `${playerId} ${action.type}${action.amount ? ` $${action.amount}` : ''}`;
        console.log(` ${actionText}`);

        if (this.statusLabel) {
            this.statusLabel.string = actionText;
        }

        // Update bet label for this player
        if (!this.engine) return;
        const gameState = this.engine.getGameState();
        const player = gameState.players.find(p => p.id === playerId);

        if (player) {
            // Check if player went all-in
            if (player.allIn) {
                this.updatePlayerStatus(playerId, 'ALL-IN', true);
                console.log(`🔴 ${playerId} is ALL-IN!`);
            }

            if (action.type === 'fold') {
                // Show "Fold" text
                this.updatePlayerBetLabel(playerId, 0, 'Fold');

                // Hide player's cards
                this.hidePlayerCards(playerId);

                // Play fold sound
                if (this.audioManager) this.audioManager.playFoldSound();
            } else if (action.type === 'check') {
                // Show "Check" text
                this.updatePlayerBetLabel(playerId, 0, 'Check');

                // Play check sound
                if (this.audioManager) this.audioManager.playCheckSound();
            } else if (action.type === 'bet' || action.type === 'call' || action.type === 'raise' || action.type === 'allin') {
                // Update bet label to show current bet amount (bet, call, raise, all-in)
                this.updatePlayerBetLabel(playerId, player.bet);

                // Play bet chips sound for betting actions
                console.log(`🎲 Action type: ${action.type} - attempting to play bet sound`);
                if (this.audioManager) this.audioManager.playBetSound();
            } else {
                // Unknown action type - log it
                console.warn(` Unknown action type: ${action.type}`);
                this.updatePlayerBetLabel(playerId, player.bet);
            }
        }

        // Update all chip labels (chips decrease when betting)
        this.updateAllChipLabels();

        // Update pot label
        this.updateAllPotLabels();
    }

    /**
     * Called when pot is updated (from engine)
     */
    private onPotUpdated(amount: number) {
        console.log(` Pot updated by engine: $${amount}`);

        // Just update the labels - engine already updated the pot
        this.updateAllPotLabels();
    }

    /**
     * Setup button click handlers
     */
    private setupButtonHandlers() {
        if (this.leftButton) {
            const button = this.leftButton.getComponent(Button);
            if (button) {
                button.node.on(Button.EventType.CLICK, this.onLeftButtonClick, this);
            }
        }

        if (this.middleButton) {
            const button = this.middleButton.getComponent(Button);
            if (button) {
                button.node.on(Button.EventType.CLICK, this.onMiddleButtonClick, this);
            }
        }

        if (this.rightButton) {
            const button = this.rightButton.getComponent(Button);
            if (button) {
                button.node.on(Button.EventType.CLICK, this.onRightButtonClick, this);
            }
        }

        if (this.newGameButton) {
            const button = this.newGameButton.getComponent(Button);
            if (button) {
                button.node.on(Button.EventType.CLICK, this.onNewGameButtonClick, this);
            }
        }

        console.log(' Button handlers set up');
    }

    /**
     * Hide all action buttons
     */
    private hideActionButtons() {
        console.log(' Hiding action buttons');
        if (this.leftButton) this.leftButton.active = false;
        if (this.middleButton) this.middleButton.active = false;
        if (this.rightButton) this.rightButton.active = false;
        if (this.betInput) this.betInput.node.active = false;
    }

    /**
     * Show action buttons
     */
    private showActionButtons() {
        console.log('👀 Showing action buttons');
        if (this.leftButton) {
            this.leftButton.active = true;
            console.log('   Left button visible');
        }
        if (this.middleButton) {
            this.middleButton.active = true;
            console.log('   Middle button visible');
        }
        if (this.rightButton) {
            this.rightButton.active = true;
            console.log('   Right button visible');
        }
    }

    /**
     * Hide New Game button
     */
    private hideNewGameButton() {
        if (this.newGameButton) {
            this.newGameButton.active = false;
        }
    }

    /**
     * Show New Game button
     */
    private showNewGameButton() {
        console.log(' Showing New Game button');
        if (this.newGameButton) {
            this.newGameButton.active = true;
        }
    }

    /**
     * Update button labels based on valid actions
     */
    private updateButtonLabels(validActions: string[]) {
        const hasCheck = validActions.indexOf('check') !== -1;
        const hasCall = validActions.indexOf('call') !== -1;
        const hasBet = validActions.indexOf('bet') !== -1;
        const hasRaise = validActions.indexOf('raise') !== -1;

        // Left Button: Check or Call
        if (this.leftButton) {
            const label = this.leftButton.getComponentInChildren(Label);
            if (label) {
                label.string = hasCheck ? 'Check' : 'Call';
            }
        }

        // Middle Button: Bet or Raise
        if (this.middleButton) {
            const label = this.middleButton.getComponentInChildren(Label);
            if (label) {
                label.string = hasBet ? 'Bet' : 'Raise';
            }
        }

        // Right Button: Always Fold
        if (this.rightButton) {
            const label = this.rightButton.getComponentInChildren(Label);
            if (label) {
                label.string = 'Fold';
            }
        }

        // Show/Hide bet input based on whether Bet or Raise is available
        if (this.betInput) {
            this.betInput.node.active = hasBet || hasRaise;
        }

        console.log(`🔘 Buttons updated: ${hasCheck ? 'Check' : 'Call'} / ${hasBet ? 'Bet' : 'Raise'} / Fold`);
    }

    /**
     * Get the bet amount from the input field
     */
    private getBetAmount(): number {
        if (!this.betInput || !this.betInput.string) {
            return this.bigBlind; // Default to big blind
        }

        const amount = parseInt(this.betInput.string);
        return isNaN(amount) ? this.bigBlind : amount;
    }

    /**
     * Left button click handler (Check or Call)
     */
    private onLeftButtonClick() {
        if (!this.engine) return;

        const label = this.leftButton?.getComponentInChildren(Label);
        if (!label) return;

        const action = label.string.toLowerCase(); // 'check' or 'call'
        console.log(` Player clicked: ${action}`);

        this.engine.processAction('player', { type: action as any });
        this.hideActionButtons();

        // Continue game to next player
        this.scheduleOnce(() => this.advanceGame(), 0.5);
    }

    /**
     * Middle button click handler (Bet or Raise)
     */
    private onMiddleButtonClick() {
        if (!this.engine) return;

        const label = this.middleButton?.getComponentInChildren(Label);
        if (!label) return;

        const action = label.string.toLowerCase(); // 'bet' or 'raise'
        const amount = this.getBetAmount();

        console.log(` Player clicked: ${action} $${amount}`);

        this.engine.processAction('player', { type: action as any, amount });
        this.hideActionButtons();

        // Continue game to next player
        this.scheduleOnce(() => this.advanceGame(), 0.5);
    }

    /**
     * Right button click handler (Fold)
     */
    private onRightButtonClick() {
        if (!this.engine) return;

        console.log(' Player clicked: fold');

        this.engine.processAction('player', { type: 'fold' });
        this.hideActionButtons();

        // Continue game to next player
        this.scheduleOnce(() => this.advanceGame(), 0.5);
    }

    /**
     * New Game button click handler
     */
    private onNewGameButtonClick() {
        console.log(' Player clicked: New Game');

        // Hide the new game button
        this.hideNewGameButton();

        // Reset eliminated players
        this.eliminatedPlayers.clear();

        // Reinitialize the engine with fresh chip stacks
        this.initializeEngine();

        // Clear all player slots
        this.playerSlots.clear();
        this.playerBetLabels.clear();
        this.playerNameLabels.clear();
        this.playerChipLabels.clear();
        this.playerStatusLabels.clear();

        // Reset hand counter
        this.handCounter = 0;
        this.handPhase = 'idle';

        // Clear community cards
        if (this.communityCardsNode) {
            this.communityCardsNode.removeAllChildren();
        }

        // Clear all player slots from UI
        if (this.slotLayoutManager) {
            const slots = this.slotLayoutManager.getAllSlots();
            slots.forEach(slot => {
                // Clear all children except the slot marker itself
                const children = slot.children.slice(); // Copy array
                children.forEach(child => child.destroy());
            });
        }

        // Update status
        if (this.statusLabel) {
            this.statusLabel.string = 'New Game Starting...';
        }

        // Start first hand after a brief delay
        this.scheduleOnce(() => {
            this.startFirstHand();
        }, 0.5);
    }

    /**
     * Called when action is required from a player
     */
    private onActionRequired(playerId: string, validActions: string[]) {
        console.log('');
        console.log('=== ⏳ ACTION REQUIRED ===');
        console.log(`  Player: ${playerId}`);
        console.log(`  Valid Actions:`, validActions);
        console.log(`  Is Human Player: ${playerId === 'player'}`);

        if (playerId === 'player') {
            // Human player's turn - show buttons
            console.log('  🎮 This is the HUMAN player - showing buttons!');
            this.updateButtonLabels(validActions);
            this.showActionButtons();

            if (this.statusLabel) {
                this.statusLabel.string = 'Your turn!';
            }
        } else {
            // AI player's turn - hide buttons and let AI decide
            console.log(`   This is an AI player - hiding buttons`);
            this.hideActionButtons();

            if (this.statusLabel) {
                this.statusLabel.string = `${playerId} is thinking...`;
            }

            // AI will automatically process its action via the engine
            // The engine's internal logic will handle AI decision-making
        }
        console.log('=== END ACTION REQUIRED ===');
        console.log('');
    }

    /**
     * Called when hand ends
     */
    private onHandEnded(result: any) {
        console.log('');
        console.log(`[HAND #${this.handCounter}]  HAND_ENDED - Phase: ${this.handPhase}`);
        console.log(`[HAND #${this.handCounter}] Result:`, result);

        this.handPhase = 'showdown';

        this.hideActionButtons(); // Make sure buttons are hidden

        // Clear all bet labels
        this.clearAllBetLabels();

        // Update all chip labels to show final chip counts
        this.updateAllChipLabels();

        // Check for eliminated players (0 chips)
        this.checkForEliminatedPlayers();

        // Flip all AI cards face-up for showdown
        this.revealAllCardsAtShowdown();

        // Display showdown results with detailed information
        if (this.statusLabel) {
            const winners = result.winners.join(', ');
            const potAmount = result.potAmount || 0;

            // Build a detailed status message
            let statusMsg = `🏆 ${winners} wins $${potAmount}!`;

            // Only show hand info if there was a showdown (not a fold win)
            if (result.winningHand) {
                statusMsg += `\nWinning Hand: ${result.winningHand}`;

                // If there's player hand info, show it
                if (result.playerHand) {
                    statusMsg += `\nYour Hand: ${result.playerHand}`;
                }
            } else {
                // Win by fold - no showdown occurred
                statusMsg += '\n(Everyone else folded)';
            }

            this.statusLabel.string = statusMsg;
            console.log('📊 Hand Result:', statusMsg);
        }

        // Schedule next hand with 5-second delay for user to see results
        this.scheduleOnce(() => {
            // Don't start next hand if human player is eliminated
            if (this.eliminatedPlayers.has('player')) {
                console.log(' Player eliminated - not starting next hand');
                return;
            }

            if (this.engine && !this.engine.isHandInProgress()) {
                console.log(' Starting next hand...');
                this.engine.startNewHand();

                // Restart the auto-advance loop for new hand
                this.scheduleOnce(() => {
                    this.advanceGame();
                }, 0.5);
            }
        }, 5); // 5 second delay for showdown review
    }

    /**
     * Reveal all players' cards at showdown
     */
    private revealAllCardsAtShowdown() {
        if (!this.engine || !this.slotLayoutManager) return;

        const gameState = this.engine.getGameState();
        const players = gameState.players;

        players.forEach((player: any, index: number) => {
            // Skip folded players - they shouldn't reveal their cards
            if (!player.cards || player.cards.length === 0 || player.folded) {
                return;
            }

            const slot = this.slotLayoutManager!.getSlot(index);
            if (!slot) return;

            // Find the Cards container
            const cardsContainer = slot.getChildByName('Cards');
            if (!cardsContainer) return;

            // Ensure cards are visible
            cardsContainer.active = true;

            console.log(`🃏 Revealing cards for ${player.id} at showdown`);

            // Flip each card face-up
            player.cards.forEach((cardData: any, cardIndex: number) => {
                const cardNode = cardsContainer.children[cardIndex];
                if (cardNode) {
                    const cardComponent = cardNode.getComponent(CardComponent);
                    if (cardComponent) {
                        // Re-set the card with faceUp = true
                        cardComponent.setCard(cardData, true);
                    }
                }
            });
        });
    }
}
