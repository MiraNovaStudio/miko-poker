/**
 * GameTable - Main integration component connecting the poker engine to Cocos UI
 * Manages an 8-max cash game with card dealing, chip display, and player actions
 */

import { _decorator, Component, Node, Label, Sprite, SpriteFrame, Vec3, UITransform, Color, resources, Prefab, instantiate } from 'cc';
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
    statusLabel: Label | null = null;

    @property(Node)
    communityCardsNode: Node | null = null;

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
    private dealerButtonNode: Node | null = null;

    start() {
        console.log('=== GameTable.start() ===');
        console.log('SlotLayoutManager:', this.slotLayoutManager ? '✅ Assigned' : '❌ Missing');
        console.log('Card Prefab:', this.cardPrefab ? '✅ Assigned' : '❌ Missing');
        console.log('Pot Label:', this.potLabel ? '✅ Assigned' : '❌ Missing');
        console.log('Status Label:', this.statusLabel ? '✅ Assigned' : '❌ Missing');
        console.log('Community Cards Node:', this.communityCardsNode ? '✅ Assigned' : '❌ Missing');
        
        this.initializeEngine();
        this.createDealerButton();
        
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

        // Add sprite
        const sprite = this.dealerButtonNode.addComponent(Sprite);
        
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
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            console.log('✅ Dealer button loaded and sized to 30x30');
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

        // Clear existing content (except debug label)
        const children = slotNode.children;
        for (let i = children.length - 1; i >= 0; i--) {
            const child = children[i];
            if (child.name !== 'Label') { // Don't remove debug label
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

        // Create chips label
        const chipsNode = new Node('PlayerChips');
        chipsNode.setParent(slotNode);
        chipsNode.setPosition(0, -70, 0);

        const chipsLabel = chipsNode.addComponent(Label);
        chipsLabel.string = `$${player.chips}`;
        chipsLabel.fontSize = 14;
        chipsLabel.color = new Color(255, 255, 0, 255);

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
            
            // Ensure size is correct
            const transform = this.dealerButtonNode.getComponent(UITransform);
            if (transform) {
                transform.setContentSize(30, 30);
            }
            
            // Fallback: Apply scale if sizing doesn't work
            // this.dealerButtonNode.setScale(0.15, 0.15, 1);
            
            this.dealerButtonNode.active = true;
            console.log(`🔘 Dealer button at seat ${dealerIndex}, size 30x30`);
        }
    }

    /**
     * Called when blind is posted
     */
    private onBlindPosted(playerId: string, amount: number, isAnte?: boolean) {
        const type = isAnte ? 'ante' : 'blind';
        console.log(`💰 ${playerId} posted ${type}: $${amount}`);
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
        
        // Fallback: Apply scale if sizing doesn't work
        // cardNode.setScale(0.3, 0.3, 1);
        
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
        console.log(`🎴 Street: ${street.toUpperCase()}`);
        
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
    }

    /**
     * Called when pot is updated
     */
    private onPotUpdated(amount: number) {
        if (this.potLabel) {
            this.potLabel.string = `Pot: $${amount}`;
        }
    }

    /**
     * Called when action is required from human player
     */
    private onActionRequired() {
        console.log('⏳ Action required from player');
        // TODO: Enable action buttons
    }

    /**
     * Called when hand ends
     */
    private onHandEnded(result: any) {
        console.log('🏁 Hand Ended:', result);

        if (this.statusLabel) {
            const winners = result.winners.join(', ');
            this.statusLabel.string = `${winners} wins $${result.potAmount}!`;
        }

        // Schedule next hand
        this.scheduleOnce(() => {
            if (this.engine && !this.engine.isHandInProgress()) {
                console.log('🎴 Starting next hand...');
                this.engine.startNewHand();
            }
        }, 3);
    }
}
