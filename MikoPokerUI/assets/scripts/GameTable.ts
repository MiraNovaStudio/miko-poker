/**
 * GameTable - Main integration component connecting the poker engine to Cocos UI
 * Manages an 8-max cash game with card dealing, chip display, and player actions
 */

import { _decorator, Component, Node, Label, Sprite, SpriteFrame, Vec3, UITransform, Color, resources, Prefab, instantiate, Button, EditBox } from 'cc';
import { SlotLayoutManager } from './SlotLayoutManager';
import { Card as CardComponent, type CardData } from './Card';

// Import poker engine (directly from compiled files to avoid module resolution issues)
import { PokerGameEngine } from '../../../engine/dist/game-engine.js';
import type { GameEvent, Card as EngineCard, PlayerState } from '../../../engine/dist/game-engine.js';

const { ccclass, property } = _decorator;

@ccclass('GameTable')
export class GameTable extends Component {
    // === Scene References ===
    
    @property(SlotLayoutManager)
    slotLayoutManager: SlotLayoutManager | null = null;

    @property(Label)
    potLabel: Label | null = null;

    @property(Label)
    totalLabel: Label | null = null;

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
    private dealerButtonNode: Node | null = null;
    private currentActivePlayer: string | null = null; // Track whose turn it is

    start() {
        console.log('=== GameTable.start() ===');
        console.log('SlotLayoutManager:', this.slotLayoutManager ? '✅ Assigned' : '❌ Missing');
        console.log('Card Prefab:', this.cardPrefab ? '✅ Assigned' : '❌ Missing');
        console.log('Pot Label:', this.potLabel ? '✅ Assigned' : '❌ Missing');
        console.log('Total Label:', this.totalLabel ? '✅ Assigned' : '❌ Missing');
        console.log('Status Label:', this.statusLabel ? '✅ Assigned' : '❌ Missing');
        console.log('Community Cards Node:', this.communityCardsNode ? '✅ Assigned' : '❌ Missing');
        console.log('Left Button:', this.leftButton ? '✅ Assigned' : '❌ Missing');
        console.log('Middle Button:', this.middleButton ? '✅ Assigned' : '❌ Missing');
        console.log('Right Button:', this.rightButton ? '✅ Assigned' : '❌ Missing');
        console.log('Bet Input:', this.betInput ? '✅ Assigned' : '❌ Missing');
        
        this.initializeEngine();
        this.createDealerButton();
        this.setupButtonHandlers();
        this.hideActionButtons(); // Hide until player's turn
        
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
            console.error('❌ SlotLayoutManager is null!');
            return;
        }

        const slots = this.slotLayoutManager.getAllSlots();
        console.log(`📍 Total slots created: ${slots.length}`);
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

        console.log('✅ Engine initialized with 8 players');
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
            console.log('✅ Dealer button loaded and sized to 30x30 (CUSTOM mode)');
        });
        
        this.dealerButtonNode.active = false; // Hide until we position it
    }

    /**
     * Start the first hand
     */
    private startFirstHand() {
        if (this.engine) {
            console.log('🎴 Starting first hand...');
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
        if (!this.engine || !this.engine.isHandInProgress()) {
            console.log('⏸️ No hand in progress, stopping auto-advance');
            return;
        }

        const gameState = this.engine.getGameState();
        const currentPlayer = gameState.players[gameState.currentPlayerIndex];
        
        if (!currentPlayer) {
            console.error('❌ No current player found!');
            return;
        }

        console.log(`\n⏳ Current turn: ${currentPlayer.id} (index ${gameState.currentPlayerIndex})`);

        // Check if current player has already folded or is all-in
        if (currentPlayer.folded || currentPlayer.isAllIn) {
            console.log(`  ⏭️ Player ${currentPlayer.id} can't act (folded: ${currentPlayer.folded}, all-in: ${currentPlayer.isAllIn})`);
            // This shouldn't happen as the engine should skip them, but just in case
            this.scheduleOnce(() => this.advanceGame(), 0.1);
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
            console.log(`  🤖 AI player ${currentPlayer.id} is deciding...`);
            
            if (this.statusLabel) {
                this.statusLabel.string = `${currentPlayer.id} is thinking...`;
            }

            // Get AI decision and process it
            this.scheduleOnce(() => {
                try {
                    const action = this.engine!.getAIAction(currentPlayer.id);
                    console.log(`  🎯 AI ${currentPlayer.id} chose:`, action);
                    this.engine!.processAction(currentPlayer.id, action);
                    
                    // Continue to next player
                    this.scheduleOnce(() => this.advanceGame(), 0.5);
                } catch (error) {
                    console.error(`❌ Error processing AI action:`, error);
                }
            }, 2.0); // 2 second delay to simulate thinking
        }
    }

    /**
     * Handle all game events from the engine
     */
    private handleGameEvent(event: GameEvent) {
        console.log('📢 Game Event:', event.type);

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

            case 'action_required':
                this.onActionRequired(event.playerId, event.validActions);
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
        console.log('=== 🎴 HAND STARTED ===');
        
        if (!this.engine) {
            console.error('❌ Engine is null!');
            return;
        }
        
        if (!this.slotLayoutManager) {
            console.error('❌ SlotLayoutManager is null!');
            return;
        }

        const gameState = this.engine.getGameState();
        console.log(`Players: ${gameState.players.length}, Dealer: ${gameState.dealerIndex}`);
        
        // Reset player highlighting
        if (this.currentActivePlayer) {
            this.unhighlightPlayer(this.currentActivePlayer);
            this.currentActivePlayer = null;
        }
        
        // Initialize pot and total labels
        this.initializeLabels();
        
        // Update all player slots
        gameState.players.forEach((player, index) => {
            console.log(`Updating slot ${index} for player ${player.id}`);
            this.updatePlayerSlot(player, index);
        });

        // Position dealer button
        this.positionDealerButton(gameState.dealerIndex);

        // Update status
        if (this.statusLabel) {
            this.statusLabel.string = 'New Hand - Dealing Cards...';
        }
        
        console.log('=== Hand Started Complete ===');
    }

    /**
     * Initialize pot and total labels at start of hand
     */
    private initializeLabels() {
        if (this.potLabel) {
            this.potLabel.string = 'Pot: $0';
        }
        if (this.totalLabel) {
            this.totalLabel.string = 'Total: $0';
        }
        
        // Clear all bet labels
        this.playerBetLabels.forEach((label, playerId) => {
            label.string = '';
            label.node.active = false;
        });
        
        console.log('💰 Labels initialized: Pot and Total set to $0, all bet labels cleared');
    }

    /**
     * Update ONLY the pot label (called when betting round closes)
     */
    private updatePotLabel() {
        if (!this.engine) return;

        const gameState = this.engine.getGameState();
        const pot = gameState.pot;

        if (this.potLabel) {
            this.potLabel.string = `Pot: $${pot}`;
        }

        console.log(`💰 Pot updated: $${pot}`);
    }

    /**
     * Update ONLY the total label (pot + outstanding bets)
     */
    private updateTotalLabel() {
        if (!this.engine) return;

        const gameState = this.engine.getGameState();
        const pot = gameState.pot;

        // Calculate total outstanding bets from current betting round
        let outstandingBets = 0;
        gameState.players.forEach(player => {
            if (!player.folded && player.bet > 0) {
                outstandingBets += player.bet;
            }
        });

        const total = pot + outstandingBets;

        if (this.totalLabel) {
            this.totalLabel.string = `Total: $${total}`;
        }

        console.log(`💰 Total updated: Pot=$${pot} + Outstanding=$${outstandingBets} = Total=$${total}`);
    }

    /**
     * Update a player's bet label
     */
    private updatePlayerBetLabel(playerId: string, amount: number) {
        const betLabel = this.playerBetLabels.get(playerId);
        if (!betLabel) {
            console.error(`  ❌ No bet label found for ${playerId}`);
            console.log(`  Available bet labels:`, Array.from(this.playerBetLabels.keys()));
            return;
        }
        
        if (amount > 0) {
            betLabel.string = `$${amount}`;
            betLabel.node.active = true;
            const nodePos = betLabel.node.getPosition();
            const worldPos = betLabel.node.getWorldPosition();
            console.log(`  💵 ${playerId} bet label SET: "$${amount}"`);
            console.log(`      Node active: ${betLabel.node.active}, parent: ${betLabel.node.parent?.name}`);
            console.log(`      Position: (${nodePos.x.toFixed(0)}, ${nodePos.y.toFixed(0)}), World: (${worldPos.x.toFixed(0)}, ${worldPos.y.toFixed(0)})`);
        } else {
            betLabel.string = '';
            betLabel.node.active = false;
            console.log(`  💵 ${playerId} bet label HIDDEN`);
        }
    }

    /**
     * Clear all player bet labels (called at end of betting round)
     */
    private clearAllBetLabels() {
        console.log('🧹 Clearing all bet labels');
        this.playerBetLabels.forEach((label, playerId) => {
            label.string = '';
            label.node.active = false;
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
        console.log(`👤 Highlighted ${playerId}`);
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
            console.error(`❌ SlotLayoutManager is null when updating seat ${seatIndex}`);
            return;
        }

        const slotNode = this.slotLayoutManager.getSlot(seatIndex);
        if (!slotNode) {
            console.error(`❌ Could not get slot node for seat ${seatIndex}`);
            return;
        }

        console.log(`  ⚙️ Updating slot ${seatIndex} for ${player.id}`);
        const slotPos = slotNode.getPosition();
        console.log(`    Slot position: (${slotPos.x.toFixed(0)}, ${slotPos.y.toFixed(0)})`);

        // Store mapping
        this.playerSlots.set(player.id, slotNode);

        // Clear existing content (except debug label and Overlay)
        const children = slotNode.children;
        for (let i = children.length - 1; i >= 0; i--) {
            const child = children[i];
            if (child.name !== 'Label' && child.name !== 'Overlay') { // Keep debug label and Overlay
                child.destroy();
            }
        }

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
            betLabelY = 40;
        } else if (slotPos.y > 100) {
            // Top players (slots 3, 4, 5) - place label BELOW cards
            betLabelY = -40;
        } else {
            // Side players (slots 2, 6) - place label to the side
            if (slotPos.x < 0) {
                // Left side - place to the right
                betLabelX = 80;
                betLabelY = 0;
            } else {
                // Right side - place to the left
                betLabelX = -80;
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

        console.log(`    📝 Bet label created in Overlay for ${player.id} at position (${betLabelX}, ${betLabelY})`);
        console.log(`    ✅ Slot ${seatIndex} updated: ${player.id} - $${player.chips}`);
    }

    /**
     * Position dealer button at dealer seat
     */
    private positionDealerButton(dealerIndex: number) {
        if (!this.dealerButtonNode || !this.slotLayoutManager) return;

        const dealerSlot = this.slotLayoutManager.getSlot(dealerIndex);
        if (dealerSlot) {
            // Re-parent dealer button to the dealer's slot for consistent positioning
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
            console.log(`🔘 Dealer button at seat ${dealerIndex}, size 30x30 (CUSTOM mode enforced)`);
        }
    }

    /**
     * Called when blind is posted
     */
    private onBlindPosted(playerId: string, amount: number, isAnte?: boolean) {
        const type = isAnte ? 'ante' : 'blind';
        console.log(`💰 ${playerId} posted ${type}: $${amount}`);
        
        // Update player's bet label to show blind
        if (!this.engine) return;
        const gameState = this.engine.getGameState();
        const player = gameState.players.find(p => p.id === playerId);
        if (player) {
            this.updatePlayerBetLabel(playerId, player.bet);
        }
        
        // Update total label (blinds are outstanding bets)
        this.updateTotalLabel();
    }

    /**
     * Called when cards are dealt to a player
     */
    private onCardsDealt(playerId: string, cards: EngineCard[]) {
        console.log(`=== 🎴 CARDS DEALT to ${playerId} ===`);
        console.log(`  Cards:`, cards.map(c => `${c.rank}${c.suit}`).join(', '));

        const slotNode = this.playerSlots.get(playerId);
        if (!slotNode) {
            console.error(`  ❌ No slot node found for ${playerId}`);
            console.log(`  Available slots:`, Array.from(this.playerSlots.keys()));
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
            console.log(`  ✅ Created Cards container at (0, 20) relative to slot`);
        } else {
            // Clear existing cards
            cardsNode.removeAllChildren();
            console.log(`  ♻️ Cleared existing cards`);
        }

        // Display both cards
        const isFaceUp = playerId === 'player'; // Only show player's cards face-up
        console.log(`  Cards will be ${isFaceUp ? 'FACE-UP' : 'FACE-DOWN'}`);
        
        cards.forEach((card, index) => {
            const xOffset = index * 35 - 17.5;
            console.log(`  Creating card ${index + 1}: ${card.rank}${card.suit} at x=${xOffset}`);
            this.createCard(cardsNode!, card, xOffset, isFaceUp);
        });
        
        console.log(`=== Cards dealt complete for ${playerId} ===`);
    }

    /**
     * Create a card from prefab
     * @param parent Parent node to attach to
     * @param cardData Card data from engine
     * @param xOffset X position offset
     * @param faceUp Whether to show face up or back
     */
    private createCard(parent: Node, cardData: EngineCard, xOffset: number, faceUp: boolean) {
        console.log(`    🎴 createCard called: ${cardData.rank}${cardData.suit}, x=${xOffset}, faceUp=${faceUp}`);
        
        if (!this.cardPrefab) {
            console.error('    ❌ Card prefab not assigned! Using fallback.');
            this.createFallbackCard(parent, cardData, xOffset, faceUp);
            return;
        }

        console.log('    ⚙️ Instantiating card from prefab...');
        
        // Instantiate card from prefab
        const cardNode = instantiate(this.cardPrefab);
        
        // IMPORTANT: Set card size immediately after instantiation
        const cardTransform = cardNode.getComponent(UITransform);
        if (cardTransform) {
            cardTransform.setContentSize(60, 84);
            console.log('    📏 Card size set to 60x84');
        }
        
        // Don't scale the card node - let the Card component handle sprite sizing
        
        cardNode.setParent(parent);
        cardNode.setPosition(xOffset, 0, 0);
        cardNode.active = true; // Make sure it's active
        
        const worldPos = cardNode.getWorldPosition();
        console.log(`    Card world position: (${worldPos.x.toFixed(0)}, ${worldPos.y.toFixed(0)}, ${worldPos.z.toFixed(0)})`);

        // Get Card component and set data
        const cardComponent = cardNode.getComponent(CardComponent);
        if (cardComponent) {
            const data: CardData = {
                rank: cardData.rank,
                suit: cardData.suit
            };
            console.log('    ⚙️ Setting card data...');
            cardComponent.setCard(data, faceUp);
            console.log(`    ✅ Card created: ${cardData.rank}${cardData.suit} (${faceUp ? 'face-up' : 'face-down'})`);
        } else {
            console.error('    ❌ Card component not found on prefab!');
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
        console.log(`🎴 Street: ${street.toUpperCase()} - Betting round ended, moving bets to pot`);
        
        // Update pot (betting round ended, bets moved to pot)
        this.updatePotLabel();
        
        // Clear bet labels for new round
        this.clearAllBetLabels();
        
        // Update total (should equal pot now since no outstanding bets)
        this.updateTotalLabel();
        
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

        console.log(`🎴 Community Cards (${cards.length}):`, cards);

        // Display each community card (all face-up)
        cards.forEach((card, index) => {
            this.createCard(this.communityCardsNode!, card, index * 40 - 80, true);
        });
    }

    /**
     * Called when a player takes an action
     */
    private onPlayerAction(playerId: string, action: any) {
        const actionText = `${playerId} ${action.type}${action.amount ? ` $${action.amount}` : ''}`;
        console.log(`🎯 ${actionText}`);

        if (this.statusLabel) {
            this.statusLabel.string = actionText;
        }

        // Update bet label for this player
        if (!this.engine) return;
        const gameState = this.engine.getGameState();
        const player = gameState.players.find(p => p.id === playerId);
        
        if (player) {
            if (action.type === 'fold') {
                // Hide bet label for folded players
                this.updatePlayerBetLabel(playerId, 0);
            } else {
                // Update bet label to show current bet this round
                this.updatePlayerBetLabel(playerId, player.bet);
            }
        }
        
        // Update all chip labels (chips decrease when betting)
        this.updateAllChipLabels();
        
        // Update total label only (pot doesn't change until round ends)
        this.updateTotalLabel();
    }

    /**
     * Called when pot is updated (from engine)
     */
    private onPotUpdated(amount: number) {
        // Update pot label (pot changed from engine)
        this.updatePotLabel();
        
        // Update total label (pot changed, so total changes too)
        this.updateTotalLabel();
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

        console.log('✅ Button handlers set up');
    }

    /**
     * Hide all action buttons
     */
    private hideActionButtons() {
        console.log('🙈 Hiding action buttons');
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
            console.log('  ✅ Left button visible');
        }
        if (this.middleButton) {
            this.middleButton.active = true;
            console.log('  ✅ Middle button visible');
        }
        if (this.rightButton) {
            this.rightButton.active = true;
            console.log('  ✅ Right button visible');
        }
    }

    /**
     * Update button labels based on valid actions
     */
    private updateButtonLabels(validActions: string[]) {
        const hasCheck = validActions.includes('check');
        const hasCall = validActions.includes('call');
        const hasBet = validActions.includes('bet');
        const hasRaise = validActions.includes('raise');

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
        console.log(`🎯 Player clicked: ${action}`);

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

        console.log(`🎯 Player clicked: ${action} $${amount}`);

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

        console.log('🎯 Player clicked: fold');

        this.engine.processAction('player', { type: 'fold' });
        this.hideActionButtons();
        
        // Continue game to next player
        this.scheduleOnce(() => this.advanceGame(), 0.5);
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
            console.log(`  🤖 This is an AI player - hiding buttons`);
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
        console.log('🏁 Hand Ended:', result);
        
        this.hideActionButtons(); // Make sure buttons are hidden
        
        // Clear all bet labels
        this.clearAllBetLabels();
        
        // Update all chip labels to show final chip counts
        this.updateAllChipLabels();

        if (this.statusLabel) {
            const winners = result.winners.join(', ');
            this.statusLabel.string = `${winners} wins $${result.potAmount}!`;
        }

        // Schedule next hand
        this.scheduleOnce(() => {
            if (this.engine && !this.engine.isHandInProgress()) {
                console.log('🎴 Starting next hand...');
                this.engine.startNewHand();
                
                // Restart the auto-advance loop for new hand
                this.scheduleOnce(() => {
                    this.advanceGame();
                }, 0.5);
            }
        }, 3);
    }
}
